import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Keyboard,
  Layers3,
  LoaderCircle,
  MonitorPlay,
  Play,
  Radio,
  Sparkles,
  Square,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  MAX_SOURCE_LENGTH,
  MIN_SOURCE_LENGTH,
  THEMES,
  getTheme,
  isThemeId,
  type Deck,
  type Slide,
  type ThemeId,
} from '../shared/schema.js';
import { generateDeck, GenerationError } from './lib/sse.js';
import { downloadStandaloneHtml } from './lib/exportHtml.js';
import { SlideRenderer } from './components/SlideRenderer.js';
import { Presentation as PresentationMode } from './components/Presentation.js';
import { apiUrl } from './lib/apiBase';

type Phase = 'idle' | 'generating' | 'ready' | 'error';

interface Health {
  ok: boolean;
  configured: boolean;
  mock: boolean;
  model: string;
  baseUrl: string;
  keySource: string;
}

interface DeckMetaState {
  title: string;
  subtitle?: string;
  slideCount: number;
  model?: string;
}

interface GenerationErrorState {
  message: string;
  code: string;
}

const SAMPLE_TEXT = `为什么好故事，能让产品被记住？

我们每天接触无数产品。功能列表越来越长，发布会越来越密，但真正留在记忆里的，往往只是其中一个画面、一句话，或者一个让人愿意转述的瞬间。

一、信息过载之后，注意力成为真正的稀缺资源
当所有产品都在强调“更多功能”，用户的注意力却在持续收缩。人们不是不愿意了解，而是没有余力理解。此时，单纯罗列卖点，只会让信息更快地滑过去。

二、故事不是包装，而是降低理解成本的结构
一个好故事会先给出具体的处境，再制造一个需要回应的冲突，最后让解决方案自然出现。它把抽象的价值翻译成用户可以感知的场景，让“这是什么”变成“这和我有什么关系”。

三、把产品放进人的选择里
不要从技术参数开始，而要从用户正在经历的时刻开始。比如，不是“我们有一个智能日程系统”，而是“当一天被会议切碎，你如何找回完整的两个小时”。前者在介绍功能，后者在邀请用户进入故事。

四、让证据站在情绪之后
故事负责让人愿意听，证据负责让人愿意信。先用场景建立共鸣，再用数据、案例和真实细节完成支撑。顺序反过来，往往会让用户在被说服之前就先关上了门。

五、结尾要留下一个可以继续的动作
好的演示不是把句号画得更大，而是给观众一个下一步：去尝试、去讨论、去分享。最后一句应该像一扇门，而不是一堵墙。

从今天开始，试着把下一次产品介绍改成一个真实的人的故事。先写他在什么时刻遇到了什么困难，再写你的产品如何改变了那个时刻。你会发现，信息没有变少，但理解变快了；功能没有变多，但记忆变深了。`;

const PAGE_OPTIONS = [
  { value: 'auto', label: '自动篇幅' },
  { value: '6', label: '6 页 · 精简' },
  { value: '8', label: '8 页 · 标准' },
  { value: '10', label: '10 页 · 完整' },
  { value: '12', label: '12 页 · 深度' },
];

function errorMessage(error: unknown): GenerationErrorState {
  if (error instanceof GenerationError) {
    return { message: error.message, code: error.code };
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { message: '已取消生成。', code: 'aborted' };
  }
  if (error instanceof TypeError) {
    return {
      message: '无法连接生成服务，请确认后端已启动后重试。',
      code: 'network_error',
    };
  }
  return {
    message: error instanceof Error ? error.message : '出现未知错误，请重试。',
    code: 'unknown',
  };
}

