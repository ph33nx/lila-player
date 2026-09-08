/**
 * Setup for every test file, in both environments. Anything DOM-shaped is
 * guarded, because the node-environment tests (the pure engine modules) share
 * this file. Web Audio fakes are deliberately *not* here: they are installed
 * per test from `web-audio-stub.ts`, so a node test cannot accidentally rely on
 * a global it never asked for.
 */
if (typeof window !== "undefined") {
  // jsdom has no media playback: `play()` returns undefined, so the engine's
  // `element.play().catch(...)` would throw on a missing `.catch`.
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => undefined;

  // jsdom implements neither half of the object-URL pair, which `downloadBlob`
  // needs to exist even when a test does not care what it returns.
  URL.createObjectURL = () => "blob:lila-player/test";
  URL.revokeObjectURL = () => undefined;
}
