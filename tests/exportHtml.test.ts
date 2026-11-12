import { describe, expect, it } from 'vitest';
import type { Deck } from '../shared/schema.js';
import { buildStandaloneHtml } from '../src/lib/exportHtml.js';

const deck: Deck = {
  id: 'deck-test',
  title: '导出测试 <script>alert("x")</script>',
  subtitle: '一个独立文件',
  theme: 'ink',
  createdAt: new Date().toISOString(),
  slides: [
    {
      id: 'slide-1',
      layout: 'cover',
      eyebrow: 'TEST',
      title: '封面标题',
      subtitle: '副标题',
      note: '演讲者备注',
    },
    {
      id: 'slide-2',
      layout: 'bullets',
      title: '关键要点',
      bullets: [
        { title: '一', text: '这是第一点' },
        { title: '二', text: '这是第二点' },
      ],
      note: '</script><script>alert(1)</script>',
    },
    {
      id: 'slide-3',
      layout: 'closing',
      title: '结束',
      subtitle: '下一章',
    },
  ],
};

describe('standalone HTML export', () => {
  const html = buildStandaloneHtml(deck);

  it('emits a complete standalone document with all slides', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>');
    expect((html.match(/class="export-slide /g) ?? []).length).toBe(3);
    expect(html).toContain('id="prev"');
    expect(html).toContain('id="next"');
    expect((html.match(/data-theme-choice=/g) ?? []).length).toBe(4);
    expect(html).not.toContain('<link rel="stylesheet"');
    expect(html).not.toMatch(/<script[^>]+src=/);
  });

  it('inlines the slide design system so it works offline', () => {
    expect(html).toContain('.slide[data-theme="ink"]');
    expect(html).toContain('container-type: inline-size');
    expect(html).toContain('@media print');
  });

  it('escapes model-provided content and notes', () => {
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('contains keyboard, theme and notes controls', () => {
    expect(html).toContain('ArrowRight');
    expect(html).toContain('keydown');
    expect(html).toContain('Speaker notes');
    expect(html).toContain('fullscreen');
    expect(html).toContain('localStorage');
  });

  it('supports every layout without throwing', () => {
    const layouts = [
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
    const allLayouts: Deck = {
      ...deck,
      slides: layouts.map((layout, index) => ({
        id: `s-${index}`,
        layout,
        title: `布局 ${layout}`,
        bullets: [{ title: 'A', text: 'B' }],
        stats: [{ value: '1', label: 'one' }],
        columns: [{ title: '左', items: ['a'] }, { title: '右', items: ['b'] }],
        timeline: [{ label: '01', title: '开始', text: '说明' }],
        quote: '一句引语',
        author: '作者',
      })),
    };
    const output = buildStandaloneHtml(allLayouts);
    expect((output.match(/class="export-slide /g) ?? []).length).toBe(9);
    expect(output).toContain('layout-two-col');
    expect(output).toContain('layout-stats');
    expect(output).toContain('布局 quote');
  });

  it('breaks a long cover title at natural punctuation', () => {
    const longCover: Deck = {
      ...deck,
      slides: [
        {
          id: 'cover',
          layout: 'cover',
          title: '为什么好故事，能让产品被记住？',
          subtitle: '从功能到记忆',
        },
      ],
    };
    const output = buildStandaloneHtml(longCover);
    expect(output).toContain('为什么好故事，<br />能让产品被记住？');
    expect(output).toContain('cover-title-md');
  });
});
