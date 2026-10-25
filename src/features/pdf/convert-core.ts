/**
 * Shared layout helpers for document conversions (docx/xlsx → PDF).
 * Text-focused re-layout into pdf-lib pages — not pixel-perfect, and the
 * tools say so up front.
 */

export interface StyledRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export interface Block {
  type: "heading" | "paragraph" | "list-item";
  level?: number;
  runs: StyledRun[];
}

/** Page geometry: A4 with 56pt (≈2cm) margins. */
export const PAGE = { width: 595.28, height: 841.89, margin: 56 };

export const FONT_SIZES = {
  heading: [22, 16, 13] as const,
  body: 11,
  lineGap: 5,
};

/** Escape WinAnsi-unfriendly characters; standard fonts can't draw them. */
export function sanitize(text: string): string {
  return text
    .replace(/₹/g, "Rs.")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2010\u2011\u2012\u2015]/g, "-");
}

export function wrapLine(
  text: string,
  maxWidth: number,
  measure: (text: string, size: number) => number,
  size: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      while (measure(current, size) > maxWidth && current.length > 1) {
        // Very long word — hard-break it.
        let cut = current.length - 1;
        while (cut > 1 && measure(current.slice(0, cut), size) > maxWidth) cut--;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}
