# Testing

Two suites. Vitest covers the engine, the hooks and the utils; Playwright drives
the built static export in a real browser.

## Running

| Command                                | What it does                                 |
| -------------------------------------- | -------------------------------------------- |
| `npm run verify`                       | The gate: typecheck, lint, unit tests, build |
| `npm run test:unit`                    | The whole Vitest suite, once                 |
| `npm run test:unit:watch`              | The same, re-running on change               |
| `npm run test:e2e`                     | Playwright against `out/` — build first      |
| `npx playwright test --project=webkit` | Only the WebKit project                      |
| `npx playwright test --ui`             | The Playwright UI, for writing and debugging |

`npm run verify` is the one command to run before pushing. `test:e2e` only
serves `out/`, so a stale export tests the wrong thing; `verify` builds it.

## Where tests live

Unit tests sit **beside the code they test**, named `<module>.test.ts`; the
Vitest config collects `src/**/*.test.{ts,tsx}` and nothing else. That includes
`web-faq.test.ts`, which parses the `## FAQ` section out of README.md and asserts
it equals the component's `faq` array, so one wording cannot drift into two. E2E
specs live in `tests/e2e/`, which Vitest must never collect: they import
`@playwright/test`.

The default environment is `node`, so the pure modules (`position`, `peaks`,
`wav`, `graph`) stay honest about touching no DOM. A file that needs jsdom opts
in with a `// @vitest-environment jsdom` docblock; Vitest 5 has no
`environmentMatchGlobs`. `src/test/setup.ts` runs in both, so it guards DOM stubs.

## The e2e specs

One file per concern, each independent, each opening its own copy of the sweep
fixture. `tests/e2e/helpers.ts` holds the shared locators; it is not a spec, so
Playwright does not collect it.

- `load.spec.ts` — both "Open audio" buttons, name, length, canvas drawn, no error.
- `theme.spec.ts` — device scheme by default, toggle switches, choice survives reload.
- `a11y.spec.ts` — axe WCAG A/AA scan (contrast included) of the empty and full player, dark and light.
- `aura.spec.ts` — active only while playing, pointer-transparent, still under reduced motion.
- `playback.spec.ts` — Play/Pause labelling, the clock running and freezing,
  Space and ArrowRight, restarting after the natural end.
- `seek.spec.ts` — clicking and dragging the waveform; a seek while playing
  stays playing.
- `controls.spec.ts` — `End`, `Home` and double-click-to-default on all four
  sliders, plus Loop's `aria-pressed`.
- `loop.spec.ts` — wrapping instead of ending, ending with loop off, and A/B
  points: set, the intro-once-then-A-to-B cycle, clear.
- `export.spec.ts` — the download, its name, its RIFF header byte by byte, the
  saved notice appearing and expiring.
- `drop.spec.ts` — an in-page `DataTransfer` for the overlay, the load, the
  rejection, and a refused pick through the chooser.
- `web-target.spec.ts` — title, description, canonical, `og:image`, the
  `SoftwareApplication` JSON-LD, `llms.txt`, the web manifest.
- `efficiency.spec.ts` — Chromium only: `Performance.getMetrics` across two
  seconds of playback, proving ticks never reach React.

## The Web Audio stub

jsdom ships no `AudioContext`, no `OfflineAudioContext` and no media playback, so
`src/test/web-audio-stub.ts` supplies the engine's whole surface by hand.
`installWebAudioStubs()` registers the fakes with `vi.stubGlobal` per test —
never in the setup file, so a node test cannot lean on a global it never asked
for. Pair it with `vi.unstubAllGlobals()` in `afterEach`.

It fakes node construction and wiring, the values the engine writes (`gain`,
`playbackRate`, `loop`/`loopStart`/`loopEnd`), `start`/`stop`/`disconnect` and
their arguments, `currentTime` as a settable field, the suspended → running
resume, `decodeAudioData` (swap `stubs.decode` per test), `createBuffer` (the
generated impulse and crackle are tracked as `generated`, so `sources()` returns
only track sources and `beds()` the crackle) and an analyser whose `level` a test
sets.

It deliberately fakes **no audio**: no samples, no time passing on its own, and
`startRendering()` returns silence of the requested shape. Every assertion is
about the graph built or the state machine walked. That is enough because the
export path only reshapes what it is handed — the sample maths is
`wav.test.ts`'s job, against buffers from `makeAudioBuffer`.

## Driving the position integrator

The playhead moves on `requestAnimationFrame`, integrating deltas of
`ctx.currentTime`. Tests fake only the frame clock:

```ts
vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });

const advance = (seconds: number): void => {
  stubs.context().currentTime += seconds;
  vi.advanceTimersToNextFrame();
};
```

`currentTime` is the engine's clock, so the test owns it and `advance(0.5)` is
exactly one frame of half a second — no wall-clock waiting, no flake.
`setTimeout` stays real, so nothing else in the process stalls.

## Vitest 5 gotchas that bit

- **`vi.mock` must be top level.** Vitest 5 throws when it is called inside a
  `describe`, a hook or a function.
- **Unawaited async assertions fail the test.** `await expect(p).rejects…`, never
  the bare call. Same for `expect.poll`, which now rejects on timeout.
- **`clearMocks` defaults to true.** History is cleared before every test, so
  `toHaveBeenCalledTimes(1)` means "in this test". Implementations survive.
- **Float32 rounding.** Peaks normalise to 0.95 and read back as `0.949999988`.
  Compare with `toBeCloseTo`.

## Playwright facts

- **The file input is hidden**, and its `accept` is a built list rather than
  `audio/*`. Drive it through `waitForEvent("filechooser")` and
  `fileChooser.setFiles(toPlaywrightFile(...))`.
- **`--autoplay-policy=no-user-gesture-required`** is set on Chromium: the engine
  constructs its `AudioContext` inside `load()`, which can precede any click.
  Headless Chromium mutes the device while still running the graph.
- **WAV fixtures, not MP3.** The bundled Chromium has no proprietary codecs.
  `tests/e2e/fixtures/wav.ts` writes the RIFF byte by byte, independently of the
  app's `audioBufferToWav`, so the two are separate views of the format.
- **Next injects a `div[role="alert"]` route announcer**, so error assertions
  scope to `p[role="alert"]`.
- **`out/` is served at `/`** with `PAGES_BASE_PATH` unset — the shape the Tauri
  webview loads. A Pages-style base path would need a different build.
- **`workers: 1`** sits alongside `fullyParallel: false`: the latter only
  serialises within a file, and these specs assert on real elapsed time.
- **WebKit is the proxy for the Linux webview**, the closest stand-in for the
  WebKitGTK that Tauri embeds.

## Screenshots

`npm run screenshots` captures the UI state matrix for both engines into
`--out <dir>` (default: a folder in the OS temp directory). It builds nothing, so
run `npm run build` and `npx serve out -l 3123` first. Adding `-- --readme`
regenerates `assets/screenshot-dark.png`, `-light.png` and `public/og.png` from the
loop-points state in a viewport holding the whole page. A review tool; CI never runs it.

## CI

`check` runs `npm run verify` plus the Chromium e2e project and blocks merges;
`e2e-webkit` runs but does not. See [docs/release.md](release.md) for the
workflows themselves.

## Intentionally untested

shadcn/ui primitives (upstream's, unmodified), animations, and screenshots: visual
regression on a canvas flakes more than it finds; peaks, positions and loop regions are pinned directly.
