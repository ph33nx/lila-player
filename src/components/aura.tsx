"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { useThemeChange } from "@/hooks/use-theme-change";
import { readCssToken } from "@/utils/css-token";

/**
 * Four overlapping colour fields; positions, radii and wander are fractions of the
 * viewport, and each axis wanders on its own period so the motion never loops.
 */
const FIELDS = [
  {
    token: "--aura-1",
    x: 0.2,
    y: 0.15,
    radius: 0.9,
    wander: 0.14,
    px: 19,
    py: 27,
  },
  {
    token: "--aura-2",
    x: 0.85,
    y: 0.3,
    radius: 0.8,
    wander: 0.16,
    px: 23,
    py: 31,
  },
  {
    token: "--aura-3",
    x: 0.5,
    y: 1.0,
    radius: 0.85,
    wander: 0.12,
    px: 29,
    py: 37,
  },
  {
    token: "--aura-1",
    x: 0.8,
    y: 0.9,
    radius: 0.7,
    wander: 0.15,
    px: 41,
    py: 17,
  },
] as const;

/** The backing store is this fraction of the viewport; the upscale is the blur. */
const SCALE = 0.125;
/** Painting every other frame halves the fill cost with no visible loss. */
const FRAME_SKIP = 2;
/** A slow base breath under the music, in seconds per cycle. */
const BREATH_SECONDS = 8;
/** How far the fields grow from rest to a loud passage. */
const SWELL = 0.22;
/**
 * The painted swell may move at most this much per painted frame (30 a second),
 * so a full swing takes over two seconds and nothing can flash. WCAG 2.3.1.
 */
const MAX_STEP = 0.015;

interface Field {
  colour: string;
  x: number;
  y: number;
  radius: number;
  wander: number;
  px: number;
  py: number;
}

/** `hsl(h s% l% / a)` tokens into the `hsla()` form every canvas accepts. */
const toColour = (token: string, alphaScale = 1): string => {
  const [hsl, alpha = "1"] = token.split("/").map((part) => part.trim());
  const [h, s, l] = hsl.split(/\s+/);
  return `hsla(${h}, ${s}, ${l}, ${Number(alpha) * alphaScale})`;
};

const readFields = (): Field[] =>
  FIELDS.map(({ token, ...field }) => ({
    ...field,
    colour: readCssToken(token, "264 80% 62% / 0.3"),
  }));

const isDark = (): boolean =>
  document.documentElement.classList.contains("dark");

interface AuraProps {
  isPlaying: boolean;
  getLevel: () => number;
}

/**
 * The background that breathes with the music: four overlapping radial fields on
 * an eighth-resolution canvas. Their size and brightness follow the output level
 * through the same envelope shape as the mark by the title, over a slow base
 * breath, and each field wanders on its own periods. Canvas paints cost no layout
 * or style, which is why this is not a CSS or Web Animations effect.
 */
const Aura: React.FC<AuraProps> = memo(({ isPlaying, getLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldsRef = useRef<Field[] | null>(null);
  const reduceMotion = useReducedMotion();

  const paint = useCallback((swell: number, seconds: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = Math.max(1, Math.round(window.innerWidth * SCALE));
    const height = Math.max(1, Math.round(window.innerHeight * SCALE));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    fieldsRef.current ??= readFields();

    const longest = Math.max(width, height);
    context.clearRect(0, 0, width, height);
    // Screen blending lets overlaps glow on a dark ground without blowing out.
    context.globalCompositeOperation = isDark() ? "screen" : "source-over";
    context.globalAlpha = 0.75 + 0.15 * swell;
    for (const field of fieldsRef.current) {
      const x =
        (field.x +
          Math.sin((seconds / field.px) * Math.PI * 2) * field.wander) *
        width;
      const y =
        (field.y +
          Math.cos((seconds / field.py) * Math.PI * 2) * field.wander) *
        height;
      const radius = field.radius * longest * (1 + SWELL * swell);
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, toColour(field.colour));
      gradient.addColorStop(0.35, toColour(field.colour, 0.6));
      gradient.addColorStop(0.7, toColour(field.colour, 0.18));
      gradient.addColorStop(1, toColour(field.colour, 0));
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }, []);

  useThemeChange(
    useCallback(() => {
      fieldsRef.current = null;
      paint(0, 0);
    }, [paint]),
  );

  useEffect(() => {
    paint(0, 0);
    if (!isPlaying || reduceMotion) return;

    let frame = 0;
    let count = 0;
    let envelope = 0;
    let shown = 0;
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      if (++count % FRAME_SKIP) return;
      // A slow envelope of the level, then a hard cap on how fast the paint may move.
      const target = getLevel();
      envelope += (target - envelope) * (target > envelope ? 0.08 : 0.04);
      const seconds = now / 1000;
      const base =
        0.5 - 0.5 * Math.cos((seconds / BREATH_SECONDS) * Math.PI * 2);
      const wanted = 0.35 * base + 0.65 * envelope;
      shown += Math.max(-MAX_STEP, Math.min(MAX_STEP, wanted - shown));
      paint(shown, seconds);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      paint(0, 0);
    };
  }, [isPlaying, reduceMotion, getLevel, paint]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="aura"
      data-active={isPlaying && !reduceMotion}
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
});

Aura.displayName = "Aura";

export default Aura;
