"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  resolveLoopRegion,
  WebAudioEngine,
  type AudioEngine,
  type EngineEvent,
  type Params,
} from "@/engine";
import { isAudioFile } from "@/utils/audio-file";
import { exportFileName } from "@/utils/audio-file";
import { downloadBlob } from "@/utils/download";
import { useMediaSession } from "./use-media-session";

/**
 * Binds the audio engine to React. Renders come from the engine snapshot only;
 * the per-frame position travels as `tick` events straight to the canvas.
 */
export const usePlayer = () => {
  const [engine] = useState<AudioEngine>(() => new WebAudioEngine());

  useEffect(() => () => engine.dispose(), [engine]);

  const subscribeState = useCallback(
    (onStoreChange: () => void) =>
      engine.subscribe((event) => {
        if (event.type === "state") onStoreChange();
      }),
    [engine],
  );
  const getSnapshot = useCallback(() => engine.getSnapshot(), [engine]);
  const snapshot = useSyncExternalStore(
    subscribeState,
    getSnapshot,
    getSnapshot,
  );
  const { state, params, track, error, exporting } = snapshot;

  // The waveform sizes its own column count from the canvas, and the engine
  // caches one peak array per count.
  const getPeaks = useCallback(
    (columns: number) => engine.getPeaks(columns),
    [engine],
  );

  // The one gate both entry points go through: picker and drop. A file that
  // passes here can still fail to decode, and that error comes from the engine.
  const [rejected, setRejected] = useState<string | null>(null);
  const open = useCallback(
    (file: File) => {
      if (!isAudioFile(file)) {
        setRejected(`Unsupported file: ${file.name}`);
        return;
      }
      setRejected(null);
      void engine.load(file);
    },
    [engine],
  );

  const play = useCallback(() => {
    void engine.play();
  }, [engine]);

  const pause = useCallback(() => engine.pause(), [engine]);

  const togglePlay = useCallback(() => {
    if (engine.getSnapshot().state === "playing") engine.pause();
    else void engine.play();
  }, [engine]);

  const toggleLoop = useCallback(
    () => engine.setParams({ loop: !engine.getSnapshot().params.loop }),
    [engine],
  );

  const seek = useCallback((seconds: number) => engine.seek(seconds), [engine]);

  const setParams = useCallback(
    (patch: Partial<Params>) => engine.setParams(patch),
    [engine],
  );

  const setLoopStart = useCallback(
    (seconds: number = engine.getPosition()) =>
      engine.setParams({ loopStart: seconds }),
    [engine],
  );

  const setLoopEnd = useCallback(
    (seconds: number = engine.getPosition()) =>
      engine.setParams({ loopEnd: seconds }),
    [engine],
  );

  const clearLoopPoints = useCallback(
    () => engine.setParams({ loopStart: null, loopEnd: null }),
    [engine],
  );

  /** Resolves with the file name that was saved, or null if nothing was. */
  const exportWav = useCallback(async (): Promise<string | null> => {
    const current = engine.getSnapshot().track;
    if (!current) return null;
    const filename = exportFileName(current.name);
    try {
      downloadBlob(await engine.exportWav(), filename);
      return filename;
    } catch {
      // Already surfaced through snapshot.error.
      return null;
    }
  }, [engine]);

  const subscribe = useCallback(
    (listener: (event: EngineEvent) => void) => engine.subscribe(listener),
    [engine],
  );

  const getPosition = useCallback(() => engine.getPosition(), [engine]);
  const getLevel = useCallback(() => engine.getLevel(), [engine]);

  const loopRegion = useMemo(
    () =>
      resolveLoopRegion(params.loopStart, params.loopEnd, track?.duration ?? 0),
    [params.loopStart, params.loopEnd, track],
  );

  useMediaSession({
    title: track ? `${track.name} - Lila Player` : "Lila Player",
    isPlaying: state === "playing",
    onPlay: play,
    onPause: pause,
  });

  return {
    state,
    params,
    track,
    error: rejected ?? error,
    exporting,
    getPeaks,
    loopRegion,
    isPlaying: state === "playing",
    isLoading: state === "loading",
    open,
    togglePlay,
    toggleLoop,
    seek,
    setParams,
    setLoopStart,
    setLoopEnd,
    clearLoopPoints,
    exportWav,
    subscribe,
    getPosition,
    getLevel,
  };
};
