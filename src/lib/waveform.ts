// Gravitational-wave style chirp for the nav background. Pure TypeScript, no DOM, so it runs at
// build time inside Nav.astro and under Vitest.

// The oscillation rate is set per 1100-wide reference canvas (the nav's viewBox), so the shape
// stays the same whatever `width` and `points` are.
const REFERENCE_WIDTH = 1100;
// Peak swing as a fraction of half the height; amplitude never exceeds 0.9, so y stays inside.
const SWING = 0.73;
const DECAY_START = 0.9;

const round = (value: number) => Number(value.toFixed(2));

/**
 * SVG path `d` for a chirp: frequency 0.03 + 0.26 t^3 (phase accumulated per sample), amplitude
 * 0.1 + 0.8 t^2.2 until t = 0.9, then a linear decay to 0 at t = 1. Returns `points + 1` vertices
 * with x from 0 to `width` and y within [0, height].
 */
export function chirpPath(width: number, height: number, points = 550): string {
  const mid = height / 2;
  const step = REFERENCE_WIDTH / points;
  const ampAtDecayStart = 0.1 + 0.8 * DECAY_START ** 2.2;
  let phase = 0;
  let d = '';
  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    const amp =
      t < DECAY_START
        ? 0.1 + 0.8 * t ** 2.2
        : ampAtDecayStart * (1 - (t - DECAY_START) / (1 - DECAY_START));
    const y = mid - Math.sin(phase) * amp * mid * SWING;
    d += `${i === 0 ? 'M' : ' L'}${round(t * width)},${round(y)}`;
    phase += (0.03 + 0.26 * t ** 3) * step;
  }
  return d;
}
