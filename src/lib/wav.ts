/** WAV (RIFF/PCM16) encoding + waveform peaks — pure, testable. */

export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  if (channels.length === 0) throw new Error("A WAV needs at least one channel.");
  const frames = channels[0].length;
  for (const channel of channels) {
    if (channel.length !== frames) throw new Error("Channels must have equal length.");
  }
  const numChannels = channels.length;
  const bytesPerSample = 2;
  const dataSize = frames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < frames; frame++) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}

export interface Peak {
  min: number;
  max: number;
}

/** Downsample an AudioBuffer-ish channel into N min/max peaks for waveform drawing. */
export function computePeaks(samples: Float32Array, buckets: number): Peak[] {
  if (buckets <= 0 || samples.length === 0) return [];
  const peaks: Peak[] = [];
  const bucketSize = Math.max(1, Math.floor(samples.length / buckets));
  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = bucket * bucketSize;
    if (start >= samples.length) break;
    const end = Math.min(samples.length, start + bucketSize);
    let min = 0;
    let max = 0;
    for (let i = start; i < end; i++) {
      const sample = samples[i];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    peaks.push({ min, max });
  }
  return peaks;
}
