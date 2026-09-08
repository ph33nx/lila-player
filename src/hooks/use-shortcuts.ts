"use client";

import { useEffect, useRef } from "react";

/** Keys typed into these belong to the element, not to the window. */
const INTERACTIVE =
  'button, input, textarea, [role="slider"], [contenteditable]';

export interface ShortcutActions {
  togglePlay: () => void;
  seekBy: (seconds: number) => void;
  toggleLoop: () => void;
  setLoopStart: () => void;
  setLoopEnd: () => void;
  open: () => void;
  exportWav: () => void;
}

const SEEK_STEP = 5;

/** Window-level transport keys. Focused controls keep their own key handling. */
export const useShortcuts = (actions: ShortcutActions): void => {
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof Element && target.closest(INTERACTIVE)) return;
      if (event.altKey) return;

      const act = latest.current;

      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === "o") {
          event.preventDefault();
          act.open();
        } else if (key === "e") {
          event.preventDefault();
          act.exportWav();
        }
        return;
      }

      switch (event.key) {
        case " ":
          event.preventDefault();
          act.togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          act.seekBy(-SEEK_STEP);
          break;
        case "ArrowRight":
          event.preventDefault();
          act.seekBy(SEEK_STEP);
          break;
        case "l":
        case "L":
          act.toggleLoop();
          break;
        case "[":
          act.setLoopStart();
          break;
        case "]":
          act.setLoopEnd();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
