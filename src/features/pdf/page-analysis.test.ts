import { describe, expect, it } from "vitest";
import { blankThreshold, findInkBounds, inkRatio, isBlankPage } from "./page-analysis";

/** White RGBA canvas helper with an ink rectangle painted on it. */
function canvas(
  width: number,
  height: number,
  boxes: Array<[number, number, number, number]> = [],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [x0, y0, x1, y1] of boxes) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * width + x) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
  }
  return data;
}

describe("findInkBounds", () => {
  it("finds the tight box around ink", () => {
    const data = canvas(10, 10, [[2, 3, 5, 7]]);
    expect(findInkBounds(data, 10, 10)).toEqual({ left: 2, top: 3, right: 5, bottom: 7 });
  });

  it("returns null for a pure white page", () => {
    expect(findInkBounds(canvas(6, 6), 6, 6)).toBeNull();
  });

  it("respects the brightness threshold", () => {
    const data = canvas(4, 4, [[1, 1, 2, 2]]);
    // Overwrite the ink with very light gray — under threshold 250 it counts,
    // above it (strictly lighter) it doesn't.
    for (let y = 1; y <= 2; y++) {
      for (let x = 1; x <= 2; x++) {
        const i = (y * 4 + x) * 4;
        data[i] = 252;
        data[i + 1] = 252;
        data[i + 2] = 252;
      }
    }
    expect(findInkBounds(data, 4, 4, 245)).toBeNull();
    expect(findInkBounds(data, 4, 4, 253)).toEqual({ left: 1, top: 1, right: 2, bottom: 2 });
  });
});

describe("blank detection", () => {
  it("measures the ink share", () => {
    expect(inkRatio(canvas(10, 10), 10, 10)).toBe(0);
    // 4 of 100 pixels carry ink.
    expect(inkRatio(canvas(10, 10, [[0, 0, 1, 1]]), 10, 10)).toBeCloseTo(0.04, 5);
  });

  it("flags blank pages by sensitivity", () => {
    expect(isBlankPage(0, "normal")).toBe(true);
    expect(isBlankPage(0.0005, "normal")).toBe(true); // under 0.08%
    expect(isBlankPage(0.002, "normal")).toBe(false);
    expect(isBlankPage(0.002, "aggressive")).toBe(true); // under 0.4%
    expect(isBlankPage(0.01, "aggressive")).toBe(false);
  });

  it("keeps thresholds ordered sanely", () => {
    expect(blankThreshold("aggressive")).toBeGreaterThan(blankThreshold("normal"));
  });
});
