/** A resolved, playable loop region. `custom` is false when it spans the whole track. */
export interface LoopRegion {
  start: number;
  end: number;
  custom: boolean;
}

export interface AdvanceInput {
  position: number;
  /** Seconds of wall clock since the last frame. */
  deltaTime: number;
  playbackRate: number;
  duration: number;
  loop: boolean;
  /** Already resolved through `resolveLoopRegion`. */
  loopStart: number;
  loopEnd: number;
}

export interface AdvanceResult {
  position: number;
  wrapped: boolean;
  ended: boolean;
}

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/**
 * Turn raw loop points into a region the Web Audio node will actually honour:
 * both points inside the track and start strictly before end, or the whole track.
 */
export const resolveLoopRegion = (
  loopStart: number | null,
  loopEnd: number | null,
  duration: number,
): LoopRegion => {
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const whole: LoopRegion = { start: 0, end: total, custom: false };
  if (loopStart === null || loopEnd === null) return whole;

  const start = clamp(loopStart, 0, total);
  const end = clamp(loopEnd, 0, total);
  return start < end ? { start, end, custom: true } : whole;
};

/** Integrate one frame of playback. Pure: the caller owns the position. */
export const advancePosition = ({
  position,
  deltaTime,
  playbackRate,
  duration,
  loop,
  loopStart,
  loopEnd,
}: AdvanceInput): AdvanceResult => {
  if (!(duration > 0)) return { position: 0, wrapped: false, ended: true };

  const next = position + Math.max(0, deltaTime) * playbackRate;

  if (!loop) {
    return next >= duration
      ? { position: duration, wrapped: false, ended: true }
      : { position: next, wrapped: false, ended: false };
  }

  const end = clamp(loopEnd, 0, duration);
  const start = clamp(loopStart, 0, end);
  if (next < end) return { position: next, wrapped: false, ended: false };

  // Carry the overshoot across the wrap so a slow frame cannot drift the loop.
  const span = end - start;
  const wrappedPosition = span > 0 ? start + ((next - start) % span) : start;
  return { position: wrappedPosition, wrapped: true, ended: false };
};
