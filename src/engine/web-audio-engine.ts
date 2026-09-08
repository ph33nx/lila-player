import { buildGraph, type AudioGraph } from "./graph";
import { computePeaks, EMPTY_PEAKS } from "./peaks";
import {
  advancePosition,
  clamp,
  resolveLoopRegion,
  type LoopRegion,
} from "./position";
import { makeCrackle, makeImpulseResponse } from "./synth";
import {
  DEFAULT_PARAMS,
  type AudioEngine,
  type EngineEvent,
  type EngineSnapshot,
  type EngineState,
  type Params,
  type TrackInfo,
} from "./types";
import { audioBufferToWav } from "./wav";

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Time-domain window the level meter reads; small so it follows the music. */
const LEVEL_WINDOW = 256;
/** RMS of a full-scale mix sits well under 1; this maps a loud passage near it. */
const LEVEL_GAIN = 3;

/**
 * The whole audio side of the app: one AudioContext, one graph, one source node at a
 * time, one position. Nothing here knows about React; the UI reads `getSnapshot()`
 * and listens for `tick` events.
 */
export class WebAudioEngine implements AudioEngine {
  private readonly listeners = new Set<(event: EngineEvent) => void>();
  private readonly peakCache = new Map<number, Float32Array>();

  private ctx: AudioContext | null = null;
  private graph: AudioGraph | null = null;
  private analyser: AnalyserNode | null = null;
  private readonly levelSamples = new Float32Array(LEVEL_WINDOW);
  private crackle: AudioBuffer | null = null;
  private crackleGain: GainNode | null = null;
  private crackleSource: AudioBufferSourceNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;

  private state: EngineState = "idle";
  private params: Params = DEFAULT_PARAMS;
  private track: TrackInfo | null = null;
  private error: string | null = null;
  private exporting = false;
  private snapshot: EngineSnapshot;

  private position = 0;
  private lastFrameTime = 0;
  private frame: number | null = null;
  private disposed = false;
  /** Bumped on every load(); an older load that resolves late is dropped. */
  private loadToken = 0;

  constructor() {
    this.snapshot = this.buildSnapshot();
  }

  // --- public surface -------------------------------------------------------

  readonly getSnapshot = (): EngineSnapshot => this.snapshot;

  readonly getPosition = (): number => this.position;

  readonly subscribe = (
    listener: (event: EngineEvent) => void,
  ): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async load(file: File): Promise<void> {
    // Two picks in quick succession race: decode times differ, so the older
    // load can resolve last and win. The newest token owns the snapshot, and a
    // stale load returns after every await without touching a field.
    const token = ++this.loadToken;
    const stale = (): boolean => token !== this.loadToken;

    this.stopSource();
    this.stopCrackle();
    this.stopFrame();

    const hadTrack = this.track !== null;
    this.state = "loading";
    this.error = null;
    this.sync();

    try {
      const ctx = await this.ensureContext();
      if (stale()) return;
      const bytes = await file.arrayBuffer();
      if (stale()) return;
      const decoded = await ctx.decodeAudioData(bytes);
      if (stale()) return;

      this.buffer = decoded;
      this.track = Object.freeze({
        name: file.name,
        duration: decoded.duration,
        sampleRate: decoded.sampleRate,
        channels: decoded.numberOfChannels,
      });
      this.peakCache.clear();
      this.position = 0;
      // Loop points are seconds of the previous track, so they cannot survive it.
      this.params = Object.freeze({
        ...this.params,
        loopStart: null,
        loopEnd: null,
      });
      this.state = "ready";
      this.emit({ type: "tick", position: 0 });
    } catch (error) {
      if (stale()) return;
      this.error = `Could not load ${file.name}: ${describeError(error)}`;
      // The previous track survives, but its source node is gone with the reload.
      this.state = hadTrack ? "paused" : "idle";
    } finally {
      if (!stale()) this.sync();
    }
  }

  async play(): Promise<void> {
    if (this.state !== "ready" && this.state !== "paused") return;

    const ctx = await this.ensureContext();
    if (!this.buffer || !this.graph) return;

    this.startSource(ctx);
    this.startCrackle(ctx);
    this.state = "playing";
    this.error = null;
    this.sync();
    this.startFrame();
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.halt(this.position);
  }

