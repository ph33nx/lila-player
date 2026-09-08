// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installWebAudioStubs,
  makeFile,
  makeSilentBuffer,
  type WebAudioStubs,
} from "../test/web-audio-stub";
import { DEFAULT_PARAMS, type EngineEvent, type EngineState } from "./types";
import { WebAudioEngine } from "./web-audio-engine";

let stubs: WebAudioStubs;
let engine: WebAudioEngine;

beforeEach(() => {
  // Only the frame clock is faked: `ctx.currentTime` is the engine's real
  // clock and every test moves it by hand.
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  });
  stubs = installWebAudioStubs();
  engine = new WebAudioEngine();
});

afterEach(() => {
  engine.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** The stub decodes a 3-second stereo track at 44.1 kHz unless told otherwise. */
const load = (name = "song.wav"): Promise<void> => engine.load(makeFile(name));

/** Move the audio clock, then let the engine integrate exactly one frame. */
const advance = (seconds: number): void => {
  stubs.context().currentTime += seconds;
  vi.advanceTimersToNextFrame();
};

const states = (): EngineState[] => {
  const seen: EngineState[] = [];
  engine.subscribe((event: EngineEvent) => {
    if (event.type === "state") seen.push(engine.getSnapshot().state);
  });
  return seen;
};

const ticks = (): number[] => {
  const seen: number[] = [];
  engine.subscribe((event: EngineEvent) => {
    if (event.type === "tick") seen.push(event.position);
  });
  return seen;
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe("WebAudioEngine lifecycle", () => {
  it("starts idle with the default params and no track", () => {
    expect(engine.getSnapshot()).toEqual({
      state: "idle",
      params: DEFAULT_PARAMS,
      track: null,
      error: null,
      exporting: false,
    });
    expect(engine.getPosition()).toBe(0);
  });

  it("ignores play() before a track is loaded", async () => {
    await engine.play();

    expect(engine.getSnapshot().state).toBe("idle");
    expect(stubs.contexts).toHaveLength(0);
  });

  it("walks idle -> loading -> ready -> playing -> paused", async () => {
    const seen = states();

    await load();
    await engine.play();
    engine.pause();

    expect(seen).toEqual(["loading", "ready", "playing", "paused"]);
  });

  it("describes the decoded track", async () => {
    await load("beat.wav");

    expect(engine.getSnapshot().track).toEqual({
      name: "beat.wav",
      duration: 3,
      sampleRate: 44100,
      channels: 2,
    });
    expect(engine.getSnapshot().state).toBe("ready");
  });

  it("rewinds the playhead to zero on load", async () => {
    engine.setParams({ playbackRate: 1 });
    await load();
    await engine.play();
    advance(1.5);
    expect(engine.getPosition()).toBeCloseTo(1.5, 6);

    await load("next.wav");

    expect(engine.getPosition()).toBe(0);
  });

  it("clears loop points on load, because they are seconds of the old track", async () => {
    await load();
    engine.setParams({ loopStart: 1, loopEnd: 2 });

    await load("next.wav");

    expect(engine.getSnapshot().params.loopStart).toBeNull();
    expect(engine.getSnapshot().params.loopEnd).toBeNull();
  });

  it("clears the peaks cache on load", async () => {
    await load();
    const first = await engine.getPeaks(4);

    await load("next.wav");

    expect(await engine.getPeaks(4)).not.toBe(first);
  });

  it("returns to idle with an error when the first load fails", async () => {
    stubs.decode = () => Promise.reject(new Error("bad codec"));

    await load("broken.wav");

    expect(engine.getSnapshot().state).toBe("idle");
    expect(engine.getSnapshot().track).toBeNull();
    expect(engine.getSnapshot().error).toContain("Could not load broken.wav");
  });

  it("keeps the previous track and parks paused when a later load fails", async () => {
    await load("good.wav");
    stubs.decode = () => Promise.reject(new Error("bad codec"));

    await load("broken.wav");

    expect(engine.getSnapshot().state).toBe("paused");
    expect(engine.getSnapshot().track?.name).toBe("good.wav");
    expect(engine.getSnapshot().error).toContain("Could not load broken.wav");
  });

  it("lets the newer of two overlapping loads own the snapshot", async () => {
    await load("warm.wav");

    const slow = deferred<AudioBuffer>();
    const entered = deferred<void>();
    const fileA = makeFile("a.wav", 16);
    const fileB = makeFile("b.wav", 32);
    stubs.decode = (bytes) => {
      if (bytes.byteLength === 16) {
        entered.resolve();
        return slow.promise;
      }
      return Promise.resolve(makeSilentBuffer(44100 * 2, 44100, 1));
    };
    const seen = states();

    const a = engine.load(fileA);
    await entered.promise;
    const b = engine.load(fileB);
    await b;
    slow.resolve(makeSilentBuffer(44100 * 3, 44100, 2));
    await a;

    expect(engine.getSnapshot().track?.name).toBe("b.wav");
    expect(engine.getSnapshot().track?.duration).toBe(2);
    expect(seen.filter((state) => state === "ready")).toEqual(["ready"]);
  });

  it("closes the context and stops the frame loop on dispose", async () => {
    await load();
    await engine.play();
    const ctx = stubs.context();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    engine.dispose();

    expect(ctx.closes).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("WebAudioEngine transport", () => {
  beforeEach(async () => {
    engine.setParams({ playbackRate: 1 });
    await load();
  });

  it("resumes a suspended context before starting a source", async () => {
    const ctx = stubs.context();
    ctx.state = "suspended";
    const before = ctx.resumes;

    await engine.play();

    expect(ctx.resumes).toBe(before + 1);
    expect(ctx.state).toBe("running");
  });

  it("starts a whole-track source at the playhead with 0/0 loop points", async () => {
    await engine.play();

    const [source] = stubs.sources();
    expect(source.playbackRate.value).toBe(1);
    expect(source.loop).toBe(true);
    expect(source.loopStart).toBe(0);
    expect(source.loopEnd).toBe(0);
    expect(source.starts).toEqual([{ when: 0, offset: 0 }]);
  });

  it("writes a custom region onto the source it starts", async () => {
    engine.setParams({ loopStart: 1, loopEnd: 2 });

    await engine.play();

    const [source] = stubs.sources();
    expect(source.loopStart).toBe(1);
    expect(source.loopEnd).toBe(2);
  });

  it("stops and disconnects the source on pause", async () => {
    await engine.play();
    advance(0.5);

    engine.pause();

    const [source] = stubs.sources();
    expect(source.stops).toBe(1);
    expect(source.disconnects).toBe(1);
    expect(engine.getSnapshot().state).toBe("paused");
    expect(engine.getPosition()).toBeCloseTo(0.5, 6);
  });

  it("recreates the source at the offset when seeking while playing", async () => {
    await engine.play();

    engine.seek(1.5);

    expect(stubs.sources()).toHaveLength(2);
    expect(stubs.sources()[0].stops).toBe(1);
    expect(stubs.sources()[1].starts).toEqual([{ when: 0, offset: 1.5 }]);
    expect(engine.getSnapshot().state).toBe("playing");
  });

  it("only moves the playhead and ticks when seeking while paused", async () => {
    await engine.play();
    engine.pause();
    const seen = ticks();

    engine.seek(1);

    expect(stubs.sources()).toHaveLength(1);
    expect(engine.getPosition()).toBe(1);
    expect(seen).toEqual([1]);
    expect(engine.getSnapshot().state).toBe("paused");
  });

  it("clamps the seek to the track", async () => {
    engine.seek(99);
    expect(engine.getPosition()).toBe(3);

    engine.seek(-5);
    expect(engine.getPosition()).toBe(0);
  });

  it("bends every source's pitch with the wobble LFO", async () => {
    await engine.play();
    const [source] = stubs.sources();
    const depth = stubs.context().gains[4];

    expect(depth.connections).toContain(source.detune);

    await engine.exportWav();
    const offline = stubs.offline();
    expect(offline.gains[4].connections).toContain(offline.sources[0].detune);
  });

  it("clamps a start at or past loopEnd back to loopStart", async () => {
    engine.setParams({ loopStart: 1, loopEnd: 2 });
    engine.seek(2.5);

    await engine.play();

    expect(stubs.sources()[0].starts).toEqual([{ when: 0, offset: 1 }]);
    expect(engine.getPosition()).toBe(1);
  });

  it("loops the crackle bed under playback and stops it with the transport", async () => {
    await engine.play();
    const [bed] = stubs.beds();
    expect(bed.loop).toBe(true);
    expect(bed.starts).toEqual([{ when: 0, offset: 0 }]);

    engine.seek(1);
    expect(stubs.beds()).toHaveLength(1);

    engine.pause();
    expect(bed.stops).toBe(1);
    expect(bed.disconnects).toBe(1);
  });
});

describe("WebAudioEngine params", () => {
  beforeEach(async () => {
    engine.setParams({ playbackRate: 1 });
    await load();
  });

  it("writes playbackRate and the loop flag onto the live source", async () => {
    await engine.play();

    engine.setParams({ playbackRate: 1.2, loop: false });

    const [source] = stubs.sources();
    expect(source.playbackRate.value).toBe(1.2);
    expect(source.loop).toBe(false);
  });

  it("writes new loop points onto the live source without restarting it", async () => {
    await engine.play();

    engine.setParams({ loopStart: 1, loopEnd: 2 });

    expect(stubs.sources()).toHaveLength(1);
    expect(stubs.sources()[0].loopStart).toBe(1);
    expect(stubs.sources()[0].loopEnd).toBe(2);
  });

  it("restarts at the new start when the region moves past the playhead", async () => {
    await engine.play();
    advance(2.5);

    engine.setParams({ loopStart: 0.5, loopEnd: 1 });

    expect(stubs.sources()).toHaveLength(2);
    expect(stubs.sources()[1].starts).toEqual([{ when: 0, offset: 0.5 }]);
  });

  it("restarts at loopStart when loop is switched on past the region end", async () => {
    engine.setParams({ loop: false, loopStart: 1, loopEnd: 2 });
    await engine.play();
    advance(2.5);

    engine.setParams({ loop: true });

    expect(stubs.sources()).toHaveLength(2);
    expect(stubs.sources()[0].stops).toBe(1);
    expect(stubs.sources()[0].disconnects).toBe(1);
    expect(stubs.sources()[1].starts).toEqual([{ when: 0, offset: 1 }]);
  });

  it("writes the vinyl volume onto the bed gain", async () => {
    await engine.play();
    const [bed] = stubs.beds();
    const bedGain = bed.connections[0] as unknown as {
      gain: { value: number };
    };

    engine.setParams({ vinylVolume: 20 });

    expect(bedGain.gain.value).toBeCloseTo(0.2, 10);
  });

  it("publishes a new snapshot only when a param actually moves", () => {
    const seen = states();

    engine.setParams({ volume: DEFAULT_PARAMS.volume });
    expect(seen).toHaveLength(0);

    engine.setParams({ volume: 50 });
    expect(seen).toEqual(["ready"]);
  });
});

describe("WebAudioEngine position", () => {
  beforeEach(async () => {
    engine.setParams({ playbackRate: 1 });
    await load();
  });

  it("reports each integrated frame as a tick", async () => {
    const seen = ticks();
    await engine.play();

    advance(0.5);
    advance(0.25);

    expect(seen).toEqual([0.5, 0.75]);
  });

  it("returns the same snapshot reference across ticks", async () => {
    await engine.play();
    const snapshot = engine.getSnapshot();

    advance(0.5);
    advance(0.5);

    expect(engine.getSnapshot()).toBe(snapshot);
  });

  it("returns a new snapshot reference when a fact changes", async () => {
    await engine.play();
    const snapshot = engine.getSnapshot();

    engine.setParams({ volume: 50 });

    expect(engine.getSnapshot()).not.toBe(snapshot);
  });

  it("stops, disconnects and parks at zero on the natural end", async () => {
    engine.setParams({ loop: false });
    await engine.play();

    advance(3);

    const [source] = stubs.sources();
    expect(source.stops).toBe(1);
    expect(source.disconnects).toBe(1);
    expect(engine.getSnapshot().state).toBe("paused");
    expect(engine.getPosition()).toBe(0);
  });

  it("ignores the source's own ended event", async () => {
    await engine.play();

    stubs.sources()[0].fireEnded();

    expect(engine.getSnapshot().state).toBe("playing");
  });
});

describe("WebAudioEngine level", () => {
  it("reports zero unless playing, then the master bus RMS", async () => {
    await load();
    expect(engine.getLevel()).toBe(0);

    await engine.play();
    const [analyser] = stubs.context().analysers;
    analyser.level = 0.2;
    expect(engine.getLevel()).toBeCloseTo(0.6, 6);

    analyser.level = 0.9;
    expect(engine.getLevel()).toBe(1);

    engine.pause();
    expect(engine.getLevel()).toBe(0);
  });
});

describe("WebAudioEngine peaks", () => {
  it("returns an empty array before a track is loaded", async () => {
    expect(await engine.getPeaks(8)).toHaveLength(0);
  });

  it("caches the result per column count", async () => {
    await load();

    const four = await engine.getPeaks(4);
    expect(await engine.getPeaks(4)).toBe(four);

    const eight = await engine.getPeaks(8);
    expect(eight).not.toBe(four);
    expect(eight).toHaveLength(16);
  });
});

describe("WebAudioEngine export", () => {
  beforeEach(() => {
    // A short track keeps the offline render and the WAV encode cheap.
    stubs.decode = () => Promise.resolve(makeSilentBuffer(1000, 8000, 2));
  });

  it("renders ceil(length / rate) frames at the track's rate and channels", async () => {
    await load();
    engine.setParams({ playbackRate: 0.85 });

    await engine.exportWav();

    const offline = stubs.offline();
    expect(offline.numberOfChannels).toBe(2);
    expect(offline.length).toBe(Math.ceil(1000 / 0.85));
    expect(offline.sampleRate).toBe(8000);
  });

  it("renders through the same wet/dry graph the live path uses", async () => {
    await load();
    engine.setParams({ volume: 85, reverbLevel: 40 });

    await engine.exportWav();

    const offline = stubs.offline();
    // input, master, dry, wet, wobble depth.
    expect(offline.gains.map((gain) => gain.gain.value)).toEqual([
      1, 0.85, 0.6, 0.4, 0,
    ]);
    expect(offline.convolvers).toHaveLength(1);
    const [source] = offline.sources;
    expect(source.starts).toEqual([{ when: 0, offset: 0 }]);
    expect(source.connections).toEqual([offline.gains[0]]);
    expect(offline.gains[1].connections).toContain(offline.destination);
  });

  it("returns a 16-bit PCM WAV blob", async () => {
    await load();
    engine.setParams({ playbackRate: 1 });

    const blob = await engine.exportWav();

    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 1000 * 2 * 2);
  });

  it("raises and lowers the exporting flag around the render", async () => {
    await load();
    const seen: boolean[] = [];
    engine.subscribe((event) => {
      if (event.type === "state") seen.push(engine.getSnapshot().exporting);
    });

    await engine.exportWav();

    expect(seen).toEqual([true, false]);
  });

  it("builds the impulse for the offline context so the sample rates match", async () => {
    await load();

    await engine.exportWav();

    const offline = stubs.offline();
    expect(offline.generated).toHaveLength(1);
    expect(offline.convolvers[0].buffer).toBe(offline.generated[0]);
    expect(offline.generated[0].sampleRate).toBe(offline.sampleRate);
  });

  it("rejects when there is no track to export", async () => {
    await expect(engine.exportWav()).rejects.toThrow("No track loaded");
  });
});
