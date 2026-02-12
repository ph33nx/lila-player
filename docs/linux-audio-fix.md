# Linux Audio Fix — Plan & Options

## Problem

**WebKitGTK's `AudioContext.destination` does not produce audible output on Linux.**

This is a known limitation of WebKitGTK (the WebView engine Tauri uses on Linux). WebKitGTK's Web Audio API implementation is incomplete — their own site states: *"Currently we are working to finish support for WebAudio and WebRTC."*

### What works on WebKitGTK

- `AudioContext` creation, `.resume()`, `.state` transitions
- `decodeAudioData()` — decoding audio files into AudioBuffers
- `OfflineAudioContext.startRendering()` — offline rendering with full effect chain
- All processing nodes: `GainNode`, `ConvolverNode`, `AudioBufferSourceNode`, `playbackRate`
- `<audio>` element playback — plays sound via GStreamer pipeline
- `HTMLMediaElement` with blob URLs — confirmed working

### What does NOT work

- `AudioContext.destination` — the final audio output node produces silence
- This means **any** Web Audio graph connected to `context.destination` is inaudible

### Impact

- Windows/macOS: fully working (Chromium/WebKit have complete Web Audio support)
- Linux (all distros): no audio playback at all

---

## Option A: MediaStreamAudioDestinationNode (Recommended)

**Minimal change — keep all existing Web Audio API logic, only change the output sink.**

### Concept

Instead of routing the final `GainNode` to `context.destination`, route it to a `MediaStreamAudioDestinationNode`, then pipe that MediaStream into a hidden `<audio>` element via `srcObject`. The `<audio>` element uses GStreamer's HTMLMediaElement pipeline which **does** produce sound on WebKitGTK.

```
CURRENT (broken on Linux):
  source -> dryGain -> gain -> context.destination (SILENT on WebKitGTK)
  source -> reverb -> reverbGain -> gain -> context.destination

PROPOSED:
  source -> dryGain -> gain -> MediaStreamAudioDestinationNode -> <audio>.srcObject
  source -> reverb -> reverbGain -> gain -> MediaStreamAudioDestinationNode
```

### What changes

Only **one file** changes: `src/hooks/use-audio-processor.ts`

1. In `useAudioContext`: create a `MediaStreamAudioDestinationNode` alongside existing nodes
2. In `connectAudioNodes`: connect `gain` to the stream destination instead of `context.destination`
3. Create a hidden `<audio>` element, set its `srcObject` to the stream, and call `.play()` when playing
4. Platform detection: only use this path on Linux/WebKitGTK; on Windows/macOS continue using `context.destination` directly (for zero risk of regression)

### Changes in detail

```typescript
// In useAudioContext hook — add streamDest to nodes
const streamDest = audioContext.createMediaStreamDestination();

// In connectAudioNodes — change the last line:
// FROM: nodes.gain.connect(context.destination);
// TO:   nodes.gain.connect(nodes.streamDest);

// New hidden <audio> element managed in the hook:
const audioEl = new Audio();
audioEl.srcObject = streamDest.stream;
// Play/pause this element in sync with isPlaying state
```

### Risk assessment

| Risk | Mitigation |
|------|------------|
| `MediaStreamAudioDestinationNode` may not exist in WebKitGTK | Feature-detect with `typeof context.createMediaStreamDestination === 'function'`; fall back to `context.destination` |
| `srcObject` may not be supported on `<audio>` in WebKitGTK | Feature-detect; if unsupported, fall back to blob URL approach |
| Audio latency through MediaStream | Acceptable for a music player (not a real-time instrument) |
| Regression on Windows/macOS | Use platform detection: only apply on Linux, or feature-detect WebKitGTK |

### Previous attempt

This approach was tried once but **was not properly debugged** — debug logging was accidentally removed during the rewrite, so when "no logs in console" was reported, we couldn't determine if the code was even executing. The approach itself is sound and should be re-attempted with proper instrumentation.

### Effort

- ~30 lines of code changed in `use-audio-processor.ts`
- Zero changes to Rust backend
- Zero changes to UI components
- All existing real-time controls preserved (speed, reverb, volume, vinyl, seek, loop)

### Fallback plan

If `MediaStreamAudioDestinationNode` is not available in WebKitGTK, use the **ScriptProcessorNode / AudioWorklet** approach: tap the audio graph with a ScriptProcessorNode, write PCM data into a WAV blob in small chunks, and pipe through `<audio>` element. This has higher latency but is guaranteed to work since `OfflineAudioContext` rendering is confirmed functional.

---

## Option B: Rust Audio Engine

**Major refactor — move all audio processing to Rust, frontend becomes pure UI.**

### Architecture

