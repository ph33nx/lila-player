"use client";

import { useEffect, useRef, memo, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { Upload } from "lucide-react";
import { Input } from "./ui/input";

interface AudioWaveformProps {
  buffer: AudioBuffer | null;
  progress: number;
  onProgressClick: (progress: number) => void;
  isLoading?: boolean;
  onFileChange: (file: File) => void;
  filename: string | null;
}

function AudioWaveform({
  buffer,
  progress,
  onProgressClick,
  isLoading = false,
  onFileChange,
  filename,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformImageRef = useRef<ImageData | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!waveformImageRef.current) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const channelData = buffer.getChannelData(0);
      const step = Math.ceil(channelData.length / canvas.width);
      const amp = canvas.height / 2;

      ctx.beginPath();
      ctx.moveTo(0, amp);

      for (let i = 0; i < canvas.width; i++) {
        const start = i * step;
        const slice = channelData.slice(start, start + step);
        const max = Math.max(...slice);
        const min = Math.min(...slice);

        ctx.lineTo(i, amp + max * amp);
        ctx.lineTo(i, amp + min * amp);
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.stroke();

      waveformImageRef.current = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
    } else {
      ctx.putImageData(waveformImageRef.current, 0, 0);
    }

    // Apply semi-transparent white overlay to the played part
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(0, 0, canvas.width * progress, canvas.height);

    // Draw vertical progress line
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.moveTo(canvas.width * progress, 0);
    ctx.lineTo(canvas.width * progress, canvas.height);
    ctx.stroke();
  }, [buffer, progress]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  useEffect(() => {
    if (buffer) {
      waveformImageRef.current = null;
    }
  }, [buffer]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      // Account for scaling between canvas size and display size
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const clickedProgress = x / canvas.width;
      onProgressClick(clickedProgress);
    },
    [onProgressClick],
  );

  const formattedCurrentTime = useMemo(
    () => formatTime(buffer ? progress * buffer.duration : 0),
    [buffer, progress],
  );
  const formattedDuration = useMemo(
    () => formatTime(buffer ? buffer.duration : 0),
    [buffer],
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileChange(e.target.files[0]);
    }
  };

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <motion.div
      className="relative w-full h-32 mb-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded z-10">
          <div className="w-8 h-8 border-4 border-t-white rounded-full animate-spin"></div>
        </div>
      )}

      {!buffer && !isLoading && (
        <div className="flex items-center justify-center w-full h-full">
          <Button onClick={openFilePicker}>Select Audio</Button>
        </div>
      )}

      {buffer && (
        <>
          <div className="absolute top-2 left-2 text-sm text-white/80">
            {filename}
          </div>
          <button
            className="absolute top-2 right-2 cursor-pointer"
            onClick={openFilePicker}
          >
            <Upload className="h-6 w-6 text-white" />
          </button>
        </>
      )}

      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        onClick={handleClick}
        className="w-full h-full bg-transparent rounded-lg cursor-pointer"
      />

      <input
        type="file"
        accept="audio/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="absolute bottom-2 left-2 text-sm text-white/80">
        {formattedCurrentTime == "0:00" ? "" : formattedCurrentTime}
      </div>
      <div className="absolute bottom-2 right-2 text-sm text-white/80">
        {formattedDuration == "0:00" ? "" : formattedDuration}
      </div>
    </motion.div>
  );
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default memo(AudioWaveform);
