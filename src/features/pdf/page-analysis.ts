/**
 * Pure pixel analysis over rendered PDF pages (no DOM — unit-testable).
 * Callers render a page to a canvas and pass the RGBA buffer here.
 */

export interface ContentBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function isInk(r: number, g: number, b: number, threshold: number): boolean {
  return r < threshold || g < threshold || b < threshold;
}

/**
 * Smallest rectangle containing all non-white pixels, or null when the page
 * has no visible content at all.
 */
export function findInkBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 245,
): ContentBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isInk(data[i], data[i + 1], data[i + 2], threshold)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

/** Fraction of pixels that carry visible ink (0 = blank white page). */
export function inkRatio(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 245,
): number {
  let ink = 0;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    if (isInk(data[o], data[o + 1], data[o + 2], threshold)) ink++;
  }
  return total === 0 ? 0 : ink / total;
}

export type BlankSensitivity = "normal" | "aggressive";

/** Ink share under which a page counts as blank. */
export function blankThreshold(sensitivity: BlankSensitivity): number {
  return sensitivity === "aggressive" ? 0.004 : 0.0008;
}

export function isBlankPage(ratio: number, sensitivity: BlankSensitivity): boolean {
  return ratio < blankThreshold(sensitivity);
}