function closeToViewport(ref: RefObject<HTMLElement | null>) {
  if (window.matchMedia('(max-width: 980px)').matches) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function App() {
  const [text, setText] = useState('');
  const [theme, setTheme] = useState<ThemeId>('ink');
  const [pageOption, setPageOption] = useState('auto');
  const [phase, setPhase] = useState<Phase>('idle');
  const [deck, setDeck] = useState<Deck | null>(null);
  const [meta, setMeta] = useState<DeckMetaState | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState('等待你的文案');
  const [progress, setProgress] = useState(0);
  const [streamedChars, setStreamedChars] = useState(0);
  const [streamPreview, setStreamPreview] = useState('');
  const [showStream, setShowStream] = useState(false);
  const [error, setError] = useState<GenerationErrorState | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef(theme);
  const slidesRef = useRef<Slide[]>([]);
  const toastTimer = useRef<number | undefined>(undefined);
  themeRef.current = theme;
  slidesRef.current = slides;

  const generating = phase === 'generating';
  const activeSlides = deck?.slides ?? slides;
  const total = deck?.slides.length || meta?.slideCount || Math.max(activeSlides.length, 1);
  const metaTitle = deck?.title || meta?.title || '';
  const metaSubtitle = deck?.subtitle || meta?.subtitle || '';
  const activeSlide = activeSlides[Math.min(current, activeSlides.length - 1)];
  const selectedTheme = getTheme(theme);
  const canExport = phase === 'ready' && Boolean(deck);
  const canPresent = Boolean(deck) && phase === 'ready';

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/health'))
      .then(async (response) => {
        if (!response.ok) throw new Error('health failed');
        return (await response.json()) as Health;
      })
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealthError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('slideweave-theme');
    } catch {
      // Storage can be unavailable in private modes.
    }
    if (isThemeId(saved)) setTheme(saved);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('slideweave-theme', theme);
    } catch {
      // Non-critical preference.
    }
  }, [theme]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable ||
        presenting
      ) {
        return;
      }
      if (!activeSlides.length) return;
      if (event.key === 'ArrowRight') {
        setCurrent((value) => Math.min(activeSlides.length - 1, value + 1));
      } else if (event.key === 'ArrowLeft') {
        setCurrent((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeSlides.length, presenting]);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3_600);
  };

  const resetGeneration = () => {
    setDeck(null);
    setMeta(null);
    setSlides([]);
    setCurrent(0);
    setProgress(0);
    setStreamedChars(0);
    setStreamPreview('');
    setError(null);
  };

  const cancelGeneration = () => {
    abortRef.current?.abort();
  };

  const handleGenerate = async () => {
    if (generating) {
      cancelGeneration();
      return;
    }
    const cleanText = text.trim();
    if (cleanText.length < MIN_SOURCE_LENGTH) {
      setError({
        code: 'source_too_short',
        message: `文案还差一点。请至少输入 ${MIN_SOURCE_LENGTH} 个字符，让 AI 有足够的信息来组织结构。`,
      });
      textareaRef.current?.focus();
      return;
    }
    if (cleanText.length > MAX_SOURCE_LENGTH) {
      setError({
        code: 'source_too_long',
        message: `文案超过了 ${MAX_SOURCE_LENGTH.toLocaleString('zh-CN')} 个字符，请精简后再试。`,
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    resetGeneration();
    setPhase('generating');
    setStatus('正在建立生成通道…');
    setProgress(3);
    setShowStream(false);
    closeToViewport(stageRef);

    let receivedDone = false;
    try {
      await generateDeck({
        text: cleanText,
        theme,
        slideCount: pageOption === 'auto' ? null : Number(pageOption),
        signal: controller.signal,
        onEvent: (event) => {
          if (event.event === 'status') {
            setStatus(event.data.message);
          } else if (event.event === 'meta') {
            setStatus('已连接 DeepSeek，正在构思叙事线…');
          } else if (event.event === 'deck') {
            setMeta({
              title: event.data.title,
              subtitle: event.data.subtitle,
              slideCount: event.data.slideCount,
              model: event.data.model,
            });
            setProgress((value) => Math.max(value, 12));
            setStatus('结构已规划，正在逐页撰写…');
          } else if (event.event === 'slide') {
            const index = event.data.index;
            setSlides((previous) => {
              const next = [...previous];
              next[index - 1] = event.data.slide;
              return next.filter(Boolean);
            });
            setCurrent(index - 1);
            const expected = event.data.total || meta?.slideCount || total;
            setProgress((value) =>
              Math.max(value, Math.min(95, 12 + (index / Math.max(expected, 1)) * 82)),
            );
            setStatus(event.data.total ? `第 ${index} / ${event.data.total} 页已成形` : `第 ${index} 页已成形`);
          } else if (event.event === 'delta') {
            setStreamedChars((value) => value + event.data.text.length);
            setStreamPreview((value) => (value + event.data.text).slice(-1_600));
            setProgress((value) => Math.max(value, Math.min(14, 4 + event.data.text.length / 80)));
          } else if (event.event === 'done') {
            receivedDone = true;
            setDeck({ ...event.data.deck, theme: themeRef.current });
            setSlides(event.data.deck.slides);
            setMeta({
              title: event.data.deck.title,
              subtitle: event.data.deck.subtitle,
              slideCount: event.data.deck.slides.length,
              model: event.data.deck.model,
            });
            setCurrent(0);
            setProgress(100);
            setStatus(`演示已就绪 · ${event.data.deck.slides.length} 页`);
            setPhase('ready');
          }
        },
      });
      if (!receivedDone) {
        throw new GenerationError('未收到完整演示数据，请重试。', 'incomplete_stream');
      }
      setShowStream(false);
      showToast('演示已生成，可以切换主题或进入全屏。');
    } catch (caught) {
      const state = errorMessage(caught);
      if (state.code === 'aborted') {
        const partialCount = slidesRef.current.length;
        setStatus('已停止生成');
        setPhase(partialCount ? 'error' : 'idle');
        setError({
          code: 'aborted',
          message: partialCount
            ? `已停止生成，保留了已经完成的 ${partialCount} 页。你可以重新生成。`
            : '已停止生成。',
        });
      } else {
        setPhase('error');
        setError(state);
        setStatus('生成未完成');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleThemeChange = (next: ThemeId) => {
    setTheme(next);
    setDeck((value) => (value ? { ...value, theme: next } : value));
  };

  const handleExport = () => {
    if (!deck) return;
    setExporting(true);
    try {
      downloadStandaloneHtml({ ...deck, theme });
      showToast('独立 HTML 已导出，可直接用浏览器打开。');
    } catch {
      setError({ code: 'export_error', message: '导出失败，请刷新页面后重试。' });
    } finally {
      setExporting(false);
    }
  };

  const setSample = () => {
    setText(SAMPLE_TEXT);
    setError(null);
    textareaRef.current?.focus();
  };

  const healthLabel = healthError
    ? '服务未连接'
    : !health
      ? '正在检查 AI 服务'
      : health.mock
        ? '演示模式 · Mock AI'
        : health.configured
          ? 'AI 服务已就绪'
          : '等待配置 API Key';
  const healthTone = healthError || (health && !health.configured && !health.mock) ? 'warn' : health ? 'ok' : 'idle';

  const phaseLabel =
    phase === 'generating'
      ? 'LIVE BUILD'
      : phase === 'ready'
        ? 'PRESENTATION READY'
        : phase === 'error'
          ? 'NEEDS ATTENTION'
          : 'PREVIEW STAGE';

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" aria-hidden="true" />
      <div className="ambient ambient-b" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#studio" aria-label="织演 Slideweave 首页">
          <span className="brand-mark" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <span className="brand-copy">
            <strong>织演</strong>
            <em>SLIDEWEAVE</em>
          </span>
        </a>

        <nav className="site-nav" aria-label="主导航">
          <a href="#studio" className="is-active">
            创作台
          </a>
          <a href="#how-it-works">如何使用</a>
          <a href="#features">能力</a>
        </nav>

        <div className={`health-pill tone-${healthTone}`} title={health ? `${health.baseUrl} · ${health.model}` : undefined}>
          <span className="health-dot" />
          <span className="health-label">{healthLabel}</span>
          {health && <span className="health-model">{health.mock ? 'mock' : health.model}</span>}
        </div>
      </header>

      <main>
        <section className="intro" id="studio">
          <div className="intro-main">
            <span className="eyebrow">
              <Sparkles size={13} />
              AI PRESENTATION STUDIO
            </span>
            <h1>
              把长文案，
              <br />
              织成一场<span>好演示。</span>
            </h1>
            <p>
              粘贴一段文字，AI 负责提炼叙事、拆解页面。你只管站上舞台，
              <span className="no-wrap">剩下的交给织演。</span>
            </p>
          </div>
          <div className="intro-aside" id="features">
            <div className="feature">
              <span className="feature-icon">
                <Layers3 size={17} />
              </span>
              <div>
                <strong>叙事优先</strong>
                <p>不是分段搬运，而是重组为有起伏的表达结构。</p>
              </div>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Radio size={17} />
              </span>
              <div>
                <strong>流式生成</strong>
                <p>页面逐张浮现，生成进度与模型输出实时可见。</p>
              </div>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Download size={17} />
              </span>
              <div>
                <strong>独立文件</strong>
                <p>一键导出单文件 HTML，随处演示，无需部署。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="studio" aria-label="AI 演示生成工作台">
          <aside className="composer">
            <div className="composer-accent" aria-hidden="true" />
            <div className="composer-head">
              <div>
                <span className="panel-index">01</span>
                <h2>输入素材</h2>
              </div>
              <button type="button" className="text-button" onClick={setSample}>
                <WandSparkles size={14} />
                填入示例
              </button>
            </div>

            <div className={`textarea-shell ${error?.code === 'source_too_short' ? 'has-error' : ''}`}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  if (error?.code === 'source_too_short') setError(null);
                }}
                placeholder="在这里粘贴文章、报告、产品介绍或任何一段长文案…&#10;&#10;越具体的素材，越能生成有洞察的演示。"
                maxLength={MAX_SOURCE_LENGTH + 500}
                aria-label="演示素材"
                spellCheck={false}
              />
              <div className="textarea-meta">
                <span className={text.length > MAX_SOURCE_LENGTH ? 'is-over' : ''}>
                  {text.trim().length.toLocaleString('zh-CN')} /{' '}
                  {MAX_SOURCE_LENGTH.toLocaleString('zh-CN')}
                </span>
                <span>建议 800 – 8,000 字</span>
              </div>
            </div>

            <div className="control-block">
              <div className="control-label">
                <span>视觉主题</span>
                <em>{selectedTheme.description}</em>
              </div>
              <div className="theme-grid" role="group" aria-label="选择视觉主题">
                {THEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`theme-option ${theme === item.id ? 'is-active' : ''}`}
                    onClick={() => handleThemeChange(item.id)}
                    aria-pressed={theme === item.id}
                  >
                    <span className="theme-swatches">
                      {item.swatches.map((color) => (
                        <i key={color} style={{ background: color }} />
                      ))}
                    </span>
                    <span className="theme-name">{item.name}</span>
                    {theme === item.id && (
                      <span className="theme-check">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-block compact">
              <label className="control-label" htmlFor="page-length">
                <span>演示篇幅</span>
                <em>AI 会按素材长度自适应</em>
              </label>
              <div className="select-wrap">
                <select
                  id="page-length"
                  value={pageOption}
                  onChange={(event) => setPageOption(event.target.value)}
                >
                  {PAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronRight size={15} aria-hidden="true" />
              </div>
            </div>

            <button
              type="button"
              className={`generate-button ${generating ? 'is-generating' : ''}`}
              onClick={handleGenerate}
              aria-busy={generating}
            >
              <span className="generate-icon">
                {generating ? (
                  <Square size={15} fill="currentColor" />
                ) : (
                  <Sparkles size={17} />
                )}
              </span>
              <span>
                <strong>{generating ? '停止生成' : '生成我的演示'}</strong>
                <small>
                  {generating ? '已生成内容会保留' : 'DeepSeek 流式生成 · 约 30–60 秒'}
                </small>
              </span>
              {generating ? <LoaderCircle size={19} className="spin" /> : <ArrowUpRight size={20} />}
            </button>

            {health && !health.configured && !health.mock && (
              <div className="key-note">
                <AlertTriangle size={15} />
                <span>
                  服务端尚未读取到 API Key。生成前请在 <code>.env.local</code> 中配置。
                </span>
              </div>
            )}

            <div className="composer-foot">
              <span>
                <Keyboard size={13} /> 支持全屏键盘演示
              </span>
              <span>密钥仅保存在本地服务端</span>
            </div>
          </aside>

          <section className="stage-panel" ref={stageRef} aria-label="演示预览">
            <div className="stage-head">
              <div className="stage-title-wrap">
                <span className={`stage-kicker phase-${phase}`}>
                  <i />
                  {phaseLabel}
                </span>
                <h2 className={!metaTitle ? 'is-placeholder' : ''}>
                  {metaTitle || '等待一段好文案'}
                </h2>
                <p>
                  {metaSubtitle ||
                    (activeSlides.length
                      ? `${selectedTheme.name}主题 · ${activeSlides.length} 页`
                      : '生成后可切换主题、全屏演示，或导出为独立 HTML。')}
                </p>
              </div>

              <div className="stage-actions">
                <div className="compact-themes" role="group" aria-label="快速切换主题">
                  {THEMES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`compact-theme ${theme === item.id ? 'is-active' : ''}`}
                      onClick={() => handleThemeChange(item.id)}
                      style={{ '--dot': item.swatches[2] } as CSSProperties}
                      aria-label={`${item.name}主题`}
                      aria-pressed={theme === item.id}
                      title={item.name}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="action-button ghost"
                  onClick={() => setPresenting(true)}
                  disabled={!canPresent}
                  title="全屏演示"
                >
                  <Play size={15} fill="currentColor" />
                  <span>演示</span>
                </button>
                <button
                  type="button"
                  className="action-button dark"
                  onClick={handleExport}
                  disabled={!canExport || exporting}
                  title="导出独立 HTML"
                >
                  {exporting ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}
                  <span>导出 HTML</span>
                </button>
              </div>
            </div>

            {generating && (
              <div className="generation-strip" role="status" aria-live="polite">
                <div className="generation-status">
                  <span className="live-wave" aria-hidden="true">
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                  </span>
                  <span>{status}</span>
                </div>
                <div className="generation-progress">
                  <i style={{ width: `${Math.max(progress, 3)}%` }} />
                </div>
                <span className="generation-percent">{Math.round(progress)}%</span>
                <button
                  type="button"
                  className="stream-toggle"
                  onClick={() => setShowStream((value) => !value)}
                  aria-expanded={showStream}
                >
                  {showStream ? '收起流' : '查看流'}
                </button>
              </div>
            )}

            {error && (
              <div className="error-banner" role="alert">
                <AlertTriangle size={17} />
                <div className="error-copy">
                  <strong>{error.code === 'key_missing' ? '尚未配置 AI 密钥' : '这次没有完成'}</strong>
                  <p>{error.message}</p>
                  {(error.code === 'key_missing' || (health && !health.configured && !health.mock)) && (
                    <details>
                      <summary>查看配置方式</summary>
                      <p>
                        在项目根目录的 <code>.env.local</code> 中写入：
                      </p>
                      <pre>DEEPSEEK_API_KEY=你的密钥</pre>
                      <p>
                        然后重启 <code>npm run dev</code>。密钥只在服务端读取，不会发送到浏览器。
                      </p>
                    </details>
                  )}
                </div>
                <div className="error-actions">
                  <button type="button" onClick={handleGenerate}>
                    重试
                  </button>
                  <button type="button" className="icon-only" onClick={() => setError(null)} aria-label="关闭提示">
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            <div className={`stage-canvas ${!activeSlide ? 'is-empty' : ''}`}>
              {activeSlide ? (
                <>
                  <div className="stage-slide" key={`${activeSlide.id}-${theme}`}>
                    <SlideRenderer
                      slide={activeSlide}
                      index={current}
                      total={total}
                      theme={theme}
                    />
                  </div>
                  <div className="stage-controls">
                    <button
                      type="button"
                      className="stage-arrow"
                      onClick={() => setCurrent((value) => Math.max(0, value - 1))}
                      disabled={current === 0}
                      aria-label="上一页"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="stage-page">
                      {String(current + 1).padStart(2, '0')}
                      <i>/</i>
                      {String(total).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      className="stage-arrow"
                      onClick={() =>
                        setCurrent((value) => Math.min(activeSlides.length - 1, value + 1))
                      }
                      disabled={current >= activeSlides.length - 1}
                      aria-label="下一页"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  {generating && (
                    <div className="live-badge">
                      <LoaderCircle size={13} className="spin" />
                      正在生成
                    </div>
                  )}
                </>
              ) : (
                <EmptyStage generating={generating} status={status} />
              )}
            </div>

            {showStream && generating && (
              <div className="stream-console" aria-label="模型实时输出">
                <div className="stream-console-head">
                  <span>
                    <Radio size={12} /> LIVE MODEL OUTPUT
                  </span>
                  <span>{streamedChars.toLocaleString('zh-CN')} chars</span>
                </div>
                <pre>
                  {streamPreview.slice(-1_100) || '等待模型返回第一段内容…'}
                  <span className="stream-cursor" />
                </pre>
              </div>
            )}

            {(activeSlides.length > 0 || generating) && (
              <div className="thumbnail-area">
                <div className="thumbnail-head">
                  <span>页面序列</span>
                  <span>{generating ? '实时追加中' : `${activeSlides.length} 页 · 点击切换`}</span>
                </div>
                <div className="thumbnail-strip">
                  {activeSlides.map((slide, index) => (
                    <button
                      key={`${slide.id}-${index}`}
                      type="button"
                      className={`thumbnail ${index === current ? 'is-active' : ''}`}
                      onClick={() => setCurrent(index)}
                      aria-label={`预览第 ${index + 1} 页：${slide.title}`}
                    >
                      <span className="thumbnail-slide">
                        <SlideRenderer
                          slide={slide}
                          index={index}
                          total={activeSlides.length}
                          theme={theme}
                        />
                      </span>
                      <span className="thumbnail-meta">
                        <i>{String(index + 1).padStart(2, '0')}</i>
                        <span>{slide.title}</span>
                      </span>
                    </button>
                  ))}
                  {generating &&
                    Array.from({
                      length: Math.max(0, Math.min(4, (meta?.slideCount || 6) - activeSlides.length)),
                    }).map((_, index) => (
                      <div className="thumbnail skeleton" key={`skeleton-${index}`} aria-hidden="true">
                        <span className="thumbnail-slide skeleton-shimmer" />
                        <span className="thumbnail-meta">
                          <i>{String(activeSlides.length + index + 1).padStart(2, '0')}</i>
                          <span>正在成形…</span>
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="stage-foot">
              <span>
                <MonitorPlay size={14} /> 全屏内使用 ← → 翻页，N 查看备注，T 切换主题
              </span>
              <span>
                <FileText size={14} /> 单文件 HTML · 离线可用
              </span>
            </div>
          </section>
        </section>

        <section className="how-it-works" id="how-it-works">
          <div className="how-head">
            <span className="eyebrow">
              <ArrowRight size={13} /> HOW IT WORKS
            </span>
            <h2>从文字到舞台，只要三步。</h2>
          </div>
          <div className="step-grid">
            <article>
              <span className="step-number">01</span>
              <h3>粘贴你的素材</h3>
              <p>文章、报告、会议纪要、产品文档，越长越能体现结构能力。</p>
            </article>
            <article>
              <span className="step-number">02</span>
              <h3>看 AI 逐页落笔</h3>
              <p>模型边生成、页面边出现。叙事结构与版式同步完成。</p>
            </article>
            <article>
              <span className="step-number">03</span>
              <h3>演示，或带走它</h3>
              <p>键盘全屏放映，或导出一个没有任何依赖的 HTML 文件。</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>织演 SLIDEWEAVE · AI WEB PRESENTATION STUDIO</span>
        <span>DeepSeek V4 Pro · Streaming · Exportable</span>
      </footer>

      {presenting && deck && (
        <PresentationMode
          deck={deck}
          startIndex={current}
          theme={theme}
          onThemeChange={handleThemeChange}
          onClose={() => setPresenting(false)}
        />
      )}

      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">
        <Check size={15} />
        {toast}
      </div>
    </div>
  );
}

function EmptyStage({ generating, status }: { generating: boolean; status: string }) {
  return (
    <div className="empty-stage">
      <div className="empty-stage-grid" aria-hidden="true" />
      <div className="empty-copy">
        <span className="empty-kicker">{generating ? 'COMPOSING YOUR STORY' : 'YOUR NEXT DECK'}</span>
        <h3>
          一段文案，
          <br />
          一场好演示。
        </h3>
        <p>
          {generating
            ? status
            : '在左侧粘贴素材，选择主题，然后让 AI 开始组织你的下一场表达。'}
        </p>
        <div className="empty-chips">
          <span>结构化叙事</span>
          <span>逐页流式生成</span>
          <span>可演示 / 可导出</span>
        </div>
      </div>
      <div className="empty-art" aria-hidden="true">
        <div className="empty-ring empty-ring-a" />
        <div className="empty-ring empty-ring-b" />
        <div className="empty-orb" />
        <span className="empty-number">01</span>
        <span className="empty-star">✦</span>
        <span className="empty-word">DECK</span>
      </div>
      <span className="empty-corner">16 : 9</span>
      {generating && (
        <div className="empty-loading">
          <LoaderCircle size={15} className="spin" />
          <span>AI 正在书写第一页</span>
        </div>
      )}
    </div>
  );
}
