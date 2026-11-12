import { LAYOUT_LABELS, escapeHtml, type Slide } from '../../shared/schema.js';

const pad = (value: number) => String(value).padStart(2, '0');

function text(value: string | undefined, fallback = ''): string {
  return escapeHtml((value ?? fallback).trim());
}

function titleClass(title: string): string {
  const length = [...title].length;
  if (length > 38) return 'title-xs';
  if (length > 22) return 'title-sm';
  return '';
}

function topBar(slide: Slide): string {
  return `
    <div class="slide-top">
      <div class="slide-logo" aria-label="织演 Slideweave">
        <span class="logo-glyph"><i></i><i></i><i></i></span>
        <span class="logo-text">织演<em>SLIDEWEAVE</em></span>
      </div>
      <span class="slide-kicker">${text(slide.eyebrow, LAYOUT_LABELS[slide.layout])}</span>
    </div>`;
}

function footBar(slide: Slide, index: number, total: number): string {
  return `
    <div class="slide-foot">
      <span class="foot-title">${text(slide.title, 'Slideweave')}</span>
      <span class="foot-count">${pad(index + 1)}<i>/</i>${pad(total)}</span>
    </div>`;
}

function heading(slide: Slide, level: 1 | 2 = 2): string {
  const tag = level === 1 ? 'h1' : 'h2';
  return `<${tag} class="layout-title ${titleClass(slide.title)}">${text(slide.title)}</${tag}>`;
}

function coverTitleClass(title: string): string {
  const length = [...title].length;
  if (length > 26) return 'cover-title-xs';
  if (length > 18) return 'cover-title-sm';
  if (length > 10) return 'cover-title-md';
  return '';
}

/** Breaks a cover title at natural punctuation, or near the middle for long lines. */
function coverTitleHtml(title: string): string {
  const chars = [...title];
  if (chars.length <= 10) return text(title);

  const punctuation = ['，', '：', '；', ',', ':', ';', '—', '·'];
  const candidates = punctuation
    .map((mark) => title.indexOf(mark))
    .filter((index) => index >= Math.floor(chars.length * 0.26));
  let split = candidates.length ? candidates[0] : -1;

  if (split < 0) {
    const space = title.indexOf(' ', Math.floor(chars.length * 0.35));
    split = space >= 0 ? space : Math.ceil(chars.length / 2) - 1;
  }

  const left = title.slice(0, split + 1).trim();
  const right = title.slice(split + 1).trim();
  if (!left || !right) return text(title);
  return `${escapeHtml(left)}<br />${escapeHtml(right)}`;
}

function cover(slide: Slide): string {
  return `
    <div class="cover-grid">
      <div class="cover-copy">
        <span class="slide-label">${text(slide.eyebrow, 'AI PRESENTATION')}</span>
        <h1 class="layout-title ${coverTitleClass(slide.title)}">${coverTitleHtml(slide.title)}</h1>
        ${slide.subtitle ? `<p class="cover-sub">${text(slide.subtitle)}</p>` : ''}
        <div class="cover-meta">
          <span><i class="meta-dot"></i> STORY FIRST</span>
          <span>TEXT → STAGE</span>
        </div>
      </div>
      <div class="cover-art" aria-hidden="true">
        <div class="cover-ring cover-ring-a"></div>
        <div class="cover-ring cover-ring-b"></div>
        <div class="cover-ring cover-ring-c"></div>
        <div class="cover-orb"></div>
        <span class="cover-index">01</span>
        <div class="cover-chip">
          <span>把想法</span>
          <strong>变成现场</strong>
        </div>
        <span class="cover-caption">MADE WITH SLIDEWEAVE</span>
      </div>
    </div>`;
}

function agenda(slide: Slide): string {
  const bullets = slide.bullets ?? [];
  const items = bullets
    .map(
      (bullet, index) => `
      <li class="agenda-item">
        <span class="agenda-index">${pad(index + 1)}</span>
        <div class="agenda-copy">
          ${bullet.title ? `<strong>${text(bullet.title)}</strong>` : ''}
          <p>${text(bullet.text)}</p>
        </div>
        <span class="agenda-arrow">↗</span>
      </li>`,
    )
    .join('');
  return `
    <div class="split-layout">
      <div class="section-head">
        <span class="slide-label">${text(slide.eyebrow, 'AGENDA')}</span>
        ${heading(slide)}
        ${slide.subtitle ? `<p class="section-sub">${text(slide.subtitle)}</p>` : ''}
      </div>
      <ol class="agenda-list">${items}</ol>
    </div>`;
}

function statement(slide: Slide): string {
  return `
    <div class="statement-wrap">
      <span class="slide-label">${text(slide.eyebrow, '核心判断')}</span>
      ${heading(slide)}
      ${slide.subtitle ? `<p class="statement-sub">${text(slide.subtitle)}</p>` : ''}
      <div class="statement-mark" aria-hidden="true"><span></span><i>✦</i></div>
    </div>`;
}

