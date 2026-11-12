import { describe, expect, it } from 'vitest';
import { JsonObjectStream, findObjectEnd } from '../server/jsonStream.js';

describe('JsonObjectStream', () => {
  it('parses NDJSON objects across arbitrary chunk boundaries', () => {
    const stream = new JsonObjectStream();
    const input = [
      '{"kind":"deck","title":"一场演示","slideCount":3}',
      '{"kind":"slide","index":1,"title":"封面","layout":"cover"}',
      '{"kind":"end"}',
    ].join('\n');

    const objects = [];
    for (let index = 0; index < input.length; index += 7) {
      objects.push(...stream.push(input.slice(index, index + 7)));
    }
    objects.push(...stream.end());

    expect(objects).toHaveLength(3);
    expect(objects[0]).toMatchObject({ kind: 'deck', title: '一场演示' });
    expect(objects[1]).toMatchObject({ kind: 'slide', title: '封面' });
  });

  it('ignores code fences and prose around JSON', () => {
    const stream = new JsonObjectStream();
    const objects = stream.push(
      'Here you go:\n```json\n{"kind":"deck","title":"A"}\n```\nThanks!',
    );
    expect(objects).toEqual([{ kind: 'deck', title: 'A' }]);
  });

  it('does not treat braces inside strings as structure', () => {
    const stream = new JsonObjectStream();
    const objects = stream.push(
      '{"kind":"slide","quote":"左 { 中 } 右","nested":{"text":"} not the end"}}',
    );
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      quote: '左 { 中 } 右',
      nested: { text: '} not the end' },
    });
  });

  it('waits for a complete object before emitting it', () => {
    const stream = new JsonObjectStream();
    expect(stream.push('{"kind":"slide","title":"未')).toEqual([]);
    expect(stream.push('完成"}')).toEqual([{ kind: 'slide', title: '未完成' }]);
  });

  it('skips one malformed object but recovers the next', () => {
    const stream = new JsonObjectStream();
    const objects = stream.push('{"broken":}\n{"ok":true}');
    expect(objects).toEqual([{ ok: true }]);
  });

  it('handles pretty-printed multi-line JSON', () => {
    const stream = new JsonObjectStream();
    const objects = stream.push(`{
      "kind": "deck",
      "title": "多行",
      "slides": [
        { "title": "A" },
        { "title": "B" }
      ]
    }`);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({ kind: 'deck', title: '多行' });
  });

  it('findObjectEnd matches nested braces and escaped quotes', () => {
    const source = '{"a":{"b":"\\"}"},"c":1}';
    expect(findObjectEnd(source)).toBe(source.length - 1);
    expect(findObjectEnd('{"a":1')).toBe(-1);
  });
});
