import { clamp } from "./position";
import type { Params } from "./types";

export interface AudioGraph {
  /** Connect the source node here. */
  input: AudioNode;
  /** Master bus. Connect it to a destination; other beds may connect into it. */
  output: AudioNode;
  /** Tape wobble: connect to a source's `detune` so the LFO bends its pitch. */
  wobble: AudioNode;
  setParams(params: Params): void;
}

/** Warmth 0 leaves the top end alone; 100 closes the low-pass down to this. */
const WARMTH_FLOOR_HZ = 1200;
const OPEN_HZ = 20000;
/** Low shelf below this frequency, lifted by up to this much. */
const BASS_HZ = 110;
const BASS_MAX_DB = 9;
/** Drive shapes the wave with tanh; the slope at 100 is this many times steeper. */
const DRIVE_MAX_SLOPE = 8;
const DRIVE_CURVE_POINTS = 1024;
/** Wobble is one slow sine on the pitch, up to this many cents either way. */
const WOBBLE_HZ = 0.8;
const WOBBLE_MAX_CENTS = 25;

const percent = (value: number): number => clamp(value, 0, 100) / 100;

/** Soft-clipping transfer curve; unity gain for small signals at every slope. */
const driveCurve = (slope: number): Float32Array<ArrayBuffer> => {
  const curve = new Float32Array(DRIVE_CURVE_POINTS);
  const norm = Math.tanh(slope);
  for (let i = 0; i < DRIVE_CURVE_POINTS; i++) {
    const x = (i * 2) / (DRIVE_CURVE_POINTS - 1) - 1;
    curve[i] = Math.tanh(slope * x) / norm;
  }
  return curve;
};

/**
 * The one graph, shared by live playback and offline export:
 *
 *   input -> bass shelf -> warmth low-pass -> drive -+-> dry ---------------+-> master
 *                                                    +-> convolver -> wet --+
 *   wobble LFO -> depth ~~> (source.detune)
 */
export const buildGraph = (
  ctx: BaseAudioContext,
  params: Params,
  impulse: AudioBuffer,
): AudioGraph => {
  const input = ctx.createGain();
  const master = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();

  const bass = ctx.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = BASS_HZ;

  const warmth = ctx.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.Q.value = Math.SQRT1_2;

  const drive = ctx.createWaveShaper();
  drive.oversample = "2x";

  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;

  input.connect(bass);
  bass.connect(warmth);
  warmth.connect(drive);
  drive.connect(dry);
  dry.connect(master);
  drive.connect(convolver);
  convolver.connect(wet);
  wet.connect(master);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = WOBBLE_HZ;
  const wobble = ctx.createGain();
  lfo.connect(wobble);
  lfo.start(0);

  const setParams = (next: Params): void => {
    master.gain.value = Math.max(0, next.volume) / 100;
    const mix = percent(next.reverbLevel);
    dry.gain.value = 1 - mix;
    wet.gain.value = mix;

    bass.gain.value = BASS_MAX_DB * percent(next.bass);
    warmth.frequency.value =
      OPEN_HZ * Math.pow(WARMTH_FLOOR_HZ / OPEN_HZ, percent(next.warmth));
    const amount = percent(next.drive);
    drive.curve =
      amount > 0 ? driveCurve(1 + (DRIVE_MAX_SLOPE - 1) * amount) : null;
    wobble.gain.value = WOBBLE_MAX_CENTS * percent(next.wobble);
  };

  setParams(params);
  return { input, output: master, wobble, setParams };
};
