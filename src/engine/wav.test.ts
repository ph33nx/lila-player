import { describe, expect, it } from "vitest";
import { makeAudioBuffer } from "../test/web-audio-stub";
import { audioBufferToWav } from "./wav";

const ascii = (view: DataView, offset: number, length: number): string =>
  Array.from({ length }, (_, i) =>
    String.fromCharCode(view.getUint8(offset + i)),
  ).join("");

const encode = (channels: number[][], sampleRate = 44100): DataView =>
  new DataView(
    audioBufferToWav(
      makeAudioBuffer(
        channels.map((data) => Float32Array.from(data)),
        sampleRate,
      ),
    ),
  );

/** Read the interleaved 16-bit samples that follow the 44-byte header. */
const samples = (view: DataView): number[] =>
  Array.from({ length: (view.byteLength - 44) / 2 }, (_, i) =>
    view.getInt16(44 + i * 2, true),
  );

describe("audioBufferToWav header", () => {
  const view = encode([[0, 0, 0, 0]], 8000);

  it("opens with the RIFF magic", () => {
    expect(ascii(view, 0, 4)).toBe("RIFF");
  });

  it("declares the RIFF size as the file length minus the 8-byte magic", () => {
    expect(view.getUint32(4, true)).toBe(view.byteLength - 8);
  });

  it("declares the WAVE form and the fmt chunk", () => {
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 12, 4)).toBe("fmt ");
  });

  it("sizes the fmt chunk at 16 bytes", () => {
    expect(view.getUint32(16, true)).toBe(16);
  });

  it("declares format 1, uncompressed PCM", () => {
    expect(view.getUint16(20, true)).toBe(1);
  });

  it("declares the channel count", () => {
    expect(view.getUint16(22, true)).toBe(1);
  });

  it("declares the sample rate", () => {
    expect(view.getUint32(24, true)).toBe(8000);
  });

  it("declares the byte rate as rate * channels * 2", () => {
    expect(view.getUint32(28, true)).toBe(8000 * 1 * 2);
  });

  it("declares the block align as channels * 2", () => {
    expect(view.getUint16(32, true)).toBe(2);
  });

  it("declares 16 bits per sample", () => {
    expect(view.getUint16(34, true)).toBe(16);
  });

  it("declares the data chunk and its size", () => {
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(view.byteLength - 44);
  });

  it("writes the stereo channel count and its wider block align", () => {
    const stereo = encode([[0], [0]], 44100);
    expect(stereo.getUint16(22, true)).toBe(2);
    expect(stereo.getUint16(32, true)).toBe(4);
    expect(stereo.getUint32(28, true)).toBe(44100 * 2 * 2);
  });
});

describe("audioBufferToWav samples", () => {
  it("writes a mono buffer in source order", () => {
    const view = encode([[1, 0, -1]]);
    expect(samples(view)).toEqual([32767, 0, -32768]);
  });

  it("interleaves stereo as left, right, left, right", () => {
    const view = encode([
      [1, 0],
      [-1, 0],
    ]);
    expect(samples(view)).toEqual([32767, -32768, 0, 0]);
  });

  it("interleaves three channels frame by frame", () => {
    const view = encode([
      [1, 1],
      [0, 0],
      [-1, -1],
    ]);
    expect(samples(view)).toEqual([32767, 0, -32768, 32767, 0, -32768]);
  });

  it("clips samples beyond +/-1 instead of wrapping them", () => {
    const view = encode([[2, -2]]);
    expect(samples(view)).toEqual([32767, -32768]);
  });

  it("scales asymmetrically: negatives by 0x8000, positives by 0x7fff", () => {
    const view = encode([[0.5, -0.5]]);
    expect(samples(view)).toEqual([Math.trunc(0.5 * 0x7fff), -0.5 * 0x8000]);
  });

  it("round-trips a known sample back to its float value", () => {
    const view = encode([[0.25]]);
    const written = samples(view)[0];
    expect(written).toBe(Math.trunc(0.25 * 0x7fff));
    expect(written / 0x7fff).toBeCloseTo(0.25, 4);
  });

  it("emits exactly the 44-byte header for an empty buffer", () => {
    expect(encode([[]]).byteLength).toBe(44);
  });

  it("sizes the file at 44 + frames * channels * 2", () => {
    expect(
      encode([
        [0, 0, 0],
        [0, 0, 0],
      ]).byteLength,
    ).toBe(44 + 3 * 2 * 2);
  });
});
