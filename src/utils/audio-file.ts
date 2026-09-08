/**
 * One list, three consumers: the drop/picker predicate, the file input's
 * `accept`, and the formats line in the empty state. Decoding is still the
 * final word — this only keeps obviously wrong files out of the engine.
 */
export const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "flac",
  "ogg",
  "oga",
  "m4a",
  "aac",
  "aiff",
  "aif",
  "opus",
  "webm",
  "wma",
] as const;

export const ACCEPT = [
  "audio/*",
  ...AUDIO_EXTENSIONS.map((extension) => `.${extension}`),
].join(",");

export const AUDIO_FORMATS = AUDIO_EXTENSIONS.map((extension) =>
  extension.toUpperCase(),
).join(", ");

const NAME_PATTERN = new RegExp(`\\.(${AUDIO_EXTENSIONS.join("|")})$`, "i");

/** Some OS pickers and WebKit hand over an empty `type`, so fall back to the name. */
export const isAudioFile = (file: File): boolean =>
  file.type.startsWith("audio/") || NAME_PATTERN.test(file.name);

/** `Song.flac` exports as `Song-lofi.wav`; only a known audio extension is dropped. */
export const exportFileName = (trackName: string): string =>
  `${trackName.replace(NAME_PATTERN, "")}-lofi.wav`;
