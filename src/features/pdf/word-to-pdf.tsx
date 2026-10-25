"use client";

import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { baseName, bytesToBlob, type ResultFile } from "@/lib/utils";
import { FONT_SIZES, PAGE, sanitize, wrapLine, type Block, type StyledRun } from "./convert-core";

type MammothModule = {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
};

/** Parse the (small, predictable) HTML subset mammoth emits into layout blocks. */
function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: Block[] = [];
  const walk = (element: Element, inherited: StyledRun): void => {
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = sanitize(node.textContent ?? "").replace(/\s+/g, " ");
        if (text.trim()) blocks.push({ type: "paragraph", runs: [{ ...inherited, text }] });
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        blocks.push({
          type: "heading",
          level: Math.min(3, Number(tag.slice(1))),
          runs: [{ text: sanitize(el.textContent ?? "") }],
        });
      } else if (tag === "li") {
        blocks.push({ type: "list-item", runs: [{ text: sanitize(el.textContent ?? "") }] });
      } else if (tag === "p" || tag === "blockquote") {
        blocks.push({ type: "paragraph", runs: [{ text: sanitize(el.textContent ?? "") }] });
      } else if (tag === "table") {
        // Flatten table rows into tab-ish lines — text-focused output.
        for (const row of el.querySelectorAll("tr")) {
          const cells = [...row.querySelectorAll("td,th")].map((cell) => sanitize(cell.textContent ?? "").trim());
          blocks.push({ type: "paragraph", runs: [{ text: cells.join("   |   ") }] });
        }
      } else {
        // Inline containers (strong/em/span/ol/ul/div…) — recurse with style.
        const bold = tag === "strong" || tag === "b" || inherited.bold;
        const italic = tag === "em" || tag === "i" || inherited.italic;
        const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim());
        if (hasText) {
          blocks.push({ type: "paragraph", runs: [{ text: sanitize(el.textContent ?? ""), bold, italic }] });
        } else {
          walk(el, { text: "", bold, italic });
        }
      }
    }
  };
  walk(doc.body, { text: "" });
  // Merge consecutive paragraphs of a single run each into flowing text blocks.
  const merged: Block[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if (
      block.type === "paragraph" &&
      last?.type === "paragraph" &&
      !last.runs[0].bold &&
      !block.runs[0].bold
    ) {
      last.runs[0].text += ` ${block.runs[0].text}`;
    } else {
      merged.push(block);
    }
  }
  return merged;
}

export default function WordToPdfTool() {
  const queue = useFileQueue({ accept: ["docx"], multiple: true, maxFiles: 5, maxSizeMb: 30 });
  const { state, start, reset } = useJob();

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  async function convert() {
    const sources = queue.files;
    await start(async ({ report }) => {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const results: ResultFile[] = [];
      for (const [fileIndex, source] of sources.entries()) {
        report(`Reading “${source.name}”…`, (fileIndex + 0.1) / sources.length);
        const mammoth = (await import("mammoth")) as unknown as MammothModule;
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await source.arrayBuffer() });
        const blocks = htmlToBlocks(html);
        if (blocks.length === 0) throw new Error(`“${source.name}” contains no readable text.`);

        const doc = await PDFDocument.create();
        const regular = await doc.embedFont(StandardFonts.TimesRoman);
        const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
        const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
        const boldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
        const contentWidth = PAGE.width - PAGE.margin * 2;
        let page = doc.addPage([PAGE.width, PAGE.height]);
        let y = PAGE.height - PAGE.margin;
        const total = blocks.length || 1;

        const newPage = () => {
          page = doc.addPage([PAGE.width, PAGE.height]);
          y = PAGE.height - PAGE.margin;
        };

        blocks.forEach((block, blockIndex) => {
          const isHeading = block.type === "heading";
          const level = Math.min(3, block.level ?? 3);
          const size = isHeading ? FONT_SIZES.heading[level - 1] : FONT_SIZES.body;
          const prefix = block.type === "list-item" ? "• " : "";
          const text = (prefix + block.runs.map((run) => run.text).join("")).trim();
          if (!text) return;

          const font =
            block.runs[0].bold && block.runs[0].italic ? boldItalic
              : block.runs[0].bold ? bold
                : block.runs[0].italic ? italic
                  : regular;

          const lines = wrapLine(text, contentWidth, (t, s) => font.widthOfTextAtSize(t, s), size);
          for (const line of lines) {
            if (y < PAGE.margin + size * 2) newPage();
            page.drawText(line, {
              x: PAGE.margin,
              y: y - size,
              size,
              font,
              color: rgb(0.12, 0.13, 0.18),
            });
            y -= size + FONT_SIZES.lineGap;
          }
          // Extra breathing room after headings and paragraphs.
          y -= isHeading ? size * 0.6 : 4;
          report(`Laying out page ${doc.getPageCount()}…`, (fileIndex + (blockIndex + 1) / total * 0.85) / sources.length);
        });

        const bytes = await doc.save();
        results.push({ name: `${baseName(source.name)}.pdf`, blob: bytesToBlob(bytes, "application/pdf") });
      }
      return results;
    }, "Reading the document…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "docs")}-pdf`}
          note="Text-focused conversion: headings, paragraphs, lists and tables re-layout as clean PDF text."
          onReset={() => {
            queue.clear();
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["docx"]} multiple maxFiles={5} maxSizeMb={30} onFiles={queue.addFiles} existingCount={queue.files.length} hint=".docx (Word 2007+) — .doc is not supported" />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="border-[3px] border-warn bg-warn-soft p-3">
            <p className="text-sm text-ink">
              Honest limits: this re-lays out the document&apos;s <strong>text</strong> — headings,
              paragraphs, lists and simple tables. Complex layouts, images and exact formatting
              don&apos;t carry over. Everything runs locally; the conversion can&apos;t upload your
              document even if it wanted to.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Converted entirely on this device.</p>
            <Button size="lg" disabled={queue.files.length === 0} onClick={convert}>
              Convert to PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
