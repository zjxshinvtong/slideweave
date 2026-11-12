import { describe, expect, it } from 'vitest';
import { DeckComposer, normalizeSlide } from '../server/deckBuilder.js';

describe('DeckComposer', () => {
  it('collects meta + slides and produces a normalized deck', () => {
    const composer = new DeckComposer();
    composer.addObject({
      kind: 'deck',
      title: '把复杂讲清楚',
      subtitle: '一份演示的结构方法',
      slideCount: 3,
    });
    composer.addObject({
      kind: 'slide',
      index: 1,
      layout: 'cover',
      title: '把复杂讲清楚',
      subtitle: '从文案到舞台',
    });
    composer.addObject({
      kind: 'slide',
      index: 2,
      layout: 'bullets',
      title: '三条原则',
      bullets: ['先结论', { title: '再结构', text: '最后补充证据' }],
    });
    composer.addObject({
      kind: 'slide',
      index: 3,
      layout: 'closing',
      title: '轮到你了',
    });
    composer.addObject({ kind: 'end' });

    const result = composer.finalize('ink');
    expect(result).not.toBeNull();
    expect(result!.meta.title).toBe('把复杂讲清楚');
    expect(result!.meta.slideCount).toBe(3);
    expect(result!.slides).toHaveLength(3);
    expect(result!.slides[1].bullets).toEqual([
      { text: '先结论' },
      { title: '再结构', text: '最后补充证据' },
    ]);
    expect(composer.didEnd).toBe(true);
  });

  it('accepts a full deck object as a fallback', () => {
    const composer = new DeckComposer();
    composer.addObject({
      title: '完整 JSON',
      slideCount: 2,
      slides: [
        { layout: 'cover', title: '开场' },
        { layout: 'closing', title: '收束' },
      ],
    });
    const result = composer.finalize('midnight');
    expect(result!.slides).toHaveLength(2);
    expect(result!.slides[0].layout).toBe('cover');
  });

  it('deduplicates slide indexes', () => {
    const composer = new DeckComposer();
    composer.addObject({ kind: 'deck', title: 'D', slideCount: 2 });
    composer.addObject({ kind: 'slide', index: 1, title: '第一版' });
    composer.addObject({ kind: 'slide', index: 1, title: '重复投递' });
    composer.addObject({ kind: 'slide', index: 2, title: '第二页' });
    const result = composer.finalize('ink');
    expect(result!.slides.map((slide) => slide.title)).toEqual(['第一版', '第二页']);
  });

  it('returns null when nothing usable was generated', () => {
    const composer = new DeckComposer();
    composer.addObject({ kind: 'slide', layout: 'cover' });
    expect(composer.finalize('ink')).toBeNull();
  });

  it('infers a layout from content when the model forgets it', () => {
    const slide = normalizeSlide(
      {
        title: '三个数字',
        stats: [
          { value: '3×', label: '增长' },
          { value: '42%', label: '节省' },
        ],
      },
      0,
    );
    expect(slide?.layout).toBe('stats');
    expect(slide?.stats).toHaveLength(2);
  });

  it('sanitizes lengths and unsupported layouts', () => {
    const slide = normalizeSlide(
      {
        layout: 'unknown-evil-layout',
        title: 'A'.repeat(300),
        bullets: Array.from({ length: 30 }, (_, index) => `第 ${index} 条`),
        note: 'x'.repeat(1_000),
        script: '<script>alert(1)</script>',
      },
      0,
    );
    expect(slide).not.toBeNull();
    expect(slide!.layout).toBe('bullets');
    expect([...slide!.title].length).toBeLessThanOrEqual(110);
    expect(slide!.bullets!.length).toBeLessThanOrEqual(8);
    expect([...(slide!.note ?? '')].length).toBeLessThanOrEqual(400);
    expect(slide).not.toHaveProperty('script');
  });

  it('keeps valid Chinese layout aliases', () => {
    const slide = normalizeSlide({ layout: '数据', title: '数字', stats: [{ value: '1', label: 'x' }] }, 0);
    expect(slide?.layout).toBe('stats');
  });
});
