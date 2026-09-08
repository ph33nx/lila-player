"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import type { LoopRegion, Subscribe, TrackInfo } from "@/engine";
import { AUDIO_FORMATS } from "@/utils/audio-file";
import { readCssToken } from "@/utils/css-token";
import { formatTime } from "@/utils/time";

/** Column pitch and bar width in CSS pixels; the bitmap is scaled by devicePixelRatio. */
const PITCH = 3;
const BAR = 2;
const MIN_BAR = 2;

const MARKER =
  "pointer-events-none absolute top-0 rounded-sm bg-primary px-1 font-mono text-[10px] font-semibold leading-4 text-primary-foreground";

interface Palette {
  idle: string;
  played: string;
  band: string;
  glow: string;
}

/** One source of truth for colour: the same tokens the DOM uses. */
const readPalette = (): Palette => {
  const wave = readCssToken("--wave", "258 10% 43%");
  const primary = readCssToken("--primary", "264 92% 78%");
  return {
    idle: `hsl(${wave})`,
    played: `hsl(${primary})`,
    band: `hsl(${primary} / 0.1)`,
    glow: `hsl(${primary} / 0.25)`,
  };
};

const ratioAt = (clientX: number, rect: DOMRect): number =>
  Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);

interface AudioWaveformProps {
  track: TrackInfo | null;
  loopRegion: LoopRegion;
  isLoading: boolean;
  isPlaying: boolean;
  onOpen: () => void;
  onSeek: (seconds: number) => void;
  /** The hook has no split play/pause; toggling is exact because scrubbing only
   *  ever pauses a playing track and resumes the one it paused. */
  onTogglePlay: () => void;
  getPeaks: (columns: number) => Promise<Float32Array>;
  subscribe: Subscribe;
  getPosition: () => number;
}

const AudioWaveform: React.FC<AudioWaveformProps> = memo(
  ({
    track,
    loopRegion,
    isLoading,
    isPlaying,
    onOpen,
    onSeek,
    onTogglePlay,
    getPeaks,
    subscribe,
    getPosition,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const positionRef = useRef(0);
    const paletteRef = useRef<Palette | null>(null);
    const scrubRef = useRef<{ resume: boolean } | null>(null);

    const [size, setSize] = useState({ width: 0, height: 0 });
    const [peaks, setPeaks] = useState<Float32Array | null>(null);
    const [hover, setHover] = useState<{ x: number; time: number } | null>(
      null,
    );

    const duration = track?.duration ?? 0;
    const columns = Math.max(1, Math.floor(size.width / PITCH));

    // Bitmap follows the element and the display, so bars stay crisp at any dpr.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        setSize((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
      });
      observer.observe(canvas);
      return () => observer.disconnect();
    }, [track]);

    useEffect(() => {
      if (!track || size.width === 0) {
        setPeaks(null);
        return;
      }
      let live = true;
      void getPeaks(columns).then((data) => {
        if (live) setPeaks(data);
      });
      return () => {
        live = false;
      };
    }, [getPeaks, track, columns, size.width]);

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      const { width, height } = size;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const bitmapWidth = Math.round(width * dpr);
      const bitmapHeight = Math.round(height * dpr);
      if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
      if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;

      paletteRef.current ??= readPalette();
      const palette = paletteRef.current;

      // Draw in CSS pixels; the transform maps them onto device pixels.
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const middle = height / 2;
      const played =
        duration > 0 ? (positionRef.current / duration) * width : 0;

      if (loopRegion.custom && duration > 0) {
        const from = (loopRegion.start / duration) * width;
        const to = (loopRegion.end / duration) * width;
        context.fillStyle = palette.band;
        context.fillRect(from, 0, to - from, height);
      }

      if (peaks && peaks.length > 0) {
        const count = Math.min(columns, peaks.length / 2);
        for (let i = 0; i < count; i++) {
          const x = i * PITCH;
          if (x > width) break;
          const top = middle - Math.max(0, peaks[i * 2]) * middle;
          const bottom = middle - Math.min(0, peaks[i * 2 + 1]) * middle;
          const barHeight = Math.max(bottom - top, MIN_BAR);
          context.fillStyle = x + BAR <= played ? palette.played : palette.idle;
          context.fillRect(
            x,
            Math.min(top, middle - MIN_BAR / 2),
            BAR,
            barHeight,
          );
        }
      }

      if (duration > 0) {
        context.fillStyle = palette.glow;
        context.fillRect(played - 3, 0, 6, height);
        context.fillStyle = palette.played;
        context.fillRect(played - 1, 0, 2, height);
      }
    }, [size, duration, loopRegion, peaks, columns]);

    useEffect(() => {
      positionRef.current = getPosition();
      draw();
    }, [draw, getPosition]);

    // The tokens change with the theme class on <html>; drop the cached palette.
    useEffect(() => {
      const observer = new MutationObserver(() => {
        paletteRef.current = null;
        draw();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    }, [draw]);

    useEffect(
      () =>
        subscribe((event) => {
          if (event.type !== "tick") return;
          positionRef.current = event.position;
          draw();
        }),
      [subscribe, draw],
    );

    const seekToPointer = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(ratioAt(event.clientX, rect) * duration);
      },
      [duration, onSeek],
    );

    const onPointerDown = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (duration <= 0 || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrubRef.current = { resume: isPlaying };
        if (isPlaying) onTogglePlay();
        seekToPointer(event);
      },
      [duration, isPlaying, onTogglePlay, seekToPointer],
    );

    const onPointerMove = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (duration <= 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = ratioAt(event.clientX, rect);
        setHover({ x: ratio * rect.width, time: ratio * duration });
        if (scrubRef.current) onSeek(ratio * duration);
      },
      [duration, onSeek],
    );

    const clearHover = useCallback(() => setHover(null), []);

    useEffect(() => {
      scrubRef.current = null;
      setHover(null);
    }, [track]);

    const onPointerUp = useCallback(
      (event: React.PointerEvent<HTMLCanvasElement>) => {
        const scrub = scrubRef.current;
        if (!scrub) return;
        scrubRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        seekToPointer(event);
        if (scrub.resume) onTogglePlay();
      },
      [onTogglePlay, seekToPointer],
    );

    return (
      <div className="relative h-[clamp(120px,26vh,320px)] w-full overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="absolute inset-x-12 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/5 animate-scan rounded-full bg-primary" />
          </div>
        ) : track ? (
          <div className="absolute inset-3">
            <canvas
              ref={canvasRef}
              data-testid="waveform"
              className="block h-full w-full cursor-pointer touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={clearHover}
            />
            {loopRegion.custom && duration > 0 && (
              <>
                <span
                  className={MARKER}
                  style={{ left: `${(loopRegion.start / duration) * 100}%` }}
                >
                  A
                </span>
                <span
                  className={MARKER}
                  style={{
                    right: `${100 - (loopRegion.end / duration) * 100}%`,
                  }}
                >
                  B
                </span>
              </>
            )}
            {hover && (
              <span
                className="pointer-events-none absolute bottom-0 -translate-x-1/2 rounded-sm bg-secondary px-1.5 font-mono text-[10px] leading-4 tabular-nums text-foreground"
                style={{ left: hover.x }}
              >
                {formatTime(hover.time)}
              </span>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <Button variant="primary" onClick={onOpen}>
              Open audio
            </Button>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                or drop a file here
              </p>
              <p className="text-[11px] text-muted-foreground/90">
                {AUDIO_FORMATS}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);

AudioWaveform.displayName = "AudioWaveform";

export default AudioWaveform;
