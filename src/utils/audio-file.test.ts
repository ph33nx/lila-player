import { describe, expect, it } from "vitest";
import {
  ACCEPT,
  AUDIO_EXTENSIONS,
  AUDIO_FORMATS,
  exportFileName,
  isAudioFile,
} from "./audio-file";
import { makeFile } from "../test/web-audio-stub";

describe("isAudioFile", () => {
  it("accepts anything the browser labels as audio", () => {
    expect(isAudioFile(makeFile("recording", 8, "audio/mpeg"))).toBe(true);
  });

  it("falls back to the extension when the picker gives no type", () => {
    expect(isAudioFile(makeFile("song.wav", 8, ""))).toBe(true);
  });

  it("matches the extension whatever its case", () => {
    expect(isAudioFile(makeFile("SONG.WAV", 8, ""))).toBe(true);
  });

  it("accepts every extension the accept list advertises", () => {
    for (const extension of AUDIO_EXTENSIONS) {
      expect(isAudioFile(makeFile(`track.${extension}`, 8, ""))).toBe(true);
    }
  });

  it("rejects a file that is neither audio-typed nor audio-named", () => {
    expect(isAudioFile(makeFile("notes.txt", 8, "text/plain"))).toBe(false);
  });

  it("only matches an extension at the end of the name", () => {
    expect(isAudioFile(makeFile("song.wav.txt", 8, "text/plain"))).toBe(false);
  });
});

describe("the accept list", () => {
  it("offers the broad audio type plus every explicit extension", () => {
    expect(ACCEPT.split(",")).toEqual([
      "audio/*",
      ...AUDIO_EXTENSIONS.map((extension) => `.${extension}`),
    ]);
  });

  it("names the same formats in the empty state, uppercased", () => {
    expect(AUDIO_FORMATS.split(", ")).toEqual(
      AUDIO_EXTENSIONS.map((extension) => extension.toUpperCase()),
    );
  });
});

describe("exportFileName", () => {
  it("drops a known audio extension and appends -lofi.wav", () => {
    expect(exportFileName("A4. Follow My Way.flac")).toBe(
      "A4. Follow My Way-lofi.wav",
    );
    expect(exportFileName("song.MP3")).toBe("song-lofi.wav");
  });

  it("leaves names without a known extension intact", () => {
    expect(exportFileName("take 2")).toBe("take 2-lofi.wav");
    expect(exportFileName("v1.0.final")).toBe("v1.0.final-lofi.wav");
  });
});
