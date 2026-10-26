/**
 * Existing-text detection for Edit PDF — pure, DOM-free, unit-testable.
 *
 * pdf.js `getTextContent` emits raw runs (words or fragments) with their
 * text matrix. Here those runs are merged into line-level targets — so a
 * tap grabs the whole email/URL, not a fragment — and hit-tested in PDF
 * user space (points, origin bottom-left, y up).
 */

export interface PdfTextItem {
  str: string;
  /** Baseline start x in user space (points). */
  x: number;
  /** Baseline y in user space (points). */
  y: number;
  /** Advance width in user-space units. */
  width: number;
  /** Font size in points. */
  fontSize: number;
  /** Ascender height as a ratio of font size (positive). */
  ascent: number;
  /** Descender depth as a ratio of font size (negative). */
  descent: number;
  /** Real font name detected in the document (e.g. "SourceSansPro-Regular"). */
  fontLabel: string | null;
}

/** Axis-aligned box in user space; y1 is the top edge. */
export interface TextBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Bounding box of a run, from its baseline + font metrics. */
export function textItemBox(item: PdfTextItem): TextBox {
  return {
    x0: item.x,
    x1: item.x + item.width,
    y0: item.y + item.descent * item.fontSize,
    y1: item.y + item.ascent * item.fontSize,
  };
}

/**
 * Merge runs that share a baseline into line-level targets. Runs are joined
 * when the gap between them is under one em (kerning/split fragments get no
 * space, visible word gaps get one); column and paragraph gaps are preserved
 * by keeping the pieces separate.
 */
export function mergeLineItems(items: PdfTextItem[]): PdfTextItem[] {
  if (items.length <= 1) return items.slice();

  const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);

  // Cluster by baseline: same line ⇒ baselines within ~1pt.
  const clusters: PdfTextItem[][] = [];
  for (const item of sorted) {
    const cluster = clusters[clusters.length - 1];
    const tolerance = Math.max(0.75, item.fontSize * 0.08);
    if (cluster && Math.abs(item.y - cluster[0].y) <= tolerance) {
      cluster.push(item);
    } else {
      clusters.push([item]);
    }
  }

  const merged: PdfTextItem[] = [];
  for (const cluster of clusters) {
    cluster.sort((a, b) => a.x - b.x);
    let current = cluster[0];
    for (let i = 1; i < cluster.length; i++) {
      const next = cluster[i];
      const gap = next.x - (current.x + current.width);
      const em = Math.max(current.fontSize, next.fontSize);
      if (gap > em * 1.2) {
        // Too far apart — a column break or separate cell.
        merged.push(current);
        current = next;
        continue;
      }
      current = {
        str: current.str + (gap > em * 0.25 ? " " : "") + next.str,
        x: current.x,
        y: current.y,
        width: next.x + next.width - current.x,
        fontSize: Math.max(current.fontSize, next.fontSize),
        ascent: Math.max(current.ascent, next.ascent),
        descent: Math.min(current.descent, next.descent),
        fontLabel: current.fontLabel ?? next.fontLabel,
      };
    }
    merged.push(current);
  }
  return merged;
}

/**
 * Find the line containing a user-space point. `padPt` widens the box
 * horizontally (fingers are imprecise); ties go to the baseline closest to
 * the point, then to the wider run.
 */
export function hitTestTextItem(
  items: PdfTextItem[],
  x: number,
  y: number,
  padPt = 2,
): PdfTextItem | null {
  let best: PdfTextItem | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const box = textItemBox(item);
    if (x < box.x0 - padPt || x > box.x1 + padPt) continue;
    if (y < box.y0 || y > box.y1) continue;
    const score = Math.abs(y - item.y) - item.width * 1e-6;
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}
