# Architecture

## The engine/UI boundary

Audio state lives in `src/engine`, plain TypeScript with no React; the UI observes it two ways:

- **Snapshot** — `getSnapshot()` returns a frozen `EngineSnapshot` (state, params,
  track, error, exporting). The _same object reference_ comes back until one of those
  facts changes, which is what `useSyncExternalStore` requires: a `getSnapshot` that
  allocates on every call makes React re-render forever.
- **Tick events** — `subscribe()` delivers `{ type: "tick", position }` every
  animation frame while playing. Ticks never touch React state; the waveform canvas
  redraws from the event, and the time label only calls `setState` when the formatted
  `m:ss` string actually changes (once a second, not sixty times).

`usePlayer()` (`src/hooks/use-player.ts`) is the only glue: one engine per mount,
React subscribed to `state` events only, and stable command callbacks so `memo` holds.

Why this split: the engine owns mutable audio hardware whose lifetime has nothing to
do with the render cycle; encoding it in hooks produced stale closures (see
`docs/audio-engine.md`).

## File map

```
src/engine/
  types.ts             EngineState, Params, TrackInfo, EngineSnapshot, EngineEvent,
                       the AudioEngine interface, DEFAULT_PARAMS
  position.ts          pure: resolveLoopRegion, advancePosition, clamp
  graph.ts             buildGraph(ctx, params, ir) -> { input, output, setParams }
  wav.ts               audioBufferToWav (16-bit PCM RIFF)
  peaks.ts             pure computePeaks, waveform column count
  web-audio-engine.ts  WebAudioEngine: the state machine and every mutable field
  index.ts             public barrel

src/hooks/
  use-player.ts        engine <-> React binding, and the one file gate (isAudioFile)
  use-media-session.ts OS media keys
  use-theme-change.ts  observes the theme class so canvases refresh their tokens
  use-shortcuts.ts     window-level transport keys
  use-file-drop.ts     window-wide drop target, returns { isDragging, isRejected }
  use-desktop-shell.ts Tauri-only chrome: context menu, macOS drag strip

src/components/
  audio-waveform.tsx   canvas, peaks in, seek and scrub out, ticks to the 2D context
  track-header.tsx     title, m:ss readouts, Open
  transport.tsx        play/pause, loop, export, export status
  param-grid.tsx       the slider grid; MAIN_PARAMS and TONE_PARAMS are its two spec lists
  advanced-panel.tsx   the Advanced disclosure and its SettingsGroup / SettingsRow
  loop-section.tsx     the Loop section group: Start (A), End (B), Clear
  tone-section.tsx     the Tone group: Bass, Warmth, Drive, Wobble, via ParamGrid
  drop-overlay.tsx     full-window drop affordance (presentation only)
  status-line.tsx      the one message slot: error outranks the saved notice
  theme-provider.tsx   next-themes: class attribute, system default, persisted
  theme-toggle.tsx     light or dark, shows the scheme in effect
  corner-controls.tsx  bottom-right cluster: theme switch; on the web also source and download links
  web-faq.tsx          the README FAQ and its FAQPage JSON-LD, web build only
  level-mark.tsx       the lilac mark, breathing with getLevel() while playing
  aura.tsx             four overlapping colour fields on an eighth-res canvas, swelling with getLevel()
  motion-provider.tsx  MotionConfig reducedMotion="user"
  ui/                  shadcn/ui primitives

src/utils/
  audio-file.ts        isAudioFile, ACCEPT, AUDIO_FORMATS - one list, three consumers
  time.ts              formatTime
  download.ts          downloadBlob
  css-token.ts         readCssToken, so canvases paint with the DOM's tokens
  site.ts              SITE_URL, REPO_URL, RELEASES_URL and the IS_WEB build guard

src/app/               layout.tsx (metadata, providers), page.tsx (composition)
src/lib/utils.ts       cn(), the class-name merger shadcn primitives expect
src/types/global.d.ts  the webkitAudioContext shim
```

## The UI layer

Three rules keep the render cost flat while the audio runs:

