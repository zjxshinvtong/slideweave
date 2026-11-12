export const THEME_IDS = ['ink', 'midnight', 'citrus', 'mono'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const LAYOUTS = [
  'cover',
  'agenda',
  'statement',
  'bullets',
  'two-col',
  'stats',
  'timeline',
  'quote',
  'closing',
] as const;
export type SlideLayout = (typeof LAYOUTS)[number];

export interface Bullet {
  title?: string;
  text: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Column {
  title: string;
  items: string[];
}

export interface TimelineItem {
  label: string;
  title: string;
  text?: string;
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  bullets?: Bullet[];
  stats?: Stat[];
  columns?: Column[];
  timeline?: TimelineItem[];
  quote?: string;
  author?: string;
  note?: string;
}

export interface Deck {
  id: string;
  title: string;
  subtitle?: string;
  theme: ThemeId;
  slides: Slide[];
  createdAt: string;
  model?: string;
}

export interface DeckMeta {
  title: string;
  subtitle?: string;
  slideCount: number;
  theme?: ThemeId;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  swatches: [string, string, string];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'ink',
    name: '墨纸',
    description: '编辑感 · 暖白与朱砂',
    swatches: ['#f3efe6', '#1c2822', '#d95538'],
  },
  {
    id: 'midnight',
    name: '极夜',
    description: '科技感 · 深空与极光',
    swatches: ['#0b1124', '#f4f6ff', '#7b7bff'],
  },
  {
    id: 'citrus',
    name: '柑橘',
    description: '清新感 · 奶油与橘绿',
    swatches: ['#fff4dd', '#263327', '#2f7350'],
  },
  {
    id: 'mono',
    name: '电场',
    description: '先锋感 · 纯黑与荧光',
    swatches: ['#11120f', '#f5f6e9', '#d9ff43'],
  },
];

export const LAYOUT_LABELS: Record<SlideLayout, string> = {
  cover: '封面',
  agenda: '目录',
  statement: '观点',
  bullets: '要点',
  'two-col': '对比',
  stats: '数据',
  timeline: '路径',
  quote: '引言',
  closing: '收束',
};

export const MAX_SOURCE_LENGTH = 24_000;
export const MIN_SOURCE_LENGTH = 40;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export function isSlideLayout(value: unknown): value is SlideLayout {
  return typeof value === 'string' && (LAYOUTS as readonly string[]).includes(value);
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function makeId(prefix = 'deck'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A last line of defence for any text that reaches an exported HTML document. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
