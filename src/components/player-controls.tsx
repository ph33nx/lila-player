"use client";

import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Play, Pause, Repeat, Save, Loader2 } from "lucide-react";

interface PlayerControlsProps {
  onPlayPause: () => void;
  onVolumeChange: (value: number) => void;
  onSpeedChange: (value: number) => void;
  onReverbChange: (value: number) => void;
  onVinylVolumeChange: (value: number) => void;
  onSave: () => void;
  toggleLoop: () => void;
  volume: number;
  playbackRate: number;
  reverbLevel: number;
  vinylVolume: number;
  isPlaying: boolean;
  isSaving: boolean;
  isLooping: boolean;
}

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
    const handleSliderChange = useCallback(
      (callback: (value: number) => void) => (values: number[]) => {
        callback(values[0]);
      },
      [],
    );

    const buttonVariants = {
      hover: { scale: 1.1 },
      tap: { scale: 0.95 },
    };

    return (
      <motion.div
        className="w-full flex flex-col justify-center items-center gap-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm">Volume</label>
              <span className="text-sm">{volume}%</span>
            </div>
            <Slider
              value={[volume]}
              min={0}
              max={110}
              step={1}
              onValueChange={handleSliderChange(onVolumeChange)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm">Speed & Pitch</label>
              <span className="text-sm">{playbackRate.toFixed(2)}x</span>
            </div>
            <Slider
              value={[playbackRate]}
              min={0.65}
              max={1.35}
              step={0.05}
              onValueChange={handleSliderChange(onSpeedChange)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm">Reverb</label>
              <span className="text-sm">{reverbLevel}</span>
            </div>
            <Slider
              value={[reverbLevel]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleSliderChange(onReverbChange)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm">Vinyl Noise</label>
              <span className="text-sm">{vinylVolume}</span>
            </div>
            <Slider
              value={[vinylVolume]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleSliderChange(onVinylVolumeChange)}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex justify-center items-center gap-4">
          <motion.div
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            <Button
              onClick={toggleLoop}
              variant="outline"
              size="icon"
              className="rounded-full"
              title={isLooping ? "Disable loop" : "Enable loop"}
            >
              <Repeat
                className={`h-4 w-4 ${isLooping ? "text-white" : "text-gray-400"}`}
              />
            </Button>
          </motion.div>

          <motion.div
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            <Button
              onClick={onPlayPause}
              variant="outline"
              size="icon"
              className="rounded-full w-20 h-20"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-12 w-12" />
              ) : (
                <Play className="h-12 w-12" />
              )}
            </Button>
          </motion.div>

          <motion.div
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            <Button
              onClick={onSave}
              variant="outline"
              size="icon"
              className="rounded-full"
              disabled={isSaving}
              title="Save"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  },
);

PlayerControls.displayName = "PlayerControls";

export default PlayerControls;
