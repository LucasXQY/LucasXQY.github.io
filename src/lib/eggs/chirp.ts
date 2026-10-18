// The chirp egg: the nav waveform, as sound. A compact-binary inspiral sweeps up in pitch and
// loudness until the merger, then rings down. The maths is plain TypeScript; only playChirp touches
// the Web Audio API, and it takes the context it should use, so it tests with a fake.

/** The sound stops being driven 5 ms before the coalescence time, where the formula diverges. */
const CAP_GAP = 0.005;
/** The last tenth of the sound is the ringdown. */
const RINGDOWN_SHARE = 0.1;
/** The ringdown's time constant is a quarter of its length, so it fades to about 2% by the end. */
const RINGDOWN_TAU_SHARE = 0.25;
/** A linear fade to silence over the last 2 ms, so the buffer ends on 0 instead of a small step. */
const FADE_OUT = 0.002;
const PEAK = 0.9;
/** Output level: the chirp is a surprise, so it plays well below full scale. */
const GAIN = 0.6;

/**
 * Instantaneous frequency (Hz) of an inspiral that merges at time `tc` (seconds): the leading-order
 * `f0 * ((tc - t) / tc) ** (-3/8)`. The curve diverges at `tc`, so from `tc - 5 ms` on it holds the
 * value it has there (about 6.7 f0, so about 402 Hz with the defaults) instead of returning
 * Infinity. The default f0 of 60 Hz keeps the whole sweep inside what a laptop speaker can play.
 */
export function chirpFrequency(t: number, tc = 0.8, f0 = 60): number {
  const capped = Math.min(t, tc - CAP_GAP);
  return f0 * ((tc - capped) / tc) ** (-3 / 8);
}

/**
 * Mono samples of the chirp: a sine whose phase is the running sum of `2π f(t) / sampleRate`, so the
 * pitch can change every sample without a jump. The amplitude follows `f(t) ** (2/3)`, then an
 * exponential ringdown over the last 10% of `duration`, and the last 2 ms fade linearly to 0; the
 * whole thing is scaled so the loudest sample is exactly 0.9. Coalescence is at `duration`.
 */
export function renderChirp(sampleRate: number, duration = 0.8): Float32Array {
  const length = Math.round(sampleRate * duration);
  const samples = new Float32Array(length);
  const ringdownStart = duration * (1 - RINGDOWN_SHARE);
  const tau = duration * RINGDOWN_SHARE * RINGDOWN_TAU_SHARE;

  const fade = Math.min(length, Math.round(sampleRate * FADE_OUT));
  let phase = 0;
  let loudest = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const f = chirpFrequency(t, duration);
    const ringdown = t > ringdownStart ? Math.exp(-(t - ringdownStart) / tau) : 1;
    const fadeOut = i >= length - fade ? (length - 1 - i) / fade : 1;
    const value = Math.sin(phase) * f ** (2 / 3) * ringdown * fadeOut;
    samples[i] = value;
    loudest = Math.max(loudest, Math.abs(value));
    phase += (2 * Math.PI * f) / sampleRate;
  }

  if (loudest > 0) {
    const scale = PEAK / loudest;
    for (let i = 0; i < length; i += 1) samples[i] *= scale;
  }
  return samples;
}

/**
 * Plays the chirp once on `ctx` at a modest gain and resolves when it has finished. A suspended
 * context (browsers start them suspended until a gesture) is resumed first, so call this from a
 * click handler.
 */
export async function playChirp(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'suspended') await ctx.resume();

  const samples = renderChirp(ctx.sampleRate);
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.getChannelData(0).set(samples);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = GAIN;
  source.connect(gain);
  gain.connect(ctx.destination);

  return new Promise((resolve) => {
    source.addEventListener(
      'ended',
      () => {
        source.disconnect();
        gain.disconnect();
        resolve();
      },
      { once: true },
    );
    source.start();
  });
}
