import { describe, expect, it } from "vitest";
import { computePeaks, encodeWav } from "./wav";

describe("encodeWav", () => {
  it("writes a valid RIFF/PCM16 header", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1]);
    const wav = encodeWav([samples], 8000);
    const text = String.fromCharCode(...wav.slice(0, 4));
    expect(text).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
    expect(String.fromCharCode(...wav.slice(36, 40))).toBe("data");
    const view = new DataView(wav.buffer);
    expect(view.getUint32(4, true)).toBe(36 + 8); // 4 frames × mono × 2 bytes
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint16(34, true)).toBe(16);
  });

  it("encodes samples as little-endian PCM16 with clipping", () => {
    const wav = encodeWav([new Float32Array([0.5, -0.5, 2, -2])], 8000);
    const view = new DataView(wav.buffer);
    expect(view.getInt16(44, true)).toBe(16383); // 0.5 × 0x7fff (truncated)
    expect(view.getInt16(46, true)).toBe(-16384);
    expect(view.getInt16(48, true)).toBe(0x7fff); // clipped
    expect(view.getInt16(50, true)).toBe(-0x8000); // clipped
  });

  it("interleaves stereo channels", () => {
    const wav = encodeWav([new Float32Array([1, 0]), new Float32Array([0, 1])], 44100);
    const view = new DataView(wav.buffer);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getInt16(44, true)).toBe(0x7fff); // L frame 0
    expect(view.getInt16(46, true)).toBe(0); // R frame 0
    expect(view.getInt16(48, true)).toBe(0); // L frame 1
    expect(view.getInt16(50, true)).toBe(0x7fff); // R frame 1
  });

  it("rejects mismatched channel lengths", () => {
    expect(() =>
      encodeWav([new Float32Array([1, 2]), new Float32Array([1])], 44100),
    ).toThrow(/equal length/);
  });
});

describe("computePeaks", () => {
  it("finds min/max per bucket", () => {
    const samples = new Float32Array([0, 0.5, -0.9, 0.2, 0.8, -0.1]);
    const peaks = computePeaks(samples, 3);
    expect(peaks.length).toBe(3);
    expect(peaks[0].max).toBeCloseTo(0.5);
    expect(peaks[1].min).toBeCloseTo(-0.9);
    expect(peaks[1].max).toBeCloseTo(0.2);
    expect(peaks[2].min).toBeCloseTo(-0.1);
    expect(peaks[2].max).toBeCloseTo(0.8);
  });

  it("handles empty input and degenerate buckets", () => {
    expect(computePeaks(new Float32Array([]), 10)).toEqual([]);
    expect(computePeaks(new Float32Array([0.3]), 0)).toEqual([]);
    // More buckets than samples still yields one peak per populated bucket.
    const peaks = computePeaks(new Float32Array([0.4, -0.4]), 8);
    expect(peaks.length).toBe(2);
    expect(peaks[0].max).toBeCloseTo(0.4);
    expect(peaks[1].min).toBeCloseTo(-0.4);
  });
});
