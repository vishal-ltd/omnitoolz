"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { baseName, type ResultFile } from "@/lib/utils";
import { loadPdfjs } from "./pdfjs";

export default function PdfToWordTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [paragraphCount, setParagraphCount] = useState<number | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  async function convert() {
    const source = file!;
    setParagraphCount(null);
    await start(async ({ report }) => {
      // 1) Extract text with paragraph-ish structure from pdf.js.
      const pdfjs = await loadPdfjs();
      const bytes = new Uint8Array(await source.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const pageTexts: string[][] = [];
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        report(`Reading page ${pageNumber} of ${doc.numPages}…`, (pageNumber / doc.numPages) * 0.8);
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        page.cleanup();
        // Reconstruct lines from positioned items, then group into paragraphs.
        const lines: Array<{ y: number; text: string }> = [];
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const y = Math.round((item.transform[5] ?? 0) / 2) * 2;
          const existing = lines.find((line) => Math.abs(line.y - y) <= 2);
          if (existing) existing.text += (existing.text.endsWith(" ") ? "" : " ") + item.str;
          else lines.push({ y, text: item.str });
        }
        lines.sort((a, b) => b.y - a.y);
        pageTexts.push(lines.map((line) => line.text.trim()));
      }
      await doc.destroy();

      // Paragraph heuristics: blank-ish gaps or short previous line end a paragraph.
      const paragraphs: string[] = [];
      let current = "";
      for (const lines of pageTexts) {
        for (const [index, line] of lines.entries()) {
          current = current ? `${current} ${line}` : line;
          const next = lines[index + 1];
          if (!next || line.length < 45 || /[:.!?"]$/.test(line)) {
            if (current.trim()) paragraphs.push(current.trim());
            current = "";
          }
        }
        if (current.trim()) {
          paragraphs.push(current.trim());
          current = "";
        }
      }
      if (paragraphs.length === 0) {
        throw new Error("No text found — scanned PDFs have no text layer. Run them through Image-to-Text (OCR) first.");
      }
      setParagraphCount(paragraphs.length);

      // 2) Build a .docx with the docx library (all local).
      const { Document, Packer, Paragraph, TextRun } = await import("docx");
      const document = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs.map(
              (text) =>
                new Paragraph({
                  children: [new TextRun({ text, size: 22, font: "Calibri" })],
                  spacing: { after: 160 },
                }),
            ),
          },
        ],
        styles: {
          default: {
            document: { run: { size: 22 } },
          },
        },
      });
      report("Writing the document…", 0.95);
      const blob = await Packer.toBlob(document);
      const result: ResultFile = { name: `${baseName(source.name)}.docx`, blob };
      return [result];
    }, "Reading the PDF…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          note={`${paragraphCount ?? "—"} paragraphs written — open in Word, Google Docs or LibreOffice.`}
          onReset={() => {
            queue.clear();
            setParagraphCount(null);
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="border-[3px] border-warn bg-warn-soft p-3">
            <p className="text-sm text-ink">
              Honest limits: the conversion carries the PDF&apos;s <strong>text</strong> as editable
              paragraphs — headings become plain paragraphs, images, columns and exact layout
              don&apos;t carry over. Everything runs locally.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Converted entirely on this device.</p>
            <Button size="lg" disabled={!file} onClick={convert}>
              Convert to Word
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
