"use client";

import { memo, useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { readCssToken } from "@/utils/css-token";

const SIZE = 20;
const REST = 3;
const SWELL = 4;

interface LevelMarkProps {
  isPlaying: boolean;
  getLevel: () => number;
}

/**
 * The app's mark: a lilac dot that breathes with the output level while a track
 * plays and rests otherwise. Painted on a canvas per frame, so it costs no layout.
 */
const LevelMark: React.FC<LevelMarkProps> = memo(({ isPlaying, getLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const centre = SIZE / 2;

    const paint = (level: number): void => {
      const primary = readCssToken("--primary", "264 92% 78%");
      context.clearRect(0, 0, SIZE, SIZE);
      context.fillStyle = `hsl(${primary} / ${0.35 * level})`;
      context.beginPath();
      context.arc(centre, centre, REST + SWELL * 2.4 * level, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = `hsl(${primary})`;
      context.beginPath();
      context.arc(centre, centre, REST + SWELL * level, 0, Math.PI * 2);
      context.fill();
    };

    if (!isPlaying || reduceMotion) {
      paint(0);
      return;
    }

    let frame = 0;
    let level = 0;
    const tick = (): void => {
      // Fast attack, slow release: pops read, silence settles.
      const target = Math.min(1, getLevel());
      level += (target - level) * (target > level ? 0.5 : 0.08);
      paint(level);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      paint(0);
    };
  }, [isPlaying, reduceMotion, getLevel]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="shrink-0"
      style={{ width: SIZE, height: SIZE }}
    />
  );
});

LevelMark.displayName = "LevelMark";

export default LevelMark;
