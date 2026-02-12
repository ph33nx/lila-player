"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { audioBufferToWav, loadImpulseResponse } from "../utils/audio-utils";
import { useMediaSession } from "./use-media-session";

// WebKitGTK (Tauri on Linux) has a broken AudioContext.destination that produces silence.
// Detect once and use <audio> element for playback on Linux as a workaround.
const IS_LINUX =
  typeof navigator !== "undefined" && /Linux/.test(navigator.userAgent);

// Custom hook for managing audio context and base nodes
const useAudioContext = () => {
  const [context, setContext] = useState<AudioContext | null>(null);
  const [nodes, setNodes] = useState<{
    gain: GainNode | null;
    reverb: ConvolverNode | null;
    reverbGain: GainNode | null;
    dryGain: GainNode | null;
  }>({
    gain: null,
    reverb: null,
    reverbGain: null,
    dryGain: null,
  });

  useEffect(() => {
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const gain = audioContext.createGain();
    const reverbGain = audioContext.createGain();
    const dryGain = audioContext.createGain();
    const convolver = audioContext.createConvolver();

    if (IS_LINUX) {
      console.log(
        "[Audio] Linux detected — using <audio> element playback (WebKitGTK workaround)",
      );
    } else {
      console.log("[Audio] Using native AudioContext.destination");
    }

    setContext(audioContext);
    setNodes({
      gain,
      reverb: convolver,
      reverbGain,
      dryGain,
    });

    loadImpulseResponse(audioContext, "/audio/impulse.wav")
      .then((buffer: AudioBuffer) => {
        convolver.buffer = buffer;
      })
      .catch((err: unknown) => {
        console.error("Error loading impulse response:", err);
      });

    return () => {
      audioContext.close();
    };
  }, []);

  return { context, nodes };
};

// Custom hook for managing vinyl background sound
const useVinylSound = (
  context: AudioContext | null,
  destinationNode: GainNode | null,
  volume: number,
  isPlaying: boolean,
) => {
  const vinylRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Setup vinyl audio and connections
  useEffect(() => {
    if (!context) return;
    // On Windows/Mac we need the gain node for Web Audio routing
    if (!IS_LINUX && !destinationNode) return;

    const vinylAudio = new Audio("/audio/vinyl.mp3");
    vinylAudio.loop = true;
    vinylRef.current = vinylAudio;

    if (!IS_LINUX && destinationNode) {
      // Windows/Mac: route through Web Audio graph for mixing
      const vinylSource = context.createMediaElementSource(vinylAudio);
      sourceRef.current = vinylSource;
      vinylSource.connect(destinationNode).connect(context.destination);
    }
    // Linux: play the <audio> element directly — no Web Audio routing needed

    return () => {
      vinylAudio.pause();
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    };
  }, [context, destinationNode]);

  // Control vinyl playback based on isPlaying state
  useEffect(() => {
    if (!vinylRef.current || !context) return;

    vinylRef.current.volume = volume / 100;

    if (isPlaying) {
      // Ensure AudioContext is resumed before playing vinyl audio
      const startVinyl = async () => {
        if (context.state === "suspended") {
          await context.resume();
        }
        vinylRef.current
          ?.play()
          .catch((err) => console.warn("Vinyl playback interrupted:", err));
      };
      startVinyl();
    } else {
      vinylRef.current.pause();
    }
  }, [isPlaying, volume, context]);
};

// Custom hook for managing audio playback state
const usePlaybackState = (sourceNode: AudioBufferSourceNode | null) => {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!sourceNode) return;

    const handleEnded = () => setIsPlaying(false);
    sourceNode.addEventListener("ended", handleEnded);

    return () => {
      sourceNode.removeEventListener("ended", handleEnded);
    };
  }, [sourceNode]);

  return [isPlaying, setIsPlaying] as const;
};

