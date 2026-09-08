import { describe, expect, it } from "vitest";
import { StubAudioContext } from "../test/web-audio-stub";
import { makeCrackle, makeImpulseResponse } from "./synth";

const context = (): BaseAudioContext =>
  new StubAudioContext() as unknown as BaseAudioContext;

const rms = (data: Float32Array): number =>
  Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);

const finite = (data: Float32Array): boolean =>
  data.every((v) => Number.isFinite(v) && Math.abs(v) <= 1);

describe("makeImpulseResponse", () => {
  it("is stereo, the requested length, at the context's rate", () => {
    const ir = makeImpulseResponse(context(), 2);
    expect(ir.numberOfChannels).toBe(2);
    expect(ir.length).toBe(2 * 44100);
    expect(ir.sampleRate).toBe(44100);
  });

  it("decays to near silence and never leaves [-1, 1]", () => {
    const data = makeImpulseResponse(context()).getChannelData(0);
    const tenth = Math.floor(data.length / 10);
    const head = rms(data.subarray(0, tenth));
    const tail = rms(data.subarray(data.length - tenth));
    expect(head).toBeGreaterThan(0);
    expect(tail).toBeLessThan(head * 0.05);
    expect(finite(data)).toBe(true);
  });

  it("opens with a short pre-delay of silence", () => {
    const data = makeImpulseResponse(context()).getChannelData(1);
    expect(rms(data.subarray(0, 400))).toBe(0);
    expect(rms(data.subarray(600, 2000))).toBeGreaterThan(0);
  });

  it("is deterministic for a seed and differs across seeds", () => {
    const a = makeImpulseResponse(context(), 0.5, 7).getChannelData(0);
    const b = makeImpulseResponse(context(), 0.5, 7).getChannelData(0);
    const c = makeImpulseResponse(context(), 0.5, 8).getChannelData(0);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("makeCrackle", () => {
  it("is a quiet stationary bed with pops on top", () => {
    const data = makeCrackle(context(), 2).getChannelData(0);
    const level = rms(data);
    const peak = data.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
    expect(level).toBeGreaterThan(0.001);
    expect(level).toBeLessThan(0.1);
    expect(peak).toBeGreaterThan(level * 4);
    expect(finite(data)).toBe(true);
  });

  it("gives both channels independent crackle", () => {
    const buffer = makeCrackle(context(), 1);
    expect(buffer.numberOfChannels).toBe(2);
    expect(buffer.getChannelData(0)).not.toEqual(buffer.getChannelData(1));
  });

  it("is deterministic for a seed", () => {
    const a = makeCrackle(context(), 0.5, 3).getChannelData(0);
    const b = makeCrackle(context(), 0.5, 3).getChannelData(0);
    expect(a).toEqual(b);
  });
});
