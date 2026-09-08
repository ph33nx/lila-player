import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 resolves the `@/*` alias from tsconfig.json itself; `react()`
  // compiles the JSX in `*.test.tsx`.
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    // Unit tests live beside the code they test. `tests/e2e` is Playwright's and
    // must never be collected: those specs import `@playwright/test`.
    include: ["src/**/*.test.{ts,tsx}"],
    // Node by default, so the pure modules stay honest about touching no DOM.
    // DOM-bound files opt in with a `// @vitest-environment jsdom` docblock;
    // `environmentMatchGlobs` is not a Vitest 5 option.
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});
