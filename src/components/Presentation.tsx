import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Maximize2,
  StickyNote,
  X,
} from 'lucide-react';
import { THEMES, THEME_IDS, type Deck, type ThemeId } from '../../shared/schema.js';
import { SlideRenderer } from './SlideRenderer.js';

interface PresentationProps {
  deck: Deck;
  startIndex: number;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  onClose: () => void;
}

export function Presentation({
  deck,
  startIndex,
  theme,
  onThemeChange,
  onClose,
}: PresentationProps) {
  const [current, setCurrent] = useState(() =>
    Math.max(0, Math.min(startIndex, deck.slides.length - 1)),
  );
  const [notesOpen, setNotesOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);
  const requestedFullscreen = useRef(false);
  const closing = useRef(false);
  const themeRef = useRef(theme);
  const notesRef = useRef(notesOpen);
  const total = deck.slides.length;

  themeRef.current = theme;
  notesRef.current = notesOpen;

  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 4_000);
  }, []);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    onClose();
  }, [onClose]);

  const go = useCallback(
    (direction: number) => {
      setCurrent((value) => Math.max(0, Math.min(total - 1, value + direction)));
      wake();
    },
    [total, wake],
  );

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    wake();

    const handleKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      wake();
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          event.preventDefault();
          go(1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          go(-1);
          break;
        case 'Home':
          event.preventDefault();
          setCurrent(0);
          break;
        case 'End':
          event.preventDefault();
          setCurrent(total - 1);
          break;
        case 'n':
        case 'N':
          event.preventDefault();
          setNotesOpen((value) => !value);
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          requestedFullscreen.current = !document.fullscreenElement;
          if (!document.fullscreenElement) {
            void document.documentElement.requestFullscreen().catch(() => {
              requestedFullscreen.current = false;
            });
          } else {
            void document.exitFullscreen().catch(() => undefined);
          }
          break;
        case 't':
        case 'T': {
          event.preventDefault();
          const index = THEME_IDS.indexOf(themeRef.current);
          onThemeChange(THEME_IDS[(index + 1) % THEME_IDS.length]);
          break;
        }
        case 'Escape':
          if (notesRef.current) {
            setNotesOpen(false);
          } else if (!document.fullscreenElement) {
            close();
          }
          break;
        default:
          break;
      }
    };

    const handleFullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active && requestedFullscreen.current && !closing.current) {
        requestedFullscreen.current = false;
        close();
      }
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('mousemove', wake, { passive: true });
    document.addEventListener('touchstart', wake, { passive: true });

    requestedFullscreen.current = true;
    void document.documentElement.requestFullscreen?.().catch(() => {
      requestedFullscreen.current = false;
    });

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('mousemove', wake);
      document.removeEventListener('touchstart', wake);
      window.clearTimeout(idleTimer.current);
      document.body.style.overflow = originalOverflow;
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
    // Event bindings are intentionally mount-only; navigation uses state updaters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullscreen = () => {
    requestedFullscreen.current = !document.fullscreenElement;
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {
        requestedFullscreen.current = false;
      });
    } else {
      void document.exitFullscreen().catch(() => undefined);
    }
  };

  let touchStartX: number | null = null;
  const onTouchStart = (event: TouchEvent) => {
    touchStartX = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    touchStartX = null;
    if (Math.abs(delta) > 48) go(delta < 0 ? 1 : -1);
  };

  const slide = deck.slides[current];
  if (!slide) return null;

  return (
    <div
      className={`presentation ${idle && !notesOpen ? 'is-idle' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${deck.title} 全屏演示`}
      onMouseMove={wake}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="presentation-chrome presentation-top">
        <div className="presentation-brand">
          <span className="presentation-glyph" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <span>{deck.title}</span>
        </div>
        <div className="presentation-actions">
          <div className="presentation-themes" role="group" aria-label="切换配色主题">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`presentation-theme ${theme === item.id ? 'is-active' : ''}`}
                style={{ '--swatch': item.swatches[2] } as CSSProperties}
                onClick={() => onThemeChange(item.id)}
                aria-label={`切换到${item.name}主题`}
                aria-pressed={theme === item.id}
                title={item.name}
              />
            ))}
          </div>
          <button
            type="button"
            className={`presentation-icon ${notesOpen ? 'is-active' : ''}`}
            onClick={() => setNotesOpen((value) => !value)}
            aria-label="演讲者备注 (N)"
            title="备注 (N)"
          >
            <StickyNote size={18} />
          </button>
          <button
            type="button"
            className="presentation-icon"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
            title="全屏 (F)"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            type="button"
            className="presentation-icon presentation-close"
            onClick={close}
            aria-label="退出演示"
            title="退出 (Esc)"
          >
            <X size={19} />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="presentation-arrow presentation-prev"
        onClick={() => go(-1)}
        disabled={current === 0}
        aria-label="上一页"
      >
        <ChevronLeft size={24} />
      </button>

      <div className="presentation-stage" onClick={() => go(1)}>
        <div className="presentation-frame" onClick={(event) => event.stopPropagation()}>
          <SlideRenderer
            key={`${slide.id}-${current}`}
            slide={slide}
            index={current}
            total={total}
            theme={theme}
          />
        </div>
      </div>

      <button
        type="button"
        className="presentation-arrow presentation-next"
        onClick={() => go(1)}
        disabled={current === total - 1}
        aria-label="下一页"
      >
        <ChevronRight size={24} />
      </button>

      <div className="presentation-chrome presentation-bottom">
        <div className="presentation-progress" aria-hidden="true">
          <i style={{ width: `${((current + 1) / total) * 100}%` }}></i>
        </div>
        <div className="presentation-meta">
          <span className="presentation-count">
            {String(current + 1).padStart(2, '0')} <i>/</i> {String(total).padStart(2, '0')}
          </span>
          <span className="presentation-hint">← → 翻页 · N 备注 · T 换主题 · Esc 退出</span>
          <span className="presentation-touch-hint">轻点或左右滑动翻页 · N 备注</span>
        </div>
      </div>

      <div className="presentation-rotate" aria-hidden="true">
        横屏观看 · 文字更清晰
      </div>

      <aside className={`presentation-notes ${notesOpen ? 'is-open' : ''}`} aria-hidden={!notesOpen}>
        <div className="presentation-notes-head">
          <span>SPEAKER NOTES</span>
          <button type="button" onClick={() => setNotesOpen(false)} aria-label="关闭备注">
            <X size={16} />
          </button>
        </div>
        <h3>演讲者备注</h3>
        <p>{slide.note || '这一页没有备注。试着用一句话说出你希望观众记住什么。'}</p>
      </aside>
    </div>
  );
}
