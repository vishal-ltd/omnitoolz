/**
 * Edit-PDF overlay model + geometry — pure, DOM-free, unit-testable.
 * Overlays are stored in page-relative percentages so the editor is
 * zoom-independent and baking converts to PDF points deterministically.
 */

import type { PdfTextItem } from "./pdf-text-items";

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
  /** Fill for shape boxes (whiteout); defaults to white. */
  fill?: string;
}

export interface ImageOverlay extends BaseOverlay {
  type: "image";
  widthPct: number;
  heightPct: number;
  /** PNG data URL of the placed image. */
  dataUrl: string;
}

/** Replacement font for an existing-text edit ("original" = closest match). */
export type FontChoice = "original" | "helvetica" | "times" | "courier";

/**
 * An edit of EXISTING page text: the original run is covered with a white
 * box and the replacement is drawn at the captured baseline. Geometry lives
 * twice on purpose — % for the zoom-independent DOM editor, user-space points
 * (captured from pdf.js) so baking lands exactly on the original glyphs.
 */
export interface EditTextOverlay extends BaseOverlay {
  type: "edit";
  /** Display box (% of page, top-left origin) around the replaced run. */
  widthPct: number;
  heightPct: number;
  /** Baseline y as % (top-left origin) — the live preview paints from here. */
  baselinePct: number;
  /** Original run geometry in PDF user space (points, y up). */
  userX: number;
  userY: number;
  userWidth: number;
  /** Ascender height above the baseline, in points (positive). */
  userAscent: number;
  /** Descender depth below the baseline, in points (positive). */
  userDescent: number;
  /** Replacement text + typography. */
  text: string;
  sizePt: number;
  fontFamily: FontChoice;
  bold: boolean;
  italic: boolean;
  color: string;
  /** Font name detected in the document, shown in the editor sheet. */
  fontLabel: string | null;
  /** The run being replaced — "no changes" checks compare against these. */
  originalText: string;
  originalSizePt: number;
}

export type EditOverlay =
  | TextOverlay
  | InkOverlay
  | RectOverlay
  | ImageOverlay
  | EditTextOverlay;

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

/** A page's CropBox in PDF user space (points, origin bottom-left, y up). */
export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How the editor displays a page: its CropBox plus the /Rotate applied. */
export interface PageView {
  cropBox: CropBox;
  rotate: number;
}

/** PDF /Rotate is a multiple of 90; normalize anything else defensively. */
function normalizeRotate(rotate: number): number {
  const r = ((Math.round(rotate) % 360) + 360) % 360;
  return r === 90 || r === 180 || r === 270 ? r : 0;
}

/** Size of the displayed (rotated CropBox) view — what the canvas shows. */
export function displaySize(cropBox: CropBox, rotate: number): PageSize {
  return normalizeRotate(rotate) % 180 === 0
    ? { width: cropBox.width, height: cropBox.height }
    : { width: cropBox.height, height: cropBox.width };
}

/**
 * Display-space % delta → user-space point delta. The per-rotation formulas
 * were derived empirically from pdf.js PageViewport.convertToPdfPoint corner
 * probes (asserted in pdf-edit.test.ts) so baking matches the rotated canvas.
 */
export function displayDeltaToUserSpace(
  dxPct: number,
  dyPct: number,
  cropBox: CropBox,
  rotate: number,
): { dx: number; dy: number } {
  const { width: w, height: h } = cropBox;
  // Quarter turns swap which DISPLAY axis drives which user axis; each user
  // axis still scales with its own CropBox dimension (probe-verified).
  switch (normalizeRotate(rotate)) {
    case 90:
      return { dx: (dyPct / 100) * w, dy: (dxPct / 100) * h };
    case 180:
      return { dx: -(dxPct / 100) * w, dy: (dyPct / 100) * h };
    case 270:
      return { dx: -(dyPct / 100) * w, dy: -(dxPct / 100) * h };
    default:
      return { dx: (dxPct / 100) * w, dy: -(dyPct / 100) * h };
  }
}

/**
 * Display percentages (top-left origin on the ROTATED CropBox view) → PDF
 * user space. Matches pdf.js viewport.convertToPdfPoint at all four corners
 * for rotations 0/90/180/270, including offset CropBoxes. With an unrotated
 * zero-origin CropBox this is exactly pctToPt.
 */
export function displayPctToUserSpace(
  xPct: number,
  yPct: number,
  cropBox: CropBox,
  rotate: number,
): { x: number; y: number } {
  const rot = normalizeRotate(rotate);
  const { x, y, width, height } = cropBox;
  // User-space point under the display top-left corner, per rotation.
  const origin =
    rot === 90
      ? { x, y }
      : rot === 180
        ? { x: x + width, y }
        : rot === 270
          ? { x: x + width, y: y + height }
          : { x, y: y + height };
  const d = displayDeltaToUserSpace(xPct, yPct, cropBox, rot);
  return { x: origin.x + d.dx, y: origin.y + d.dy };
}

