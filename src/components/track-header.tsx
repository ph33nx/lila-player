"use client";

import { memo, useEffect, useState } from "react";
import LevelMark from "./level-mark";
import { Button } from "./ui/button";
import type { Subscribe } from "@/engine";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/time";

interface CurrentTimeProps {
  subscribe: Subscribe;
}

/** Owns its own state so a per-frame tick never re-renders the page. */
const CurrentTime: React.FC<CurrentTimeProps> = ({ subscribe }) => {
  const [label, setLabel] = useState("0:00");

  useEffect(
    () =>
      subscribe((event) => {
        if (event.type !== "tick") return;
        const next = formatTime(event.position);
        setLabel((previous) => (previous === next ? previous : next));
      }),
    [subscribe],
  );

  return <span data-testid="current-time">{label}</span>;
};

interface TrackHeaderProps {
  name: string | null;
  duration: number;
  isPlaying: boolean;
  onOpen: () => void;
  subscribe: Subscribe;
  getLevel: () => number;
}

const TrackHeader: React.FC<TrackHeaderProps> = memo(
  ({ name, duration, isPlaying, onOpen, subscribe, getLevel }) => (
    <header className="flex h-8 items-center gap-3">
      {name && <LevelMark isPlaying={isPlaying} getLevel={getLevel} />}
      <h1
        data-testid="track-title"
        title={name ?? undefined}
        className={cn(
          "min-w-0 flex-1 truncate text-[15px] font-medium tracking-tight",
          name ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {name ?? "No track open"}
      </h1>

      {name && (
        <div className="flex shrink-0 items-center gap-3">
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            <CurrentTime subscribe={subscribe} />
            <span className="px-1 opacity-40">/</span>
            <span data-testid="duration">{formatTime(duration)}</span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open audio"
            onClick={onOpen}
          >
            Open
          </Button>
        </div>
      )}
    </header>
  ),
);

TrackHeader.displayName = "TrackHeader";

export default TrackHeader;
