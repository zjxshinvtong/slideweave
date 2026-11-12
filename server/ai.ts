export class AIError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code = 'ai_error', status?: number) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.status = status;
  }
}

export interface ChatStreamOptions {
  authHeader: string;
  authValue: string;
  baseUrl: string;
  model: string;
  system: string;
  user: string;
  signal: AbortSignal;
  onDelta: (text: string) => void;
  thinking?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatStreamResult {
  content: string;
  finishReason?: string;
}

interface OpenAIChunk {
  choices?: Array<{
    delta?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  error?: { message?: string; type?: string; code?: string };
}

function readableApiError(status: number, body: string): AIError {
  let upstream = '';
  try {
    const parsed = JSON.parse(body) as OpenAIChunk;
    upstream = parsed.error?.message || '';
  } catch {
    upstream = body;
  }
  upstream = upstream.replace(/\s+/g, ' ').trim().slice(0, 240);

  if (status === 401 || status === 403) {
    return new AIError(
      'DeepSeek 鉴权失败。请检查 DEEPSEEK_API_KEY，或重新登录 DeepSeek Harness 后再试。',
      'auth_error',
      status,
    );
  }
  if (status === 429) {
    return new AIError(
      'DeepSeek 当前请求过多或额度不足，请稍后重试。',
      'rate_limited',
      status,
    );
  }
  if (status === 404) {
    return new AIError(
      `接口或模型不存在（404）。请确认 base_url 与模型 ID 可用。${upstream ? `上游信息：${upstream}` : ''}`,
      'not_found',
      status,
    );
  }
  return new AIError(
    `DeepSeek 请求失败（${status}）。${upstream || '请稍后重试。'}`,
    'upstream_error',
    status,
  );
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
  );
}

/** Calls an OpenAI-compatible chat completions endpoint and forwards text deltas. */
export async function streamChatCompletion(options: ChatStreamOptions): Promise<ChatStreamResult> {
  const {
    authHeader,
    authValue,
    baseUrl,
    model,
    system,
    user,
    signal,
    onDelta,
    thinking = false,
    maxTokens = 12_000,
    temperature = 0.7,
  } = options;

  const timeout = AbortSignal.timeout(240_000);
  // Cloudflare Workers 早期版本没有 AbortSignal.any，退化为基础 signal
  const combinedSignal =
    typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        [authHeader]: authValue,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'User-Agent': 'Slideweave/1.0',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: true,
        temperature,
        max_tokens: maxTokens,
        thinking: { type: thinking ? 'enabled' : 'disabled' },
      }),
      signal: combinedSignal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new AIError('生成超时或被中断，请重试。', 'timeout');
    }
    throw new AIError('无法连接 DeepSeek 接口，请检查网络或 base_url 配置。', 'network_error');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw readableApiError(response.status, body);
  }
  if (!response.body) {
    throw new AIError('DeepSeek 返回了空响应。', 'empty_response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let finishReason: string | undefined;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':')) return;
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') {
      if (data === '[DONE]') finishReason = finishReason || 'stop';
      return;
    }
    let chunk: OpenAIChunk;
    try {
      chunk = JSON.parse(data) as OpenAIChunk;
    } catch {
      return;
    }
    if (chunk.error?.message) {
      throw new AIError(`DeepSeek 返回错误：${chunk.error.message.slice(0, 240)}`, 'upstream_error');
    }
    const choice = chunk.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === 'string' && delta.length) {
      content += delta;
      onDelta(delta);
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
        buffer = buffer.slice(newlineIndex + 1);
        handleLine(line);
        newlineIndex = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);
  } catch (error) {
    if (error instanceof AIError) throw error;
    if (isAbortError(error)) {
      throw new AIError('生成超时或被中断，请重试。', 'timeout');
    }
    throw new AIError('读取 DeepSeek 流式响应时连接中断，请重试。', 'stream_error');
  } finally {
    reader.releaseLock();
  }

  if (!content.trim()) {
    throw new AIError('模型没有返回内容，请重试或换一段更完整的文案。', 'empty_content');
  }

  return { content, finishReason };
}
