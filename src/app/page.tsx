"use client";

import { useState, useEffect } from "react";
import { useAudioProcessor } from "@/hooks/use-audio-processor";
import PlayerControls from "@/components/player-controls";
import AudioWaveform from "@/components/audio-waveform";
import { motion } from "framer-motion";

export default function Home() {
  const [isAppLoading, setIsAppLoading] = useState(true);

  const {
    handleFileChange,
    handlePlayPause,
    toggleLoop,
    handleSave,
    setVolume,
    setPlaybackRate,
    setReverbLevel,
    setVinylVolume,
    filename,
    progress,
    settings,
    isPlaying,
    audioBuffer,
    isSaving,
    isWaveformLoading,
    handleWaveformClick,
    onProgressUpdate,
  } = useAudioProcessor();

  useEffect(() => {
    const disableContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    document.addEventListener("contextmenu", disableContextMenu);

    const timeout = setTimeout(() => setIsAppLoading(false), 1000);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("contextmenu", disableContextMenu);
    };
  }, []);

  if (isAppLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="w-12 h-12 border-4 border-t-white border-gray-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-screen p-4 select-none px-4 py-4 max-w-2xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-full flex flex-col justify-center items-center gap-y-8">
        <div className="text-center flex flex-col items-center justify-center mb-4 gap-y-4">
          <h1 className="text-3xl font-bold text-center font-mono tracking-wider">
            Lila
          </h1>
          <p className="text-white/70">Slowed and Reverb LoFi Player</p>
        </div>
        <AudioWaveform
          buffer={audioBuffer}
          progress={progress}
          isLoading={isWaveformLoading}
          onProgressClick={handleWaveformClick}
          onFileChange={handleFileChange}
          onProgressUpdate={onProgressUpdate}
          filename={filename}
        />
        <PlayerControls
          onPlayPause={handlePlayPause}
          toggleLoop={toggleLoop}
          onSave={handleSave}
          onVolumeChange={setVolume}
          onSpeedChange={setPlaybackRate}
          onReverbChange={setReverbLevel}
          onVinylVolumeChange={setVinylVolume}
          volume={settings.volume}
          playbackRate={settings.playbackRate}
          reverbLevel={settings.reverbLevel}
          vinylVolume={settings.vinylVolume}
          isPlaying={isPlaying}
          isSaving={isSaving}
          isLooping={settings.isLooping}
        />
      </div>
    </motion.div>
  );
}
