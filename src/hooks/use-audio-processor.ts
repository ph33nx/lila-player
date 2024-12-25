"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { audioBufferToWav, loadImpulseResponse } from "../utils/audio-utils";

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
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
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
    if (!context || !destinationNode) return;

    const vinylAudio = new Audio("/audio/vinyl.mp3");
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
    if (!vinylRef.current) return;

    vinylRef.current.volume = volume / 100;

    if (isPlaying) {
      vinylRef.current
        .play()
        .catch((err) => console.warn("Vinyl playback interrupted:", err));
    } else {
      vinylRef.current.pause();
    }
  }, [isPlaying, volume]);
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
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const progressEmitter = useRef<EventTarget>(new EventTarget());

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

  // Optimized progress update function
  const updateProgress = useCallback(() => {
    if (!context || !durationRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const elapsedTime = context.currentTime - startTimeRef.current;
    const newProgress = Math.min(elapsedTime / durationRef.current, 1);

    // Only update if progress has changed
    if (Math.abs(newProgress - progress) > 0.001) {
      setProgress(newProgress);
      // Emit progress update event
      const event = new CustomEvent("progressupdate", { detail: newProgress });
      progressEmitter.current.dispatchEvent(event);
    }

    // Handle end of audio
    if (newProgress >= 1) {
      setProgress(0);
      if (!settings.isLooping) {
        setIsPlaying(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      } else {
        // If looping, restart from beginning
        startTimeRef.current = context.currentTime;
        // Continue animation for looped playback
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
      return;
    }

    // Continue animation if playing
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
    (startTime: number) => {
      if (!context || !audioBuffer) return;

      stopAudio();

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = settings.isLooping;
      source.playbackRate.value = settings.playbackRate;

      connectAudioNodes(source);

      source.start(0, startTime);
      setSourceNode(source);
      setIsPlaying(true);
      startTimeRef.current = context.currentTime - startTime;
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

  const handleWaveformClick = useCallback(
    (clickedProgress: number) => {
      const newTime = clickedProgress * durationRef.current;
      setProgress(clickedProgress);
      startTimeRef.current = context!.currentTime - newTime;
      playAudio(newTime);
    },
    [playAudio, context],
  );

  const handleSave = useCallback(async () => {
    if (!audioBuffer || !nodes.reverb) return;

    setIsSaving(true);

    try {
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate,
      );

      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;

      const gain = offlineContext.createGain();
      gain.gain.value = settings.volume / 100;

      const convolver = offlineContext.createConvolver();
      convolver.buffer = nodes.reverb.buffer;

      source
        .connect(convolver)
        .connect(gain)
        .connect(offlineContext.destination);
      source.start(0);

      const renderedBuffer = await offlineContext.startRendering();
      const wav = audioBufferToWav(renderedBuffer);

      const blob = new Blob([new DataView(wav)], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${filename || "processed-audio"}-slowed.wav`;
      anchor.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving audio:", error);
    } finally {
      setIsSaving(false);
    }
  }, [audioBuffer, nodes.reverb, settings.volume, filename]);

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
