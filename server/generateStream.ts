/**
 * 与运行环境无关的生成流水线：Express（本地 / Vercel）与 Cloudflare Workers 共用。
 * 只依赖 Web 标准（fetch / AbortSignal / TextEncoder），不碰 Node API。
 */
import { AIError, streamChatCompletion } from './ai.js';
import { DeckComposer } from './deckBuilder.js';
import { JsonObjectStream } from './jsonStream.js';
import { buildPrompt } from './prompt.js';
import { buildMockObjects } from './mock.js';
import { type Deck, type ThemeId, makeId } from '../shared/schema.js';

export interface GenerationAuth {
  header: string;
  value: string;
}

export interface GenerationOptions {
  text: string;
  theme: ThemeId;
  slideCount: number;
  model: string;
  baseUrl: string;
  thinking: boolean;
  mock: boolean;
  auth: GenerationAuth | null;
  signal: AbortSignal;
  /** 发送一条 SSE 事件 */
  emit: (event: string, data: unknown) => void;
  /** 客户端断开或流已关闭时返回 true，用于尽早停止 */
  isClosed: () => boolean;
  mockDelayMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runGeneration(options: GenerationOptions): Promise<void> {
  const { text, theme, slideCount, model, baseUrl, thinking, mock, auth, signal, emit, isClosed } =
    options;
  const displayModel = mock ? 'mock-designer' : model;
  const startedAt = Date.now();

  const composer = new DeckComposer();
  const parser = new JsonObjectStream();
  let emittedDeckMeta = false;
  let emittedSlideCount = 0;
  let rawContent = '';
  let firstContent = true;

  const handleObjects = (objects: unknown[]) => {
    for (const object of objects) {
      for (const event of composer.addObject(object)) {
        if (event.type === 'meta' && event.meta) {
          if (emittedDeckMeta) continue;
          emittedDeckMeta = true;
          emit('deck', { ...event.meta, theme, model: displayModel });
          emit('status', {
            stage: 'drafting',
            message: `已规划 ${event.meta.slideCount || '多'} 页，正在逐页撰写…`,
          });
        } else if (event.type === 'slide' && event.slide) {
          emittedSlideCount += 1;
          emit('slide', {
            slide: event.slide,
            index: emittedSlideCount,
            total: composer.expectedCount || undefined,
          });
          emit('status', {
            stage: 'drafting',
            message: `第 ${emittedSlideCount} 页已成形${
              composer.expectedCount ? ` / 共 ${composer.expectedCount} 页` : ''
            }`,
          });
        }
      }
    }
  };

  const finish = () => {
    const finalized = composer.finalize(theme);
    if (!finalized) {
      emit('error', {
        code: 'no_slides',
        message:
          '模型没有返回可用的演示结构。请重试；若持续出现，请换用更完整的文案或检查模型是否支持 JSON 输出。',
      });
      return;
    }
    if (finalized.slides.length < 2) {
      emit('error', {
        code: 'too_few_slides',
        message: '本次只生成了 1 页内容，内容结构不完整，请重试。',
      });
      return;
    }

    const deck: Deck = {
      id: makeId(),
      title: finalized.meta.title,
      ...(finalized.meta.subtitle ? { subtitle: finalized.meta.subtitle } : {}),
      theme,
      slides: finalized.slides,
      createdAt: new Date().toISOString(),
      model: displayModel,
    };

    emit('status', { stage: 'polishing', message: '正在校对结构与版式…' });
    emit('done', {
      deck,
      stats: {
        slides: deck.slides.length,
        characters: text.length,
        elapsedMs: Date.now() - startedAt,
        mock,
      },
    });
  };

  emit('meta', { model: displayModel, mock, slideCount });
  emit('status', {
    stage: 'connecting',
    message: mock ? '演示模式：正在准备示例结构…' : '正在连接模型…',
  });

  try {
    if (mock) {
      const objects = buildMockObjects(text, theme, slideCount);
      const payload = `${objects.map((object) => JSON.stringify(object)).join('\n')}\n{"kind":"end"}`;
      const chunks = payload.match(/[\s\S]{1,80}/g) ?? [];
      for (const chunk of chunks) {
        if (isClosed() || signal.aborted) return;
        rawContent += chunk;
        emit('delta', { text: chunk });
        handleObjects(parser.push(chunk));
        if (options.mockDelayMs) await sleep(options.mockDelayMs);
      }
    } else {
      if (!auth) {
        throw new AIError(
          '服务端没有配置模型凭据（DEEPSEEK_API_KEY），暂时无法生成。',
          'key_missing',
        );
      }

      const prompt = buildPrompt({ source: text, theme, slideCount });
      let deltaBuffer = '';
      let lastDeltaSent = 0;

      await streamChatCompletion({
        authHeader: auth.header,
        authValue: auth.value,
        baseUrl,
        model,
        thinking,
        system: prompt.system,
        user: prompt.user,
        signal,
        onDelta: (delta) => {
          rawContent += delta;
          if (firstContent) {
            firstContent = false;
            emit('status', { stage: 'thinking', message: '正在提炼中心论点与叙事线…' });
          }
          handleObjects(parser.push(delta));

          deltaBuffer += delta;
          const now = Date.now();
          if (now - lastDeltaSent > 50 || deltaBuffer.length > 220) {
            emit('delta', { text: deltaBuffer });
            deltaBuffer = '';
            lastDeltaSent = now;
          }
        },
      });
      if (deltaBuffer) emit('delta', { text: deltaBuffer });
      handleObjects(parser.end());
    }

    if (isClosed()) return;
    if (!rawContent.trim()) {
      throw new AIError('模型没有返回任何内容，请重试。', 'empty_content');
    }
    if (!composer.slideCount) {
      throw new AIError(
        '模型返回的内容未通过结构解析，没有生成可用页面。请重试一次。',
        'invalid_structure',
      );
    }
    finish();
  } catch (error) {
    if (isClosed()) return;
    const isKnown = error instanceof AIError;
    const message = isKnown ? error.message : '生成过程中出现意外错误，请稍后重试。';
    const code = isKnown ? error.code : 'server_error';
    console.error(`[generate] ${code}: ${isKnown ? error.message : String(error)}`);
    emit('status', { stage: 'error', message: '生成中断' });
    emit('error', { code, message });
  }
}
