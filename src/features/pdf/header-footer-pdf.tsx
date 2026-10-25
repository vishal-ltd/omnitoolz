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
import { Checkbox, Field, RangeInput, TextInput } from "@/components/ui/form";
import { suffixedName } from "@/lib/utils";
import { loadPdf, savePdf } from "./pdf-core";

/**
 * Placeholders replaced per page: {page} {total} {date}
 * Supports ANSI (WinAnsi) characters only — non-Latin text is transliterated
 * by the user's own input method; the standard font can't draw other scripts.
 */
function fillTemplate(template: string, pageNumber: number, total: number): string {
  const today = new Date().toLocaleDateString();
  return template
    .replaceAll("{page}", String(pageNumber))
    .replaceAll("{total}", String(total))
    .replaceAll("{date}", today);
}

export default function HeaderFooterPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [headerLeft, setHeaderLeft] = useState("");
  const [headerCenter, setHeaderCenter] = useState("");
  const [headerRight, setHeaderRight] = useState("");
  const [footerLeft, setFooterLeft] = useState("");
  const [footerCenter, setFooterCenter] = useState("");
  const [footerRight, setFooterRight] = useState("");
  const [fontSize, setFontSize] = useState(10);
  const [skipFirst, setSkipFirst] = useState(false);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  async function apply() {
    const source = file!;
    await start(async ({ report }) => {
      const { StandardFonts, rgb } = await import("pdf-lib");
      const doc = await loadPdf(source);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const total = doc.getPageCount();
      const margin = 30;

      report(`Stamping ${total} ${total === 1 ? "page" : "pages"}…`, 0.7);
      doc.getPages().forEach((page, index) => {
        if (skipFirst && index === 0) return;
        const { width, height } = page.getSize();
        const pageNumber = index + 1;
        const lines: Array<[string, "left" | "center" | "right", "top" | "bottom"]> = [
          [headerLeft, "left", "top"], [headerCenter, "center", "top"], [headerRight, "right", "top"],
          [footerLeft, "left", "bottom"], [footerCenter, "center", "bottom"], [footerRight, "right", "bottom"],
        ];
        for (const [template, align, edge] of lines) {
          const text = fillTemplate(template, pageNumber, total);
          if (!text) continue;
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          const x = align === "left" ? margin : align === "right" ? width - margin - textWidth : (width - textWidth) / 2;
          const y = edge === "top" ? height - margin - fontSize : margin;
          page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.34) });
        }
      });
      return [await savePdf(doc, suffixedName(source.name, "-headers"))];
    }, "Adding header & footer…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          onReset={() => {
            queue.clear();
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {file && (
            <OptionsPanel title="Header & footer text">
              <Field label="Header — left" hint="e.g. Quarterly report">
                <TextInput value={headerLeft} onChange={(e) => setHeaderLeft(e.target.value)} aria-label="Header left" />
              </Field>
              <Field label="Header — center">
                <TextInput value={headerCenter} onChange={(e) => setHeaderCenter(e.target.value)} aria-label="Header center" />
              </Field>
              <Field label="Header — right" hint="e.g. {date}">
                <TextInput value={headerRight} onChange={(e) => setHeaderRight(e.target.value)} aria-label="Header right" />
              </Field>
              <Field label="Footer — left">
                <TextInput value={footerLeft} onChange={(e) => setFooterLeft(e.target.value)} aria-label="Footer left" />
              </Field>
              <Field label="Footer — center" hint="e.g. Page {page} of {total}">
                <TextInput value={footerCenter} onChange={(e) => setFooterCenter(e.target.value)} aria-label="Footer center" />
              </Field>
              <Field label="Footer — right">
                <TextInput value={footerRight} onChange={(e) => setFooterRight(e.target.value)} aria-label="Footer right" />
              </Field>
              <Field label={`Font size — ${fontSize} pt`}>
                <RangeInput value={fontSize} min={7} max={18} onChange={setFontSize} suffix="pt" />
              </Field>
              <div className="flex items-end">
                <Checkbox checked={skipFirst} onChange={setSkipFirst} label="Skip the first page" />
              </div>
              <p className="text-sm text-ink-soft sm:col-span-2">
                Placeholders: <code>{"{page}"}</code> page number · <code>{"{total}"}</code> page count · <code>{"{date}"}</code> today.
              </p>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Leave a field empty to keep that corner clean.</p>
            <Button
              size="lg"
              disabled={!file}
              onClick={apply}
            >
              Add Header &amp; Footer
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
