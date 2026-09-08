"use client";

import { memo } from "react";
import { Slider } from "./ui/slider";
import { DEFAULT_PARAMS, type Params } from "@/engine";

type NumericParam =
  | "volume"
  | "playbackRate"
  | "reverbLevel"
  | "vinylVolume"
  | "bass"
  | "warmth"
  | "drive"
  | "wobble";

interface ParamSpec {
  key: NumericParam;
  label: string;
  /** Accessible name for the thumb, when it needs more words than the label. */
  thumbLabel: string;
  testId: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}

const percent = (value: number): string => `${Math.round(value)}%`;

/** The four sliders on the main surface. */
export const MAIN_PARAMS: readonly ParamSpec[] = [
  {
    key: "volume",
    label: "Volume",
    thumbLabel: "Volume",
    testId: "value-volume",
    min: 0,
    max: 110,
    step: 1,
    format: percent,
  },
  {
    key: "playbackRate",
    label: "Speed",
    thumbLabel: "Speed",
    testId: "value-speed",
    min: 0.65,
    max: 1.35,
    step: 0.05,
    format: (value) => `${value.toFixed(2)}x`,
  },
  {
    key: "reverbLevel",
    label: "Reverb",
    thumbLabel: "Reverb",
    testId: "value-reverb",
    min: 0,
    max: 100,
    step: 1,
    format: percent,
  },
  {
    key: "vinylVolume",
    label: "Vinyl",
    thumbLabel: "Vinyl crackle",
    testId: "value-vinyl",
    min: 0,
    max: 100,
    step: 1,
    format: percent,
  },
];

const tone = (key: NumericParam, label: string): ParamSpec => ({
  key,
  label,
  thumbLabel: label,
  testId: `value-${key}`,
  min: 0,
  max: 100,
  step: 1,
  format: percent,
});

/** The tape-colour sliders under Advanced. */
export const TONE_PARAMS: readonly ParamSpec[] = [
  tone("bass", "Bass"),
  tone("warmth", "Warmth"),
  tone("drive", "Drive"),
  tone("wobble", "Wobble"),
];

const patchOf = (key: NumericParam, value: number): Partial<Params> => {
  const patch: Partial<Params> = {};
  patch[key] = value;
  return patch;
};

interface ParamGridProps {
  specs: readonly ParamSpec[];
  params: Params;
  onChange: (patch: Partial<Params>) => void;
}

const ParamGrid: React.FC<ParamGridProps> = memo(
  ({ specs, params, onChange }) => (
    <div className="grid grid-cols-2 gap-x-8 gap-y-2 tall:gap-y-4">
      {specs.map(
        ({ key, label, thumbLabel, testId, min, max, step, format }) => (
          <div key={key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span
                data-testid={testId}
                className="font-mono text-xs tabular-nums text-foreground"
              >
                {format(params[key])}
              </span>
            </div>
            <Slider
              thumbLabel={thumbLabel}
              value={[params[key]]}
              min={min}
              max={max}
              step={step}
              onValueChange={([value]) => onChange(patchOf(key, value))}
              onDoubleClick={() => onChange(patchOf(key, DEFAULT_PARAMS[key]))}
            />
          </div>
        ),
      )}
    </div>
  ),
);

ParamGrid.displayName = "ParamGrid";

export default ParamGrid;
