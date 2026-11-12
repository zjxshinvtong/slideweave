import {
  type Bullet,
  type Column,
  type DeckMeta,
  type Slide,
  type SlideLayout,
  type Stat,
  type ThemeId,
  type TimelineItem,
  isSlideLayout,
} from '../shared/schema.js';

const LAYOUT_ALIASES: Record<string, SlideLayout> = {
  cover: 'cover',
  title: 'cover',
  intro: 'cover',
  agenda: 'agenda',
  contents: 'agenda',
  toc: 'agenda',
  statement: 'statement',
  manifesto: 'statement',
  section: 'statement',
  bullets: 'bullets',
  bullet: 'bullets',
  list: 'bullets',
  points: 'bullets',
  'two-col': 'two-col',
  two_col: 'two-col',
  twocol: 'two-col',
  comparison: 'two-col',
  columns: 'two-col',
  stats: 'stats',
  data: 'stats',
  numbers: 'stats',
  timeline: 'timeline',
  process: 'timeline',
  roadmap: 'timeline',
  quote: 'quote',
  testimonial: 'quote',
  closing: 'closing',
  end: 'closing',
  summary: 'closing',
  封面: 'cover',
  目录: 'agenda',
  观点: 'statement',
  要点: 'bullets',
  对比: 'two-col',
  数据: 'stats',
  路径: 'timeline',
  引言: 'quote',
  结尾: 'closing',
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function text(value: unknown, max: number): string {
  if (typeof value === 'number') return String(value).slice(0, max);
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/^[ \t]*[•·*-][ \t]+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

function stringList(value: unknown, maxItems: number, maxLength = 140): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return text(item, maxLength);
      const object = record(item);
      return text(object.text ?? object.title ?? object.label, maxLength);
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeBullets(value: unknown): Bullet[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return { text: text(item, 180) };
      const object = record(item);
      const body = text(object.text ?? object.content ?? object.description ?? object.body, 180);
      const heading = text(object.title ?? object.heading ?? object.label, 60);
      if (!body && !heading) return null;
      return { ...(heading ? { title: heading } : {}), text: body || heading };
    })
    .filter((item): item is Bullet => Boolean(item))
    .slice(0, 8);
}

function normalizeStats(value: unknown): Stat[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const object = record(item);
      const valueText = text(object.value ?? object.number ?? object.metric, 30);
      const label = text(object.label ?? object.description ?? object.title, 80);
      return valueText && label ? { value: valueText, label } : null;
    })
    .filter((item): item is Stat => Boolean(item))
    .slice(0, 4);
}

function normalizeColumns(value: unknown): Column[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const object = record(item);
      const title = text(object.title ?? object.label ?? object.heading, 60);
      const items = stringList(
        object.items ?? object.points ?? object.bullets ?? object.content,
        6,
        120,
      );
      return title && items.length ? { title, items } : null;
    })
    .filter((item): item is Column => Boolean(item))
    .slice(0, 3);
}

function normalizeTimeline(value: unknown): TimelineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const object = record(item);
      const title = text(object.title ?? object.heading ?? object.label, 60);
      const label = text(object.label ?? object.step ?? object.phase ?? object.date, 24);
      const body = text(object.text ?? object.description ?? object.content, 120);
      if (!title && !body) return null;
      return {
        label: label || String(index + 1).padStart(2, '0'),
        title: title || body,
        ...(body ? { text: body } : {}),
      };
    })
    .filter((item): item is TimelineItem => Boolean(item))
    .slice(0, 6);
}

export function inferLayout(object: UnknownRecord): SlideLayout {
  const raw = text(object.layout ?? object.type, 24).toLowerCase();
  if (isSlideLayout(raw)) return raw;
  if (LAYOUT_ALIASES[raw]) return LAYOUT_ALIASES[raw];
  if (Array.isArray(object.stats) && object.stats.length) return 'stats';
  if (Array.isArray(object.timeline) && object.timeline.length) return 'timeline';
  if (Array.isArray(object.columns) && object.columns.length) return 'two-col';
  if (Array.isArray(object.quote) || typeof object.quote === 'string') return 'quote';
  if (Array.isArray(object.bullets) && object.bullets.length) return 'bullets';
  return 'statement';
}

