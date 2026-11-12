import type { Deck, Slide, ThemeId } from '../../shared/schema.js';
import { apiUrl } from './apiBase';

export type StreamEvent =
  | { event: 'meta'; data: { model: string; mock: boolean; slideCount: number } }
  | {
      event: 'status';
      data: { stage: string; message: string };
    }
  | {
      event: 'deck';
      data: { title: string; subtitle?: string; slideCount: number; theme: ThemeId; model?: string };
    }
  | { event: 'slide'; data: { slide: Slide; index: number; total?: number } }
  | { event: 'delta'; data: { text: string } }
  | {
      event: 'done';
      data: {
        deck: Deck;
        stats?: { slides: number; characters: number; elapsedMs: number; mock?: boolean };
      };
    }
  | { event: 'error'; data: { code: string; message: string } };

export class GenerationError extends Error {
  code: string;

  constructor(message: string, code = 'generation_error') {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
  }
}

interface GenerateOptions {
  text: string;
  theme: ThemeId;
  slideCount: number | null;
  signal: AbortSignal;
  onEvent: (event: StreamEvent) => void;
}

function parseBlock(block: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join('\n') };
}

function dispatch(raw: { event: string; data: string }, onEvent: (event: StreamEvent) => void): void {
  let data: unknown;
  try {
    data = JSON.parse(raw.data);
  } catch {
    return;
  }
  if (!data || typeof data !== 'object') return;

  if (raw.event === 'error') {
    const error = data as { message?: string; code?: string };
    throw new GenerationError(
      error.message || '生成失败，请稍后重试。',
      error.code || 'generation_error',
    );
  }

  const knownEvents = new Set(['meta', 'status', 'deck', 'slide', 'delta', 'done']);
  if (knownEvents.has(raw.event)) {
    onEvent({ event: raw.event, data } as StreamEvent);
  }
}

/** Reads the backend's SSE stream from a POST fetch response. */
export async function generateDeck(options: GenerateOptions): Promise<void> {
  const response = await fetch(apiUrl('/api/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: options.text,
      theme: options.theme,
      slideCount: options.slideCount,
    }),
    signal: options.signal,
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('text/event-stream')) {
    let message = `请求失败（${response.status}）`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // Keep the status-based message.
    }
    throw new GenerationError(message, 'http_error');
  }
  if (!response.body) {
    throw new GenerationError('浏览器无法读取流式响应。', 'stream_unsupported');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseBlock(block);
        if (parsed) {
          if (parsed.event === 'done') sawDone = true;
          dispatch(parsed, options.onEvent);
        }
        boundary = buffer.indexOf('\n\n');
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const parsed = parseBlock(buffer);
      if (parsed) {
        if (parsed.event === 'done') sawDone = true;
        dispatch(parsed, options.onEvent);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!sawDone) {
    throw new GenerationError(
      '连接提前结束，未收到完整的演示数据。请重试。',
      'incomplete_stream',
    );
  }
}
