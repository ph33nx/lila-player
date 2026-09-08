import { describe, expect, it } from "vitest";
import { advancePosition, resolveLoopRegion } from "./position";

describe("resolveLoopRegion", () => {
  it("falls back to the whole track when the start is null", () => {
    expect(resolveLoopRegion(null, 2, 3)).toEqual({
      start: 0,
      end: 3,
      custom: false,
    });
  });

  it("falls back to the whole track when the end is null", () => {
    expect(resolveLoopRegion(1, null, 3)).toEqual({
      start: 0,
      end: 3,
      custom: false,
    });
  });

  it("falls back to the whole track when the start is not before the end", () => {
    expect(resolveLoopRegion(2, 2, 3)).toEqual({
      start: 0,
      end: 3,
      custom: false,
    });
    expect(resolveLoopRegion(2.5, 1, 3)).toEqual({
      start: 0,
      end: 3,
      custom: false,
    });
  });

  it("clamps an end past the track down to the duration", () => {
    expect(resolveLoopRegion(1, 10, 3)).toEqual({
      start: 1,
      end: 3,
      custom: true,
    });
  });

  it("clamps a negative start up to zero", () => {
    expect(resolveLoopRegion(-2, 2, 3)).toEqual({
      start: 0,
      end: 2,
      custom: true,
    });
  });

  it("collapses to a zero-length whole track when the duration is zero", () => {
    expect(resolveLoopRegion(1, 2, 0)).toEqual({
      start: 0,
      end: 0,
      custom: false,
    });
  });

  it("treats a NaN duration as no track at all", () => {
    expect(resolveLoopRegion(1, 2, Number.NaN)).toEqual({
      start: 0,
      end: 0,
      custom: false,
    });
  });

  it("marks a region inside the track as custom", () => {
    expect(resolveLoopRegion(1, 2, 3)).toEqual({
      start: 1,
      end: 2,
      custom: true,
    });
  });
});

describe("advancePosition", () => {
  const base = {
    position: 0,
    deltaTime: 0,
    playbackRate: 1,
    duration: 3,
    loop: false,
    loopStart: 0,
    loopEnd: 3,
  };

  it("reports `ended` at the duration when the track is not looping", () => {
    expect(advancePosition({ ...base, position: 2.9, deltaTime: 0.5 })).toEqual(
      { position: 3, wrapped: false, ended: true },
    );
  });

  it("keeps playing below the duration when the track is not looping", () => {
    expect(advancePosition({ ...base, position: 1, deltaTime: 0.5 })).toEqual({
      position: 1.5,
      wrapped: false,
      ended: false,
    });
  });

  it("wraps a whole-track loop back to zero", () => {
    expect(
      advancePosition({
        ...base,
        loop: true,
        position: 2.5,
        deltaTime: 0.5,
      }),
    ).toEqual({ position: 0, wrapped: true, ended: false });
  });

  it("carries the overshoot across a section wrap", () => {
    const result = advancePosition({
      ...base,
      loop: true,
      loopStart: 1,
      loopEnd: 2,
      position: 1.9,
      deltaTime: 0.3,
    });
    // start + ((next - start) % span) = 1 + (1.2 % 1)
    expect(result.position).toBeCloseTo(1.2, 10);
    expect(result.wrapped).toBe(true);
    expect(result.ended).toBe(false);
  });

  it("plays through a position below loopStart without wrapping", () => {
    expect(
      advancePosition({
        ...base,
        loop: true,
        loopStart: 1,
        loopEnd: 2,
        position: 0.2,
        deltaTime: 0.3,
      }),
    ).toEqual({ position: 0.5, wrapped: false, ended: false });
  });

  it("stands still on a zero delta", () => {
    expect(
      advancePosition({ ...base, loop: true, position: 1, deltaTime: 0 }),
    ).toEqual({ position: 1, wrapped: false, ended: false });
  });

  it("clamps a negative delta to zero rather than rewinding", () => {
    expect(
      advancePosition({ ...base, loop: true, position: 1, deltaTime: -5 }),
    ).toEqual({ position: 1, wrapped: false, ended: false });
  });

  it("advances by delta * rate at the slowest rate", () => {
    expect(
      advancePosition({ ...base, playbackRate: 0.65, deltaTime: 1 }).position,
    ).toBeCloseTo(0.65, 10);
  });

  it("advances by delta * rate at the fastest rate", () => {
    expect(
      advancePosition({ ...base, playbackRate: 1.35, deltaTime: 1 }).position,
    ).toBeCloseTo(1.35, 10);
  });

  it("clamps a loopEnd past the duration before wrapping", () => {
    const result = advancePosition({
      ...base,
      loop: true,
      loopStart: 1,
      loopEnd: 10,
      position: 2.9,
      deltaTime: 0.2,
    });
    // end clamps to 3, so the span is 2 and the overshoot of 0.1 carries.
    expect(result.position).toBeCloseTo(1.1, 10);
    expect(result.wrapped).toBe(true);
  });

  it("collapses a loopStart at or past loopEnd to a point, never NaN", () => {
    const result = advancePosition({
      ...base,
      loop: true,
      loopStart: 2,
      loopEnd: 1,
      position: 0.9,
      deltaTime: 0.2,
    });
    expect(result).toEqual({ position: 1, wrapped: true, ended: false });
  });

  it("reports `ended` immediately when there is no duration", () => {
    expect(
      advancePosition({ ...base, duration: 0, position: 1, deltaTime: 1 }),
    ).toEqual({ position: 0, wrapped: false, ended: true });
  });
});
