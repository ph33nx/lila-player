# Architecture

## The engine/UI boundary

Audio state lives in `src/engine`, a plain TypeScript module with no React import.
The UI observes it through two channels:

- **Snapshot** — `getSnapshot()` returns a frozen `EngineSnapshot` (state, params,
  track, error, exporting). The _same object reference_ comes back until one of those
  facts changes, which is what `useSyncExternalStore` requires: a `getSnapshot` that
  allocates on every call makes React re-render forever.
- **Tick events** — `subscribe()` delivers `{ type: "tick", position }` every
  animation frame while playing. Ticks never touch React state; the waveform canvas
  redraws from the event, and the time label only calls `setState` when the formatted
  `m:ss` string actually changes (once a second, not sixty times).

`usePlayer()` (`src/hooks/use-player.ts`) is the only glue. It creates one engine per
mount, disposes it on unmount, subscribes React to `state` events only, and returns
the snapshot plus command callbacks whose identity never changes — so
`memo(PlayerControls)` actually holds.

Why this split: the engine owns mutable audio hardware (an `AudioContext`, one source
node, a playhead) whose lifetime has nothing to do with the render cycle. Encoding it
in hooks produced stale closures over `progress`, `isPlaying` and `isLooping`; see
`docs/audio-engine.md` for the defects that cost.

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
  theme-toggle.tsx     light or dark, shows the scheme in effect, bottom right
  web-faq.tsx          the README FAQ and its FAQPage JSON-LD, web build only
  level-mark.tsx       the lilac mark, breathing with getLevel() while playing
  motion-provider.tsx  MotionConfig reducedMotion="user"
  ui/                  shadcn/ui primitives

src/utils/
  audio-file.ts        isAudioFile, ACCEPT, AUDIO_FORMATS - one list, three consumers
  time.ts              formatTime
  download.ts          downloadBlob
  css-token.ts         readCssToken, so canvases paint with the DOM's tokens

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
- **Theme.** Colour tokens live on `:root` (light) and `.dark` in `globals.css`;
  `next-themes` toggles the class, defaults to the device scheme, and persists an
  explicit choice under the localStorage key `theme`, which is the app's only
  persisted setting today. The waveform canvas caches the tokens it reads and drops
  that cache when the `<html>` class changes, so it repaints in the new palette.
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

Everything pure (`position.ts`, `peaks.ts`, `wav.ts`, `graph.ts`) is testable without
a DOM; `WebAudioEngine` is testable through the `AudioEngine` interface alone.

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

When the first genuinely OS-specific feature lands (recent files, a real save dialog,
a tray control), it gets a `src/platform/` interface with a browser implementation and
a Tauri implementation, chosen once at startup. Nothing above `src/platform/` learns
which one it got. The interface is created with that first feature, not before.

Plan B, if Web Audio in WebKitGTK proves unusable on Linux: a `TauriEngine` that
implements the same `AudioEngine` interface against a Rust audio backend, swapped in
`usePlayer()` and nowhere else. That is the payoff of the interface being an
interface. See `docs/decisions.md`.
