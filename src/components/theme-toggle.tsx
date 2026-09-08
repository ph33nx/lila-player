"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";

/**
 * Light or dark. Shows the scheme in effect (the device's until the user picks
 * one) and switches to the other; renders after mount so the stored choice is known.
 */
const ThemeToggle: React.FC = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const dark = resolvedTheme === "dark";
  const Icon = dark ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      data-testid="theme-toggle"
      data-resolved={dark ? "dark" : "light"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="fixed bottom-3 right-3 z-40 h-8 w-8"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
};

export default ThemeToggle;