  seek(seconds: number): void {
    const duration = this.track?.duration ?? 0;
    if (duration <= 0) return;

    this.position = clamp(seconds, 0, duration);
    if (this.state === "playing" && this.ctx) this.startSource(this.ctx);
    this.emit({ type: "tick", position: this.position });
  }

  setParams(patch: Partial<Params>): void {
    const next: Params = { ...this.params, ...patch };
    if (!this.hasChanges(next)) return;

    this.params = Object.freeze(next);
    const region = this.region();

    this.graph?.setParams(next);
    if (this.crackleGain) {
      this.crackleGain.gain.value = clamp(next.vinylVolume / 100, 0, 1);
    }

    const source = this.source;
    if (source) {
      source.playbackRate.value = next.playbackRate;
      this.applyLoop(source, region);
      // A live node cannot rewind itself. Any looping node sitting at or past
      // its loop end was started past it and will play the tail into silence:
      // that covers a region moved out from under the playhead *and* loop being
      // switched on while the playhead is already past a custom loopEnd. No
      // "did the region move" test is needed, because a correctly looping node
      // keeps the integrator below `end`.
      if (next.loop && this.position >= region.end && this.ctx) {
        this.startSource(this.ctx);
      }
    }

    this.sync();
  }

  /**
   * Async by contract so the scan can move to a worker later; today it is one
   * synchronous pass on the main thread. See docs/audio-engine.md.
   */
  async getPeaks(columns: number): Promise<Float32Array> {
    const buffer = this.buffer;
    if (!buffer || columns <= 0) return EMPTY_PEAKS;

    const cached = this.peakCache.get(columns);
    if (cached) return cached;

    const peaks = computePeaks(buffer.getChannelData(0), columns);
    this.peakCache.set(columns, peaks);
    return peaks;
  }

  /** RMS of the master bus over the last few milliseconds, 0 when not playing. */
  getLevel(): number {
    const analyser = this.analyser;
    if (!analyser || this.state !== "playing") return 0;

    const samples = this.levelSamples;
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.min(1, Math.sqrt(sum / samples.length) * LEVEL_GAIN);
  }

