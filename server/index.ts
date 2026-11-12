import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { appConfig, publicAIConfig, resolveAuth } from './config.js';
import { runGeneration } from './generateStream.js';
import { chooseSlideCount } from './prompt.js';
import {
  type ThemeId,
  MAX_SOURCE_LENGTH,
  MIN_SOURCE_LENGTH,
  isThemeId,
} from '../shared/schema.js';

const app = express();
const distDir = path.resolve(process.cwd(), 'dist');
const hasBuild = fs.existsSync(path.join(distDir, 'index.html'));

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

/**
 * 公开演示环境的简易限流：每个 IP 每小时最多 N 次生成，
 * 同时全局最多 2 个并发生成，避免一条公开链接被脚本刷爆模型额度。
 */
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 10);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_GENERATIONS || 2);
const MAX_SLIDES = Number(process.env.MAX_SLIDES || 14);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
let activeGenerations = 0;

function clientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw || '').split(',')[0].trim() || req.ip || 'unknown';
}

app.use('/api/generate', (req, res, next) => {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [key, bucket] of rateBuckets) {
      if (bucket.resetAt < now) rateBuckets.delete(key);
    }
  }
  const ip = clientIp(req);
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  if (bucket.count >= RATE_LIMIT) {
    res.status(429).json({
      error: 'rate_limited',
      message: `演示环境每小时最多生成 ${RATE_LIMIT} 次，请稍后再试。`,
    });
    return;
  }
  bucket.count += 1;
  next();
});

app.use('/api/generate', (_req, res, next) => {
  if (activeGenerations >= MAX_CONCURRENT) {
    res.status(429).json({
      error: 'busy',
      message: '当前同时在生成的任务较多，请稍等十几秒再试。',
    });
    return;
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ...publicAIConfig(),
    service: 'slideweave',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

interface SseStream {
  send: (event: string, data: unknown) => void;
  close: () => void;
  closed: () => boolean;
}

function openSse(res: express.Response, req: express.Request): SseStream {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.socket?.setNoDelay(true);

  let closed = false;
  res.on('close', () => {
    closed = true;
  });
  req.on('aborted', () => {
    closed = true;
  });

  return {
    send(event, data) {
      if (closed || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      if (!res.writableEnded) res.end();
    },
    closed() {
      return closed || res.writableEnded;
    },
  };
}

app.post('/api/generate', async (req, res) => {
  const body = req.body as {
    text?: unknown;
    theme?: unknown;
    slideCount?: unknown;
  };
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const theme: ThemeId = isThemeId(body.theme) ? body.theme : 'ink';
  const requestedCount =
    body.slideCount === null || body.slideCount === undefined
      ? undefined
      : Number(body.slideCount);

  if (text.length < MIN_SOURCE_LENGTH) {
    res.status(400).json({
      error: 'source_too_short',
      message: `请至少粘贴 ${MIN_SOURCE_LENGTH} 个字符的文案。`,
    });
    return;
  }
  if (text.length > MAX_SOURCE_LENGTH) {
    res.status(400).json({
      error: 'source_too_long',
      message: `文案最多支持 ${MAX_SOURCE_LENGTH.toLocaleString('zh-CN')} 个字符。`,
    });
    return;
  }

  const slideCount = Math.min(chooseSlideCount(text, requestedCount), MAX_SLIDES);
  activeGenerations += 1;

  const stream = openSse(res, req);
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  const heartbeat = setInterval(() => {
    if (!stream.closed()) res.write(': keep-alive\n\n');
  }, 15_000);

  try {
    await runGeneration({
      text,
      theme,
      slideCount,
      model: appConfig.model,
      baseUrl: appConfig.baseUrl,
      thinking: appConfig.thinking,
      mock: appConfig.mockAI,
      auth: resolveAuth(),
      signal: abortController.signal,
      emit: (event, data) => stream.send(event, data),
      isClosed: () => stream.closed(),
      mockDelayMs: Number(process.env.MOCK_DELAY_MS || 14),
    });
  } finally {
    clearInterval(heartbeat);
    activeGenerations = Math.max(0, activeGenerations - 1);
    stream.close();
  }
});

if (hasBuild) {
  app.use(
    express.static(distDir, {
      index: 'index.html',
      maxAge: '1h',
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.sendFile(path.join(distDir, 'index.html'));
      return;
    }
    next();
  });
}

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', message: '接口不存在。' });
});

export { app };

// Serverless 环境（Vercel）由 api/[...all].js 代理请求，不自行监听端口。
if (process.env.VERCEL !== '1') {
  const server = app.listen(appConfig.port, appConfig.host, () => {
    const auth = resolveAuth();
    const keyStatus = appConfig.mockAI
      ? 'MOCK_AI enabled'
      : auth
        ? `credential loaded (${auth.source})`
        : 'credential MISSING';
    console.log(`Slideweave server: http://${appConfig.host}:${appConfig.port}`);
    console.log(`Model: ${appConfig.model} · ${keyStatus}`);
    console.log(hasBuild ? 'Serving production build from ./dist' : 'API only (run Vite for the UI)');
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3_000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
