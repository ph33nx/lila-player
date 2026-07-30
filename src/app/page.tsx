"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAudioProcessor } from "@/hooks/use-audio-processor";
import PlayerControls from "@/components/player-controls";
import VinylDisc from "@/components/vinyl-disc";
import YoutubeImport from "@/components/youtube-import";
import { motion } from "framer-motion";

export default function Home() {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    handleFileChange,
    handleBlobImport,
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
  } = useAudioProcessor();

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        handleFileChange(e.target.files[0]);
      }
      e.target.value = "";
    },
    [handleFileChange],
  );

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
      className="flex flex-col items-center justify-center min-h-screen p-4 select-none px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-full max-w-3xl flex flex-col items-center gap-y-6">
        <div className="text-center flex flex-col items-center justify-center gap-y-1.5">
          <h1 className="text-2xl font-bold text-center font-mono tracking-wider">
            Lila
          </h1>
          <p className="text-white/50 text-sm">Slowed and Reverb LoFi Player</p>
        </div>

        <YoutubeImport
          onImported={(blob, name) => handleBlobImport(blob, name)}
        />

        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-10">
            <VinylDisc
              buffer={audioBuffer}
              progress={progress}
              isPlaying={isPlaying}
              isLoading={isWaveformLoading}
              filename={filename}
              onProgressClick={handleWaveformClick}
              onOpenFilePicker={openFilePicker}
            />

            <div className="w-full flex-1 flex flex-col justify-center">
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
          </div>
        </div>

        <input
          type="file"
          accept="audio/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>
    </motion.div>
  );
}
