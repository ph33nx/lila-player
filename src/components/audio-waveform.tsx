"use client";

import { useEffect, useRef, memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface AudioWaveformProps {
  buffer: AudioBuffer | null;
  progress: number;
  onProgressClick: (progress: number) => void;
  isLoading?: boolean;
}

function AudioWaveform({
  buffer,
  progress,
  onProgressClick,
  isLoading = false,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate current time and total duration
  const { currentTime, totalDuration } = useMemo(() => {
    if (!buffer) return { currentTime: "0:00", totalDuration: "0:00" };
    const total = buffer.duration || 0;
    const current = total * progress;
    return {
      currentTime: formatTime(current),
      totalDuration: formatTime(total),
    };
  }, [buffer, progress]);

  // Update canvas and progress line
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw waveform
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    // Draw unplayed part (lighter)
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.strokeStyle = "#ffffff30";
    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.lineTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();

    // Draw played part (darker)
    const progressX = Math.floor(canvas.width * progress);
    if (progressX > 0) {
      ctx.beginPath();
      ctx.moveTo(0, amp);
      ctx.strokeStyle = "#ffffff";
      for (let i = 0; i < progressX; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = data[i * step + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        ctx.lineTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
      }
      ctx.stroke();
    }
  }, [buffer, progress]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / canvas.width;
    onProgressClick(progress);
  };

  return (
    <motion.div
      className="relative w-full h-48"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded z-10">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        onClick={handleClick}
        className="w-full h-full bg-black/30 rounded cursor-pointer"
      />
      {/* Progress line */}
      <motion.div
        className="absolute top-0 h-full w-[2px] bg-primary z-[1]"
        style={{ left: `${progress * 100}%` }}
        initial={false}
        animate={{ left: `${progress * 100}%` }}
        transition={{ duration: 0.1 }}
      />

      {/* Progress overlay */}
      <motion.div
        className="absolute top-0 left-0 h-full bg-primary/30"
        style={{ width: `${progress * 100}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${progress * 100}%` }}
        transition={{ duration: 0.1 }}
      />

      {/* Time displays */}
      <div className="absolute bottom-2 left-2 text-sm text-white/80">
        {currentTime}
      </div>
      <div className="absolute bottom-2 right-2 text-sm text-white/80">
        {totalDuration}
      </div>
    </motion.div>
  );
}

export default memo(AudioWaveform);
