"use client";

import { useEffect } from "react";

/** Runs `onChange` whenever the theme class on `<html>` flips, for canvases that cache tokens. */
export const useThemeChange = (onChange: () => void): void => {
  useEffect(() => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [onChange]);
};
