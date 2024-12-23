import { useState, useRef, useEffect, useCallback, useMemo } from "react";

export const useAudioProcessor = () => {
  // State Variables
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [sourceNode, setSourceNode] = useState<AudioBufferSourceNode | null>(
    null
  );
  const [gainNode, setGainNode] = useState<GainNode | null>(null);
  const [reverbGainNode, setReverbGainNode] = useState<GainNode | null>(null);
  const [reverbNode, setReverbNode] = useState<ConvolverNode | null>(null);
  const [dryGainNode, setDryGainNode] = useState<GainNode | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const [playbackRate, setPlaybackRate] = useState(0.85);
  const [volume, setVolume] = useState(100);
  const [reverbLevel, setReverbLevel] = useState(50);
  const [vinylVolume, setVinylVolume] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const durationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const vinylAudioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);

  const UPDATE_INTERVAL = 100; // ms

  // Initialize Audio Context and Nodes
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

    const loadImpulseResponse = async () => {
      try {
        const response = await fetch("/audio/impulse.wav");
        const buffer = await response.arrayBuffer();
        const decodedBuffer = await context.decodeAudioData(buffer);
        convolver.buffer = decodedBuffer;
      } catch (err) {
        console.error("Error loading impulse response:", err);
      }
    };

    loadImpulseResponse();

    return () => {
      context.close();
    };
  }, []);

  /** Update Progress */
  const updateProgress = useCallback(() => {
    if (!audioContext || !isPlaying || !durationRef.current) return;

    const currentTime = audioContext.currentTime - startTimeRef.current;
    setProgress(Math.min(currentTime / durationRef.current, 1));
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, [audioContext, isPlaying]);

  // Update Volume
  useEffect(() => {
    if (gainNode) {
      gainNode.gain.value = volume / 100;
    }
  }, [gainNode, volume]);

  // Update Playback Rate
  useEffect(() => {
    if (sourceNode) {
      sourceNode.playbackRate.value = playbackRate;
    }
  }, [sourceNode, playbackRate]);

  // Update Reverb Level
  useEffect(() => {
    if (reverbGainNode) {
      reverbGainNode.gain.value = reverbLevel / 100;
    }
    if (dryGainNode) {
      dryGainNode.gain.value = 1 - reverbLevel / 100;
    }
  }, [reverbGainNode, dryGainNode, reverbLevel]);

  // Vinyl Audio Setup
  useEffect(() => {
    const vinylAudio = new Audio("/audio/vinyl.mp3");
    vinylAudio.loop = true;
    vinylAudio.volume = vinylVolume / 100;
    vinylAudioRef.current = vinylAudio;

    return () => {
      vinylAudio.pause();
    };
  }, [vinylVolume]);

  /** Stop Playback */
  const stopAudio = useCallback(() => {
    if (sourceNode) {
      sourceNode.stop();
    }
    setSourceNode(null);
    setIsPlaying(false);
    cancelAnimationFrame(animationFrameRef.current!);
  }, [sourceNode]);

  /** Start Playback */
  const playAudio = useCallback(
    (startTime: number) => {
      if (!audioContext || !audioBuffer) return;

      // Stop existing audio
      if (sourceNode) {
        sourceNode.stop();
      }

      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.loop = isLooping;
      bufferSource.playbackRate.value = playbackRate;

      bufferSource.connect(dryGainNode!);
      dryGainNode?.connect(gainNode!);
      gainNode?.connect(audioContext.destination);

      bufferSource.connect(reverbNode!);
      reverbNode?.connect(reverbGainNode!);
      reverbGainNode?.connect(audioContext.destination);

      bufferSource.onended = () => {
        if (!isLooping) {
          setIsPlaying(false);
          setProgress(1);
        }
      };

      bufferSource.start(0, startTime);
      setSourceNode(bufferSource);
      setIsPlaying(true);
      startTimeRef.current = audioContext.currentTime - startTime;

      animationFrameRef.current = requestAnimationFrame(updateProgress);
    },
    [
      audioContext,
      audioBuffer,
      playbackRate,
      isLooping,
      sourceNode,
      dryGainNode,
      gainNode,
      reverbNode,
      reverbGainNode,
      updateProgress,
    ]
  );

  /** Handle Play/Pause */
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio(progress * durationRef.current);
    }
  }, [isPlaying, stopAudio, playAudio, progress]);

  /** Handle Waveform Click */
  const handleWaveformClick = useCallback(
    (clickedProgress: number) => {
      const newTime = clickedProgress * durationRef.current;
      setProgress(clickedProgress);
      playAudio(newTime);
    },
    [playAudio]
  );

  // Save Audio File
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
    gain.gain.value = volume / 100;

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
  }, [audioBuffer, reverbNode, volume, filename]);

  // Return Memoized Values
  return useMemo(
    () => ({
      handleFileChange: async (file: File) => {
        if (!audioContext) return;

        setIsWaveformLoading(true);

        const audioData = await file.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(audioData);

        setAudioBuffer(decodedBuffer);
        setFilename(file.name);
        durationRef.current = decodedBuffer.duration;
        setProgress(0);

        setIsWaveformLoading(false);
      },
      handlePlayPause,
      toggleLoop: () => setIsLooping((prev) => !prev),
      handleSave,
      handleWaveformClick,
      volume,
      setVolume,
      setVinylVolume,
      setPlaybackRate,
      setReverbLevel,
      progress,
      isPlaying,
      isWaveformLoading,
      audioBuffer,
      filename,
      playbackRate,
      reverbLevel,
      vinylVolume,
      isLooping,
      isSaving,
    }),
    [
      audioContext,
      handlePlayPause,
      handleSave,
      handleWaveformClick,
      volume,
      setVolume,
      setVinylVolume,
      setPlaybackRate,
      setReverbLevel,
      progress,
      isPlaying,
      isWaveformLoading,
      audioBuffer,
      filename,
      playbackRate,
      reverbLevel,
      vinylVolume,
      isLooping,
      isSaving,
    ]
  );
};

// Helper Function to Convert AudioBuffer to WAV
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numOfChannels = buffer.numberOfChannels;
  const length = buffer.length * numOfChannels * 2 + 44;
  const result = new ArrayBuffer(length);
  const view = new DataView(result);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, length - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numOfChannels * 2, true);
  view.setUint16(32, numOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length - 44, true);

  const interleaved = new Float32Array(buffer.length * numOfChannels);
  for (let channel = 0; channel < numOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      interleaved[i * numOfChannels + channel] = channelData[i];
    }
  }

  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return result;
}
