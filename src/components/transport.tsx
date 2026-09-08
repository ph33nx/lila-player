"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, Pause, Play, Repeat } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const ICON_SPRING = { type: "spring", stiffness: 520, damping: 32 } as const;

interface TransportProps {
  hasTrack: boolean;
  isPlaying: boolean;
  loop: boolean;
  exporting: boolean;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onExport: () => void;
}

const Transport: React.FC<TransportProps> = memo(
  ({
    hasTrack,
    isPlaying,
    loop,
    exporting,
    onTogglePlay,
    onToggleLoop,
    onExport,
  }) => (
    // Equal side columns keep the play button centred whatever the labels say.
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={loop}
        disabled={!hasTrack}
        onClick={onToggleLoop}
        className={cn(
          "justify-self-end",
          loop &&
            "border-primary/50 bg-primary/15 text-primary hover:bg-primary/20",
        )}
      >
        <Repeat className="h-3.5 w-3.5" />
        Loop
      </Button>

      <button
        type="button"
        aria-label={isPlaying ? "Pause" : "Play"}
        disabled={!hasTrack}
        onClick={onTogglePlay}
        className="relative h-14 w-14 rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40"
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={isPlaying ? "pause" : "play"}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={ICON_SPRING}
            className="absolute inset-0 grid place-items-center"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6 fill-current" />
            ) : (
              <Play className="h-6 w-6 translate-x-px fill-current" />
            )}
          </motion.span>
        </AnimatePresence>
      </button>

      <Button
        variant="secondary"
        size="sm"
        aria-busy={exporting}
        disabled={!hasTrack || exporting}
        onClick={onExport}
        className="justify-self-start"
      >
        <Download className="h-3.5 w-3.5" />
        {exporting ? "Rendering" : "Export"}
      </Button>
    </div>
  ),
);

Transport.displayName = "Transport";

export default Transport;
