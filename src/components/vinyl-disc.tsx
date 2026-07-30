"use client";

import { useCallback, useRef, memo } from "react";
import { motion } from "framer-motion";
import { Music2, FolderOpen } from "lucide-react";

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface VinylDiscProps {
  buffer: AudioBuffer | null;
  progress: number;
  isPlaying: boolean;
  isLoading?: boolean;
  filename: string | null;
  onProgressClick: (progress: number) => void;
  onOpenFilePicker: () => void;
}

function VinylDisc({
  buffer,
  progress,
  isPlaying,
  isLoading = false,
  filename,
  onProgressClick,
  onOpenFilePicker,
}: VinylDiscProps) {
  const ringRef = useRef<SVGSVGElement>(null);

  const handleRingClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = ringRef.current;
      if (!svg || !buffer) return;

      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;

      onProgressClick(angle / (2 * Math.PI));
    },
    [buffer, onProgressClick],
  );

  const currentTime = buffer ? formatTime(progress * buffer.duration) : "0:00";
  const duration = buffer ? formatTime(buffer.duration) : "0:00";

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <motion.div
      className="flex flex-col items-center gap-3 shrink-0"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative w-56 h-56 md:w-64 md:h-64">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full z-20">
            <div className="w-8 h-8 border-4 border-t-white border-white/20 rounded-full animate-spin" />
          </div>
        )}

        {!buffer && !isLoading ? (
          <button
            onClick={onOpenFilePicker}
            className="w-full h-full rounded-full border border-dashed border-white/20 bg-white/[0.03] flex flex-col items-center justify-center gap-2 text-white/50 hover:text-white/80 hover:border-white/40 transition-colors cursor-pointer"
          >
            <Music2 className="h-8 w-8" />
            <span className="text-xs">Select audio</span>
          </button>
        ) : (
          <>
            {/* progress ring */}
            <svg
              ref={ringRef}
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full -rotate-90 cursor-pointer z-10"
              onClick={handleRingClick}
            >
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="2"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 0.15s linear" }}
              />
            </svg>

            {/* spinning record */}
            <div
              className="absolute inset-[6px] rounded-full overflow-hidden shadow-2xl"
              style={{
                background:
                  "repeating-radial-gradient(circle at center, #1a1a1a 0px, #1a1a1a 2px, #0a0a0a 3px, #0a0a0a 4px)",
                animation: "vinyl-spin 3.2s linear infinite",
                animationPlayState: isPlaying ? "running" : "paused",
              }}
            >
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.15),transparent_45%)]" />

              {/* label / cover art */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[38%] h-[38%] rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden">
                  <Music2 className="h-6 w-6 text-white/60" />
                </div>
              </div>

              {/* center spindle hole */}
              <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black border border-white/30" />
            </div>

            <button
              onClick={onOpenFilePicker}
              title="Change file"
              className="absolute -bottom-1 -right-1 z-20 h-8 w-8 rounded-full bg-black/80 border border-white/15 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
            >
              <FolderOpen className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {buffer && (
        <div className="flex flex-col items-center gap-0.5 max-w-56 md:max-w-64">
          <span className="text-sm text-white/90 truncate max-w-full">
            {filename}
          </span>
          <span className="text-xs text-white/40 font-mono">
            {currentTime} / {duration}
          </span>
        </div>
      )}

      <style jsx>{`
        @keyframes vinyl-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </motion.div>
  );
}

export default memo(VinylDisc);
