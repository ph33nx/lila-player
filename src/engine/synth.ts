/**
 * The two sounds the engine ships with, generated instead of bundled: a reverb
 * impulse response and a vinyl crackle bed. Both are deterministic for a seed,
 * so tests and the exported file are reproducible, and both are built for the
 * context that will play them, so their sample rate always matches.
 */

/** Mulberry32: a small seeded generator, uniform in [0, 1). */
const random = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const STEREO = 2;

/**
 * Exponentially decaying noise that darkens as it fades: the shape of a large,
 * soft room. `seconds` is the tail length; the convolver normalises loudness.
 */
export const makeImpulseResponse = (
  ctx: BaseAudioContext,
  seconds = 2.4,
  seed = 1,
): AudioBuffer => {
  const rate = ctx.sampleRate;
  const length = Math.ceil(seconds * rate);
  const buffer = ctx.createBuffer(STEREO, length, rate);
  const next = random(seed);
  const preDelay = Math.round(rate * 0.012);

  for (let channel = 0; channel < STEREO; channel++) {
    const data = buffer.getChannelData(channel);
    let lowPassed = 0;
    for (let i = preDelay; i < length; i++) {
      const t = (i - preDelay) / rate;
      const progress = t / seconds;
      // One-pole low-pass whose cutoff falls with time, so the tail loses air.
      const smoothing = 0.55 - 0.45 * progress;
      lowPassed += smoothing * (next() * 2 - 1 - lowPassed);
      data[i] = lowPassed * Math.exp(-6 * progress);
    }
  }
  return buffer;
};

/**
 * Vinyl surface noise: a quiet, band-limited hiss under sparse pops of random
 * size. The hiss is stationary, so looping the buffer has no audible seam.
 */
export const makeCrackle = (
  ctx: BaseAudioContext,
  seconds = 6,
  seed = 2,
): AudioBuffer => {
  const rate = ctx.sampleRate;
  const length = Math.ceil(seconds * rate);
  const buffer = ctx.createBuffer(STEREO, length, rate);
  const next = random(seed);
  const popsPerSecond = 14;
  const popChance = popsPerSecond / rate;

  for (let channel = 0; channel < STEREO; channel++) {
    const data = buffer.getChannelData(channel);
    let hiss = 0;
    let pop = 0;
    for (let i = 0; i < length; i++) {
      hiss += 0.12 * (next() * 2 - 1 - hiss);
      if (next() < popChance) {
        // Occasional larger dust hits sit on top of the fine crackle.
        pop = (next() < 0.15 ? 0.6 : 0.2) * (0.4 + 0.6 * next());
      }
      data[i] = hiss * 0.035 + pop * (next() * 2 - 1);
      pop *= 0.94;
    }
  }
  return buffer;
};
