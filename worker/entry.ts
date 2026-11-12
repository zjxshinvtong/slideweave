/**
 * Cloudflare Pages Functions 入口（/api/*）。
 * 构建时由 scripts/build-pages-fn.mjs 打包成 functions/api/[[path]].js。
 * 与 Express 版共用 server/generateStream.ts，逻辑保持一致。
 */
import { runGeneration } from '../server/generateStream.js';
import { chooseSlideCount } from '../server/prompt.js';
import {
  MAX_SOURCE_LENGTH,
  MIN_SOURCE_LENGTH,
  isThemeId,
  type ThemeId,
} from '../shared/schema.js';

export interface Env {
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_THINKING?: string;
  RATE_LIMIT_PER_HOUR?: string;
  MAX_SLIDES?: string;
  MOCK_AI?: string;
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

const truthy = (value: string | undefined) => /^(1|true|yes)$/i.test(value || '');

// 每个 isolate 内的简易限流（Workers 无跨实例内存，属于尽力而为）
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;

function rateLimited(ip: string, limit: number): boolean {
  const now = Date.now();
  if (buckets.size > 2000) {
    for (const [key, bucket] of buckets) if (bucket.resetAt < now) buckets.delete(key);
  }
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (bucket.count >= limit) return true;
  bucket.count += 1;
  return false;
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = (env.DEEPSEEK_API_KEY || '').trim();
  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const model = env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
  const mock = truthy(env.MOCK_AI);

  if (url.pathname === '/api/health') {
    return json({
      ok: true,
      configured: Boolean(key) || mock,
      mock,
      model,
      baseUrl,
      keySource: key ? 'environment' : mock ? 'mock' : 'missing',
      service: 'slideweave',
      runtime: 'cloudflare-pages',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  }

  if (url.pathname !== '/api/generate') {
    return json({ error: 'not_found', message: '接口不存在。' }, 404);
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed', message: '请使用 POST。' }, 405);
  }

  let body: { text?: unknown; theme?: unknown; slideCount?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'bad_request', message: '请求体不是合法 JSON。' }, 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const theme: ThemeId = isThemeId(body.theme) ? body.theme : 'ink';
  const requested =
    body.slideCount === null || body.slideCount === undefined
      ? undefined
      : Number(body.slideCount);

  if (text.length < MIN_SOURCE_LENGTH) {
    return json(
      { error: 'source_too_short', message: `请至少粘贴 ${MIN_SOURCE_LENGTH} 个字符的文案。` },
      400,
    );
  }
  if (text.length > MAX_SOURCE_LENGTH) {
    return json(
      {
        error: 'source_too_long',
        message: `文案最多支持 ${MAX_SOURCE_LENGTH.toLocaleString('zh-CN')} 个字符。`,
      },
      400,
    );
  }

  const limit = Number(env.RATE_LIMIT_PER_HOUR || 10);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip, limit)) {
    return json(
      { error: 'rate_limited', message: `演示环境每小时最多生成 ${limit} 次，请稍后再试。` },
      429,
    );
  }

  const slideCount = Math.min(chooseSlideCount(text, requested), Number(env.MAX_SLIDES || 14));
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  let closed = false;
  request.signal.addEventListener('abort', () => {
    closed = true;
  });

  const emit = (event: string, data: unknown) => {
    if (closed) return;
    try {
      void writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch {
      closed = true;
    }
  };

  void (async () => {
    try {
      await runGeneration({
        text,
        theme,
        slideCount,
        model,
        baseUrl,
        thinking: (env.DEEPSEEK_THINKING || '').toLowerCase() === 'enabled',
        mock,
        auth: key ? { header: 'Authorization', value: `Bearer ${key}` } : null,
        signal: request.signal,
        emit,
        isClosed: () => closed,
      });
    } finally {
      closed = true;
      try {
        await writer.close();
      } catch {
        /* 客户端已断开 */
      }
    }
  })();

  return new Response(readable, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}

export const onRequest = (context: { request: Request; env: Env }): Promise<Response> =>
  handle(context.request, context.env);
