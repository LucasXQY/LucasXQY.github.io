import { describe, expect, it, vi } from 'vitest';
import { chirpFrequency, playChirp, renderChirp } from '../../src/lib/eggs/chirp';

describe('chirpFrequency', () => {
  it('starts at 60 Hz', () => {
    expect(chirpFrequency(0)).toBe(60);
  });

  it('rises strictly on [0, 0.75]', () => {
    let previous = chirpFrequency(0);
    for (let step = 1; step <= 75; step += 1) {
      const f = chirpFrequency(step / 100);
      expect(f).toBeGreaterThan(previous);
      previous = f;
    }
  });

  it('follows f0 * ((tc - t) / tc) ** (-3/8) before the cap', () => {
    expect(chirpFrequency(0.4)).toBeCloseTo(60 * 0.5 ** (-3 / 8), 10);
    expect(chirpFrequency(0.4, 1, 20)).toBeCloseTo(20 * 0.6 ** (-3 / 8), 10);
  });

  it('holds the value at tc - 0.005 from there on, and never reaches Infinity or NaN', () => {
    const cap = chirpFrequency(0.795);
    expect(Number.isFinite(cap)).toBe(true);
    expect(cap).toBeCloseTo(60 * (0.005 / 0.8) ** (-3 / 8), 10);
    expect(cap).toBeGreaterThan(400); // about 402 Hz, high enough for a laptop speaker
    expect(cap).toBeLessThan(406);
    for (const t of [0.7951, 0.799, 0.8, 0.81, 5]) expect(chirpFrequency(t)).toBe(cap);
  });
});

describe('renderChirp', () => {
  const samples = renderChirp(48000);
  const loudest = (part: Float32Array) => Math.max(...Array.from(part, Math.abs));

  it('is round(sampleRate * duration) samples long', () => {
    expect(samples).toBeInstanceOf(Float32Array);
    expect(samples).toHaveLength(38400);
    expect(renderChirp(44100)).toHaveLength(35280);
    expect(renderChirp(8000, 0.5)).toHaveLength(4000);
  });

  it('holds only finite samples inside [-1, 1]', () => {
    for (const x of samples) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
    }
  });

  it('peaks at 0.9', () => {
    expect(loudest(samples)).toBeGreaterThan(0.88);
    expect(loudest(samples)).toBeLessThan(0.92);
  });

  it('fades to exactly 0 over the last 2 ms, so the buffer ends without a click', () => {
    expect(Math.abs(samples[samples.length - 1])).toBe(0);
    expect(loudest(samples.slice(-96))).toBeLessThan(loudest(samples.slice(-200, -100)));
    const short = renderChirp(8000, 0.5); // 16 samples of fade at this rate
    expect(Math.abs(short[short.length - 1])).toBe(0);
  });

  it('rings down: the last 100 samples are quieter than the first 1000', () => {
    expect(loudest(samples.slice(-100))).toBeLessThan(loudest(samples.slice(0, 1000)));
  });

  it('gets louder and higher towards the merger', () => {
    expect(loudest(samples.slice(34000, 35000))).toBeGreaterThan(loudest(samples.slice(0, 1000)));

    const crossings = (part: Float32Array) => {
      let count = 0;
      for (let i = 1; i < part.length; i += 1) if (part[i - 1] < 0 !== part[i] < 0) count += 1;
      return count;
    };
    expect(crossings(samples.slice(30000, 34000))).toBeGreaterThan(
      crossings(samples.slice(0, 4000)),
    );
  });
});

/** The slice of the Web Audio API playChirp touches, recorded so the test can inspect it. */
function fakeContext(state: AudioContextState = 'running') {
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  const channel = new Float32Array(38400);
  const buffer = { getChannelData: vi.fn(() => channel) };
  const ended: Array<() => void> = [];
  const source = {
    buffer: null as unknown,
    connect: vi.fn(() => gain),
    start: vi.fn(),
    disconnect: vi.fn(),
    addEventListener: vi.fn((_type: string, fn: () => void) => void ended.push(fn)),
  };
  const ctx = {
    state,
    sampleRate: 48000,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    createBuffer: vi.fn(() => buffer),
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
  };
  return { ctx: ctx as unknown as AudioContext, spies: ctx, gain, source, channel, ended };
}

describe('playChirp', () => {
  it('plays the rendered chirp through a 0.6 gain and resolves when the source ends', async () => {
    const { ctx, spies, gain, source, channel, ended } = fakeContext();
    let done = false;

    const playing = playChirp(ctx).then(() => {
      done = true;
    });
    await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(1));

    expect(spies.createBuffer).toHaveBeenCalledWith(1, 38400, 48000);
    expect(Math.max(...channel)).toBeGreaterThan(0.5); // the samples are in the buffer
    expect(source.buffer).toBeTruthy();
    expect(gain.gain.value).toBe(0.6);
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(spies.destination);
    expect(done).toBe(false);
    expect(source.disconnect).not.toHaveBeenCalled();

    ended[0]();
    await playing;
    expect(done).toBe(true);
    expect(source.disconnect).toHaveBeenCalledTimes(1); // both nodes are let go once it ends
    expect(gain.disconnect).toHaveBeenCalledTimes(1);
  });

  it('resumes a suspended context before playing', async () => {
    const { ctx, spies, source, ended } = fakeContext('suspended');
    const playing = playChirp(ctx);
    await vi.waitFor(() => expect(source.start).toHaveBeenCalled());

    expect(spies.resume).toHaveBeenCalledTimes(1);
    ended[0]();
    await playing;
  });

  it('leaves a running context alone', async () => {
    const { ctx, spies, source, ended } = fakeContext();
    const playing = playChirp(ctx);
    await vi.waitFor(() => expect(source.start).toHaveBeenCalled());

    expect(spies.resume).not.toHaveBeenCalled();
    ended[0]();
    await playing;
  });
});
