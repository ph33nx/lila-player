import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
/** The port `serve` binds and every spec navigates to. */
const port = 3123;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // The specs drive one audio device and assert on real elapsed time; running
  // them in parallel makes playback assertions flake for reasons that have
  // nothing to do with the app. `fullyParallel: false` only serialises within a
  // file, so the worker count has to be pinned too.
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  // A readable stream locally; a browsable artefact on CI, never auto-opened.
  reporter: isCI ? [["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The engine builds its AudioContext during load(), which can precede a
        // click; without this Chromium keeps the context suspended and nothing
        // ever plays. Headless Chromium mutes the output device anyway, so the
        // graph still runs and the position still advances.
        launchOptions: {
          args: ["--autoplay-policy=no-user-gesture-required"],
        },
      },
    },
    {
      name: "webkit",
      // The closest available stand-in for the WebKitGTK webview Tauri uses on
      // Linux. Non-blocking in CI: see docs/release.md.
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    // The static export, served at `/` with PAGES_BASE_PATH unset — the same
    // shape the Tauri webview loads. Run `npm run build` first.
    command: `npx serve out -l ${port}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