  async exportWav(): Promise<Blob> {
    const buffer = this.buffer;
    if (!buffer) throw new Error("No track loaded");

    this.exporting = true;
    this.sync();
    try {
      const params = this.params;
      const offline = new OfflineAudioContext(
        buffer.numberOfChannels,
        Math.ceil(buffer.length / params.playbackRate),
        buffer.sampleRate,
      );
      // The impulse is built for the offline context so its sample rate matches.
      const graph = buildGraph(offline, params, makeImpulseResponse(offline));
      graph.output.connect(offline.destination);

      const source = offline.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = params.playbackRate;
      source.connect(graph.input);
      graph.wobble.connect(source.detune);
      source.start(0);

      const rendered = await offline.startRendering();
      return new Blob([audioBufferToWav(rendered)], { type: "audio/wav" });
    } catch (error) {
      this.error = `Export failed: ${describeError(error)}`;
      throw error;
    } finally {
      this.exporting = false;
      this.sync();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stopSource();
    this.stopCrackle();
    this.stopFrame();
    this.peakCache.clear();
    this.listeners.clear();

    this.analyser?.disconnect();
    this.analyser = null;
    this.crackleGain = null;
    this.crackle = null;
    this.graph = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  // --- snapshot -------------------------------------------------------------

  private buildSnapshot(): EngineSnapshot {
    return Object.freeze({
      state: this.state,
      params: this.params,
      track: this.track,
      error: this.error,
      exporting: this.exporting,
    });
  }

  /** Publish a new frozen snapshot only when a field actually moved. */
  private sync(): void {
    const previous = this.snapshot;
    const next = this.buildSnapshot();
    if (
      previous.state === next.state &&
      previous.params === next.params &&
      previous.track === next.track &&
      previous.error === next.error &&
      previous.exporting === next.exporting
    ) {
      return;
    }
    this.snapshot = next;
    this.emit({ type: "state" });
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private hasChanges(next: Params): boolean {
    const current = this.params;
    return (Object.keys(next) as (keyof Params)[]).some(
      (key) => next[key] !== current[key],
    );
  }

  // --- audio context --------------------------------------------------------

  private async ensureContext(): Promise<AudioContext> {
    const ctx = (this.ctx ??= this.createContext());
    // Autoplay policies start the context suspended; only a gesture can resume it.
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  }

  /** The graph, the meter tap and the crackle bed, built once per context. */
  private createContext(): AudioContext {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    const ctx = new Constructor();

    const graph = buildGraph(ctx, this.params, makeImpulseResponse(ctx));
    graph.output.connect(ctx.destination);
    this.graph = graph;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = LEVEL_WINDOW;
    graph.output.connect(analyser);
    this.analyser = analyser;

    const crackleGain = ctx.createGain();
    crackleGain.gain.value = clamp(this.params.vinylVolume / 100, 0, 1);
    crackleGain.connect(graph.output);
    this.crackleGain = crackleGain;
    this.crackle = makeCrackle(ctx);

    return ctx;
  }

  // --- source nodes ---------------------------------------------------------

  private region(): LoopRegion {
    return resolveLoopRegion(
      this.params.loopStart,
      this.params.loopEnd,
      this.track?.duration ?? 0,
    );
  }

  private applyLoop(source: AudioBufferSourceNode, region: LoopRegion): void {
    source.loop = this.params.loop;
    // 0/0 is the spec's "loop the whole buffer".
    source.loopStart = region.custom ? region.start : 0;
    source.loopEnd = region.custom ? region.end : 0;
  }

  private startSource(ctx: AudioContext): void {
    const buffer = this.buffer;
    const graph = this.graph;
    if (!buffer || !graph) return;

    this.stopSource();
    const region = this.region();
    // A looping node started at or past loopEnd never enters the loop: it plays the
    // tail once and then stays silent forever, without firing `ended`.
    if (this.params.loop && this.position >= region.end) {
      this.position = region.start;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.params.playbackRate;
    this.applyLoop(source, region);
    source.connect(graph.input);
    graph.wobble.connect(source.detune);
    source.start(0, clamp(this.position, 0, buffer.duration));

    this.source = source;
    this.lastFrameTime = ctx.currentTime;
  }

  private stopSource(): void {
    const source = this.source;
    this.source = null;
    if (!source) return;
    source.stop();
    source.disconnect();
  }

  /** The bed loops under the whole session; seeks leave it running. */
  private startCrackle(ctx: AudioContext): void {
    if (this.crackleSource || !this.crackle || !this.crackleGain) return;
    const source = ctx.createBufferSource();
    source.buffer = this.crackle;
    source.loop = true;
    source.connect(this.crackleGain);
    source.start(0);
    this.crackleSource = source;
  }

  private stopCrackle(): void {
    const source = this.crackleSource;
    this.crackleSource = null;
    if (!source) return;
    source.stop();
    source.disconnect();
  }

  private halt(position: number): void {
    this.stopSource();
    this.stopCrackle();
    this.stopFrame();
    this.position = position;
    this.state = "paused";
    this.emit({ type: "tick", position });
    this.sync();
  }

  // --- position integrator --------------------------------------------------

  private startFrame(): void {
    if (this.frame === null) this.frame = requestAnimationFrame(this.tick);
  }

  private stopFrame(): void {
    if (this.frame === null) return;
    cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private readonly tick = (): void => {
    this.frame = null;
    const ctx = this.ctx;
    const track = this.track;
    if (!ctx || !track || this.state !== "playing") return;

    const now = ctx.currentTime;
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    const region = this.region();
    const { position, ended } = advancePosition({
      position: this.position,
      deltaTime,
      playbackRate: this.params.playbackRate,
      duration: track.duration,
      loop: this.params.loop,
      loopStart: region.start,
      loopEnd: region.end,
    });

    if (ended) {
      this.halt(0);
      return;
    }

    this.position = position;
    this.emit({ type: "tick", position });
    this.frame = requestAnimationFrame(this.tick);
  };
}
