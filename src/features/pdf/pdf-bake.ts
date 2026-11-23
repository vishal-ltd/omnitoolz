/**
 * Bakes EditOverlays into a PDF with pdf-lib. Coordinate math comes from
 * lib/pdf-edit.ts; every overlay type maps to one draw primitive.
 */
import {
  displayPctToUserSpace,
  displayRectToUserSpace,
  displaySize,
  hexToRgb,
  simplifyInk,
  type CropBox,
  type EditOverlay,
  type EditTextOverlay,
} from "@/lib/pdf-edit";
import { readFileBytes } from "./pdf-core";
import { sanitize } from "./convert-core";
import { bytesToBlob, suffixedName, type ResultFile } from "@/lib/utils";
import type { PDFFont, PDFPage } from "pdf-lib";

interface PageViewInfo {
  cropBox: CropBox;
  rotate: number;
}

/** Standard 14 variants an existing-text replacement can draw with. */
function fontVariants(
  StandardFonts: typeof import("pdf-lib").StandardFonts,
): Record<EditTextOverlay["fontFamily"], Record<string, import("pdf-lib").StandardFonts>> {
  return {
    original: {
      r: StandardFonts.Helvetica,
      b: StandardFonts.HelveticaBold,
      i: StandardFonts.HelveticaOblique,
      bi: StandardFonts.HelveticaBoldOblique,
    },
    helvetica: {
      r: StandardFonts.Helvetica,
      b: StandardFonts.HelveticaBold,
      i: StandardFonts.HelveticaOblique,
      bi: StandardFonts.HelveticaBoldOblique,
    },
    times: {
      r: StandardFonts.TimesRoman,
      b: StandardFonts.TimesRomanBold,
      i: StandardFonts.TimesRomanItalic,
      bi: StandardFonts.TimesRomanBoldItalic,
    },
    courier: {
      r: StandardFonts.Courier,
      b: StandardFonts.CourierBold,
      i: StandardFonts.CourierOblique,
      bi: StandardFonts.CourierBoldOblique,
    },
  };
}

async function standardFontFor(
  doc: import("pdf-lib").PDFDocument,
  overlay: EditTextOverlay,
  cache: Map<string, PDFFont>,
  variants: ReturnType<typeof fontVariants>,
): Promise<PDFFont> {
  const family = variants[overlay.fontFamily] ?? variants.original;
  const key = `${overlay.bold ? "b" : "r"}${overlay.italic ? "i" : ""}`;
  const standardFont = family[key] ?? family.r;
  let font = cache.get(standardFont);
  if (!font) {
    font = await doc.embedFont(standardFont);
    cache.set(standardFont, font);
  }
  return font;
}

/** drawText, tolerating characters outside the standard fonts' WinAnsi set. */
function drawTextSafe(page: PDFPage, text: string, options: Parameters<PDFPage["drawText"]>[1]) {
  try {
    page.drawText(text, options);
  } catch {
    // WinAnsi-safe fallback, not Latin-1: € ‘ ’ “ ” – — survive intact.
    page.drawText(sanitize(text), options);
  }
}

