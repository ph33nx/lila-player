import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { audioBufferToWav, loadImpulseResponse } from "@/utils/audio-utils";

export const useAudioProcessor = () => {
  // State Grouping
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [audioSettings, setAudioSettings] = useState({
    playbackRate: 0.85,
    volume: 85,
    reverbLevel: 50,
    vinylVolume: 100,
    isPlaying: false,
    isLooping: false,
  });

  // Nodes
  const [gainNode, setGainNode] = useState<GainNode | null>(null);
  const [reverbNode, setReverbNode] = useState<ConvolverNode | null>(null);
  const [reverbGainNode, setReverbGainNode] = useState<GainNode | null>(null);
  const [dryGainNode, setDryGainNode] = useState<GainNode | null>(null);
  const [sourceNode, setSourceNode] = useState<AudioBufferSourceNode | null>(
    null
  );

  // Refs
  const durationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  /** Initialize Audio Context and Nodes */
  useEffect(() => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const gain = context.createGain();
    const reverbGain = context.createGain();
    const dryGain = context.createGain();
    const convolver = context.createConvolver();

    setAudioContext(context);
    setGainNode(gain);
    setReverbNode(convolver);
    setReverbGainNode(reverbGain);
    setDryGainNode(dryGain);

    loadImpulseResponse(context, "/audio/impulse.wav")
      .then((buffer: AudioBuffer) => {
        convolver.buffer = buffer;
      })
      .catch((err: unknown) => {
        console.error("Error loading impulse response:", err);
      });

    return () => {
      context.close();
    };
  }, []);

  /** Update Node Gains */
  useEffect(() => {
    if (gainNode) {
      gainNode.gain.value = audioSettings.volume / 100;
    }
  }, [gainNode, audioSettings.volume]);

  useEffect(() => {
    if (sourceNode) {
      sourceNode.playbackRate.value = audioSettings.playbackRate;
    }
  }, [sourceNode, audioSettings.playbackRate]);

  useEffect(() => {
    if (reverbGainNode) {
      reverbGainNode.gain.value = audioSettings.reverbLevel / 100;
    }
    if (dryGainNode) {
      dryGainNode.gain.value = 1 - audioSettings.reverbLevel / 100;
    }
  }, [reverbGainNode, dryGainNode, audioSettings.reverbLevel]);

  /** Update Vinyl Volume */
  useEffect(() => {
    let vinylAudio: HTMLAudioElement | null = null;

    if (audioContext) {
      vinylAudio = new Audio("/audio/vinyl.mp3");
      vinylAudio.loop = true;
      vinylAudio.volume = audioSettings.vinylVolume / 100;

      const vinylSource = audioContext.createMediaElementSource(vinylAudio);
      vinylSource.connect(gainNode!).connect(audioContext.destination);

      vinylAudio
        .play()
        .catch((err) => console.warn("Vinyl playback interrupted:", err));

      return () => {
        vinylAudio?.pause();
        vinylSource.disconnect();
      };
    }
  }, [audioContext, gainNode, audioSettings.vinylVolume]);

  /** Progress and Playback Handlers */
  const updateProgress = useCallback(() => {
    if (!audioContext || !durationRef.current) {
      cancelAnimationFrame(animationFrameRef.current!);
      return;
    }

    const elapsedTime = audioContext.currentTime - startTimeRef.current;
    setProgress(Math.min(elapsedTime / durationRef.current, 1));

    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, [audioContext, audioSettings.isPlaying, startTimeRef]);

  const stopAudio = useCallback(() => {
    if (sourceNode) {
      sourceNode.stop();
    }
    setSourceNode(null);
    setAudioSettings((prev) => ({ ...prev, isPlaying: false }));
    cancelAnimationFrame(animationFrameRef.current!);
  }, [sourceNode]);

  const playAudio = useCallback(
    (startTime: number) => {
      if (!audioContext || !audioBuffer) return;

      stopAudio();

      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.loop = audioSettings.isLooping;
      bufferSource.playbackRate.value = audioSettings.playbackRate;

      bufferSource.connect(dryGainNode!);
      dryGainNode?.connect(gainNode!);

      bufferSource.connect(reverbNode!);
      reverbNode?.connect(reverbGainNode!);
      reverbGainNode?.connect(gainNode!);

      gainNode?.connect(audioContext.destination);

      bufferSource.start(0, startTime);
      setSourceNode(bufferSource);
      setAudioSettings((prev) => ({ ...prev, isPlaying: true }));
      startTimeRef.current = audioContext.currentTime - startTime;

      animationFrameRef.current = requestAnimationFrame(updateProgress);
    },
    [
      audioContext,
      audioBuffer,
      audioSettings.isLooping,
      audioSettings.playbackRate,
      stopAudio,
      dryGainNode,
      reverbNode,
      reverbGainNode,
      gainNode,
      updateProgress,
    ]
  );

  /** Handlers */
  const handlePlayPause = useCallback(() => {
    if (audioSettings.isPlaying) {
      stopAudio();
    } else {
      playAudio(progress * durationRef.current);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [audioSettings.isPlaying, stopAudio, playAudio, progress, updateProgress]);

  const handleWaveformClick = useCallback(
    (clickedProgress: number) => {
      const newTime = clickedProgress * durationRef.current;

      // Update the progress and start playback from the clicked position
      setProgress(clickedProgress);
      startTimeRef.current = audioContext!.currentTime - newTime;
      playAudio(newTime);
    },
    [playAudio, audioContext]
  );

  const handleSave = useCallback(async () => {
    if (!audioBuffer || !reverbNode) return;

    setIsSaving(true);

    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const gain = offlineContext.createGain();
    gain.gain.value = audioSettings.volume / 100;

    const convolver = offlineContext.createConvolver();
    convolver.buffer = reverbNode.buffer;

    source.connect(convolver).connect(gain).connect(offlineContext.destination);
    source.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    const wav = audioBufferToWav(renderedBuffer);

    const blob = new Blob([new DataView(wav)], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename || "processed-audio"}-slowed.wav`;
    anchor.click();

    setIsSaving(false);
  }, [audioBuffer, reverbNode, audioSettings.volume, filename]);

  /** Cleanup */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleFileChange = useCallback(
    async (file: File) => {
      if (!audioContext) return;

      stopAudio();
      setIsWaveformLoading(true);

      const audioData = await file.arrayBuffer();
      const decodedBuffer = await audioContext.decodeAudioData(audioData);

      setAudioBuffer(decodedBuffer);
      setFilename(file.name);
      durationRef.current = decodedBuffer.duration;
      setProgress(0);

      setIsWaveformLoading(false);
    },
    [audioContext, stopAudio]
  );

  /** Memoized Return */
  return useMemo(
    () => ({
      handleFileChange,
      handlePlayPause,
      handleWaveformClick,
      handleSave,
      toggleLoop: () =>
        setAudioSettings((prev) => ({ ...prev, isLooping: !prev.isLooping })),
      setVolume: (volume: number) =>
        setAudioSettings((prev) => ({ ...prev, volume })),
      setPlaybackRate: (playbackRate: number) =>
        setAudioSettings((prev) => ({ ...prev, playbackRate })),
      setReverbLevel: (reverbLevel: number) =>
        setAudioSettings((prev) => ({ ...prev, reverbLevel })),
      setVinylVolume: (vinylVolume: number) =>
        setAudioSettings((prev) => ({ ...prev, vinylVolume })),
      isSaving,
      audioBuffer,
      audioSettings,
      isWaveformLoading,
      progress,
      filename,
    }),
    [
      audioContext,
      handlePlayPause,
      handleWaveformClick,
      handleSave,
      audioBuffer,
      audioSettings,
      isSaving,
      isWaveformLoading,
      progress,
      filename,
    ]
  );
};
