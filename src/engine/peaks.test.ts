import { describe, expect, it } from "vitest";
import { computePeaks, EMPTY_PEAKS } from "./peaks";

/** Read one interleaved [max, min] pair. */
const pair = (peaks: Float32Array, column: number): [number, number] => [
  peaks[column * 2],
  peaks[column * 2 + 1],
];

/** Float32 storage rounds 0.95 to 0.949999988, so pairs compare approximately. */
const expectPair = (
  peaks: Float32Array,
  column: number,
  [max, min]: [number, number],
): void => {
  expect(peaks[column * 2]).toBeCloseTo(max, 6);
  expect(peaks[column * 2 + 1]).toBeCloseTo(min, 6);
};

describe("computePeaks", () => {
  it("normalises the loudest sample to 0.95", () => {
    const peaks = computePeaks(new Float32Array([0.5, -0.5]), 1);
    expectPair(peaks, 0, [0.95, -0.95]);
  });

  it("returns two floats per column", () => {
    expect(computePeaks(new Float32Array(64), 8)).toHaveLength(16);
  });

  it("leaves a silent buffer at zero without producing NaN", () => {
    const peaks = computePeaks(new Float32Array(64), 8);
    expect([...peaks]).toEqual(Array.from({ length: 16 }, () => 0));
    expect([...peaks].every(Number.isFinite)).toBe(true);
  });

  it("gives every column real samples when the buffer is shorter than the columns", () => {
    const peaks = computePeaks(new Float32Array([1, -1, 0.5]), 5);
    for (let column = 0; column < 5; column++) {
      const [max, min] = pair(peaks, column);
      expect(Number.isFinite(max)).toBe(true);
      expect(Number.isFinite(min)).toBe(true);
      // A dropped column would leave the pair at 0/0; an inverted one max < min.
      expect(max).toBeGreaterThanOrEqual(min);
      expect(Math.abs(max) + Math.abs(min)).toBeGreaterThan(0);
    }
  });

  it("returns the shared empty array for zero columns", () => {
    expect(computePeaks(new Float32Array([1, -1]), 0)).toBe(EMPTY_PEAKS);
  });

  it("returns the shared empty array for a negative column count", () => {
    expect(computePeaks(new Float32Array([1, -1]), -4)).toBe(EMPTY_PEAKS);
  });

  it("keeps a DC offset as a flat band rather than a zero line", () => {
    const peaks = computePeaks(new Float32Array([0.4, 0.4, 0.4, 0.4]), 2);
    expectPair(peaks, 0, [0.95, 0.95]);
    expectPair(peaks, 1, [0.95, 0.95]);
  });

  it("includes the tail: the last column covers the last sample", () => {
    // Only the final sample is loud, so it can only reach the last column.
    const peaks = computePeaks(new Float32Array([0, 0, 0, 1]), 2);
    expectPair(peaks, 0, [0, 0]);
    expectPair(peaks, 1, [0.95, 0]);
  });
});
