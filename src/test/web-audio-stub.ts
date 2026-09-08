import { vi } from "vitest";

/**
 * A hand-written Web Audio fake. jsdom ships no `AudioContext` and no
 * `OfflineAudioContext`, so the engine's entire surface has to be supplied here.
 *
 * What it fakes: node construction and wiring, the values the engine writes
 * (`gain`, `playbackRate`, `loop*`), `start`/`stop`/`disconnect` calls,
 * `currentTime` (settable, so a test drives the position integrator by hand),
 * the suspended -> running resume, decode, and offline rendering.
 *
 * What it deliberately does not fake: any audio. No samples are processed, no
 * time passes on its own, and `startRendering()` returns silence of the right
 * shape. Assertions are about the graph and the state machine, never a signal.
 */

/** The engine only ever writes `.value` on an `AudioParam`. */
export class StubAudioParam {
  constructor(public value: number) {}
}

/** Records the wiring, so tests can assert the graph the engine built. */
export class StubAudioNode {
  readonly connections: (StubAudioNode | StubAudioParam)[] = [];
  disconnects = 0;

  connect<T extends StubAudioNode | StubAudioParam>(destination: T): T {
    this.connections.push(destination);
    return destination;
  }

  disconnect(): void {
    this.disconnects += 1;
  }
}

export class StubGainNode extends StubAudioNode {
  readonly gain = new StubAudioParam(1);
}

export class StubConvolverNode extends StubAudioNode {
  buffer: AudioBuffer | null = null;
}

export class StubBiquadFilterNode extends StubAudioNode {
  type: BiquadFilterType = "lowpass";
  readonly frequency = new StubAudioParam(350);
  readonly Q = new StubAudioParam(1);
  readonly gain = new StubAudioParam(0);
}

export class StubWaveShaperNode extends StubAudioNode {
  curve: Float32Array | null = null;
  oversample: OverSampleType = "none";
}

export class StubOscillatorNode extends StubAudioNode {
  type: OscillatorType = "sine";
  readonly frequency = new StubAudioParam(440);
  starts = 0;

  start(): void {
    this.starts += 1;
  }
}

export interface StartCall {
  when: number;
  offset: number;
}

export class StubBufferSourceNode extends StubAudioNode {
  buffer: AudioBuffer | null = null;
  readonly playbackRate = new StubAudioParam(1);
  readonly detune = new StubAudioParam(0);
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  readonly starts: StartCall[] = [];
  stops = 0;

  start(when = 0, offset = 0): void {
    this.starts.push({ when, offset });
  }

  stop(): void {
    this.stops += 1;
  }

  /** The engine ignores `ended` on purpose; tests assert that it does. */
  fireEnded(): void {
    this.onended?.();
  }
}

/** The meter tap. `level` is the constant sample it reports, so RMS equals it. */
export class StubAnalyserNode extends StubAudioNode {
  fftSize = 2048;
  level = 0;

  getFloatTimeDomainData(array: Float32Array): void {
    array.fill(this.level);
  }
}

/** Everything `BaseAudioContext` gives both the live and the offline context. */
abstract class StubBaseContext {
  abstract readonly sampleRate: number;
  readonly destination = new StubAudioNode();
  readonly gains: StubGainNode[] = [];
  readonly convolvers: StubConvolverNode[] = [];
  readonly filters: StubBiquadFilterNode[] = [];
  readonly shapers: StubWaveShaperNode[] = [];
  readonly oscillators: StubOscillatorNode[] = [];
  readonly analysers: StubAnalyserNode[] = [];
  readonly sources: StubBufferSourceNode[] = [];
  /** Buffers the engine generated with `createBuffer`: the impulse and the crackle. */
  readonly generated: AudioBuffer[] = [];

  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    const buffer = makeSilentBuffer(length, sampleRate, channels);
    this.generated.push(buffer);
    return buffer;
  }

  createAnalyser(): StubAnalyserNode {
    const node = new StubAnalyserNode();
    this.analysers.push(node);
    return node;
  }

  createBiquadFilter(): StubBiquadFilterNode {
    const node = new StubBiquadFilterNode();
    this.filters.push(node);
    return node;
  }

  createWaveShaper(): StubWaveShaperNode {
    const node = new StubWaveShaperNode();
    this.shapers.push(node);
    return node;
  }

  createOscillator(): StubOscillatorNode {
    const node = new StubOscillatorNode();
    this.oscillators.push(node);
    return node;
  }

  createGain(): StubGainNode {
    const node = new StubGainNode();
    this.gains.push(node);
    return node;
  }

  createConvolver(): StubConvolverNode {
    const node = new StubConvolverNode();
    this.convolvers.push(node);
    return node;
  }

  createBufferSource(): StubBufferSourceNode {
    const node = new StubBufferSourceNode();
    this.sources.push(node);
    return node;
  }
}

