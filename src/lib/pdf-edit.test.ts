import { describe, expect, it } from "vitest";
import {
  deserializeOverlays,
  editOverlayChanged,
  editTextOverlayFromItem,
  hexToRgb,
  pctToPt,
  ptToPct,
  serializeOverlays,
  simplifyInk,
  type EditOverlay,
} from "./pdf-edit";

const A4 = { width: 595.28, height: 841.89 };

describe("pctToPt / ptToPct", () => {
  it("converts the corners correctly (y flips)", () => {
    expect(pctToPt(0, 0, A4)).toEqual({ x: 0, y: A4.height }); // top-left
    expect(pctToPt(100, 100, A4)).toEqual({ x: A4.width, y: 0 }); // bottom-right
    expect(pctToPt(50, 50, A4).y).toBeCloseTo(A4.height / 2, 5);
  });

  it("round-trips through both directions", () => {
    const { xPct, yPct } = ptToPct(123.4, 456.7, A4);
    const back = pctToPt(xPct, yPct, A4);
    expect(back.x).toBeCloseTo(123.4, 5);
    expect(back.y).toBeCloseTo(456.7, 5);
  });

  it("handles mid-page percentages", () => {
    const { x, y } = pctToPt(25, 75, A4);
    expect(x).toBeCloseTo(A4.width * 0.25, 5);
    expect(y).toBeCloseTo(A4.height * 0.25, 5);
  });
});

describe("hexToRgb", () => {
  it("converts hex and tolerates shorthand", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb("#0f0")).toEqual({ r: 0, g: 1, b: 0 });
    expect(hexToRgb("nope")).toEqual({ r: 0.1, g: 0.1, b: 0.15 }); // fallback
  });
});

describe("simplifyInk", () => {
  it("keeps two-point strokes as-is", () => {
    const points = [
      { xPct: 0, yPct: 0 },
      { xPct: 10, yPct: 10 },
    ];
    expect(simplifyInk(points)).toHaveLength(2);
  });

  it("collapses a straight line with many sampled points to its ends", () => {
    const points = [];
    for (let i = 0; i <= 100; i++) {
      points.push({ xPct: i, yPct: i * 0.5 });
    }
    const simplified = simplifyInk(points, 0.25);
    expect(simplified.length).toBeLessThanOrEqual(3);
    expect(simplified[0].xPct).toBe(0);
    expect(simplified[simplified.length - 1].xPct).toBe(100);
  });

  it("preserves corners on a bend", () => {
    const points = [
      { xPct: 0, yPct: 0 },
      { xPct: 50, yPct: 0 },
      { xPct: 50, yPct: 50 },
    ];
    const simplified = simplifyInk(points, 0.25);
    expect(simplified).toHaveLength(3);
  });

  it("never returns fewer than two points for real strokes", () => {
    const points = [
      { xPct: 1, yPct: 1 },
      { xPct: 1.01, yPct: 1.01 },
      { xPct: 1.02, yPct: 1.01 },
    ];
    expect(simplifyInk(points, 0.25).length).toBeGreaterThanOrEqual(2);
  });
});

describe("serialize / deserialize", () => {
  it("round-trips overlays losslessly", () => {
    const overlays: EditOverlay[] = [
      { type: "text", page: 0, xPct: 10, yPct: 20, widthPct: 40, text: "Hello", fontSizePt: 14, color: "#111111", bold: true },
      { type: "ink", page: 1, xPct: 0, yPct: 0, points: [{ xPct: 1, yPct: 2 }, { xPct: 3, yPct: 4 }], widthPt: 2, color: "#ff0000" },
      { type: "highlight", page: 1, xPct: 5, yPct: 5, widthPct: 30, heightPct: 4 },
      { type: "whiteout", page: 2, xPct: 5, yPct: 5, widthPct: 30, heightPct: 4 },
      { type: "image", page: 2, xPct: 5, yPct: 5, widthPct: 20, heightPct: 10, dataUrl: "data:image/png;base64,AAA" },
      {
        type: "edit", page: 0, xPct: 10, yPct: 20, widthPct: 30, heightPct: 2, baselinePct: 21.5,
        userX: 60, userY: 780, userWidth: 180, userAscent: 9, userDescent: 2.4,
        text: "Replaced", sizePt: 12, fontFamily: "original", bold: false, italic: false,
        color: "#000000", fontLabel: "SourceSansPro-Regular", originalText: "Original run", originalSizePt: 12,
      },
    ];
    const restored = deserializeOverlays(serializeOverlays(overlays));
    expect(restored).toEqual(overlays);
  });

  it("rejects non-array data", () => {
    expect(() => deserializeOverlays('{"nope":1}')).toThrow(/array/);
  });
});

describe("editTextOverlayFromItem", () => {
  it("derives display % geometry and keeps user-space geometry exact", () => {
    const overlay = editTextOverlayFromItem(
      { str: "Hello", x: 70, y: 800, width: 200, fontSize: 12, ascent: 0.8, descent: -0.2, fontLabel: "Helvetica" },
      2,
      A4,
    );
    expect(overlay.page).toBe(2);
    expect(overlay.xPct).toBeCloseTo((70 / A4.width) * 100, 5);
    // Top of box = baseline + ascent.
    const topPt = 800 + 0.8 * 12;
    expect(overlay.yPct).toBeCloseTo(ptToPct(70, topPt, A4).yPct, 5);
    expect(overlay.baselinePct).toBeCloseTo(ptToPct(70, 800, A4).yPct, 5);
    expect(overlay.heightPct).toBeCloseTo(((0.8 + 0.2) * 12 / A4.height) * 100, 5);
    expect(overlay.userX).toBe(70);
    expect(overlay.userY).toBe(800);
    expect(overlay.userAscent).toBeCloseTo(9.6, 5);
    expect(overlay.userDescent).toBeCloseTo(2.4, 5);
    expect(overlay.fontLabel).toBe("Helvetica");
    expect(overlay.originalText).toBe("Hello");
    expect(overlay.fontFamily).toBe("original");
  });
});

describe("editOverlayChanged", () => {
  const untouched = {
    text: "Same",
    originalText: "Same",
    sizePt: 12,
    originalSizePt: 12,
    fontFamily: "original" as const,
    bold: false,
    italic: false,
    color: "#000000",
  };

  it("is false when nothing was touched", () => {
    expect(editOverlayChanged(untouched)).toBe(false);
  });

  it("detects text, size, font, style and color changes", () => {
    expect(editOverlayChanged({ ...untouched, text: "Different" })).toBe(true);
    expect(editOverlayChanged({ ...untouched, sizePt: 13 })).toBe(true);
    expect(editOverlayChanged({ ...untouched, fontFamily: "times" })).toBe(true);
    expect(editOverlayChanged({ ...untouched, bold: true })).toBe(true);
    expect(editOverlayChanged({ ...untouched, italic: true })).toBe(true);
    expect(editOverlayChanged({ ...untouched, color: "#d61a3c" })).toBe(true);
  });

  it("treats uppercase hex black as unchanged", () => {
    expect(editOverlayChanged({ ...untouched, color: "#000000" })).toBe(false);
  });
});
