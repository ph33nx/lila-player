export const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const numOfChannels = buffer.numberOfChannels;
  const length = buffer.length * numOfChannels * 2 + 44;
  const result = new ArrayBuffer(length);
  const view = new DataView(result);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, length - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numOfChannels * 2, true);
  view.setUint16(32, numOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length - 44, true);

  const interleaved = new Float32Array(buffer.length * numOfChannels);
  for (let channel = 0; channel < numOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      interleaved[i * numOfChannels + channel] = channelData[i];
    }
  }

  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return result;
};

export const audioBufferToMp3 = async (
  buffer: AudioBuffer,
  kbps: number = 192,
): Promise<Blob> => {
  const { Mp3Encoder } = await import("@breezystack/lamejs");

  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);

  const floatToPcm16 = (channelData: Float32Array): Int16Array => {
    const pcm = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm;
  };

  const left = floatToPcm16(buffer.getChannelData(0));
  const right =
    numChannels > 1 ? floatToPcm16(buffer.getChannelData(1)) : undefined;

  const blockSize = 1152;
  const mp3Chunks: Uint8Array[] = [];

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right ? right.subarray(i, i + blockSize) : undefined;

    const mp3buf = rightChunk
      ? encoder.encodeBuffer(leftChunk, rightChunk)
      : encoder.encodeBuffer(leftChunk);

    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
  }

  const finalBuf = encoder.flush();
  if (finalBuf.length > 0) {
    mp3Chunks.push(new Uint8Array(finalBuf));
  }

  return new Blob(mp3Chunks as unknown as BlobPart[], { type: "audio/mp3" });
};

export const loadImpulseResponse = async (
  context: AudioContext,
  url: string,
): Promise<AudioBuffer> => {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return context.decodeAudioData(buffer);
};
