"use client";

import { useEffect, useRef, memo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { FolderOpen } from "lucide-react";

// Custom hook for handling canvas operations
const useWaveformCanvas = (
  buffer: AudioBuffer | null,
  progress: number,
  onProgressClick: (progress: number) => void,
  onProgressUpdate: (callback: (progress: number) => void) => () => void,
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Initialize offscreen canvas for double buffering
  useEffect(() => {
    offscreenCanvasRef.current = document.createElement("canvas");
    return () => {
      offscreenCanvasRef.current = null;
    };
  }, []);

  // Optimize waveform calculation with Web Audio API
  const calculateWaveformData = useCallback(
    (channelData: Float32Array, width: number) => {
      const blockSize = Math.floor(channelData.length / width);
      const waveformData = new Float32Array(width * 2);

      // First pass: calculate min/max for each block and find peak
      let peakValue = 0;
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        const startIndex = i * blockSize;

        for (
          let j = 0;
          j < blockSize && startIndex + j < channelData.length;
          j++
        ) {
          const datum = channelData[startIndex + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }

        waveformData[i * 2] = max;
        waveformData[i * 2 + 1] = min;
        peakValue = Math.max(peakValue, Math.abs(max), Math.abs(min));
      }

      // Normalize to use full height (with small margin)
      const normalizeScale = peakValue > 0 ? 0.95 / peakValue : 1;
      for (let i = 0; i < waveformData.length; i++) {
        waveformData[i] *= normalizeScale;
      }

      return waveformData;
    },
    [],
  );

  // Store waveform data to avoid recalculation
  const waveformDataRef = useRef<Float32Array | null>(null);
  const baseImageRef = useRef<ImageData | null>(null);

  // Initial waveform calculation and drawing
  const initializeWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    if (!canvas || !offscreenCanvas || !buffer) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    const offscreenCtx = offscreenCanvas.getContext("2d", { alpha: false });
    if (!ctx || !offscreenCtx) return;

    // Calculate waveform data only once
    if (!waveformDataRef.current) {
      const channelData = buffer.getChannelData(0);
      waveformDataRef.current = calculateWaveformData(
        channelData,
        canvas.width,
      );
    }

    // Draw base waveform only once
    if (!baseImageRef.current) {
      offscreenCanvas.width = canvas.width;
      offscreenCanvas.height = canvas.height;

      // Clear with transparent background
      offscreenCtx.clearRect(0, 0, canvas.width, canvas.height);

      const amp = canvas.height / 2;
      offscreenCtx.beginPath();
      offscreenCtx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      offscreenCtx.lineWidth = 1;

      for (let i = 0; i < canvas.width; i++) {
        const max = waveformDataRef.current[i * 2] * amp + amp;
        const min = waveformDataRef.current[i * 2 + 1] * amp + amp;
        offscreenCtx.moveTo(i, max);
        offscreenCtx.lineTo(i, min);
      }
      offscreenCtx.stroke();

      baseImageRef.current = offscreenCtx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }

    // Draw base image
    ctx.putImageData(baseImageRef.current, 0, 0);
  }, [buffer, calculateWaveformData]);

  // Optimized drawing function using double buffering
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx || !baseImageRef.current) return;

    // Clear canvas for transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base waveform
    ctx.putImageData(baseImageRef.current, 0, 0);

    // Draw progress overlay
    const progressWidth = canvas.width * progress;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(0, 0, progressWidth, canvas.height);

    // Draw progress line
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.moveTo(progressWidth, 0);
    ctx.lineTo(progressWidth, canvas.height);
    ctx.stroke();
  }, [buffer, progress]);

  // Handle canvas interactions
  const handleCanvasInteraction = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const x = (e.clientX - rect.left) * scaleX;
      const clickedProgress = Math.max(0, Math.min(1, x / canvas.width));
      onProgressClick(clickedProgress);
    },
    [onProgressClick],
  );

  // Initialize waveform when buffer changes
  useEffect(() => {
    if (!buffer) {
      // Clear cached waveform and base image when no buffer is provided
      waveformDataRef.current = null;
      baseImageRef.current = null;
      return;
    }

    // Clear cached data and initialize waveform for the new buffer
    waveformDataRef.current = null;
    baseImageRef.current = null;
    initializeWaveform();
  }, [buffer, initializeWaveform]);

  // Handle progress updates
  useEffect(() => {
    if (!buffer) return;

    const handleProgress = () => {
      drawWaveform();
      rafRef.current = requestAnimationFrame(handleProgress);
    };

    // Start animation loop
    rafRef.current = requestAnimationFrame(handleProgress);

    // Subscribe to progress updates for sync
    const unsubscribe = onProgressUpdate(() => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(handleProgress);
      }
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      unsubscribe();
    };
  }, [buffer, drawWaveform, onProgressUpdate]);

  return {
    canvasRef,
    handleCanvasInteraction,
  };
};

// Custom hook for file handling
const useFileHandler = (onFileChange: (file: File) => void) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        onFileChange(e.target.files[0]);
      }
    },
    [onFileChange],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    handleFileUpload,
    openFilePicker,
  };
};

// Memoized time formatter
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface AudioWaveformProps {
  buffer: AudioBuffer | null;
  progress: number;
  onProgressClick: (progress: number) => void;
  onProgressUpdate: (callback: (progress: number) => void) => () => void;
  isLoading?: boolean;
  onFileChange: (file: File) => void;
  filename: string | null;
}

function AudioWaveform({
  buffer,
  progress,
  onProgressClick,
  onProgressUpdate,
  isLoading = false,
  onFileChange,
  filename,
}: AudioWaveformProps) {
  const { canvasRef, handleCanvasInteraction } = useWaveformCanvas(
    buffer,
    progress,
    onProgressClick,
    onProgressUpdate,
  );

  const { fileInputRef, handleFileUpload, openFilePicker } =
    useFileHandler(onFileChange);

  const currentTime = buffer ? formatTime(progress * buffer.duration) : "0:00";
  const duration = buffer ? formatTime(buffer.duration) : "0:00";

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
            <FolderOpen className="h-6 w-6 text-white" />
          </button>
        </>
      )}

      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        onClick={handleCanvasInteraction}
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
        {currentTime === "0:00" ? "" : currentTime}
      </div>
      <div className="absolute bottom-2 right-2 text-sm text-white/80">
        {duration === "0:00" ? "" : duration}
      </div>
    </motion.div>
  );
}

export default memo(AudioWaveform);
