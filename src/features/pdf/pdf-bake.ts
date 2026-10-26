/**
 * Bakes EditOverlays into a PDF with pdf-lib. Coordinate math comes from
 * lib/pdf-edit.ts; every overlay type maps to one draw primitive.
 */
import { hexToRgb, pctToPt, simplifyInk, type EditOverlay } from "@/lib/pdf-edit";
import { readFileBytes } from "./pdf-core";
import { bytesToBlob, suffixedName, type ResultFile } from "@/lib/utils";

interface PageBox {
  width: number;
  height: number;
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
  const imageCache = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  const pageBoxes: PageBox[] = doc.getPages().map((page) => {
    const { width, height } = page.getSize();
    return { width, height };
  });

  for (const overlay of overlays) {
    const box = pageBoxes[overlay.page] ?? { width: 595.28, height: 841.89 };
    const page = doc.getPage(overlay.page);

    if (overlay.type === "text") {
      const font = overlay.bold ? bold : regular;
      const { x, y } = pctToPt(overlay.xPct, overlay.yPct, box);
      const maxWidth = (overlay.widthPct / 100) * box.width;
      const lines = wrapWithFont(overlay.text, maxWidth, (line) =>
        font.widthOfTextAtSize(line, overlay.fontSizePt),
      );
      const lineHeight = overlay.fontSizePt * 1.25;
      // Text draws upward from its baseline; the click point is the box TOP.
      let cursorY = y - overlay.fontSizePt;
      for (const line of lines) {
        page.drawText(line, {
          x,
          y: cursorY,
          size: overlay.fontSizePt,
          font,
          color: rgb(hexToRgb(overlay.color).r, hexToRgb(overlay.color).g, hexToRgb(overlay.color).b),
        });
        cursorY -= lineHeight;
      }
    } else if (overlay.type === "highlight") {
      const start = pctToPt(overlay.xPct, overlay.yPct, box);
      page.drawRectangle({
        x: start.x,
        y: start.y - (overlay.heightPct / 100) * box.height,
        width: (overlay.widthPct / 100) * box.width,
        height: (overlay.heightPct / 100) * box.height,
        color: rgb(1, 0.92, 0.45),
        opacity: 0.45,
      });
    } else if (overlay.type === "whiteout") {
      const start = pctToPt(overlay.xPct, overlay.yPct, box);
      page.drawRectangle({
        x: start.x,
        y: start.y - (overlay.heightPct / 100) * box.height,
        width: (overlay.widthPct / 100) * box.width,
        height: (overlay.heightPct / 100) * box.height,
        color: rgb(1, 1, 1),
      });
    } else if (overlay.type === "ink") {
      const points = simplifyInk(overlay.points, 0.2);
      const color = hexToRgb(overlay.color);
      for (let i = 1; i < points.length; i++) {
        const from = pctToPt(points[i - 1].xPct, points[i - 1].yPct, box);
        const to = pctToPt(points[i].xPct, points[i].yPct, box);
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
      const start = pctToPt(overlay.xPct, overlay.yPct, box);
      page.drawImage(embedded, {
        x: start.x,
        y: start.y - (overlay.heightPct / 100) * box.height,
        width: (overlay.widthPct / 100) * box.width,
        height: (overlay.heightPct / 100) * box.height,
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
