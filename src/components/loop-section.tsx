"use client";

import { memo } from "react";
import { SettingsGroup, SettingsRow } from "./advanced-panel";
import { Button } from "./ui/button";
import type { LoopRegion } from "@/engine";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/time";

interface LoopSectionProps {
  region: LoopRegion;
  hasTrack: boolean;
  onSetStart: () => void;
  onSetEnd: () => void;
  onClear: () => void;
}

const LoopSection: React.FC<LoopSectionProps> = memo(
  ({ region, hasTrack, onSetStart, onSetEnd, onClear }) => {
    const time = (seconds: number): React.ReactNode => (
      <span className={cn(!region.custom && "text-muted-foreground")}>
        {formatTime(seconds)}
      </span>
    );

    return (
      <SettingsGroup
        title="Loop section"
        description="Repeats only the part between the A and B markers. The intro before A plays once."
        action={
          <Button
            size="sm"
            variant="ghost"
            data-testid="clear-loop"
            aria-label="Clear loop section"
            disabled={!hasTrack || !region.custom}
            onClick={onClear}
          >
            Clear
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-x-10 gap-y-1">
          <SettingsRow
            label="Start (A)"
            value={<span data-testid="loop-start">{time(region.start)}</span>}
            control={
              <Button
                size="sm"
                data-testid="set-loop-start"
                aria-label="Set start (A) to the playhead"
                disabled={!hasTrack}
                onClick={onSetStart}
              >
                Set
              </Button>
            }
          />
          <SettingsRow
            label="End (B)"
            value={<span data-testid="loop-end">{time(region.end)}</span>}
            control={
              <Button
                size="sm"
                data-testid="set-loop-end"
                aria-label="Set end (B) to the playhead"
                disabled={!hasTrack}
                onClick={onSetEnd}
              >
                Set
              </Button>
            }
          />
        </div>
      </SettingsGroup>
    );
  },
);

LoopSection.displayName = "LoopSection";

export default LoopSection;
