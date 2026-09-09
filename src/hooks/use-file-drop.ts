"use client";

import { useEffect, useRef, useState } from "react";
import { isAudioFile } from "@/utils/audio-file";

/** How long a refused drop keeps the overlay up before it fades out. */
const REJECT_MS = 2000;

export interface FileDropState {
  isDragging: boolean;
  isRejected: boolean;
}

/**
 * `types` lists "Files" in every engine while a drag is in flight; `items` is
 * empty in WebKit until the drop, so it is only a second opinion.
 */
const carriesFiles = (event: DragEvent): boolean => {
  const transfer = event.dataTransfer;
  if (!transfer) return false;
  return (
    Array.from(transfer.types).includes("Files") ||
    Array.from(transfer.items ?? []).some((item) => item.kind === "file")
  );
};

/**
 * Window-wide audio drop target. Listens on `window` so the whole player is a
 * target, counts enter/leave depth so crossing a child element does not flicker
 * the overlay, and cancels every drop so the webview can never navigate to a file.
 */
export const useFileDrop = (onFile: (file: File) => void): FileDropState => {
  const [state, setState] = useState<FileDropState>({
    isDragging: false,
    isRejected: false,
  });
  const latest = useRef(onFile);
  useEffect(() => {
    latest.current = onFile;
  });

  useEffect(() => {
    let depth = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onEnter = (event: DragEvent): void => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      // A rejection still counting down must not clear the overlay we just raised.
      clearTimeout(timer);
      depth += 1;
      setState({ isDragging: true, isRejected: false });
    };

    // Cancelling dragover is what lets `drop` fire at all; an uncancelled drop
    // makes the page navigate to the file, which is the browser default.
    const onOver = (event: DragEvent): void => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = carriesFiles(event) ? "copy" : "none";
      }
    };

    const onLeave = (): void => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setState({ isDragging: false, isRejected: false });
    };

    const onDrop = (event: DragEvent): void => {
      event.preventDefault();
      if (!carriesFiles(event)) return;
      clearTimeout(timer);
      depth = 0;
      const file = Array.from(event.dataTransfer?.files ?? []).find(
        isAudioFile,
      );
      if (file) {
        setState({ isDragging: false, isRejected: false });
        latest.current(file);
        return;
      }
      setState({ isDragging: true, isRejected: true });
      timer = setTimeout(
        () => setState({ isDragging: false, isRejected: false }),
        REJECT_MS,
      );
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return state;
};
