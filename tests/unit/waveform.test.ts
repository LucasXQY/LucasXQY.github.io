import { describe, expect, it } from 'vitest';
import { chirpPath } from '../../src/lib/waveform';

function pairs(d: string): Array<[number, number]> {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(
    (m) => [Number(m[1]), Number(m[2])] as [number, number],
  );
}

describe('chirpPath', () => {
  it('starts with M and holds 551 coordinate pairs for the default 550 points', () => {
    const d = chirpPath(1100, 60);
    expect(d.startsWith('M')).toBe(true);
    expect(pairs(d)).toHaveLength(551);
  });

  it('keeps every y inside [0, height]', () => {
    for (const height of [60, 40, 200]) {
      for (const [, y] of pairs(chirpPath(1100, height))) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(height);
      }
    }
  });

  it('runs x from 0 to width in increasing order', () => {
    const xs = pairs(chirpPath(1100, 60)).map(([x]) => x);
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBe(1100);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('honours the points argument', () => {
    expect(pairs(chirpPath(1100, 60, 100))).toHaveLength(101);
  });

  it('is a chirp: oscillation speeds up, amplitude swells, then decays to a flat end', () => {
    const ys = pairs(chirpPath(1100, 60)).map(([, y]) => y);
    const mid = 30;
    const crossings = (from: number, to: number) => {
      let n = 0;
      for (let i = from + 1; i < to; i += 1) if ((ys[i - 1] - mid) * (ys[i] - mid) < 0) n += 1;
      return n;
    };
    const peak = (from: number, to: number) =>
      Math.max(...ys.slice(from, to).map((y) => Math.abs(y - mid)));

    expect(crossings(367, 550)).toBeGreaterThan(crossings(0, 183));
    expect(peak(440, 500)).toBeGreaterThan(peak(0, 55) * 3);
    expect(ys[ys.length - 1]).toBeCloseTo(mid, 0);
  });
});
