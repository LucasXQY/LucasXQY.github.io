import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CERTIFICATE_LEAD } from '../../src/data/eggs';
import {
  CERTIFICATE_HEIGHT,
  CERTIFICATE_WIDTH,
  drawCertificate,
  isoDate,
} from '../../src/lib/certificate';

describe('isoDate', () => {
  test('formats the local calendar date as YYYY-MM-DD with zero padding', () => {
    expect(isoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(isoDate(new Date(2026, 9, 18, 0, 1))).toBe('2026-10-18');
  });
});

describe('drawCertificate', () => {
  beforeEach(() => {
    // Node has no Path2D; the drawing only builds one and hands it to stroke().
    vi.stubGlobal(
      'Path2D',
      class {
        constructor(readonly d: string) {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  /** A 2D context that records what is drawn and which fill colour was current at the time. */
  function record() {
    const texts: { text: string; fill: string; font: string }[] = [];
    const rects: number[][] = [];
    const strokes: { path: unknown; stroke: string }[] = [];
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: (...args: number[]) => rects.push(args),
      strokeRect: () => {},
      fillText(text: string) {
        texts.push({ text, fill: this.fillStyle, font: this.font });
      },
      stroke(path: unknown) {
        strokes.push({ path, stroke: this.strokeStyle });
      },
      save: () => {},
      restore: () => {},
      translate: () => {},
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, rects, strokes };
  }

  const content = {
    title: 'Certificate of Curiosity',
    lead: CERTIFICATE_LEAD,
    name: 'Qiyi (Lucas) Xie',
    date: '2026-10-18',
    stars: 6,
  };

  test('paints the dark page background over the whole canvas first', () => {
    const { ctx, rects } = record();
    drawCertificate(ctx, content);
    expect(rects[0]).toEqual([0, 0, CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT]);
    expect(CERTIFICATE_WIDTH).toBe(1200);
    expect(CERTIFICATE_HEIGHT).toBe(800);
  });

  test('writes the title, the name and the date, and six amber stars', () => {
    const { ctx, texts } = record();
    drawCertificate(ctx, content);

    const written = texts.map((entry) => entry.text);
    expect(written).toContain('Certificate of Curiosity');
    expect(written).toContain('Qiyi (Lucas) Xie');
    expect(written).toContain('2026-10-18');
    const stars = texts.filter((entry) => entry.text === '★');
    expect(stars).toHaveLength(6);
    expect(stars.every((entry) => entry.fill === '#fbbf24')).toBe(true);
  });

  test('draws the name below the lead and smaller than the title, so it is not the recipient', () => {
    const { ctx, texts } = record();
    drawCertificate(ctx, content);

    const size = (text: string) => {
      const entry = texts.find((candidate) => candidate.text === text);
      return Number(/(\d+)px/.exec(entry?.font ?? '')?.[1]);
    };
    expect(size(content.name)).toBeLessThan(size(content.title));
    const order = texts.map((entry) => entry.text);
    expect(order.indexOf(content.lead)).toBeLessThan(order.indexOf(content.name));
    expect(CERTIFICATE_LEAD).toBe('For finding every star hidden on the site of');
  });

  test('strokes the chirp in cyan', () => {
    const { ctx, strokes } = record();
    drawCertificate(ctx, content);
    expect(strokes.some((entry) => entry.stroke === '#22d3ee')).toBe(true);
  });
});
