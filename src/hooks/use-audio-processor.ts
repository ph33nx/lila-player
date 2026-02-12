"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { audioBufferToWav, loadImpulseResponse } from "../utils/audio-utils";
import { useMediaSession } from "./use-media-session";
import { withBasePath } from "../utils/base-path";

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

    setContext(audioContext);
    setNodes({
      gain,
      reverb: convolver,
      reverbGain,
      dryGain,
    });

    loadImpulseResponse(audioContext, withBasePath("/audio/impulse.wav"))
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
    if (!context || !destinationNode) return;

    const vinylAudio = new Audio(withBasePath("/audio/vinyl.mp3"));
    vinylAudio.loop = true;
    vinylRef.current = vinylAudio;

    const vinylSource = context.createMediaElementSource(vinylAudio);
    sourceRef.current = vinylSource;
    vinylSource.connect(destinationNode).connect(context.destination);

    return () => {
      vinylAudio.pause();
      vinylSource.disconnect();
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

  // Optimized progress update function - tracks audio position directly
  const updateProgress = useCallback(() => {
    if (!context || !durationRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Calculate delta time since last frame
    const now = context.currentTime;
    const deltaTime = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    // Advance audio position by delta * playbackRate (use ref to avoid stale closure)
    audioPositionRef.current += deltaTime * playbackRateRef.current;
    const newProgress = Math.min(
      audioPositionRef.current / durationRef.current,
      1,
    );

    // Only update if progress has changed
    if (Math.abs(newProgress - progress) > 0.001) {
      setProgress(newProgress);
      const event = new CustomEvent("progressupdate", { detail: newProgress });
      progressEmitter.current.dispatchEvent(event);
    }

    // Handle end of audio
    if (newProgress >= 1) {
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
    if (sourceNode) {
      sourceNode.stop();
      sourceNode.disconnect();
    }
    setSourceNode(null);
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

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = settings.isLooping;
      source.playbackRate.value = settings.playbackRate;

      connectAudioNodes(source);

      source.start(0, startTime);
      setSourceNode(source);
      setIsPlaying(true);

      // Set audio position and frame time for delta calculation
      audioPositionRef.current = startTime;
      lastFrameTimeRef.current = context.currentTime;
    },
    [
      context,
      audioBuffer,
      settings.isLooping,
      settings.playbackRate,
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
      } catch (error) {
        console.error("Error processing audio file:", error);
      } finally {
        setIsWaveformLoading(false);
      }
    },
    [context, stopAudio],
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
