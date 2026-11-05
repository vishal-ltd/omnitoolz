"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, RangeInput } from "@/components/ui/form";
import { baseName, bytesToBlob, type ResultFile } from "@/lib/utils";
import { PAGE, sanitize } from "./convert-core";
import { readSpreadsheet, type Cell } from "./spreadsheet";

/** Landscape pages fit spreadsheets far better than portrait. */
const LANDSCAPE = { width: PAGE.height, height: PAGE.width, margin: PAGE.margin };
const BASE_FONT = 9;

export default function ExcelToPdfTool() {
  const queue = useFileQueue({ accept: ["xlsx", "csv"], multiple: true, maxFiles: 5, maxSizeMb: 30 });
  const { state, start, reset, retry } = useJob();
  const [gridlines, setGridlines] = useState(true);
  const [scalePct, setScalePct] = useState(100);
  const [sheetSummary, setSheetSummary] = useState<string | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  async function convert() {
    const sources = queue.files;
    setSheetSummary(null);
    await start(async ({ report }) => {
       const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const results: ResultFile[] = [];

      for (const [fileIndex, source] of sources.entries()) {
        report(`Reading “${source.name}”…`, (fileIndex + 0.1) / sources.length);
        const sheets = await readSpreadsheet(source);
        const doc = await PDFDocument.create();
        const regular = await doc.embedFont(StandardFonts.Courier);
        const bold = await doc.embedFont(StandardFonts.CourierBold);
        const contentWidth = LANDSCAPE.width - LANDSCAPE.margin * 2;
        let y = 0;

        for (const [sheetIndex, sheet] of sheets.entries()) {
          const sheetName = sheet.name;
          const rows = sheet.rows.map((row) => row.map((cell: Cell) => sanitize(String(cell ?? ""))));
          if (rows.length === 0) continue;

          report(`Laying out “${sheetName}”…`, (fileIndex + (sheetIndex + 1) / sheets.length * 0.85) / sources.length);
          const columnCount = Math.max(...rows.map((row) => row.length), 1);
          // Fixed-mono layout: every column equal width, scaled to fit.
          const columnWidth = contentWidth / columnCount;
          const font = (boldFlag: boolean) => (boldFlag ? bold : regular);
          const size = Math.max(4, Math.min(BASE_FONT * (scalePct / 100), (columnWidth / 6)));

          const drawRow = (row: Cell[], header: boolean, rowIndex: number) => {
            const lineHeight = size + 2;
            if (y < LANDSCAPE.margin + lineHeight) {
              doc.addPage([LANDSCAPE.width, LANDSCAPE.height]);
              y = LANDSCAPE.height - LANDSCAPE.margin;
            }
            const page = doc.getPage(doc.getPageCount() - 1);
            if (header && gridlines) {
              page.drawRectangle({
                x: LANDSCAPE.margin - 2,
                y: y - lineHeight,
                width: contentWidth + 4,
                height: lineHeight,
                color: rgb(0.92, 0.92, 0.95),
              });
            }
            for (let c = 0; c < columnCount; c++) {
              const value = String(row[c] ?? "").slice(0, Math.floor(columnWidth / (size * 0.6)));
              if (!value) continue;
              page.drawText(value, {
                x: LANDSCAPE.margin + c * columnWidth,
                y: y - size,
                size,
                font: font(header),
                color: rgb(0.12, 0.13, 0.18),
              });
            }
            if (gridlines) {
              page.drawLine({
                start: { x: LANDSCAPE.margin, y: y - lineHeight },
                end: { x: LANDSCAPE.width - LANDSCAPE.margin, y: y - lineHeight },
                thickness: 0.5,
                color: rgb(0.75, 0.75, 0.8),
              });
            }
            y -= lineHeight;
            void rowIndex;
          };

          // Sheet header block
          if (y < LANDSCAPE.margin + size * 4) {
            doc.addPage([LANDSCAPE.width, LANDSCAPE.height]);
            y = LANDSCAPE.height - LANDSCAPE.margin;
          }
          const titlePage = doc.getPage(doc.getPageCount() - 1);
          titlePage.drawText(`${source.name} — ${sheetName}`, {
            x: LANDSCAPE.margin,
            y: y - 12,
            size: 12,
            font: bold,
            color: rgb(0.36, 0.33, 0.91),
          });
          y -= 20;

          rows.forEach((row, rowIndex) => drawRow(row, rowIndex === 0, rowIndex));
          y -= 14;
        }

        const bytes = await doc.save();
        results.push({ name: `${baseName(source.name)}.pdf`, blob: bytesToBlob(bytes, "application/pdf") });
        setSheetSummary(`${sheets.length} sheet(s) rendered`);
      }
      return results;
    }, "Reading the spreadsheet…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "sheets")}-pdf`}
          note={`${sheetSummary ?? "Sheets rendered"} as monospace text grids on landscape pages.`}
          onReset={() => {
            queue.clear();
            setSheetSummary(null);
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
           <FileDropZone accept={["xlsx", "csv"]} multiple maxFiles={5} maxSizeMb={30} onFiles={queue.addFiles} existingCount={queue.files.length} hint="xlsx · csv" />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {queue.files.length > 0 && (
            <OptionsPanel title="Layout">
              <Field label={`Scale — ${scalePct}%`}>
                <RangeInput value={scalePct} min={60} max={140} onChange={setScalePct} suffix="%" />
              </Field>
              <div className="flex items-end">
                <Checkbox checked={gridlines} onChange={setGridlines} label="Gridlines + header shading" />
              </div>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError error={state.error} detail={state.errorDetail} kind={state.errorKind} onRetry={retry} onDismiss={reset} />}

          <div className="border-[3px] border-warn bg-warn-soft p-3">
            <p className="text-sm text-ink">
              Honest limits: every sheet prints as a clean <strong>text grid</strong> on landscape
              pages — all values, no charts, colors, merged-cell layouts or formulas. Everything
              runs locally.
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
