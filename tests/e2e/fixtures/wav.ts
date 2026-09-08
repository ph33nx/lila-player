/**
 * WAV fixtures for the e2e specs, written byte by byte here rather than through
 * the app's `audioBufferToWav`. Two independent views of the same format: if
 * either drifts, a spec fails instead of both agreeing on a wrong file.
 *
 * WAV, not MP3, because the Chromium that ships with Playwright is built
 * without proprietary codecs and cannot decode MP3.
 */

const HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
const SWEEP_START_HZ = 200;
const SWEEP_END_HZ = 2000;
const PEAK = 0.8;

/**
 * A 16-bit PCM RIFF holding an exponential 200 Hz -> 2 kHz sweep, so a human
 * watching a trace can hear and a waveform can show where playback actually is.
 */
export const makeSineSweepWav = (
  seconds = 3,
  sampleRate = 44100,
  channels = 2,
): Buffer => {
  const frames = Math.max(0, Math.round(seconds * sampleRate));
  const blockAlign = channels * (BITS_PER_SAMPLE / 8);
  const dataBytes = frames * blockAlign;
  const wav = Buffer.alloc(HEADER_BYTES + dataBytes);

  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(HEADER_BYTES + dataBytes - 8, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16); // fmt chunk size
  wav.writeUInt16LE(1, 20); // format 1: uncompressed PCM
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(BITS_PER_SAMPLE, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataBytes, 40);

  const ratio = SWEEP_END_HZ / SWEEP_START_HZ;
  let phase = 0;
  for (let frame = 0; frame < frames; frame++) {
    const through = frames > 1 ? frame / (frames - 1) : 0;
    phase += (2 * Math.PI * SWEEP_START_HZ * ratio ** through) / sampleRate;
    const sample = Math.round(Math.sin(phase) * PEAK * 0x7fff);
    for (let channel = 0; channel < channels; channel++) {
      wav.writeInt16LE(sample, HEADER_BYTES + frame * blockAlign + channel * 2);
    }
  }

  return wav;
};

/** The shape `fileChooser.setFiles()` and `input.setInputFiles()` accept. */
export interface PlaywrightFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export const toPlaywrightFile = (
  name = "sweep.wav",
  seconds = 3,
): PlaywrightFile => ({
  name,
  mimeType: "audio/wav",
  buffer: makeSineSweepWav(seconds),
});
