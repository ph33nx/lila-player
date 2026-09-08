"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Follows the device scheme until the user picks one; the pick persists in localStorage. */
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
  >
    {children}
  </NextThemesProvider>
);

export default ThemeProvider;
