"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    /** Injected by the Tauri webview; absent in every browser. */
    isTauri?: boolean;
  }
}

const isMac = (): boolean =>
  /mac/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent);

/**
 * Adapts the page to the Tauri window: suppresses the webview context menu, and
 * reports whether a drag strip must clear the macOS traffic lights. Runs in an
 * effect because the static export is prerendered without a window.
 */
export const useDesktopShell = (): { titleBarStrip: boolean } => {
  const [titleBarStrip, setTitleBarStrip] = useState(false);

  useEffect(() => {
    if (window.isTauri !== true) return;

    setTitleBarStrip(isMac());
    const suppress = (event: MouseEvent): void => event.preventDefault();
    document.addEventListener("contextmenu", suppress);
    return () => document.removeEventListener("contextmenu", suppress);
  }, []);

  return { titleBarStrip };
};