/** Inverse of displayPctToUserSpace: user space → display percentages. */
export function userSpaceToDisplayPct(
  x: number,
  y: number,
  cropBox: CropBox,
  rotate: number,
): { xPct: number; yPct: number } {
  const { x: cx, y: cy, width, height } = cropBox;
  switch (normalizeRotate(rotate)) {
    case 90:
      return { xPct: ((y - cy) / height) * 100, yPct: ((x - cx) / width) * 100 };
    case 180:
      return { xPct: ((cx + width - x) / width) * 100, yPct: ((y - cy) / height) * 100 };
    case 270:
      return { xPct: ((cy + height - y) / height) * 100, yPct: ((cx + width - x) / width) * 100 };
    default:
      return { xPct: ((x - cx) / width) * 100, yPct: ((cy + height - y) / height) * 100 };
  }
}

/**
 * A display-space rectangle → the axis-aligned user-space rectangle pdf-lib
 * draws. Quarter turns swap the axes; the anchor corner flips accordingly.
 * Unrotated zero-origin CropBox reproduces the legacy pctToPt rect exactly.
 */
export function displayRectToUserSpace(
  xPct: number,
  yPct: number,
  widthPct: number,
  heightPct: number,
  cropBox: CropBox,
  rotate: number,
): { x: number; y: number; width: number; height: number } {
  const rot = normalizeRotate(rotate);
  const display = displaySize(cropBox, rot);
  const swap = rot % 180 !== 0;
  // Display extents first, then swap axes on quarter turns.
  const displayWidth = (widthPct / 100) * display.width;
  const displayHeight = (heightPct / 100) * display.height;
  const width = swap ? displayHeight : displayWidth;
  const height = swap ? displayWidth : displayHeight;
  const corner = displayPctToUserSpace(xPct, yPct, cropBox, rot);
  return {
    x: rot === 180 || rot === 270 ? corner.x - width : corner.x,
    y: rot === 0 || rot === 270 ? corner.y - height : corner.y,
    width,
    height,
  };
}

/**
 * Aspect-preserving image stamp size in display percentages. `imageAspect`
 * is the image's natural height/width; the display aspect (dw/dh) converts
 * it so the stamp is never force-stretched. Scaled to fit ≤90% of the page,
 * then floored at 1% per axis for pathological aspects.
 */
export function imageStampSize(
  imageAspect: number,
  display: PageSize,
  widthPct = 25,
): { widthPct: number; heightPct: number } {
  const aspect = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 1;
  const ratio = aspect * (display.width / display.height);
  let w = widthPct;
  let h = w * ratio;
  const fit = Math.min(1, 90 / w, 90 / h);
  w *= fit;
  h *= fit;
  return { widthPct: Math.max(1, w), heightPct: Math.max(1, h) };
}

/**
 * Build an existing-text edit overlay from a detected run (see
 * pdf-text-items.ts). The display box wraps the run's ascent→descent band,
 * mapped through the page's display transform so the DOM preview lands on
 * the glyphs even on rotated / offset-CropBox pages. User-space fields stay
 * exact — baking draws against them directly.
 */
export function editTextOverlayFromItem(
  item: Pick<PdfTextItem, "str" | "x" | "y" | "width" | "fontSize" | "ascent" | "descent" | "fontLabel">,
  pageIndex: number,
  view: PageView,
): EditTextOverlay {
  const { cropBox, rotate } = view;
  const topPt = item.y + item.ascent * item.fontSize;
  const bottomPt = item.y + item.descent * item.fontSize;
  const topCorner = userSpaceToDisplayPct(item.x, topPt, cropBox, rotate);
  const bottomCorner = userSpaceToDisplayPct(item.x + item.width, bottomPt, cropBox, rotate);
  const baseline = userSpaceToDisplayPct(item.x, item.y, cropBox, rotate);
  return {
    type: "edit",
    page: pageIndex,
    xPct: Math.min(topCorner.xPct, bottomCorner.xPct),
    yPct: Math.min(topCorner.yPct, bottomCorner.yPct),
    widthPct: Math.abs(bottomCorner.xPct - topCorner.xPct),
    heightPct: Math.abs(bottomCorner.yPct - topCorner.yPct),
    baselinePct: baseline.yPct,
    userX: item.x,
    userY: item.y,
    userWidth: item.width,
    userAscent: item.ascent * item.fontSize,
    userDescent: -item.descent * item.fontSize,
    text: item.str,
    sizePt: item.fontSize,
    fontFamily: "original",
    bold: false,
    italic: false,
    color: "#000000",
    fontLabel: item.fontLabel,
    originalText: item.str,
    originalSizePt: item.fontSize,
  };
}

/**
 * Whether an existing-text edit actually changes anything — untouched edits
 * are discarded on Done instead of needlessly redrawing the page.
 */
export function editOverlayChanged(overlay: {
  text: string;
  originalText: string;
  sizePt: number;
  originalSizePt: number;
  fontFamily: FontChoice;
  bold: boolean;
  italic: boolean;
  color: string;
}): boolean {
  return (
    overlay.text !== overlay.originalText ||
    overlay.sizePt !== overlay.originalSizePt ||
    overlay.fontFamily !== "original" ||
    overlay.bold ||
    overlay.italic ||
    overlay.color.toLowerCase() !== "#000000"
  );
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

/** JSON serialization for the undo/redo stacks. */
export function serializeOverlays(overlays: EditOverlay[]): string {
  return JSON.stringify(overlays);
}
