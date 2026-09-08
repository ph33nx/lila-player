"use client";

import { memo } from "react";
import { motion, type TargetAndTransition } from "motion/react";
import { cn } from "@/lib/utils";
import type { FileDropState } from "@/hooks/use-file-drop";

const READY: TargetAndTransition = {
  scale: [1, 1.012, 1],
  transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
};
const STILL: TargetAndTransition = { scale: 1 };
const HIDDEN: TargetAndTransition = { scale: 0.98 };

/**
 * Full-window drop affordance. Mounted always so the state is observable;
 * `MotionConfig reducedMotion="user"` drops the scale and leaves the fade.
 */
const DropOverlay: React.FC<FileDropState> = memo(
  ({ isDragging, isRejected }) => (
    <motion.div
      data-testid="drop-overlay"
      data-active={isDragging || isRejected}
      data-state={isRejected ? "rejected" : "ready"}
      aria-hidden
      initial={false}
      animate={{ opacity: isDragging || isRejected ? 1 : 0 }}
      transition={{ duration: 0.16 }}
      className={cn(
        "pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/85 p-6",
        !isDragging && !isRejected && "invisible",
      )}
    >
      <motion.div
        initial={false}
        animate={isRejected ? STILL : isDragging ? READY : HIDDEN}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className={cn(
          "grid h-full w-full place-items-center rounded-lg border-2 border-dashed text-sm font-medium",
          isRejected
            ? "border-destructive text-destructive"
            : "border-primary text-primary",
        )}
      >
        {isRejected ? "Audio files only" : "Drop to open"}
      </motion.div>
    </motion.div>
  ),
);

DropOverlay.displayName = "DropOverlay";

export default DropOverlay;