function bullets(slide: Slide): string {
  const items = slide.bullets ?? [];
  const cards = items
    .map(
      (bullet, index) => `
      <article class="bullet-card ${index === 0 ? 'is-primary' : ''}">
        <span class="bullet-index">${pad(index + 1)}</span>
        <div>
          ${bullet.title ? `<h3>${text(bullet.title)}</h3>` : ''}
          <p>${text(bullet.text)}</p>
        </div>
        <span class="bullet-line"></span>
      </article>`,
    )
    .join('');
  return `
    <div class="layout-head">
      <span class="slide-label">${text(slide.eyebrow, 'KEY IDEAS')}</span>
      ${heading(slide)}
      ${slide.subtitle ? `<p class="section-sub">${text(slide.subtitle)}</p>` : ''}
    </div>
    <div class="bullet-grid count-${Math.min(items.length, 4)}">${cards}</div>`;
}

function twoCol(slide: Slide): string {
  const columns = slide.columns ?? [];
  const panels = columns
    .map(
      (column, index) => `
      <article class="compare-panel ${index === 1 ? 'is-accent' : ''}">
        <div class="compare-head">
          <span class="compare-index">${pad(index + 1)}</span>
          <h3>${text(column.title)}</h3>
        </div>
        <ul>
          ${column.items.map((item) => `<li><span>→</span>${text(item)}</li>`).join('')}
        </ul>
      </article>`,
    )
    .join('');
  return `
    <div class="layout-head">
      <span class="slide-label">${text(slide.eyebrow, 'COMPARE')}</span>
      ${heading(slide)}
      ${slide.subtitle ? `<p class="section-sub">${text(slide.subtitle)}</p>` : ''}
    </div>
    <div class="compare-grid count-${Math.max(2, columns.length)}">${panels}</div>`;
}

function stats(slide: Slide): string {
  const items = slide.stats ?? [];
  const cells = items
    .map(
      (stat, index) => `
      <div class="stat-cell">
        <span class="stat-index">${pad(index + 1)}</span>
        <strong class="stat-value">${text(stat.value)}</strong>
        <span class="stat-bar"></span>
        <p>${text(stat.label)}</p>
      </div>`,
    )
    .join('');
  return `
    <div class="layout-head">
      <span class="slide-label">${text(slide.eyebrow, 'BY THE NUMBERS')}</span>
      ${heading(slide)}
      ${slide.subtitle ? `<p class="section-sub">${text(slide.subtitle)}</p>` : ''}
    </div>
    <div class="stats-row count-${Math.max(1, items.length)}">${cells}</div>`;
}

function timeline(slide: Slide): string {
  const items = slide.timeline ?? [];
  const steps = items
    .map(
      (item, index) => `
      <article class="timeline-step">
        <div class="timeline-node">
          <span>${text(item.label, pad(index + 1))}</span>
        </div>
        <h3>${text(item.title)}</h3>
        ${item.text ? `<p>${text(item.text)}</p>` : ''}
      </article>`,
    )
    .join('');
  return `
    <div class="layout-head">
      <span class="slide-label">${text(slide.eyebrow, 'THE PATH')}</span>
      ${heading(slide)}
      ${slide.subtitle ? `<p class="section-sub">${text(slide.subtitle)}</p>` : ''}
    </div>
    <div class="timeline-track count-${Math.max(1, items.length)}">${steps}</div>`;
}

function quote(slide: Slide): string {
  return `
    <div class="quote-wrap">
      <span class="quote-mark" aria-hidden="true">“</span>
      <span class="slide-label">${text(slide.eyebrow, 'QUOTE')}</span>
      <blockquote class="${titleClass(slide.quote ?? slide.title)}">${text(
        slide.quote,
        slide.title,
      )}</blockquote>
      <div class="quote-meta">
        <span class="quote-rule"></span>
        <span>${text(slide.author, 'SLIDEWEAVE')}</span>
      </div>
      <div class="quote-orb" aria-hidden="true"></div>
    </div>`;
}

function closing(slide: Slide): string {
  return `
    <div class="closing-wrap">
      <span class="slide-label">${text(slide.eyebrow, 'THE END / THE START')}</span>
      ${heading(slide, 1)}
      ${slide.subtitle ? `<p class="closing-sub">${text(slide.subtitle)}</p>` : ''}
      <div class="closing-cta"><span>让想法站上舞台</span><i>↗</i></div>
      <div class="closing-art" aria-hidden="true">
        <span class="closing-ring"></span>
        <span class="closing-ring closing-ring-b"></span>
        <span class="closing-star">✦</span>
        <span class="closing-word">FIN</span>
      </div>
    </div>`;
}

const LAYOUT_RENDERERS: Record<Slide['layout'], (slide: Slide) => string> = {
  cover,
  agenda,
  statement,
  bullets,
  'two-col': twoCol,
  stats,
  timeline,
  quote,
  closing,
};

/** Renders the inner DOM for a slide. All model output is HTML-escaped here. */
export function renderSlideInner(slide: Slide, index: number, total: number): string {
  const renderer = LAYOUT_RENDERERS[slide.layout] ?? statement;
  return `
    <div class="slide-noise" aria-hidden="true"></div>
    ${topBar(slide)}
    <div class="slide-main">${renderer(slide)}</div>
    ${footBar(slide, index, total)}
    <span class="slide-edge" aria-hidden="true"></span>`;
}

/** Standalone article used by the exported HTML file. */
export function renderSlideArticle(
  slide: Slide,
  index: number,
  total: number,
  theme: string,
): string {
  return `<article class="slide layout-${slide.layout}" data-theme="${theme}" data-index="${index}" data-note="${escapeHtml(
    slide.note ?? '',
  )}">${renderSlideInner(slide, index, total)}</article>`;
}