```
Frontend (React)                          Backend (Rust)
  UI sliders/buttons  -- invoke() -->      #[tauri::command] handlers
  Waveform display    <-- Channel  --      Audio engine state
                                              |
                                           symphonia (decode)
                                              |
                                           rodio Source pipeline:
                                             Decoder -> speed() -> ReverbSource -> amplify()
                                              |
                                           rodio Sink (output via cpal -> PipeWire/ALSA)
```

### Tauri commands needed

```rust
#[tauri::command] fn load_audio(path: String) -> Result<AudioInfo, String>
#[tauri::command] fn play() -> Result<(), String>
#[tauri::command] fn pause() -> Result<(), String>
#[tauri::command] fn seek(position: f64) -> Result<(), String>
#[tauri::command] fn set_speed(rate: f32) -> Result<(), String>
#[tauri::command] fn set_volume(volume: f32) -> Result<(), String>
#[tauri::command] fn set_reverb(level: f32) -> Result<(), String>
#[tauri::command] fn export_wav(path: String) -> Result<(), String>
#[tauri::command] fn get_position() -> Result<f64, String>
#[tauri::command] fn get_waveform_data() -> Result<Vec<f32>, String>
```

### Rust dependencies

```toml
rodio = { version = "0.20", features = ["symphonia-all"] }
freeverb = "0.1"
```

- **rodio**: High-level audio playback. Has `Sink::set_speed()`, `Sink::set_volume()`, `Sink::try_seek()`, `Sink::get_pos()` for real-time control.
- **freeverb**: Freeverb algorithm implementation. Process stereo frames via `Freeverb::tick((left, right)) -> (left, right)`. Set room_size, dampening, wet/dry mix.
- **symphonia** (via rodio): Decodes MP3, WAV, FLAC, OGG, etc.
- **cpal** (via rodio): Cross-platform audio output (ALSA, PipeWire, PulseAudio, CoreAudio, WASAPI).

### What we gain

- Native audio output — bypasses WebKitGTK entirely, uses cpal which talks directly to PipeWire/ALSA
- Works identically on all platforms
- Better offline export performance (no OfflineAudioContext overhead)
- Audio keeps playing even if WebView is busy

### What we lose / trade-offs

- **Reverb quality**: Current ConvolverNode uses impulse response files (convolution reverb) which captures real room acoustics. Freeverb is an algorithmic reverb — different character, less "real". Could load impulse responses in Rust but would need a custom convolution implementation.
- **Waveform visualization**: Currently generated from AudioBuffer in JS. Would need to send waveform data from Rust to frontend via IPC.
- **Vinyl crackle**: Currently uses `<audio>` element with `createMediaElementSource`. Would need to decode and mix in Rust.
- **Complexity**: ~500+ lines of new Rust code, custom Source implementations, state management with Mutex/Arc.
- **Two audio systems**: Vinyl currently plays via `<audio>` element. With Rust engine, either move vinyl to Rust too or have two separate audio paths.
- **Testing difficulty**: Harder to test audio processing in Rust vs. browser DevTools.

### Effort

- New Rust module: `src-tauri/src/audio_engine.rs` (~400-500 lines)
- Modify `src-tauri/src/lib.rs` to register commands and manage state
- Rewrite `src/hooks/use-audio-processor.ts` to call Tauri `invoke()` instead of Web Audio API
- Update `src-tauri/Cargo.toml` with new dependencies
- Increase binary size (~2-5MB for symphonia codecs)

---

## Recommendation

**Start with Option A (MediaStreamAudioDestinationNode).** Here's why:

1. **Minimal change, maximum preservation.** Only ~30 lines change. All your 2 weeks of Web Audio API work stays intact.

2. **The approach is architecturally sound.** WebKitGTK's `<audio>` element playback works. `MediaStreamAudioDestinationNode` bridges Web Audio to `<audio>`. This is the same pattern Safari Desktop uses.

3. **It wasn't properly tested last time.** The previous attempt failed because debug logs were removed, not because the approach is wrong.

4. **Option B is always available later.** If Option A fails (e.g., WebKitGTK doesn't support `MediaStreamAudioDestinationNode`), we can still do Option B. But Option B is a week+ of work with reverb quality trade-offs.

5. **Option A has a fallback.** If `MediaStreamAudioDestinationNode` isn't available, we can fall back to periodic OfflineAudioContext rendering into blob URLs — more complex but proven to produce sound.

### Implementation order

1. Try `MediaStreamAudioDestinationNode` with feature detection
2. If unsupported, try ScriptProcessorNode -> WAV blob -> `<audio>` approach
3. If both fail, then consider Option B (Rust engine)

---

## Next steps

1. Add feature detection for `createMediaStreamDestination` in WebKitGTK
2. Implement the MediaStream -> `<audio>` bridge in `connectAudioNodes`
3. Test on Linux with `npm run tauri dev` with full debug logging
4. Verify no regression on Windows/macOS
