import slideCss from '../styles/slide.css?raw';
import {
  THEMES,
  escapeHtml,
  getTheme,
  type Deck,
  type ThemeId,
} from '../../shared/schema.js';
import { renderSlideArticle } from './slideMarkup.js';

const EXPORT_SHELL_CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  overflow: hidden;
  background:
    radial-gradient(circle at 15% 10%, rgba(68, 103, 86, 0.24), transparent 38%),
    radial-gradient(circle at 88% 88%, rgba(208, 81, 53, 0.12), transparent 32%),
    #0d1310;
  color: #f4f1e8;
  font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
}
button { font: inherit; }
.export-app {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100svh;
  isolation: isolate;
}
.export-top {
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(244, 241, 232, 0.1);
  background: rgba(13, 19, 16, 0.78);
  backdrop-filter: blur(18px);
}
.export-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.export-glyph { display: flex; align-items: flex-end; gap: 3px; width: 25px; height: 25px; flex: none; }
.export-glyph i { display: block; width: 6px; border-radius: 3px; background: #e16141; }
.export-glyph i:nth-child(1) { height: 60%; opacity: .5; }
.export-glyph i:nth-child(2) { height: 100%; }
.export-glyph i:nth-child(3) { height: 76%; opacity: .72; }
.export-name { font-size: 12px; font-weight: 800; letter-spacing: .14em; white-space: nowrap; }
.export-name span { margin-left: 6px; color: #8f9b91; font-size: 9px; font-weight: 500; letter-spacing: .16em; }
.export-deck-title {
  overflow: hidden;
  padding-left: 18px;
  border-left: 1px solid rgba(244, 241, 232, .15);
  color: #b8c1b9;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.export-actions { display: flex; align-items: center; gap: 8px; }
.export-themes { display: flex; align-items: center; gap: 5px; padding: 4px; border: 1px solid rgba(244,241,232,.13); border-radius: 999px; }
.export-theme {
  position: relative;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  background: var(--swatch);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.18);
  transition: transform .2s ease;
}
.export-theme:hover { transform: scale(1.1); }
.export-theme[aria-pressed="true"]::after {
  content: "";
  position: absolute;
  inset: -4px;
  border: 1px solid #f4f1e8;
  border-radius: 50%;
}
.export-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 13px;
  border: 1px solid rgba(244,241,232,.15);
  border-radius: 9px;
  background: rgba(244,241,232,.05);
  color: #e8ece3;
  font-size: 11px;
  cursor: pointer;
}
.export-btn:hover { background: rgba(244,241,232,.1); }
.export-btn .k { color: #8f9b91; font-size: 9px; }
.export-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 34px 82px 54px;
}
.export-frame {
  width: min(100%, calc((100svh - 178px) * 16 / 9));
  filter: drop-shadow(0 34px 60px rgba(0, 0, 0, .42));
}
.export-slide { display: none; }
.export-slide.is-active { display: block; animation: export-in .42s cubic-bezier(.2,.75,.25,1) both; }
@keyframes export-in { from { opacity: 0; transform: translateY(12px) scale(.992); } to { opacity: 1; transform: none; } }
.export-nav {
  position: absolute;
  top: 50%;
  z-index: 10;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid rgba(244,241,232,.16);
  border-radius: 50%;
  background: rgba(14,20,17,.65);
  color: #f4f1e8;
  cursor: pointer;
  transform: translateY(-50%);
  backdrop-filter: blur(10px);
  transition: background .2s, opacity .2s;
}
.export-nav:hover { background: rgba(34,48,40,.92); }
.export-nav:disabled { opacity: .24; cursor: default; }
.export-nav.prev { left: 22px; }
.export-nav.next { right: 22px; }
.export-bottom {
  position: absolute;
  right: 82px;
  bottom: 26px;
  left: 82px;
  display: flex;
  align-items: center;
  gap: 18px;
}
.export-progress { flex: 1; height: 2px; overflow: hidden; background: rgba(244,241,232,.12); }
.export-progress i { display: block; width: 10%; height: 100%; background: #e16141; transition: width .35s ease; }
.export-counter { color: #b8c1b9; font-size: 10px; font-variant-numeric: tabular-nums; letter-spacing: .16em; white-space: nowrap; }
.export-hint {
  position: absolute;
  bottom: 24px;
  left: 50%;
  z-index: 12;
  padding: 7px 13px;
  border: 1px solid rgba(244,241,232,.1);
  border-radius: 999px;
  background: rgba(14,20,17,.7);
  color: #98a49a;
  font-size: 10px;
  letter-spacing: .04em;
  white-space: nowrap;
  transform: translateX(-50%);
  transition: opacity .4s ease;
  pointer-events: none;
}
.export-hint.is-hidden { opacity: 0; }
.export-touch-hint { display: none; }
.notes {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  width: min(380px, 92vw);
  padding: 36px 30px;
  border-left: 1px solid rgba(244,241,232,.1);
  background: #121a15;
  box-shadow: -24px 0 60px rgba(0,0,0,.32);
  transform: translateX(104%);
  transition: transform .35s cubic-bezier(.2,.75,.25,1);
}
.notes.is-open { transform: none; }
.notes-kicker { color: #e16141; font-size: 9px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
.notes h2 { margin: 14px 0 18px; font-family: "Songti SC", SimSun, Georgia, serif; font-size: 25px; font-weight: 500; }
.notes p { margin: 0; color: #b8c1b9; font-size: 14px; line-height: 1.9; white-space: pre-wrap; }
.notes-close { position: absolute; top: 22px; right: 22px; border: 0; background: none; color: #8f9b91; font-size: 20px; cursor: pointer; }
@media (max-width: 760px) {
  .export-top { padding: 11px 14px; gap: 10px; }
  .export-deck-title { display: none; }
  .export-name span { display: none; }
  .export-actions { gap: 6px; }
  .export-themes { gap: 4px; padding: 3px; }
  .export-theme { width: 18px; height: 18px; }
  .export-btn { width: auto; height: 32px; padding: 0 9px; }
  .export-btn .label { display: inline; }
  .export-btn .k { display: none; }
  .export-stage { padding: 18px 12px 70px; }
  .export-frame { width: 100%; }
  .export-nav { display: none; }
  .export-bottom { right: 18px; bottom: 18px; left: 18px; }
  .export-hint { display: none; }
  .export-touch-hint {
    position: absolute;
    bottom: 48px;
    left: 50%;
    display: block;
    padding: 4px 9px;
    border: 1px solid rgba(244,241,232,.1);
    border-radius: 999px;
    background: rgba(14,20,17,.55);
    color: #98a49a;
    font-size: 9px;
    letter-spacing: .04em;
    white-space: nowrap;
    transform: translateX(-50%);
  }
  .notes { top: auto; left: 0; width: 100%; height: 48svh; border-top: 1px solid rgba(244,241,232,.12); border-left: 0; transform: translateY(104%); }
  .notes.is-open { transform: none; }
}
@media print {
  @page { size: landscape; margin: 0; }
  html, body { height: auto; overflow: visible; background: #fff; }
  .export-app { display: block; height: auto; }
  .export-top, .export-nav, .export-bottom, .export-hint, .notes { display: none !important; }
  .export-stage { display: block; padding: 0; }
  .export-frame { width: 100%; filter: none; }
  .export-slide { display: block !important; break-after: page; page-break-after: always; animation: none !important; }
  .export-slide:last-child { break-after: auto; page-break-after: auto; }
  .slide { box-shadow: none; }
}
`;

function themeButtons(theme: ThemeId): string {
  return THEMES.map(
    (item) => `<button class="export-theme" data-theme-choice="${item.id}" aria-label="切换到${item.name}主题" aria-pressed="${
      item.id === theme
    }" style="--swatch:${item.swatches[2]};background:linear-gradient(135deg, ${item.swatches[0]} 0 37%, ${item.swatches[1]} 37% 68%, ${item.swatches[2]} 68% 100%)" title="${item.name}"></button>`,
  ).join('');
}

export function buildStandaloneHtml(deck: Deck): string {
  const total = deck.slides.length;
  const theme = deck.theme;
  const title = deck.title || '织演演示';
  const themeName = getTheme(theme).name;

  const slideSections = deck.slides
    .map(
      (slide, index) =>
        `<section class="export-slide ${index === 0 ? 'is-active' : ''}" data-slide="${index}" aria-hidden="${
          index === 0 ? 'false' : 'true'
        }">${renderSlideArticle(slide, index, total, theme)}</section>`,
    )
    .join('\n');

  const script = `
(() => {
  const slides = Array.from(document.querySelectorAll('.export-slide'));
  const notes = document.getElementById('notes');
  const notesText = document.getElementById('notes-text');
  const notesClose = document.getElementById('notes-close');
  const progress = document.getElementById('progress-fill');
  const counter = document.getElementById('counter');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const hint = document.getElementById('hint');
  const themes = ${JSON.stringify(THEMES.map((item) => item.id))};
  let current = 0;
  let initialized = false;
  let notesOpen = false;

  const pad = (n) => String(n).padStart(2, '0');

  function go(nextIndex, updateHash = true) {
    const target = Math.max(0, Math.min(slides.length - 1, nextIndex));
    if (target === current && initialized) return;
    initialized = true;
    current = target;
    slides.forEach((slide, index) => {
      const active = index === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    const article = slides[current].querySelector('.slide');
    notesText.textContent = article?.dataset.note || '这一页没有备注。';
    progress.style.width = (((current + 1) / slides.length) * 100).toFixed(2) + '%';
    counter.textContent = pad(current + 1) + ' / ' + pad(slides.length);
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    if (updateHash && history.replaceState) history.replaceState(null, '', '#' + (current + 1));
  }

  function toggleNotes(force) {
    notesOpen = typeof force === 'boolean' ? force : !notesOpen;
    notes.classList.toggle('is-open', notesOpen);
    notes.setAttribute('aria-hidden', notesOpen ? 'false' : 'true');
  }

  function setTheme(id) {
    if (!themes.includes(id)) return;
    document.querySelectorAll('.slide').forEach((slide) => slide.setAttribute('data-theme', id));
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === id));
    });
    try { localStorage.setItem('slideweave-export-theme', id); } catch (_) {}
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {}
  }

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === ' ') {
      event.preventDefault(); go(current + 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') {
      event.preventDefault(); go(current - 1);
    } else if (key === 'Home') {
      event.preventDefault(); go(0);
    } else if (key === 'End') {
      event.preventDefault(); go(slides.length - 1);
    } else if (key === 'f' || key === 'F') {
      event.preventDefault(); void toggleFullscreen();
    } else if (key === 'n' || key === 'N') {
      event.preventDefault(); toggleNotes();
    } else if (key === 't' || key === 'T') {
      const currentTheme = document.querySelector('.slide')?.dataset.theme || '${theme}';
      const index = themes.indexOf(currentTheme);
      setTheme(themes[(index + 1) % themes.length]);
    } else if (key === 'Escape') {
      if (notesOpen) toggleNotes(false);
    }
  });

  prev.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  document.querySelector('.export-stage').addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    go(current + 1);
  });
  notesClose.addEventListener('click', () => toggleNotes(false));
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
  });
  document.getElementById('notes-toggle').addEventListener('click', () => toggleNotes());
  document.getElementById('fullscreen-toggle').addEventListener('click', toggleFullscreen);

  let touchStartX = null;
  document.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) touchStartX = event.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    touchStartX = null;
    if (Math.abs(delta) > 48) delta < 0 ? go(current + 1) : go(current - 1);
  }, { passive: true });

  const fromHash = parseInt(location.hash.replace('#', ''), 10);
  try {
    const savedTheme = localStorage.getItem('slideweave-export-theme');
    if (savedTheme) setTheme(savedTheme);
  } catch (_) {}
  go(Number.isFinite(fromHash) ? fromHash - 1 : 0, false);
  setTimeout(() => hint?.classList.add('is-hidden'), 5200);
})();`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="generator" content="Slideweave 织演" />
  <meta name="description" content="${escapeHtml(title)} — 由织演生成的独立网页演示" />
  <title>${escapeHtml(title)} · 织演</title>
  <style>${slideCss}\n${EXPORT_SHELL_CSS}</style>
</head>
<body data-theme="${theme}">
  <div class="export-app">
    <header class="export-top">
      <div class="export-brand">
        <span class="export-glyph" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="export-name">织演<span>SLIDEWEAVE</span></span>
        <span class="export-deck-title">${escapeHtml(title)} · ${escapeHtml(themeName)}</span>
      </div>
      <div class="export-actions">
        <div class="export-themes" role="group" aria-label="切换配色主题">${themeButtons(theme)}</div>
        <button class="export-btn" id="notes-toggle" type="button" aria-label="演讲者备注"><span class="label">备注</span><span class="k">N</span></button>
        <button class="export-btn" id="fullscreen-toggle" type="button" aria-label="全屏演示"><span class="label">全屏</span><span class="k">F</span></button>
      </div>
    </header>
    <main class="export-stage">
      <div class="export-frame" id="frame">
${slideSections}
      </div>
      <button class="export-nav prev" id="prev" type="button" aria-label="上一页">←</button>
      <button class="export-nav next" id="next" type="button" aria-label="下一页">→</button>
      <div class="export-bottom">
        <div class="export-progress" aria-hidden="true"><i id="progress-fill"></i></div>
        <span class="export-counter" id="counter">01 / ${pad(total)}</span>
      </div>
      <div class="export-hint" id="hint">← → 翻页 · F 全屏 · N 备注 · T 换主题</div>
      <div class="export-touch-hint">轻点或左右滑动翻页</div>
    </main>
  </div>
  <aside class="notes" id="notes" aria-hidden="true">
    <button class="notes-close" id="notes-close" type="button" aria-label="关闭备注">×</button>
    <div class="notes-kicker">Speaker notes</div>
    <h2>演讲者备注</h2>
    <p id="notes-text">这一页没有备注。</p>
  </aside>
  <script>${script}</script>
</body>
</html>`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function downloadStandaloneHtml(deck: Deck): void {
  const html = buildStandaloneHtml(deck);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = (deck.title || 'slideweave')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48);
  link.href = url;
  link.download = `${safeTitle || 'slideweave'}-${deck.theme}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}