/** Wrap text within a box width using the real font metrics. */
function wrapWithFont(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) current = candidate;
      else {
        if (current) lines.push(current);
        current = word;
        // Over-long word: hard-break instead of overflowing the box.
        while (measure(current) > maxWidth && current.length > 1) {
          let cut = current.length - 1;
          while (cut > 1 && measure(current.slice(0, cut)) > maxWidth) cut--;
          lines.push(current.slice(0, cut));
          current = current.slice(cut);
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/**
 * Apply all overlays onto a fresh copy of the source PDF and save.
 * Overlays may target any page; each is positioned on its own page.
 */
export async function bakeOverlays(
  source: File,
  overlays: EditOverlay[],
): Promise<ResultFile> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.load(await readFileBytes(source), {
    updateMetadata: false,
  });
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontCache = new Map<string, PDFFont>();
  const imageCache = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  // Overlays are stored against the DISPLAYED view (rotated CropBox), not
  // getSize()'s unrotated MediaBox — map through the same transform pdf.js
  // renders with, or every overlay shifts on rotated / offset-CropBox pages.
  const pageViews: PageViewInfo[] = doc.getPages().map((page) => {
    const cb = page.getCropBox();
    return {
      cropBox: { x: cb.x, y: cb.y, width: cb.width, height: cb.height },
      rotate: page.getRotation().angle,
    };
  });

  for (const overlay of overlays) {
    const view = pageViews[overlay.page] ?? {
      cropBox: { x: 0, y: 0, width: 595.28, height: 841.89 },
      rotate: 0,
    };
    const page = doc.getPage(overlay.page);

    if (overlay.type === "text") {
      const font = overlay.bold ? bold : regular;
      const { x, y } = displayPctToUserSpace(overlay.xPct, overlay.yPct, view.cropBox, view.rotate);
      const maxWidth = (overlay.widthPct / 100) * displaySize(view.cropBox, view.rotate).width;
      const lines = wrapWithFont(overlay.text, maxWidth, (line) =>
        font.widthOfTextAtSize(line, overlay.fontSizePt),
      );
      const lineHeight = overlay.fontSizePt * 1.25;
      // Text draws upward from its baseline; the click point is the box TOP.
      let cursorY = y - overlay.fontSizePt;
      for (const line of lines) {
        drawTextSafe(page, line, {
          x,
          y: cursorY,
          size: overlay.fontSizePt,
          font,
          color: rgb(hexToRgb(overlay.color).r, hexToRgb(overlay.color).g, hexToRgb(overlay.color).b),
        });
        cursorY -= lineHeight;
      }
    } else if (overlay.type === "edit") {
      // Replace existing text: cover the captured run, then draw the
      // replacement on the original baseline in the chosen typography.
      // userX/userY are already user-space (captured via the display
      // transform at detection time), so no % mapping is needed here.
      page.drawRectangle({
        x: overlay.userX - 1,
        y: overlay.userY - overlay.userDescent - 1,
        width: overlay.userWidth + 2,
        height: overlay.userAscent + overlay.userDescent + 2,
        color: rgb(1, 1, 1),
      });
      const font = await standardFontFor(doc, overlay, fontCache, fontVariants(StandardFonts));
      const color = hexToRgb(overlay.color);
      drawTextSafe(page, overlay.text, {
        x: overlay.userX,
        y: overlay.userY,
        size: overlay.sizePt,
        font,
        color: rgb(color.r, color.g, color.b),
      });
    } else if (overlay.type === "highlight") {
      const rect = displayRectToUserSpace(
        overlay.xPct, overlay.yPct, overlay.widthPct, overlay.heightPct, view.cropBox, view.rotate,
      );
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(1, 0.92, 0.45),
        opacity: 0.45,
      });
    } else if (overlay.type === "whiteout") {
      const rect = displayRectToUserSpace(
        overlay.xPct, overlay.yPct, overlay.widthPct, overlay.heightPct, view.cropBox, view.rotate,
      );
      const fill = overlay.fill ? hexToRgb(overlay.fill) : { r: 1, g: 1, b: 1 };
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(fill.r, fill.g, fill.b),
      });
    } else if (overlay.type === "ink") {
      const points = simplifyInk(overlay.points, 0.2);
      const color = hexToRgb(overlay.color);
      for (let i = 1; i < points.length; i++) {
        const from = displayPctToUserSpace(points[i - 1].xPct, points[i - 1].yPct, view.cropBox, view.rotate);
        const to = displayPctToUserSpace(points[i].xPct, points[i].yPct, view.cropBox, view.rotate);
        page.drawLine({
          start: from,
          end: to,
          thickness: overlay.widthPt,
          color: rgb(color.r, color.g, color.b),
        });
      }
    } else if (overlay.type === "image") {
      let embedded = imageCache.get(overlay.dataUrl);
      if (!embedded) {
        const bytes = dataUrlToBytes(overlay.dataUrl);
        embedded = await doc.embedPng(bytes);
        imageCache.set(overlay.dataUrl, embedded);
      }
      const rect = displayRectToUserSpace(
        overlay.xPct, overlay.yPct, overlay.widthPct, overlay.heightPct, view.cropBox, view.rotate,
      );
      page.drawImage(embedded, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
    }
  }

  const bytes = await doc.save();
  return {
    name: suffixedName(source.name, "-edited"),
    blob: bytesToBlob(bytes, "application/pdf"),
  };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