export function normalizeSlide(value: unknown, order: number): Slide | null {
  const object = record(value);
  const layout = inferLayout(object);
  const title = text(
    object.title ?? object.heading ?? object.headline ?? object.statement,
    110,
  );
  const subtitle = text(
    object.subtitle ?? object.description ?? object.summary ?? object.subhead,
    240,
  );
  const quote = text(object.quote ?? object.text, 320);
  const bullets = normalizeBullets(
    object.bullets ?? object.points ?? object.items ?? object.takeaways,
  );
  const stats = normalizeStats(object.stats ?? object.metrics ?? object.numbers);
  const columns = normalizeColumns(object.columns ?? object.compare ?? object.sides);
  const timeline = normalizeTimeline(object.timeline ?? object.steps ?? object.process);

  if (!title && !quote && !bullets.length && !stats.length && !columns.length) return null;

  return {
    id: `slide-${order + 1}`,
    layout,
    ...(text(object.eyebrow ?? object.kicker ?? object.label, 40)
      ? { eyebrow: text(object.eyebrow ?? object.kicker ?? object.label, 40) }
      : {}),
    title: title || quote.slice(0, 110),
    ...(subtitle ? { subtitle } : {}),
    ...(bullets.length ? { bullets } : {}),
    ...(stats.length ? { stats } : {}),
    ...(columns.length ? { columns } : {}),
    ...(timeline.length ? { timeline } : {}),
    ...(quote ? { quote } : {}),
    ...(text(object.author ?? object.source ?? object.attribution, 60)
      ? { author: text(object.author ?? object.source ?? object.attribution, 60) }
      : {}),
    ...(text(object.note ?? object.notes ?? object.speakerNotes, 400)
      ? { note: text(object.note ?? object.notes ?? object.speakerNotes, 400) }
      : {}),
  };
}

export interface ComposerEvent {
  type: 'meta' | 'slide' | 'end';
  meta?: DeckMeta;
  slide?: Slide;
  index?: number;
}

export class DeckComposer {
  private meta: DeckMeta | null = null;
  private slides: Slide[] = [];
  private seenIndexes = new Set<number>();
  private ended = false;

  addObject(value: unknown): ComposerEvent[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.addObject(item));
    }

    const object = record(value);
    if (!Object.keys(object).length) return [];

    // A single full-deck JSON object is accepted as a fallback.
    if (Array.isArray(object.slides) && object.kind !== 'slide') {
      const events: ComposerEvent[] = [];
      const meta = this.applyMeta(object);
      if (meta) events.push({ type: 'meta', meta });
      object.slides.forEach((slide) => {
        const event = this.addSlide(slide);
        if (event) events.push(event);
      });
      return events;
    }

    const kind = text(object.kind ?? object.type, 24).toLowerCase();
    if (kind === 'end' || kind === 'done' || kind === 'end_deck') {
      this.ended = true;
      return [{ type: 'end' }];
    }
    if (kind === 'meta' || kind === 'deck' || Array.isArray(object.outline)) {
      if (kind === 'deck' || kind === 'meta' || object.slideCount || object.title) {
        const meta = this.applyMeta(object);
        return meta ? [{ type: 'meta', meta }] : [];
      }
    }
    if (kind === 'slide' || kind === 'page' || !kind) {
      const event = this.addSlide(object);
      return event ? [event] : [];
    }
    return [];
  }

  private applyMeta(object: UnknownRecord): DeckMeta | null {
    const title = text(object.title ?? object.deckTitle ?? object.name, 110);
    const subtitle = text(object.subtitle ?? object.description ?? object.tagline, 200);
    const rawCount = Number(object.slideCount ?? object.pages ?? object.total);
    if (!title && !subtitle && !Number.isFinite(rawCount)) return null;

    const count = Number.isFinite(rawCount) ? Math.max(3, Math.min(16, Math.round(rawCount))) : 0;
    this.meta = {
      title: title || this.meta?.title || '未命名演示',
      ...(subtitle ? { subtitle } : {}),
      slideCount: count || this.meta?.slideCount || 0,
    };
    return this.meta;
  }

  private addSlide(value: unknown): ComposerEvent | null {
    const object = record(value);
    const rawIndex = Number(object.index ?? object.page ?? object.order);
    if (Number.isFinite(rawIndex) && rawIndex > 0) {
      if (this.seenIndexes.has(rawIndex)) return null;
      this.seenIndexes.add(rawIndex);
    }
    const slide = normalizeSlide(object, this.slides.length);
    if (!slide) return null;
    this.slides.push(slide);
    if (this.meta) this.meta.slideCount = Math.max(this.meta.slideCount, this.slides.length);
    return { type: 'slide', slide, index: this.slides.length };
  }

  get slideCount(): number {
    return this.slides.length;
  }

  get expectedCount(): number {
    return this.meta?.slideCount ?? 0;
  }

  get didEnd(): boolean {
    return this.ended;
  }

  getMeta(): DeckMeta | null {
    if (this.meta) return this.meta;
    if (!this.slides.length) return null;
    const first = this.slides[0];
    return {
      title: first.title || '未命名演示',
      ...(first.subtitle ? { subtitle: first.subtitle } : {}),
      slideCount: this.slides.length,
    };
  }

  finalize(theme: ThemeId, model?: string): { meta: DeckMeta; slides: Slide[] } | null {
    if (!this.slides.length) return null;
    const meta = this.getMeta();
    if (!meta) return null;
    return {
      meta: {
        ...meta,
        slideCount: this.slides.length,
      },
      slides: this.slides.map((slide, index) => ({ ...slide, id: `slide-${index + 1}` })),
    };
  }
}
