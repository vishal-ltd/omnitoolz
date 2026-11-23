import { describe, expect, it } from "vitest";
import {
  displayDeltaToUserSpace,
  displayPctToUserSpace,
  displayRectToUserSpace,
  displaySize,
  editOverlayChanged,
  editTextOverlayFromItem,
  hexToRgb,
  imageStampSize,
  pctToPt,
  ptToPct,
  serializeOverlays,
  simplifyInk,
  userSpaceToDisplayPct,
  type CropBox,
  type EditOverlay,
} from "./pdf-edit";

const A4 = { width: 595.28, height: 841.89 };
/** Zero-origin CropBox == MediaBox — the legacy, must-stay-identical case. */
const A4_BOX: CropBox = { x: 0, y: 0, ...A4 };
/** Offset CropBox used by the pdf.js convertToPdfPoint probe (MediaBox 612×792). */
const PROBE_BOX: CropBox = { x: 10, y: 20, width: 592, height: 762 };

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

describe("serializeOverlays", () => {
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
    const restored = JSON.parse(serializeOverlays(overlays)) as EditOverlay[];
    expect(restored).toEqual(overlays);
  });
});

describe("editTextOverlayFromItem", () => {
  it("derives display % geometry and keeps user-space geometry exact", () => {
    const overlay = editTextOverlayFromItem(
      { str: "Hello", x: 70, y: 800, width: 200, fontSize: 12, ascent: 0.8, descent: -0.2, fontLabel: "Helvetica" },
      2,
      { cropBox: A4_BOX, rotate: 0 },
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

describe("displaySize", () => {
  it("swaps axes on quarter turns only", () => {
    expect(displaySize(PROBE_BOX, 0)).toEqual({ width: 592, height: 762 });
    expect(displaySize(PROBE_BOX, 180)).toEqual({ width: 592, height: 762 });
    expect(displaySize(PROBE_BOX, 90)).toEqual({ width: 762, height: 592 });
    expect(displaySize(PROBE_BOX, 270)).toEqual({ width: 762, height: 592 });
  });
});

describe("displayPctToUserSpace (probe-derived)", () => {
  // Corner mappings printed by pdf.js PageViewport.convertToPdfPoint for an
  // offset-CropBox page (probe-viewport.mjs): [TL, TR, BL, BR] per rotation.
  const corners: Record<number, Array<[number, number]>> = {
    0: [[10, 782], [602, 782], [10, 20], [602, 20]],
    90: [[10, 20], [10, 782], [602, 20], [602, 782]],
    180: [[602, 20], [10, 20], [602, 782], [10, 782]],
    270: [[602, 782], [602, 20], [10, 782], [10, 20]],
  };
  const pctCorners: Array<[number, number]> = [[0, 0], [100, 0], [0, 100], [100, 100]];

  for (const rotate of [0, 90, 180, 270]) {
    it(`matches the pdf.js probe corners at rotate=${rotate}`, () => {
      pctCorners.forEach(([xPct, yPct], i) => {
        const [x, y] = corners[rotate][i];
        expect(displayPctToUserSpace(xPct, yPct, PROBE_BOX, rotate)).toEqual({ x, y });
      });
    });
  }

  it("normalizes out-of-range rotations", () => {
    expect(displayPctToUserSpace(0, 0, PROBE_BOX, 450)).toEqual({ x: 10, y: 20 }); // 90
    expect(displayPctToUserSpace(0, 0, PROBE_BOX, -90)).toEqual({ x: 602, y: 782 }); // 270
    expect(displayPctToUserSpace(0, 0, PROBE_BOX, 360)).toEqual({ x: 10, y: 782 }); // 0
  });

  it("is byte-identical to pctToPt for unrotated CropBox==MediaBox (no regression)", () => {
    for (const [xPct, yPct] of [[0, 0], [100, 100], [25, 75], [12.5, 63.25]]) {
      expect(displayPctToUserSpace(xPct, yPct, A4_BOX, 0)).toEqual(pctToPt(xPct, yPct, A4));
    }
  });

  it("round-trips through userSpaceToDisplayPct on every rotation", () => {
    for (const rotate of [0, 90, 180, 270]) {
      for (const [xPct, yPct] of [[0, 0], [100, 100], [37.5, 62.5]]) {
        const { x, y } = displayPctToUserSpace(xPct, yPct, PROBE_BOX, rotate);
        const back = userSpaceToDisplayPct(x, y, PROBE_BOX, rotate);
        expect(back.xPct).toBeCloseTo(xPct, 8);
        expect(back.yPct).toBeCloseTo(yPct, 8);
      }
    }
  });
});

describe("displayDeltaToUserSpace", () => {
  it("matches the legacy drag math for unrotated CropBox==MediaBox", () => {
    expect(displayDeltaToUserSpace(10, 5, A4_BOX, 0)).toEqual({
      dx: (10 / 100) * A4.width,
      dy: -(5 / 100) * A4.height,
    });
  });

  it("swaps/negates axes per rotation (probe-derived)", () => {
    expect(displayDeltaToUserSpace(10, 0, PROBE_BOX, 90).dx).toBeCloseTo(0, 8);
    expect(displayDeltaToUserSpace(10, 0, PROBE_BOX, 90).dy).toBeCloseTo(76.2, 8);
    expect(displayDeltaToUserSpace(0, 10, PROBE_BOX, 90).dx).toBeCloseTo(59.2, 8);
    expect(displayDeltaToUserSpace(0, 10, PROBE_BOX, 90).dy).toBeCloseTo(0, 8);
    expect(displayDeltaToUserSpace(10, 5, PROBE_BOX, 180).dx).toBeCloseTo(-59.2, 8);
    expect(displayDeltaToUserSpace(10, 5, PROBE_BOX, 180).dy).toBeCloseTo(38.1, 8);
    expect(displayDeltaToUserSpace(10, 5, PROBE_BOX, 270).dx).toBeCloseTo(-29.6, 8);
    expect(displayDeltaToUserSpace(10, 5, PROBE_BOX, 270).dy).toBeCloseTo(-76.2, 8);
  });
});

describe("displayRectToUserSpace", () => {
  it("is byte-identical to the legacy pctToPt rect for unrotated CropBox==MediaBox", () => {
    for (const [xPct, yPct, widthPct, heightPct] of [[0, 0, 100, 100], [5, 10, 30, 4], [62.5, 71.25, 12.5, 8.5]]) {
      const start = pctToPt(xPct, yPct, A4);
      const legacy = {
        x: start.x,
        y: start.y - (heightPct / 100) * A4.height,
        width: (widthPct / 100) * A4.width,
        height: (heightPct / 100) * A4.height,
      };
      expect(displayRectToUserSpace(xPct, yPct, widthPct, heightPct, A4_BOX, 0)).toEqual(legacy);
    }
  });

  it("covers the whole CropBox for a full-page rect on every rotation", () => {
    for (const rotate of [0, 90, 180, 270]) {
      expect(displayRectToUserSpace(0, 0, 100, 100, PROBE_BOX, rotate)).toEqual({
        x: 10,
        y: 20,
        width: 592,
        height: 762,
      });
    }
  });

  it("maps a partial rect correctly at rotate=90 (axes swap)", () => {
    // Display rect: left 25%, top 50%, half the display width, quarter height.
    // Display view is 762×592; display y drives user x (×CropBox width),
    // display x drives user y (×CropBox height).
    const rect = displayRectToUserSpace(25, 50, 50, 25, PROBE_BOX, 90);
    expect(rect.x).toBeCloseTo(10 + 0.5 * 592, 8);
    expect(rect.y).toBeCloseTo(20 + 0.25 * 762, 8);
    expect(rect.width).toBeCloseTo(0.25 * 592, 8);
    expect(rect.height).toBeCloseTo(0.5 * 762, 8);
  });
});

describe("editTextOverlayFromItem on rotated pages", () => {
  it("maps the display box through the rotation but keeps user space exact", () => {
    const overlay = editTextOverlayFromItem(
      { str: "Hi", x: 100, y: 100, width: 200, fontSize: 12, ascent: 0.8, descent: -0.2, fontLabel: null },
      0,
      { cropBox: PROBE_BOX, rotate: 90 },
    );
    // Run box corners (100, 109.6) and (300, 97.6) through the rotate-90 map:
    // display xPct = (userY - 20) / 762, yPct = (userX - 10) / 592.
    expect(overlay.xPct).toBeCloseTo(((97.6 - 20) / 762) * 100, 8);
    expect(overlay.yPct).toBeCloseTo(((100 - 10) / 592) * 100, 8);
    expect(overlay.widthPct).toBeCloseTo((12 / 762) * 100, 8); // font band spans display x
    expect(overlay.heightPct).toBeCloseTo((200 / 592) * 100, 8); // run width spans display y
    expect(overlay.baselinePct).toBeCloseTo(((100 - 10) / 592) * 100, 8);
    expect(overlay.userX).toBe(100);
    expect(overlay.userY).toBe(100);
    expect(overlay.userWidth).toBe(200);
  });
});

describe("imageStampSize", () => {
  const SQUARE = { width: 600, height: 600 };

  it("preserves a square image's aspect on a portrait page", () => {
    const { widthPct, heightPct } = imageStampSize(1, A4);
    expect(widthPct).toBe(25);
    expect(heightPct).toBeCloseTo(25 * (A4.width / A4.height), 8);
  });

  it("preserves landscape and portrait aspects on a square display", () => {
    expect(imageStampSize(0.5, SQUARE)).toEqual({ widthPct: 25, heightPct: 12.5 });
    expect(imageStampSize(2, SQUARE)).toEqual({ widthPct: 25, heightPct: 50 });
  });

  it("uses the DISPLAY aspect (rotated page), not the unrotated one", () => {
    const landscapeDisplay = { width: A4.height, height: A4.width };
    expect(imageStampSize(1, landscapeDisplay).heightPct).toBeCloseTo(25 * (A4.height / A4.width), 8);
  });

  it("clamps extreme aspects to sane bounds", () => {
    const tall = imageStampSize(100, SQUARE);
    expect(tall.widthPct).toBe(1);
    expect(tall.heightPct).toBeCloseTo(90, 8);
    expect(imageStampSize(0.01, SQUARE)).toEqual({ widthPct: 25, heightPct: 1 });
  });

  it("falls back to square for invalid aspects", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(imageStampSize(bad, SQUARE)).toEqual({ widthPct: 25, heightPct: 25 });
    }
  });
});
