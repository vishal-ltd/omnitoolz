/**
 * Edit-PDF overlay model + geometry — pure, DOM-free, unit-testable.
 * Overlays are stored in page-relative percentages so the editor is
 * zoom-independent and baking converts to PDF points deterministically.
 */

export type EditTool = "text" | "ink" | "highlight" | "whiteout" | "image";

export interface BaseOverlay {
  /** Zero-based page index. */
  page: number;
  xPct: number;
  yPct: number;
}

export interface TextOverlay extends BaseOverlay {
  type: "text";
  widthPct: number;
  text: string;
  fontSizePt: number;
  color: string;
  bold?: boolean;
}

export interface InkOverlay extends BaseOverlay {
  type: "ink";
  /** Percent-space points (xPct/yPct pairs), as drawn. */
  points: Array<{ xPct: number; yPct: number }>;
  widthPt: number;
  color: string;
}

export interface RectOverlay extends BaseOverlay {
  type: "highlight" | "whiteout";
  widthPct: number;
  heightPct: number;
}

export interface ImageOverlay extends BaseOverlay {
  type: "image";
  widthPct: number;
  heightPct: number;
  /** PNG data URL of the placed image. */
  dataUrl: string;
}

export type EditOverlay =
  | TextOverlay
  | InkOverlay
  | RectOverlay
  | ImageOverlay;

/** A page's PDF dimensions in points. */
export interface PageSize {
  width: number;
  height: number;
}

/** Percentage coordinates → PDF points, with the y-axis flip. */
export function pctToPt(
  xPct: number,
  yPct: number,
  page: PageSize,
): { x: number; y: number } {
  return {
    x: (xPct / 100) * page.width,
    y: page.height - (yPct / 100) * page.height,
  };
}

/** PDF points → percentage coordinates (inverse of pctToPt). */
export function ptToPct(x: number, y: number, page: PageSize): { xPct: number; yPct: number } {
  return {
    xPct: (x / page.width) * 100,
    yPct: ((page.height - y) / page.height) * 100,
  };
}

/** hex like #rrggbb → pdf-lib rgb triple (0–1). */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const expanded = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(expanded, 16);
  if (Number.isNaN(num)) return { r: 0.1, g: 0.1, b: 0.15 };
  return {
    r: ((num >> 16) & 0xff) / 255,
    g: ((num >> 8) & 0xff) / 255,
    b: (num & 0xff) / 255,
  };
}

/**
 * Ramer-Douglas-Peucker simplification on percent-space points — keeps
 * drawings smooth while collapsing noisy pointer trails. Tolerance is in
 * percentage units of the page diagonal-ish scale (0.1–0.5 is typical).
 */
export function simplifyInk(
  points: Array<{ xPct: number; yPct: number }>,
  tolerance = 0.25,
): Array<{ xPct: number; yPct: number }> {
  if (points.length <= 2) return points.slice();

  const perpendicularDistance = (
    point: { xPct: number; yPct: number },
    start: { xPct: number; yPct: number },
    end: { xPct: number; yPct: number },
  ): number => {
    const dx = end.xPct - start.xPct;
    const dy = end.yPct - start.yPct;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return Math.hypot(point.xPct - start.xPct, point.yPct - start.yPct);
    const t = Math.max(
      0,
      Math.min(1, ((point.xPct - start.xPct) * dx + (point.yPct - start.yPct) * dy) / lengthSq),
    );
    const projX = start.xPct + t * dx;
    const projY = start.yPct + t * dy;
    return Math.hypot(point.xPct - projX, point.yPct - projY);
  };

  const simplify = (
    pts: Array<{ xPct: number; yPct: number }>,
  ): Array<{ xPct: number; yPct: number }> => {
    if (pts.length <= 2) return pts;
    let maxDistance = 0;
    let maxIndex = 0;
    const start = pts[0];
    const end = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) {
      const distance = perpendicularDistance(pts[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    if (maxDistance <= tolerance) return [start, end];
    const left = simplify(pts.slice(0, maxIndex + 1));
    const right = simplify(pts.slice(maxIndex));
    return left.slice(0, -1).concat(right);
  };

  return simplify(points);
}

/** JSON round-trip for undo stacks and (future) persistence. */
export function serializeOverlays(overlays: EditOverlay[]): string {
  return JSON.stringify(overlays);
}

export function deserializeOverlays(json: string): EditOverlay[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("Overlay data must be an array.");
  return parsed as EditOverlay[];
}
