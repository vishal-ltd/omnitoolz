import { describe, expect, it } from "vitest";
import { contrastRatio, hslToRgb, parseHex, rgbToHsl, toHex, wcagGrade } from "./color";

describe("color conversions", () => {
  it("parses 3- and 6-digit hex", () => {
    expect(parseHex("#5b54e8")).toEqual({ r: 91, g: 84, b: 232 });
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("12abcf")).toEqual({ r: 0x12, g: 0xab, b: 0xcf });
    expect(parseHex("nope")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
  });

  it("formats hex round-trips", () => {
    expect(toHex({ r: 0, g: 128, b: 255 })).toBe("#0080ff");
  });

  it("converts rgb → hsl → rgb", () => {
    const rgb = { r: 91, g: 84, b: 232 };
    const hsl = rgbToHsl(rgb);
    expect(hsl).toEqual({ h: 243, s: 76, l: 62 });
    const back = hslToRgb(hsl);
    // Hue rounding to whole degrees can shift a channel by a step.
    for (const key of ["r", "g", "b"] as const) {
      expect(Math.abs(back[key] - rgb[key])).toBeLessThanOrEqual(2);
    }
  });

  it("treats grays as zero saturation", () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, l: 50 });
    expect(hslToRgb({ h: 200, s: 0, l: 50 })).toEqual({ r: 128, g: 128, b: 128 });
  });
});

describe("WCAG contrast", () => {
  it("black vs white is 21:1", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0);
  });

  it("same color is 1:1", () => {
    expect(contrastRatio({ r: 10, g: 200, b: 30 }, { r: 10, g: 200, b: 30 })).toBe(1);
  });

  it("grades the thresholds", () => {
    expect(wcagGrade(21)).toBe("AAA");
    expect(wcagGrade(7)).toBe("AAA");
    expect(wcagGrade(4.5)).toBe("AA");
    expect(wcagGrade(3)).toBe("AA Large");
    expect(wcagGrade(2.9)).toBe("Fail");
  });

  it("matches the known brand-on-white check", () => {
    // #5b54e8 on white ≈ 5.4:1 → AA
    const ratio = contrastRatio(parseHex("#5b54e8")!, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(6);
  });
});
