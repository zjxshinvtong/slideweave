import type { ThemeId } from '../shared/schema.js';

/**
 * Deterministic fixture used by tests and by MOCK_AI=1 local previews.
 * It follows the exact same NDJSON contract as the real model.
 */
export function buildMockObjects(source: string, theme: ThemeId, requestedCount: number): unknown[] {
  const count = Math.max(3, Math.min(12, requestedCount || 8));
  const excerpt = source
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  const allSlides: Record<string, unknown>[] = [
    {
      kind: 'slide',
      index: 1,
      layout: 'cover',
      eyebrow: 'SLIDEWEAVE · AI PRESENTATION',
      title: '把复杂，讲得动人',
      subtitle: '从一段长文案，到一场有节奏的演示',
      note: '开场不要急着讲信息，先让观众感到这件事与自己有关。',
    },
    {
      kind: 'slide',
      index: 2,
      layout: 'agenda',
      eyebrow: 'AGENDA',
      title: '今天，我们聊三件事',
      bullets: [
        { title: '看见问题', text: '为什么信息越多，观众反而越记不住？' },
        { title: '找到结构', text: '用一条叙事线串起所有事实与洞察。' },
        { title: '形成行动', text: '让最后一页不只是结束，而是开始。' },
      ],
      note: '目录页不要逐个念，用一句话带过每一部分的价值。',
    },
    {
      kind: 'slide',
      index: 3,
      layout: 'statement',
      eyebrow: '核心判断',
      title: '观众记住的从来不是信息量，而是信息之间的距离。',
      subtitle: '演示不是把文档搬上屏幕，而是替观众完成一次认知整理。',
      note: '这句话放慢语速，停两秒，让观众消化。',
    },
    {
      kind: 'slide',
      index: 4,
      layout: 'bullets',
      eyebrow: '三个信号',
      title: '一份好演示，通常长这样',
      bullets: [
        { title: '一句话就能复述', text: '如果观众只能带走一句话，那句话必须足够锋利。' },
        { title: '每一页只做一件事', text: '页面不是仓库，而是一个个清晰的思考台阶。' },
        { title: '结尾给出下一步', text: '让观点落到行动，而不是停在掌声里。' },
      ],
      note: '这里的三个信号可以和观众现场确认：他们最近见过哪一个？',
    },
    {
      kind: 'slide',
      index: 5,
      layout: 'stats',
      eyebrow: '数据视角',
      title: '少一点，反而被记住更多',
      stats: [
        { value: '3×', label: '结构清晰的演示，信息留存率显著更高' },
        { value: '1', label: '每页只保留一个核心观点' },
        { value: '8', label: '分钟，是注意力重新集中前的窗口' },
      ],
      note: '强调数字背后的对比，不要只念数字。',
    },
    {
      kind: 'slide',
      index: 6,
      layout: 'two-col',
      eyebrow: '方法对比',
      title: '从「文档思维」切换到「舞台思维」',
      columns: [
        { title: '文档思维', items: ['按章节顺序搬运', '句子完整但缺少重点', '读者可以自行跳读'] },
        { title: '舞台思维', items: ['按注意力节奏编排', '每页一句话立住观点', '讲述者控制信息节拍'] },
      ],
      note: '可以问观众：你上一次把文档直接当 PPT，是什么时候？',
    },
    {
      kind: 'slide',
      index: 7,
      layout: 'timeline',
      eyebrow: '生成路径',
      title: '从文案到舞台，只需四步',
      timeline: [
        { label: '01', title: '提炼', text: '找出真正值得被记住的中心论点。' },
        { label: '02', title: '编排', text: '按钩子、冲突、洞察、行动重排信息。' },
        { label: '03', title: '视觉化', text: '为每种信息选择最合适的页面结构。' },
        { label: '04', title: '预演', text: '用键盘翻页，在真实节奏里打磨表达。' },
      ],
      note: '这页是流程总览，后续可以逐页展开。',
    },
    {
      kind: 'slide',
      index: 8,
      layout: 'quote',
      eyebrow: '一句提醒',
      title: '好的演示，是一次共同思考',
      quote:
        excerpt && excerpt.length > 12
          ? excerpt
          : '你不需要讲完所有内容，你只需要让观众愿意继续想下去。',
      author: 'Slideweave 编辑台',
      note: '用引语收束中段，为最后的行动号召留出空间。',
    },
    {
      kind: 'slide',
      index: 9,
      layout: 'statement',
      eyebrow: '转折',
      title: '视觉不是装饰，它是信息的第二层语法。',
      subtitle: '当版式、节奏与内容同频，观众会先感受到，再理解。',
      note: '这里可以展示切换主题后的同一页，让观众感受风格差异。',
    },
    {
      kind: 'slide',
      index: 10,
      layout: 'bullets',
      eyebrow: '实践清单',
      title: '下一次演示前，先问自己',
      bullets: [
        { title: '一句话是什么？', text: '如果只能说一句，你希望观众记住什么？' },
        { title: '哪里可以删？', text: '删掉不改变结论的内容，节奏才会出现。' },
        { title: '最后一步是什么？', text: '把观点翻译成观众明天就能做的动作。' },
      ],
      note: '把这三问留给观众，作为可以带走的工具。',
    },
    {
      kind: 'slide',
      index: 11,
      layout: 'closing',
      eyebrow: 'THANK YOU',
      title: '现在，轮到你讲了。',
      subtitle: '把下一段长文案交给织演，让想法站上舞台。',
      note: '停在这里，不要用「谢谢大家」稀释最后一句话的力量。',
    },
    {
      kind: 'slide',
      index: 12,
      layout: 'closing',
      eyebrow: 'Q & A',
      title: '问题，是最好的下一章。',
      subtitle: '扫描二维码，获取本次演示的独立 HTML 文件。',
      note: '留足提问时间。',
    },
  ];

  const deck = {
    kind: 'deck',
    title: '把复杂，讲得动人',
    subtitle: '从一段长文案，到一场有节奏的演示',
    slideCount: count,
    theme,
  };

  const cover = allSlides[0];
  const agenda = allSlides[1];
  const middle = allSlides.slice(2, 10);
  const closing = allSlides[10];
  const qa = allSlides[11];
  let selected: Record<string, unknown>[];

  if (count === 3) {
    selected = [cover, allSlides[2], closing];
  } else {
    selected = [
      cover,
      agenda,
      ...middle.slice(0, Math.max(1, count - 3)),
      ...(count >= 12 ? [qa] : []),
      closing,
    ].slice(0, count);
  }

  return [
    deck,
    ...selected.map((slide, index) => ({ ...slide, index: index + 1 })),
  ];
}
