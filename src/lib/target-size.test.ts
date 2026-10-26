import { describe, expect, it } from "vitest";
import { findQualityForTarget, findScaleForTarget, parseTargetSize } from "./target-size";

/** Mock encoder: size falls linearly from 10 MB at q=95 to 100 KB at q=20. */
function mockEncode(maxBytes = 10_000_000, minBytes = 100_000) {
  return async (quality: number) =>
    Math.round(minBytes + ((maxBytes - minBytes) * (quality - 20)) / (95 - 20));
}

describe("findQualityForTarget", () => {
  it("finds the largest quality that fits the target", async () => {
    const encode = mockEncode();
    const result = await findQualityForTarget(encode, 3_000_000);
    expect(result.hit).toBe(true);
    // size(41) ≈ 2.99 MB ≤ 3 MB; size(42) ≈ 3.04 MB > 3 MB → best q = 41
    expect(result.quality).toBe(41);
    expect(result.sizeBytes).toBeLessThanOrEqual(3_000_000);
  });

  it("returns max quality when everything fits", async () => {
    const result = await findQualityForTarget(mockEncode(), 50_000_000);
    expect(result.hit).toBe(true);
    expect(result.quality).toBe(95);
  });

  it("reports a miss with the smallest size when the floor can't fit", async () => {
    const result = await findQualityForTarget(mockEncode(), 50_000);
    expect(result.hit).toBe(false);
    expect(result.quality).toBe(20);
    expect(result.sizeBytes).toBe(100_000);
  });

  it("converges within the iteration cap", async () => {
    let calls = 0;
    const result = await findQualityForTarget(
      async (q) => {
        calls++;
        return await mockEncode()(q);
      },
      500_000,
      { maxIterations: 8 },
    );
    expect(result.hit).toBe(true);
    expect(result.sizeBytes).toBeLessThanOrEqual(500_000);
    expect(calls).toBeLessThanOrEqual(12);
  });

  it("rejects non-positive targets", async () => {
    await expect(findQualityForTarget(mockEncode(), 0)).rejects.toThrow(/positive/);
  });
});

describe("findScaleForTarget", () => {
  it("scales dimensions down until the target fits", async () => {
    // Encode size scales with quality AND with scale² (pixel count).
    const encode = async (quality: number, scale: number) =>
      (await mockEncode()(quality)) * scale * scale;
    // 80 KB < size(20, 1) = 100 KB → full scale can't fit, forces scaling.
    const result = await findScaleForTarget(encode, 80_000, {
      startScale: 1,
      minScale: 0.15,
      scaleStep: 0.2,
    });
    expect(result).not.toBeNull();
    expect(result!.search.hit).toBe(true);
    expect(result!.scale).toBeLessThan(1);
    expect(result!.search.sizeBytes).toBeLessThanOrEqual(80_000);
  });

  it("returns the closest attempt when even the minimum scale can't fit", async () => {
    const encode = async (quality: number, scale: number) =>
      (await mockEncode()(quality)) * scale * scale;
    const result = await findScaleForTarget(encode, 1_000, {
      startScale: 1,
      minScale: 0.15,
      scaleStep: 0.2,
    });
    expect(result).not.toBeNull();
    expect(result!.search.hit).toBe(false);
  });
});

describe("parseTargetSize", () => {
  it("parses kb, mb, and bare numbers", () => {
    expect(parseTargetSize("100kb")).toBe(100 * 1024);
    expect(parseTargetSize("200 KB")).toBe(200 * 1024);
    expect(parseTargetSize("1.5mb")).toBe(Math.round(1.5 * 1024 * 1024));
    expect(parseTargetSize("150")).toBe(150 * 1024);
  });

  it("rejects garbage", () => {
    expect(parseTargetSize("abc")).toBeNull();
    expect(parseTargetSize("-5kb")).toBeNull();
    expect(parseTargetSize("")).toBeNull();
  });
});
