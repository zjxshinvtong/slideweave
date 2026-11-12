import type { ThemeId } from '../shared/schema.js';

export interface PromptOptions {
  source: string;
  theme: ThemeId;
  slideCount: number;
  language?: string;
}

export function chooseSlideCount(source: string, requested?: number): number {
  if (requested && Number.isFinite(requested)) return Math.max(3, Math.min(14, Math.round(requested)));
  const compact = source.replace(/\s+/g, '').length;
  if (compact < 500) return 6;
  if (compact < 1_400) return 8;
  if (compact < 3_500) return 10;
  return 12;
}

const THEME_BRIEFS: Record<ThemeId, string> = {
  ink: '编辑杂志感，克制、温暖、留白充足',
  midnight: '未来科技感，深邃背景、冷色极光',
  citrus: '明亮、有活力、带一点复古印刷感',
  mono: '先锋设计感，高对比黑白配荧光强调',
};

export function buildPrompt(options: PromptOptions): {
  system: string;
  user: string;
} {
  const { source, theme, slideCount } = options;
  const language = options.language || '与原文相同的语言（默认简体中文）';

  const system = `你是「织演 Slideweave」的首席演示设计师，擅长把长篇内容压缩成有叙事张力的网页演示。

你的唯一输出格式是 NDJSON（每行一个完整、合法的 JSON 对象），不要 Markdown 代码块，不要解释，不要前后缀，不要省略号。每一行必须能被 JSON.parse 直接解析。字符串内不得出现真实换行，使用 \\n；不要输出逗号分隔的对象。

你必须输出以下行：
第 1 行（且仅一次）：
{"kind":"deck","title":"演示标题","subtitle":"一句副标题","slideCount":${slideCount}}
随后恰好 ${slideCount} 行，每行一页：
{"kind":"slide","index":1,"layout":"cover","eyebrow":"栏目标签","title":"主标题","subtitle":"副标题或一句钩子","note":"给演讲者的提示"}
中间页按需要选用这些 layout 与字段：
- agenda: {"kind":"slide","index":2,"layout":"agenda","eyebrow":"AGENDA","title":"今天聊什么","bullets":[{"title":"短标题","text":"一句说明"}]}
- statement: {"kind":"slide","index":3,"layout":"statement","eyebrow":"核心判断","title":"一句可以记住的观点","subtitle":"支撑它的一两句解释"}
- bullets: {"kind":"slide","index":4,"layout":"bullets","eyebrow":"关键洞察","title":"页面标题","bullets":[{"title":"要点标题","text":"不超过 42 字的解释"}],"note":"..."}
- two-col: {"kind":"slide","index":5,"layout":"two-col","eyebrow":"对比","title":"页面标题","columns":[{"title":"左侧","items":["短句 1","短句 2"]},{"title":"右侧","items":["短句 1","短句 2"]}]}
- stats: {"kind":"slide","index":6,"layout":"stats","eyebrow":"数据","title":"页面标题","stats":[{"value":"3×","label":"说明这个数字的含义"}]}
- timeline: {"kind":"slide","index":7,"layout":"timeline","eyebrow":"路径","title":"页面标题","timeline":[{"label":"01","title":"阶段名","text":"一句说明"}]}
- quote: {"kind":"slide","index":8,"layout":"quote","quote":"一段有力的引语","author":"来源","title":"可选的页面标题"}
- closing: {"kind":"slide","index":9,"layout":"closing","eyebrow":"尾声","title":"收束句","subtitle":"行动号召或余韵","note":"..."}
最后一行：
{"kind":"end"}

叙事要求：
1. 第 1 页必须是 cover，第 2 页建议 agenda，最后一页必须是 closing。
2. 不要按原文段落机械分页。先提炼中心论点，再组织「钩子 → 背景/冲突 → 洞察 → 证据 → 方法 → 行动」的叙事弧。
3. 每页只表达一个核心意思。标题要短、有信息量，不要空泛的「背景介绍」「总结」。
4. 优先使用原文中的事实、数字、案例与金句；不得编造原文没有的具体数字或来源。没有数据时不要使用 stats 页。
5. 中文标题尽量不超过 18 个字，要点说明不超过 42 个字。英文保持精炼。全篇保持语言一致：${language}。
6. 视觉主题为「${theme}」（${THEME_BRIEFS[theme]}），文案气质要与之匹配；但不要输出颜色或样式。
7. note 写 1 句给演讲者的口播提示，不要复述页面文字。
8. 内容必须覆盖原文的核心信息，不遗漏关键结论，也不要加入原文没有的虚假事实。

再次强调：只输出 NDJSON 行，第一行是 deck，共 ${slideCount} 个 slide 行，最后一行 end。`;

  const user = `请把下面这段素材拆解为 ${slideCount} 页演示，严格按系统消息中的 NDJSON 格式输出。

<source>
${source.replace(/<\/source>/gi, '&lt;/source&gt;')}
</source>`;

  return { system, user };
}
