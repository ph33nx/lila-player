/** Canvas columns the waveform is rendered at, and the default peak resolution. */
export const DEFAULT_PEAK_COLUMNS = 800;

export const EMPTY_PEAKS = new Float32Array(0);

/**
 * Reduce a channel to `columns` interleaved [max, min] pairs, normalised so the
 * loudest sample sits at 0.95. Block bounds are computed from fractional offsets,
 * so a buffer shorter than the canvas still yields real samples per column and the
 * tail is never dropped; columns past the end of the data stay flat.
 */
export const computePeaks = (
  channelData: Float32Array,
  columns: number,
): Float32Array => {
  if (columns <= 0) return EMPTY_PEAKS;

  const length = channelData.length;
  const peaks = new Float32Array(columns * 2);
  let loudest = 0;

  for (let i = 0; i < columns; i++) {
    const start = Math.min(Math.floor((i * length) / columns), length);
    const end = Math.min(
      Math.max(start + 1, Math.floor(((i + 1) * length) / columns)),
      length,
    );
    if (start >= end) continue;

    let min = channelData[start];
    let max = min;
    for (let j = start + 1; j < end; j++) {
      const sample = channelData[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    peaks[i * 2] = max;
    peaks[i * 2 + 1] = min;
    loudest = Math.max(loudest, Math.abs(max), Math.abs(min));
  }

  if (loudest > 0) {
    const scale = 0.95 / loudest;
    for (let i = 0; i < peaks.length; i++) peaks[i] *= scale;
  }

  return peaks;
};
