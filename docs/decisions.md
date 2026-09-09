# Decisions

ADR-lite. One entry per decision that shouldn't be re-litigated from scratch each session.

### Keep Tauri

- **Decision:** keep Tauri 2, don't move to Electron or a native-only GUI.
- **Why:** cross-platform OS APIs via maintained plugins, ~10 MB binaries, and the same static export ships unchanged as the Pages web app. A native Rust GUI would drop the web target.
- **Revisit when:** someone proposes a native Rust GUI framework and is willing to give up the web build.

### No product rewrite — engine/UI split instead

- **Decision:** no rewrite. Split the audio engine out behind an interface instead.
- **Why:** the UI is small; the missing piece is an engine boundary, not a new codebase.
- **Revisit when:** the split (docs/architecture.md) turns out not to be enough on its own.

### Web Audio engine now, Rust engine only if triggered

- **Decision:** Web Audio engine for now. A `TauriEngine` behind the same interface (symphonia decode, kira or fundsp graph, fft-convolver, Tauri `ipc::Channel` for position) only if triggered.
- **Why:** building a second engine for a problem the webview doesn't have yet is waste.
- **Revisit when:** streaming long files becomes a requirement. Linux output is confirmed working (Ubuntu 24.04 GNOME, `.deb` build), so that trigger is retired.

### Whole-track PCM in memory

- **Decision:** `decodeAudioData` holds the whole track as float32 PCM; no streaming decode.
- **Why:** acceptable for songs — a 5-minute stereo 44.1 kHz track is ~106 MB, a 2-hour file is ~2.5 GB.
- **Revisit when:** a use case needs files long enough that per-file memory becomes a problem (same trigger as the Rust engine above).

### Time stretch licensing

- **Decision:** time stretch via `HTMLMediaElement.preservesPitch` (Baseline since 2023) or the MIT `signalsmith-stretch` WASM worklet — never Rubber Band (GPL) or SoundTouch (LGPL).
- **Why:** Lila is MIT; a GPL/LGPL dependency would change the license obligations of the whole app.
- **Revisit when:** the app's own license changes.

### Export ignores loop points

- **Decision:** export is a single pass; loop points are playback-only.
- **Why:** keeps the export path simple and matches the default expectation of "save the file."
- **Revisit when:** looped export is requested often enough to justify a second export mode.

### No YouTube/SoundCloud URL import

- **Decision:** no YouTube or SoundCloud URL import.
- **Why:** DMCA section 1201 exposure. A February 2026 N.D. Cal. ruling treats third-party YouTube downloading as plausible circumvention, separate from any fair-use defence; GitHub's 2020 youtube-dl takedown was a section 1201 notice, and a project distributed through its repo cannot survive one.
- **Revisit when:** the legal landscape around circumvention-tool liability changes.

### Next.js held on its current major

- **Decision:** stay on the current Next major until the Next 16 decision point.
- **Why:** Next 16 removes `next lint` and changes Turbopack defaults — a deliberate migration, not a routine bump.
- **Revisit when:** ready to do that migration; see the hold list in docs/dependencies.md.

### Tone effects: bass, warmth, drive, wobble

- **Decision:** the tone chain is a low shelf, a low-pass, a tanh wave-shaper and a slow pitch LFO, all inside the shared graph. No bitcrusher, no stereo width, no sidechain, no delay.
- **Why:** those four are what the slowed and reverb tools people use actually ship (low-pass and wobble in four of eleven, saturation in four, bass in five); the rejected ones appeared in at most one, and delay is a preset ingredient rather than a control. Keeping them in `buildGraph` means the export cannot drift from playback.
- **Revisit when:** presets land (a slap-back delay or a narrowed stereo image may belong inside a "vintage" preset), or pitch-preserving speed changes what the source node is.

### Version defined once

- **Decision:** `package.json` is the only place the version is typed; `tauri.conf.json` points at it (`"version": "../package.json"`), the page's JSON-LD imports it, and `Cargo.toml` is set to match at release time because Cargo needs a literal.
- **Why:** two hand-typed copies drifted before (0.2.8 in npm and Tauri, 0.1.0 in Cargo); one source plus one derived reference cannot.
- **Revisit when:** Cargo gains a way to reference an external version, or Tauri drops path resolution for `version`.

### Generated reverb and crackle instead of bundled audio

- **Decision:** the impulse response and the vinyl bed are synthesized in `src/engine/synth.ts`; no audio files ship.
- **Why:** the two bundled files had no recorded provenance, which an MIT grant cannot cover; generating them removes the doubt, 2.4 MB, two runtime fetches and the base-path plumbing they needed, and makes the engine self-contained and deterministic in tests.
- **Revisit when:** a measured impulse response with a clear licence would audibly improve the reverb; keep the generator as the fallback.

---

Fonts and the `motion` animation library are UI decisions owned by docs/architecture.md, not this file.
