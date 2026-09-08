import { describe, expect, it } from "vitest";
import { makeSilentBuffer, StubAudioContext } from "../test/web-audio-stub";
import { buildGraph } from "./graph";
import { DEFAULT_PARAMS, type Params } from "./types";

const impulse = makeSilentBuffer(16, 44100, 1);

/**
 * `buildGraph` creates its gains in one order — input, master, dry, wet, then the
 * wobble depth — and its filters as bass then warmth, which the wiring test pins.
 */
const build = (patch: Partial<Params>) => {
  const ctx = new StubAudioContext();
  const params: Params = { ...DEFAULT_PARAMS, ...patch };
  const graph = buildGraph(ctx as unknown as BaseAudioContext, params, impulse);
  const [input, master, dry, wet, depth] = ctx.gains;
  const [bass, warmth] = ctx.filters;
  const [drive] = ctx.shapers;
  return { ctx, graph, input, master, dry, wet, depth, bass, warmth, drive };
};

describe("buildGraph", () => {
  it("runs input through bass, warmth and drive, then dry and wet into master", () => {
    const { ctx, graph, input, master, dry, wet, bass, warmth, drive } = build(
      {},
    );
    const [convolver] = ctx.convolvers;

    expect(graph.input).toBe(input);
    expect(graph.output).toBe(master);
    expect(input.connections).toEqual([bass]);
    expect(bass.type).toBe("lowshelf");
    expect(bass.connections).toEqual([warmth]);
    expect(warmth.type).toBe("lowpass");
    expect(warmth.connections).toEqual([drive]);
    expect(drive.oversample).toBe("2x");
    expect(drive.connections).toEqual([dry, convolver]);
    expect(dry.connections).toEqual([master]);
    expect(convolver.connections).toEqual([wet]);
    expect(wet.connections).toEqual([master]);
    expect(convolver.buffer).toBe(impulse);
  });

  it("drives the wobble output from one running sine LFO", () => {
    const { ctx, graph, depth } = build({});
    const [lfo] = ctx.oscillators;

    expect(graph.wobble).toBe(depth);
    expect(lfo.type).toBe("sine");
    expect(lfo.frequency.value).toBeCloseTo(0.8, 6);
    expect(lfo.connections).toEqual([depth]);
    expect(lfo.starts).toBe(1);
  });

  it("is transparent with every tone control at zero", () => {
    const { bass, warmth, drive, depth } = build({});
    expect(bass.gain.value).toBe(0);
    expect(warmth.frequency.value).toBe(20000);
    expect(drive.curve).toBeNull();
    expect(depth.gain.value).toBe(0);
  });

  it("maps bass to a shelf lift of up to 9 dB", () => {
    expect(build({ bass: 50 }).bass.gain.value).toBeCloseTo(4.5, 6);
    expect(build({ bass: 100 }).bass.gain.value).toBe(9);
  });

  it("closes warmth down to 1.2 kHz along an exponential curve", () => {
    expect(build({ warmth: 100 }).warmth.frequency.value).toBeCloseTo(1200, 3);
    const half = build({ warmth: 50 }).warmth.frequency.value;
    expect(half).toBeCloseTo(Math.sqrt(20000 * 1200), 3);
  });

  it("shapes drive with a unity-gain soft clip that steepens with the amount", () => {
    const soft = build({ drive: 20 }).drive.curve as Float32Array;
    const hard = build({ drive: 100 }).drive.curve as Float32Array;
    const at = (curve: Float32Array, x: number): number =>
      curve[Math.round(((x + 1) / 2) * (curve.length - 1))];
    expect(at(soft, 1)).toBeCloseTo(1, 5);
    expect(at(hard, 1)).toBeCloseTo(1, 5);
    expect(at(hard, 0.25)).toBeGreaterThan(at(soft, 0.25));
    expect(at(hard, -0.25)).toBeCloseTo(-at(hard, 0.25), 6);
  });

  it("maps wobble to a detune depth of up to 25 cents", () => {
    expect(build({ wobble: 40 }).depth.gain.value).toBeCloseTo(10, 6);
  });

  it("sets master gain to volume / 100", () => {
    expect(build({ volume: 85 }).master.gain.value).toBe(0.85);
    expect(build({ volume: 110 }).master.gain.value).toBe(1.1);
    expect(build({ volume: 0 }).master.gain.value).toBe(0);
  });

  it("floors a negative volume at silence rather than inverting the signal", () => {
    expect(build({ volume: -20 }).master.gain.value).toBe(0);
  });

  it("crossfades dry and wet so they always sum to 1", () => {
    for (const reverbLevel of [0, 1, 40, 73, 100]) {
      const { dry, wet } = build({ reverbLevel });
      expect(dry.gain.value + wet.gain.value).toBeCloseTo(1, 10);
      expect(wet.gain.value).toBeCloseTo(reverbLevel / 100, 10);
    }
  });

  it("writes later params onto the same live nodes", () => {
    const { graph, master, dry, wet } = build({ volume: 85, reverbLevel: 40 });

    graph.setParams({ ...DEFAULT_PARAMS, volume: 50, reverbLevel: 25 });

    expect(master.gain.value).toBe(0.5);
    expect(dry.gain.value).toBeCloseTo(0.75, 10);
    expect(wet.gain.value).toBeCloseTo(0.25, 10);
  });
});