export type DecodeHandler = (bytes: ArrayBuffer) => Promise<AudioBuffer>;

export class StubAudioContext extends StubBaseContext {
  /** Autoplay policy: a context is born suspended until a gesture resumes it. */
  state: AudioContextState = "suspended";
  /** The clock the engine integrates against. Tests move it by hand. */
  currentTime = 0;
  sampleRate = 44100;
  resumes = 0;
  closes = 0;
  decode: DecodeHandler = () =>
    Promise.reject(new Error("decode not configured"));

  async resume(): Promise<void> {
    this.resumes += 1;
    this.state = "running";
  }

  async close(): Promise<void> {
    this.closes += 1;
    this.state = "closed";
  }

  decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer> {
    return this.decode(bytes);
  }
}

export class StubOfflineAudioContext extends StubBaseContext {
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    super();
  }

  /** Silence of exactly the requested shape: the export path only reshapes it. */
  startRendering(): Promise<AudioBuffer> {
    return Promise.resolve(
      makeSilentBuffer(this.length, this.sampleRate, this.numberOfChannels),
    );
  }
}

/** The minimum of `AudioBuffer` the engine, the WAV encoder and peaks read. */
export const makeAudioBuffer = (
  channels: Float32Array[],
  sampleRate = 44100,
): AudioBuffer => {
  const length = channels[0]?.length ?? 0;
  return {
    numberOfChannels: channels.length,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (index: number): Float32Array => channels[index],
  } as unknown as AudioBuffer;
};

export const makeSilentBuffer = (
  frames: number,
  sampleRate = 44100,
  channels = 2,
): AudioBuffer =>
  makeAudioBuffer(
    Array.from({ length: channels }, () => new Float32Array(frames)),
    sampleRate,
  );

/** The parts of `File` the app reads: `name`, `type` and `arrayBuffer()`. */
export const makeFile = (
  name: string,
  byteLength = 8,
  type = "audio/wav",
): File =>
  ({
    name,
    type,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(byteLength)),
  }) as unknown as File;

export interface WebAudioStubs {
  /** Live contexts the engine constructed, newest last. */
  readonly contexts: StubAudioContext[];
  /** Offline contexts `exportWav()` constructed, newest last. */
  readonly offlines: StubOfflineAudioContext[];
  /** How `decodeAudioData` resolves. Replace to control one test. */
  decode: DecodeHandler;
  /** The one live context. Throws before the engine has built it. */
  context(): StubAudioContext;
  /** Sources playing the decoded track on the live context, newest last. */
  sources(): StubBufferSourceNode[];
  /** Sources playing a generated bed (the crackle), newest last. */
  beds(): StubBufferSourceNode[];
  /** The most recent offline context. Throws before an export. */
  offline(): StubOfflineAudioContext;
}

/**
 * Install the fakes as globals for one test. Pair with `vi.unstubAllGlobals()`
 * in `afterEach`, so a test that does not install them sees a bare jsdom.
 */
export const installWebAudioStubs = (): WebAudioStubs => {
  const stubs: WebAudioStubs = {
    contexts: [],
    offlines: [],
    decode: () => Promise.resolve(makeSilentBuffer(44100 * 3, 44100, 2)),
    context: () => {
      const ctx = stubs.contexts.at(-1);
      if (!ctx) throw new Error("no AudioContext has been created yet");
      return ctx;
    },
    sources: () => {
      const ctx = stubs.context();
      return ctx.sources.filter(
        (source) => !ctx.generated.includes(source.buffer as AudioBuffer),
      );
    },
    beds: () => {
      const ctx = stubs.context();
      return ctx.sources.filter((source) =>
        ctx.generated.includes(source.buffer as AudioBuffer),
      );
    },
    offline: () => {
      const offline = stubs.offlines.at(-1);
      if (!offline)
        throw new Error("no OfflineAudioContext has been created yet");
      return offline;
    },
  };

  vi.stubGlobal(
    "AudioContext",
    class extends StubAudioContext {
      constructor() {
        super();
        // Delegate so a test can swap `stubs.decode` after construction.
        this.decode = (bytes) => stubs.decode(bytes);
        stubs.contexts.push(this);
      }
    },
  );

  vi.stubGlobal(
    "OfflineAudioContext",
    class extends StubOfflineAudioContext {
      constructor(channels: number, length: number, sampleRate: number) {
        super(channels, length, sampleRate);
        stubs.offlines.push(this);
      }
    },
  );

  return stubs;
};
