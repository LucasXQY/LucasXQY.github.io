import { describe, expect, it } from 'vitest';
import { placeholderSvg } from '../../src/lib/placeholder';

const PREFIX = 'data:image/svg+xml;utf8,';
const decode = (uri: string) => decodeURIComponent(uri.slice(PREFIX.length));

describe('placeholderSvg', () => {
  it('returns an svg data URI that shows the label', () => {
    const uri = placeholderSvg('prin', 'PR');
    expect(uri.startsWith(PREFIX)).toBe(true);
    expect(uri).toContain('PR');
    expect(decode(uri)).toMatch(/^<svg[\s\S]*>PR<\/text>[\s\S]*<\/svg>$/);
  });

  it('escapes characters that would break a data URI or the XML', () => {
    const uri = placeholderSvg('x', '<&');
    const body = uri.slice(PREFIX.length);
    expect(body).not.toMatch(/[<>#"']/);
    expect(decode(uri)).toContain('&lt;&amp;');
  });

  it('shows only the first two characters of the label', () => {
    expect(decode(placeholderSvg('s', 'Prin'))).toContain('>Pr<');
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(placeholderSvg('prin', 'PR')).toBe(placeholderSvg('prin', 'PR'));
    const backgrounds = new Set(
      ['prin', 'vetonet', 'gw-yolo', 'dt-hrc', 'microgrid', 'a', 'b', 'c', 'd', 'e'].map(
        (seed) => decode(placeholderSvg(seed, 'XX')).match(/<rect[^>]*fill='(#[0-9a-f]{6})'/)?.[1],
      ),
    );
    expect(backgrounds.size).toBeGreaterThan(1);
    expect(backgrounds.size).toBeLessThanOrEqual(6);
  });
});
