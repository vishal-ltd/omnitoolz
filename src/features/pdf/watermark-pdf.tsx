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
import { Checkbox, Field, RangeInput, Select, TextInput } from "@/components/ui/form";
import { baseName, suffixedName, type ResultFile } from "@/lib/utils";
import { loadPdf, savePdf, yieldToUi } from "./pdf-core";

type Position = "center" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
type ColorKey = "gray" | "red" | "brand" | "black";

const COLORS: Record<ColorKey, [number, number, number]> = {
  gray: [0.45, 0.45, 0.5],
  red: [0.78, 0.16, 0.16],
  brand: [0.36, 0.33, 0.91],
  black: [0.1, 0.1, 0.12],
};

export default function WatermarkPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: true, maxFiles: 20, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [text, setText] = useState("DRAFT");
  const [position, setPosition] = useState<Position>("center");
  const [size, setSize] = useState(48);
  const [color, setColor] = useState<ColorKey>("gray");
  const [opacity, setOpacity] = useState(25);
  const [diagonal, setDiagonal] = useState(true);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  async function apply() {
    const sources = queue.files;
    await start(async ({ report }) => {
      const { StandardFonts, degrees, rgb } = await import("pdf-lib");
      const results: ResultFile[] = [];
      for (const [fileIndex, source] of sources.entries()) {
        report(`Stamping “${source.name}”…`, (fileIndex + 0.2) / sources.length);
        const doc = await loadPdf(source);
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const stamp = text.trim() || "WATERMARK";
        for (const page of doc.getPages()) {
          const { width, height } = page.getSize();
          const textWidth = font.widthOfTextAtSize(stamp, size);
          const x = position.endsWith("left")
            ? 36
            : position.endsWith("right")
              ? width - 36 - textWidth
              : (width - textWidth) / 2;
          const y = position.startsWith("top")
            ? height - 48 - size
            : position.startsWith("bottom")
              ? 48
              : (height - size) / 2;
          const [r, g, b] = COLORS[color];
          page.drawText(stamp, {
            x,
            y,
            size,
            font,
            color: rgb(r, g, b),
            opacity: opacity / 100,
            ...(diagonal
              ? { rotate: degrees(-30), x: (width - textWidth * 0.87) / 2, y: (height - size) / 2.6 }
              : {}),
          });
        }
        await yieldToUi();
        results.push(await savePdf(doc, suffixedName(source.name, "-watermarked")));
      }
      return results;
    }, "Stamping pages…");
  }

  const disabled = state.phase !== "idle" && state.phase !== "error";

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={baseName(queue.files[0]?.name ?? "pdfs")}
          onReset={() => {
            queue.clear();
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple maxFiles={20} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {queue.files.length > 0 && (
            <OptionsPanel title="Watermark">
              <Field label="Text" className="sm:col-span-2">
                <TextInput
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="DRAFT"
                  aria-label="Watermark text"
                />
              </Field>
              <Field label="Position">
                <Select
                  value={position}
                  onChange={(event) => setPosition(event.target.value as Position)}
                  aria-label="Watermark position"
                >
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="top-left">Top left</option>
                  <option value="top-right">Top right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="bottom-right">Bottom right</option>
                </Select>
              </Field>
              <Field label="Color">
                <Select
                  value={color}
                  onChange={(event) => setColor(event.target.value as ColorKey)}
                  aria-label="Watermark color"
                >
                  <option value="gray">Gray</option>
                  <option value="red">Red</option>
                  <option value="brand">Violet</option>
                  <option value="black">Black</option>
                </Select>
              </Field>
              <Field label={`Font size — ${size} pt`}>
                <RangeInput value={size} min={16} max={120} onChange={setSize} suffix="pt" />
              </Field>
              <Field label={`Opacity — ${opacity}%`}>
                <RangeInput value={opacity} min={5} max={100} onChange={setOpacity} suffix="%" />
              </Field>
              <div className="sm:col-span-2">
                <Checkbox checked={diagonal} onChange={setDiagonal} label="Diagonal stamp (overrides position)" />
              </div>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">The watermark is drawn into every page — up to 20 files per run.</p>
            <Button size="lg" disabled={disabled || queue.files.length === 0} onClick={apply}>
              Add Watermark
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
