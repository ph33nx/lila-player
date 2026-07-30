"use client";

import { memo, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Repeat, Download, Loader2 } from "lucide-react";

interface PlayerControlsProps {
  onPlayPause: () => void;
  onVolumeChange: (value: number) => void;
  onSpeedChange: (value: number) => void;
  onReverbChange: (value: number) => void;
  onVinylVolumeChange: (value: number) => void;
  onSave: (format: "mp3" | "wav") => void;
  toggleLoop: () => void;
  volume: number;
  playbackRate: number;
  reverbLevel: number;
  vinylVolume: number;
  isPlaying: boolean;
  isSaving: boolean;
  isLooping: boolean;
}

const ControlRow = ({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center">
      <label className="text-xs text-white/50">{label}</label>
      <span className="text-xs text-white/70 font-mono">{value}</span>
    </div>
    {children}
  </div>
);

const PlayerControls: React.FC<PlayerControlsProps> = memo(
  ({
    onPlayPause,
    onVolumeChange,
    onSpeedChange,
    onReverbChange,
    onVinylVolumeChange,
    onSave,
    toggleLoop,
    volume,
    playbackRate,
    reverbLevel,
    vinylVolume,
    isPlaying,
    isSaving,
    isLooping,
  }) => {
    const [format, setFormat] = useState<"mp3" | "wav">("mp3");

    const handleSliderChange = useCallback(
      (callback: (value: number) => void) => (values: number[]) => {
        callback(values[0]);
      },
      [],
    );

    const buttonVariants = {
      hover: { scale: 1.06 },
      tap: { scale: 0.95 },
    };

    return (
      <motion.div
        className="w-full flex flex-col gap-y-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex flex-col gap-4">
          <ControlRow label="Volume" value={`${volume}%`}>
            <Slider
              value={[volume]}
              min={0}
              max={110}
              step={1}
              onValueChange={handleSliderChange(onVolumeChange)}
              className="w-full"
            />
          </ControlRow>

          <ControlRow label="Speed & Pitch" value={`${playbackRate.toFixed(2)}x`}>
            <Slider
              value={[playbackRate]}
              min={0.65}
              max={1.35}
              step={0.05}
              onValueChange={handleSliderChange(onSpeedChange)}
              className="w-full"
            />
          </ControlRow>

          <ControlRow label="Reverb" value={`${reverbLevel}`}>
            <Slider
              value={[reverbLevel]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleSliderChange(onReverbChange)}
              className="w-full"
            />
          </ControlRow>

          <ControlRow label="Vinyl Noise" value={`${vinylVolume}`}>
            <Slider
              value={[vinylVolume]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleSliderChange(onVinylVolumeChange)}
              className="w-full"
            />
          </ControlRow>
        </div>

        <div className="h-px w-full bg-white/10" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
              <button
                onClick={toggleLoop}
                title={isLooping ? "Disable loop" : "Enable loop"}
                className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center cursor-pointer hover:bg-white/[0.08] transition-colors"
              >
                <Repeat
                  className={`h-4 w-4 ${isLooping ? "text-white" : "text-white/35"}`}
                />
              </button>
            </motion.div>

            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
              <button
                onClick={onPlayPause}
                title={isPlaying ? "Pause" : "Play"}
                className="h-14 w-14 rounded-full bg-white text-black flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 translate-x-0.5" />
                )}
              </button>
            </motion.div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-xs">
              {(["mp3", "wav"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-2.5 py-1 rounded-full uppercase transition-colors cursor-pointer ${
                    format === f
                      ? "bg-white text-black"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
              <button
                onClick={() => onSave(format)}
                disabled={isSaving}
                title={`Download as ${format.toUpperCase()}`}
                className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center cursor-pointer hover:bg-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    );
  },
);

PlayerControls.displayName = "PlayerControls";

export default PlayerControls;
