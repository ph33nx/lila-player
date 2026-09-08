/** Lifecycle of the audio engine. Exactly one of these is true at any time. */
export type EngineState = "idle" | "loading" | "ready" | "playing" | "paused";

/** Everything the user can tune. Units match the UI sliders. */
export interface Params {
  /** Master gain, percent (0..110). */
  volume: number;
  /** Source playback rate, also shifts pitch (0.65..1.35). */
  playbackRate: number;
  /** Wet/dry reverb mix, percent (0..100). */
  reverbLevel: number;
  /** Vinyl crackle bed volume, percent (0..100). */
  vinylVolume: number;
  /** Low-shelf lift, percent of +9 dB (0..100). */
  bass: number;
  /** Low-pass roll-off, percent of the way from open to 1.2 kHz (0..100). */
  warmth: number;
  /** Soft saturation, percent (0..100). */
  drive: number;
  /** Tape flutter depth, percent of 25 cents (0..100). */
  wobble: number;
  loop: boolean;
  /** Loop points in seconds of the source track; null means "whole track". */
  loopStart: number | null;
  loopEnd: number | null;
}

export interface TrackInfo {
  name: string;
  /** Seconds of source audio, before playbackRate is applied. */
  duration: number;
  sampleRate: number;
  channels: number;
}

/** Immutable view of the engine. The same object is returned until something changes. */
export interface EngineSnapshot {
  state: EngineState;
  params: Params;
  track: TrackInfo | null;
  error: string | null;
  exporting: boolean;
}

/**
 * `state` fires when the snapshot changes and drives React renders.
 * `tick` fires every animation frame while playing and must never render.
 */
export type EngineEvent =
  { type: "state" } | { type: "tick"; position: number };

/** Register for engine events; the returned function unsubscribes. */
export type Subscribe = (listener: (event: EngineEvent) => void) => () => void;

export interface AudioEngine {
  load(file: File): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  /** Seconds into the source track; clamped to the track. */
  seek(seconds: number): void;
  setParams(patch: Partial<Params>): void;
  exportWav(): Promise<Blob>;
  /** Interleaved [max, min] pairs, `columns * 2` long, cached per track and column count. */
  getPeaks(columns: number): Promise<Float32Array>;
  getSnapshot(): EngineSnapshot;
  getPosition(): number;
  /** Output level in [0, 1] for meters; 0 unless playing. */
  getLevel(): number;
  subscribe: Subscribe;
  dispose(): void;
}

export const DEFAULT_PARAMS: Params = Object.freeze({
  volume: 85,
  playbackRate: 0.85,
  reverbLevel: 40,
  vinylVolume: 50,
  bass: 0,
  warmth: 0,
  drive: 0,
  wobble: 0,
  loop: true,
  loopStart: null,
  loopEnd: null,
});
