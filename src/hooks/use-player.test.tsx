// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "@/utils/download";
import {
  installWebAudioStubs,
  makeFile,
  makeSilentBuffer,
  type WebAudioStubs,
} from "../test/web-audio-stub";
import { usePlayer } from "./use-player";

// Vitest 5 hoists this, so it has to sit at the top level of the file.
vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

type Player = ReturnType<typeof usePlayer>;

let stubs: WebAudioStubs;
let renders = 0;

/** Render the hook, counting every render so tick traffic can be proved silent. */
const mount = () => {
  renders = 0;
  return renderHook(() => {
    renders += 1;
    return usePlayer();
  });
};

/** Open a track and wait for the engine's snapshot to reach the hook. */
const openTrack = async (
  result: { current: Player },
  name = "song.wav",
): Promise<void> => {
  act(() => {
    result.current.open(makeFile(name));
  });
  await waitFor(() => expect(result.current.track?.name).toBe(name));
};

/** Every callback the hook promises to keep stable. */
const commands = (player: Player) => ({
  open: player.open,
  togglePlay: player.togglePlay,
  toggleLoop: player.toggleLoop,
  seek: player.seek,
  setParams: player.setParams,
  setLoopStart: player.setLoopStart,
  setLoopEnd: player.setLoopEnd,
  clearLoopPoints: player.clearLoopPoints,
  exportWav: player.exportWav,
  subscribe: player.subscribe,
  getPosition: player.getPosition,
  getPeaks: player.getPeaks,
});

beforeEach(() => {
  stubs = installWebAudioStubs();
  // A tenth of a second: long enough for loop points, cheap to encode.
  stubs.decode = () => Promise.resolve(makeSilentBuffer(800, 8000, 1));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("usePlayer", () => {
  it("re-renders with the new snapshot when the engine publishes one", async () => {
    const { result } = mount();
    expect(result.current.track).toBeNull();
    expect(result.current.state).toBe("idle");
    const before = renders;

    await openTrack(result);

    expect(result.current.state).toBe("ready");
    expect(result.current.track).toEqual({
      name: "song.wav",
      duration: 0.1,
      sampleRate: 8000,
      channels: 1,
    });
    expect(renders).toBeGreaterThan(before);
  });

  it("does not re-render for tick events", async () => {
    const { result } = mount();
    await openTrack(result);
    const before = renders;

    // A seek while paused emits a tick and changes nothing in the snapshot.
    act(() => {
      result.current.seek(0.05);
    });

    expect(result.current.getPosition()).toBeCloseTo(0.05, 6);
    expect(renders).toBe(before);
  });

  it("keeps every command callback identical across renders", async () => {
    const { result } = mount();
    const before = commands(result.current);

    await openTrack(result);
    act(() => {
      result.current.setParams({ volume: 40 });
    });

    expect(renders).toBeGreaterThan(1);
    expect(commands(result.current)).toEqual(before);
  });

  it("hands the export to downloadBlob named after the track", async () => {
    const { result } = mount();
    await openTrack(result, "beat.wav");

    await act(async () => {
      await result.current.exportWav();
    });

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
    expect(filename).toBe("beat-lofi.wav");
    expect(blob.type).toBe("audio/wav");
  });

  it("exports nothing when no track is loaded", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.exportWav();
    });

    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("derives the loop region from the params and the duration", async () => {
    const { result } = mount();
    await openTrack(result);

    expect(result.current.loopRegion).toEqual({
      start: 0,
      end: 0.1,
      custom: false,
    });

    act(() => {
      result.current.setParams({ loopStart: 0.02, loopEnd: 0.06 });
    });

    expect(result.current.loopRegion).toEqual({
      start: 0.02,
      end: 0.06,
      custom: true,
    });
  });

  it("rejects a non-audio file before it reaches the engine", () => {
    const { result } = mount();

    act(() => {
      result.current.open(makeFile("notes.txt", 8, "text/plain"));
    });

    expect(result.current.error).toBe("Unsupported file: notes.txt");
    expect(result.current.state).toBe("idle");
    expect(stubs.contexts).toHaveLength(0);
  });

  it("passes getPeaks through to the engine's per-column cache", async () => {
    const { result } = mount();
    await openTrack(result);

    const peaks = await result.current.getPeaks(4);

    expect(peaks).toHaveLength(8);
    expect(await result.current.getPeaks(4)).toBe(peaks);
  });

  it("disposes the engine when the component unmounts", async () => {
    const { result, unmount } = mount();
    await openTrack(result);
    const ctx = stubs.context();

    unmount();

    expect(ctx.closes).toBe(1);
  });
});