- **Nothing above the canvas re-renders during playback.** The waveform and the
  `m:ss` readout each subscribe to `tick` themselves; the readout only calls
  `setState` when the formatted string changes. A measured 2 s playback run
  produces zero page renders.
- **Peaks follow the canvas, not a constant.** A `ResizeObserver` gives the
  bitmap `clientWidth * devicePixelRatio`, and the column count (one bar per 3
  CSS px) is what `engine.getPeaks(columns)` is asked for. The engine caches per
  column count, so a resize costs one pass and a repeat size costs nothing.
- **Theme.** Tokens live on `:root` (light) and `.dark` in `globals.css`; `next-themes`
  toggles the class, defaults to the device scheme, and persists a choice under the
  localStorage key `theme` (the only persisted setting). Canvases cache the tokens
  they read and drop the cache on `useThemeChange`, so they repaint in the new palette.
- **Per-frame work never touches React or styles.** The waveform and the level
  mark and the aura all paint on canvases. The aura paints four overlapping radial
  fields on an eighth-resolution canvas every other frame (the upscale is the blur;
  screen blending in dark mode). The swell follows a slow envelope of the level and
  may move at most 1.5 % per painted frame, so a full swing takes over two seconds
  and it cannot flash (WCAG 2.3.1). Web Animations were tried first and cost a
  style recalc per frame in headless Chromium, which the efficiency spec rejected;
  that spec pins the rule that layout and style counts stay flat in playback.
- **One fixed-height message slot.** Errors and the export notice share a single
  `h-4` line below the transport that is always mounted, so no message can move a
  control. `exportWav()` resolves with the file name it saved, so the notice needs
  no edge detection on the `exporting` flag.
- **Scrubbing pauses once, not per frame.** Pointer-down pauses and remembers
  whether it was playing; pointer-move seeks while paused, which only moves the
  playhead; pointer-up seeks and resumes. The source node is rebuilt twice for a
  whole drag.

Colour is declared once, in `globals.css`. The canvas reads the same `--wave` and
`--primary` custom properties through `getComputedStyle`, so there is no second
palette to drift.

The frontend still imports nothing from `@tauri-apps/*`. Desktop-only chrome is
gated on `window.isTauri`, the boolean Tauri 2 defines on the main frame, read in
an effect because the static export is prerendered without a window.
`app.windows[0].dragDropEnabled` is `false` so the webview delivers DOM `drop`
events with `dataTransfer.files` instead of Tauri's native drag-drop handler
swallowing them, and the macOS drag strip needs
`core:window:allow-start-dragging`, which `core:window:default` does not grant.

## Two targets, one build

`next.config.ts` sets `output: "export"`, so `npm run build` emits a static `out/`.

- **Tauri desktop** — `src-tauri/tauri.conf.json` points `frontendDist` at `../out`
  and `devUrl` at `http://localhost:3123`. The dev server port is hard-wired in three
  places that must agree: the `dev` script in `package.json` (`next dev --turbopack -p
3123`), `assetPrefix` in `next.config.ts`, and `devUrl`.
- **GitHub Pages** — the same export, built with `PAGES_BASE_PATH` set, which becomes
  Next's `basePath`. The app has no runtime asset loads (both sounds are generated in
  `src/engine/synth.ts`), so nothing needs the base path at runtime; if a runtime
  `fetch` against `public/` is ever added, it must be prefixed with the base path,
  re-exposed through `env` in `next.config.ts`.

## Why the app runs unchanged in a browser

The frontend imports nothing from `@tauri-apps/*`. Opening a file is a plain
`<input type="file">` — every webview, including WebKitGTK, shows the native OS
picker for it — and export is a Blob download. Tauri contributes the window, the
logger, and the installers; the JS bridge is not used, and the `fs`/`dialog` plugins
and their capability grants were removed because nothing called them.

## Where platform code will go

The first OS-specific feature (recent files, a save dialog, a tray control) creates a
`src/platform/` interface with browser and Tauri implementations chosen once at
startup; nothing above it learns which one it got. Plan B for Linux, if Web Audio in
WebKitGTK proves unusable: a `TauriEngine` behind the same `AudioEngine` interface,
swapped in `usePlayer()` only. See `docs/decisions.md`.