// Main hook
export const useAudioProcessor = () => {
  const { context, nodes } = useAudioContext();
  const [sourceNode, setSourceNode] = useState<AudioBufferSourceNode | null>(
    null,
  );
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const [settings, setSettings] = useState({
    playbackRate: 0.85,
    volume: 85,
    reverbLevel: 40,
    vinylVolume: 50,
    isLooping: true,
  });

  const [isPlaying, setIsPlaying] = usePlaybackState(sourceNode);

  // Refs for timing
  const durationRef = useRef<number>(0);
  const audioPositionRef = useRef<number>(0); // Position in source audio (seconds)
  const lastFrameTimeRef = useRef<number>(0); // Last context.currentTime for delta calculation
  const animationFrameRef = useRef<number | null>(null);
  const progressEmitter = useRef<EventTarget>(new EventTarget());
  const playbackRateRef = useRef<number>(settings.playbackRate); // Avoid stale closure in animation frame

  // Linux-only: <audio> element for direct playback
  const linuxAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileBlobUrlRef = useRef<string | null>(null);

  // Keep playbackRateRef in sync
  useEffect(() => {
    playbackRateRef.current = settings.playbackRate;
  }, [settings.playbackRate]);

  // Setup vinyl sound
  useVinylSound(context, nodes.gain, settings.vinylVolume, isPlaying);

  // Update node parameters when settings change
  useEffect(() => {
    if (!nodes.gain) return;
    nodes.gain.gain.value = settings.volume / 100;
  }, [nodes.gain, settings.volume]);

  useEffect(() => {
    if (!sourceNode) return;
    sourceNode.playbackRate.value = settings.playbackRate;
  }, [sourceNode, settings.playbackRate]);

  useEffect(() => {
    if (!nodes.reverbGain || !nodes.dryGain) return;
    const reverbLevel = settings.reverbLevel / 100;
    nodes.reverbGain.gain.value = reverbLevel;
    nodes.dryGain.gain.value = 1 - reverbLevel;
  }, [nodes.reverbGain, nodes.dryGain, settings.reverbLevel]);

  // Linux: sync playbackRate and volume to the <audio> element
  useEffect(() => {
    if (!IS_LINUX || !linuxAudioRef.current) return;
    linuxAudioRef.current.playbackRate = settings.playbackRate;
  }, [settings.playbackRate]);

  useEffect(() => {
    if (!IS_LINUX || !linuxAudioRef.current) return;
    linuxAudioRef.current.volume = Math.min(settings.volume / 100, 1);
  }, [settings.volume]);

  useEffect(() => {
    if (!IS_LINUX || !linuxAudioRef.current) return;
    linuxAudioRef.current.loop = settings.isLooping;
  }, [settings.isLooping]);

  // Optimized progress update function - tracks audio position directly
  const updateProgress = useCallback(() => {
    if (!durationRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let newProgress: number;

    if (IS_LINUX && linuxAudioRef.current) {
      // Linux: read position directly from <audio> element
      newProgress = Math.min(
        linuxAudioRef.current.currentTime / durationRef.current,
        1,
      );
    } else if (context) {
      // Windows/Mac: calculate from delta time
      const now = context.currentTime;
      const deltaTime = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      audioPositionRef.current += deltaTime * playbackRateRef.current;
      newProgress = Math.min(audioPositionRef.current / durationRef.current, 1);
    } else {
      return;
    }

    // Only update if progress has changed
    if (Math.abs(newProgress - progress) > 0.001) {
      setProgress(newProgress);
      const event = new CustomEvent("progressupdate", { detail: newProgress });
      progressEmitter.current.dispatchEvent(event);
    }

    // Handle end of audio (Windows/Mac path — Linux uses <audio>.loop and ended event)
    if (!IS_LINUX && newProgress >= 1) {
      if (!settings.isLooping) {
        audioPositionRef.current = 0;
        setProgress(0);
        setIsPlaying(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      } else {
        // Loop: reset audio position to beginning
        audioPositionRef.current = 0;
        setProgress(0);
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
      return;
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [context, isPlaying, progress, setIsPlaying, settings.isLooping]);

  // Start/stop progress updates based on playing state
  useEffect(() => {
    if (isPlaying && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else if (!isPlaying && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isPlaying, updateProgress]);

  // Subscribe to progress updates
  const onProgressUpdate = useCallback(
    (callback: (progress: number) => void) => {
      const handler = (e: Event) => {
        callback((e as CustomEvent).detail);
      };
      progressEmitter.current.addEventListener("progressupdate", handler);
      return () => {
        progressEmitter.current.removeEventListener("progressupdate", handler);
      };
    },
    [],
  );

  // Audio control functions
  const stopAudio = useCallback(() => {
    if (IS_LINUX) {
      if (linuxAudioRef.current) {
        linuxAudioRef.current.pause();
      }
    } else {
      if (sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
      }
      setSourceNode(null);
    }
    setIsPlaying(false);
  }, [sourceNode, setIsPlaying]);

  const connectAudioNodes = useCallback(
    (source: AudioBufferSourceNode) => {
      if (
        !nodes.dryGain ||
        !nodes.gain ||
        !nodes.reverb ||
        !nodes.reverbGain ||
        !context
      )
        return;

      source.connect(nodes.dryGain);
      nodes.dryGain.connect(nodes.gain);

      source.connect(nodes.reverb);
      nodes.reverb.connect(nodes.reverbGain);
      nodes.reverbGain.connect(nodes.gain);

      nodes.gain.connect(context.destination);
    },
    [nodes, context],
  );

  const playAudio = useCallback(
    async (startTime: number) => {
      if (!context || !audioBuffer) return;

      // Resume AudioContext if suspended (required by WebKitGTK autoplay policy on Linux)
      if (context.state === "suspended") {
        await context.resume();
      }

      stopAudio();

      if (IS_LINUX) {
        // Linux: play via <audio> element (WebKitGTK workaround)
        const el = linuxAudioRef.current;
        if (!el || !el.src) {
          console.warn("[Audio] Linux: no <audio> element or src available");
          return;
        }
        el.currentTime = startTime;
        el.playbackRate = settings.playbackRate;
        el.volume = Math.min(settings.volume / 100, 1);
        el.loop = settings.isLooping;
        await el
          .play()
          .catch((err) => console.error("[Audio] Linux playback failed:", err));
        setIsPlaying(true);
        console.log(
          "[Audio] Linux: playback started at",
          startTime.toFixed(2),
          "s, rate:",
          settings.playbackRate,
        );
      } else {
        // Windows/Mac: play via Web Audio API
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = settings.isLooping;
        source.playbackRate.value = settings.playbackRate;

        connectAudioNodes(source);

        source.start(0, startTime);
        setSourceNode(source);
        setIsPlaying(true);
      }

      // Set audio position and frame time for delta calculation
      audioPositionRef.current = startTime;
      lastFrameTimeRef.current = context.currentTime;
    },
    [
      context,
      audioBuffer,
      settings.isLooping,
      settings.playbackRate,
      settings.volume,
      stopAudio,
      connectAudioNodes,
      setIsPlaying,
    ],
  );

  // Event handlers
  const handleFileChange = useCallback(
    async (file: File) => {
      if (!context) return;

      // Resume AudioContext on user gesture (file selection) for WebKitGTK compatibility
      if (context.state === "suspended") {
        await context.resume();
      }

      stopAudio();
      setIsWaveformLoading(true);

      try {
        const audioData = await file.arrayBuffer();
        const decodedBuffer = await context.decodeAudioData(audioData);

        setAudioBuffer(decodedBuffer);
        setFilename(file.name);
        durationRef.current = decodedBuffer.duration;
        setProgress(0);

        if (IS_LINUX) {
          // Create blob URL and set up <audio> element for Linux playback
          if (fileBlobUrlRef.current) {
            URL.revokeObjectURL(fileBlobUrlRef.current);
          }
          const blobUrl = URL.createObjectURL(file);
          fileBlobUrlRef.current = blobUrl;

          if (!linuxAudioRef.current) {
            const el = new Audio();
            el.addEventListener("ended", () => {
              setIsPlaying(false);
              setProgress(0);
            });
            linuxAudioRef.current = el;
          }
          linuxAudioRef.current.src = blobUrl;
          linuxAudioRef.current.load();
          console.log(
            "[Audio] Linux: file loaded via <audio> element:",
            file.name,
          );
        }

        console.log(
          "[Audio] File decoded:",
          file.name,
          "duration:",
          decodedBuffer.duration.toFixed(2),
          "s",
        );
      } catch (error) {
        console.error("Error processing audio file:", error);
      } finally {
        setIsWaveformLoading(false);
      }
    },
    [context, stopAudio, setIsPlaying],
  );

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio(progress * durationRef.current);
    }
  }, [isPlaying, stopAudio, playAudio, progress]);

  // Media session for system media keys
  const handleMediaPlay = useCallback(() => {
    if (!isPlaying && audioBuffer) {
      playAudio(progress * durationRef.current);
    }
  }, [isPlaying, audioBuffer, playAudio, progress]);

  const handleMediaPause = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    }
  }, [isPlaying, stopAudio]);

  useMediaSession({
    title: filename ? `${filename} - Lila Player` : "Lila Player",
    isPlaying,
    onPlay: handleMediaPlay,
    onPause: handleMediaPause,
  });

  const handleWaveformClick = useCallback(
    (clickedProgress: number) => {
      const newTime = clickedProgress * durationRef.current;
      setProgress(clickedProgress);
      // playAudio will set audioPositionRef and lastFrameTimeRef
      playAudio(newTime);
    },
    [playAudio],
  );

  const handleSave = useCallback(async () => {
    if (!audioBuffer || !nodes.reverb?.buffer) return;

    setIsSaving(true);

    try {
      // Calculate output length for slowed audio
      const outputLength = Math.ceil(
        audioBuffer.length / settings.playbackRate,
      );
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        outputLength,
        audioBuffer.sampleRate,
      );

      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = settings.playbackRate;

      // Create gain nodes for mixing
      const masterGain = offlineContext.createGain();
      const dryGain = offlineContext.createGain();
      const wetGain = offlineContext.createGain();
      const convolver = offlineContext.createConvolver();

      // Set levels
      masterGain.gain.value = settings.volume / 100;
      const reverbMix = settings.reverbLevel / 100;
      dryGain.gain.value = 1 - reverbMix;
      wetGain.gain.value = reverbMix;
      convolver.buffer = nodes.reverb.buffer;

      // Dry path: source -> dryGain -> masterGain -> destination
      source.connect(dryGain);
      dryGain.connect(masterGain);

      // Wet path: source -> convolver -> wetGain -> masterGain -> destination
      source.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(masterGain);

      masterGain.connect(offlineContext.destination);
      source.start(0);

      const renderedBuffer = await offlineContext.startRendering();
      const wav = audioBufferToWav(renderedBuffer);

      const blob = new Blob([new DataView(wav)], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${filename || "processed-audio"}-lofi.wav`;
      anchor.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving audio:", error);
    } finally {
      setIsSaving(false);
    }
  }, [
    audioBuffer,
    nodes.reverb,
    settings.volume,
    settings.playbackRate,
    settings.reverbLevel,
    filename,
  ]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (fileBlobUrlRef.current) {
        URL.revokeObjectURL(fileBlobUrlRef.current);
      }
      if (linuxAudioRef.current) {
        linuxAudioRef.current.pause();
        linuxAudioRef.current = null;
      }
    };
  }, []);

  return {
    handleFileChange,
    handlePlayPause,
    handleWaveformClick,
    handleSave,
    toggleLoop: () =>
      setSettings((prev) => ({ ...prev, isLooping: !prev.isLooping })),
    setVolume: (volume: number) => setSettings((prev) => ({ ...prev, volume })),
    setPlaybackRate: (playbackRate: number) =>
      setSettings((prev) => ({ ...prev, playbackRate })),
    setReverbLevel: (reverbLevel: number) =>
      setSettings((prev) => ({ ...prev, reverbLevel })),
    setVinylVolume: (vinylVolume: number) =>
      setSettings((prev) => ({ ...prev, vinylVolume })),
    onProgressUpdate,
    isSaving,
    audioBuffer,
    settings,
    isPlaying,
    isWaveformLoading,
    progress,
    filename,
  };
};
