/**
 * CloudBase 云函数（HTTP 类型）入口：/api/*
 * 与本地 Express / Cloudflare Workers 共用 server/generateStream.ts。
 * 构建：node scripts/build-cloudbase-fn.mjs → cloudbase/functions/api/index.js
 */
import { runGeneration } from '../../../server/generateStream.js';
import { chooseSlideCount } from '../../../server/prompt.js';
import {
  MAX_SOURCE_LENGTH,
  MIN_SOURCE_LENGTH,
  isThemeId,
  type ThemeId,
} from '../../../shared/schema.js';

interface HttpEvent {
  path?: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}

const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 20);

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

function json(statusCode: number, data: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
    body: JSON.stringify(data),
  };
}

function clientIp(event: HttpEvent): string {
  const h = event.headers || {};
  const raw = h['x-forwarded-for'] || h['X-Forwarded-For'] || h['x-real-ip'] || '';
  return String(raw).split(',')[0].trim() || 'unknown';
}

async function main(event: HttpEvent) {
  const path = (event.path || '/').replace(/\/+$/, '') || '/';
  const method = (event.httpMethod || 'GET').toUpperCase();
  const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

  if (path.endsWith('/health')) {
    return json(200, {
      ok: true,
      configured: Boolean(apiKey),
      mock: false,
      model,
      baseUrl,
      keySource: apiKey ? 'environment' : 'missing',
      service: 'slideweave',
      runtime: 'cloudbase-function',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  }

  if (method === 'OPTIONS') return { statusCode: 204, headers: { ...CORS_HEADERS }, body: '' };

  if (!path.endsWith('/generate')) return json(404, { error: 'not_found', message: '接口不存在。' });
  if (method !== 'POST') return json(405, { error: 'method_not_allowed', message: '请使用 POST。' });

  const ip = clientIp(event);
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else if (bucket.count >= LIMIT) {
    return json(429, { error: 'rate_limited', message: `演示环境每小时最多生成 ${LIMIT} 次。` });
  } else {
    bucket.count += 1;
  }

  let body: { text?: unknown; theme?: unknown; slideCount?: unknown } = {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '{}';
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'bad_request', message: '请求体不是合法 JSON。' });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const theme: ThemeId = isThemeId(body.theme) ? body.theme : 'ink';
  const requested =
    body.slideCount === null || body.slideCount === undefined ? undefined : Number(body.slideCount);

  if (text.length < MIN_SOURCE_LENGTH) {
    return json(400, {
      error: 'source_too_short',
      message: `请至少粘贴 ${MIN_SOURCE_LENGTH} 个字符的文案。`,
    });
  }
  if (text.length > MAX_SOURCE_LENGTH) {
    return json(400, {
      error: 'source_too_long',
      message: `文案最多支持 ${MAX_SOURCE_LENGTH.toLocaleString('zh-CN')} 个字符。`,
    });
  }
  if (!apiKey) {
    return json(503, {
      error: 'key_missing',
      message: '服务端没有配置模型凭据（DEEPSEEK_API_KEY），暂时无法生成。',
    });
  }

  const slideCount = Math.min(
    chooseSlideCount(text, requested),
    Number(process.env.MAX_SLIDES || 8),
  );

  // 云函数是「一问一答」模型：把 SSE 事件攒成完整响应一次返回，
  // 前端仍按 SSE 解析，只是不再逐字出现。
  const frames: string[] = [];
  const emit = (name: string, data: unknown) => {
    frames.push(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  await runGeneration({
    text,
    theme,
    slideCount,
    model,
    baseUrl,
    thinking: (process.env.DEEPSEEK_THINKING || '').toLowerCase() === 'enabled',
    mock: false,
    auth: { header: 'Authorization', value: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(50_000),
    emit,
    isClosed: () => false,
  });

  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      ...CORS_HEADERS,
    },
    body: frames.join(''),
  };
}

exports.main = main;
