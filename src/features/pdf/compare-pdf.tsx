"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, ToolWidget } from "@/components/tools/job-ui";
import { JobProgress } from "@/components/tools/job-ui";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { loadPdfjs } from "./pdfjs";

interface CompareReport {
  aName: string;
  bName: string;
  aSize: number;
  bSize: number;
  aPages: number;
  bPages: number;
  aTitle: string;
  bTitle: string;
  aAuthor: string;
  bAuthor: string;
  samePageCount: boolean;
  differingPages: number[];
  textPagesCompared: number;
}

function djb2Hash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

async function pageTextHashes(file: File): Promise<string[]> {
  const pdfjs = await loadPdfjs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const hashes: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    page.cleanup();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    hashes.push(djb2Hash(text));
  }
  await doc.destroy();
  return hashes;
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  const differs = a !== b;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5">
      <span className={`break-words font-body text-lg ${differs ? "text-ink" : "text-ink-soft"}`}>{a}</span>
      <span className="font-display text-[8px] text-ink-soft uppercase">{label}</span>
      <span className={`break-words text-right font-body text-lg ${differs ? "text-ink" : "text-ink-soft"}`}>{b}</span>
    </div>
  );
}

export default function ComparePdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: true, maxFiles: 2, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [report, setReport] = useState<CompareReport | null>(null);

  const [a, b] = queue.files;

  async function compare() {
    await start(async ({ report: progress }) => {
      progress("Reading both documents…", 0.3);
      const [aHashes, bHashes] = await Promise.all([pageTextHashes(a!), pageTextHashes(b!)]);

      const { PDFDocument } = await import("pdf-lib");
      const info = await Promise.all(
        [a!, b!].map(async (file) => {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const doc = await PDFDocument.load(bytes, { updateMetadata: false });
          return {
            title: doc.getTitle() ?? "—",
            author: doc.getAuthor() ?? "—",
          };
        }),
      );

      const length = Math.max(aHashes.length, bHashes.length);
      const differingPages: number[] = [];
      for (let i = 0; i < length; i++) {
        if (aHashes[i] !== bHashes[i]) differingPages.push(i + 1);
      }

      const result: CompareReport = {
        aName: a!.name,
        bName: b!.name,
        aSize: a!.size,
        bSize: b!.size,
        aPages: aHashes.length,
        bPages: bHashes.length,
        aTitle: info[0].title,
        bTitle: info[1].title,
        aAuthor: info[0].author,
        bAuthor: info[1].author,
        samePageCount: aHashes.length === bHashes.length,
        differingPages,
        textPagesCompared: Math.min(aHashes.length, bHashes.length),
      };
      setReport(result);
      return [];
    }, "Comparing documents…");
  }

  const differentCount = report?.differingPages.length ?? 0;
  const shownDiffs = report ? report.differingPages.slice(0, 60) : [];

  return (
    <ToolWidget>
      {state.phase === "running" ? (
        <JobProgress state={state} />
      ) : state.phase === "error" ? (
        <div className="space-y-4">
          <JobError message={state.error ?? ""} />
          <Button variant="secondary" onClick={() => { queue.clear(); reset(); }}>
            Start over
          </Button>
        </div>
      ) : report ? (
        <div className="animate-pixel-in space-y-4">
          <div
            className={`border-[3px] p-4 shadow-[4px_4px_0_0_var(--color-shadow)] ${
              differentCount === 0 && report.samePageCount
                ? "border-ok bg-ok-soft"
                : "border-warn bg-warn-soft"
            }`}
            role="status"
          >
            <p className="font-display text-[10px] uppercase">
              {differentCount === 0 && report.samePageCount
                ? "Text-wise identical"
                : `${differentCount} ${differentCount === 1 ? "page differs" : "pages differ"}`}
            </p>
            <p className="mt-2 font-body text-lg text-ink-soft">
              {differentCount === 0 && report.samePageCount
                ? "Every page's text matches between the two files."
                : report.samePageCount
                  ? `Of ${report.aPages} pages, ${differentCount} ${differentCount === 1 ? "page has" : "pages have"} different text.`
                  : `Page counts differ (${report.aPages} vs ${report.bPages}); ${report.textPagesCompared} pages could be compared text-wise.`}
            </p>
          </div>

          <div className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
            <Row label="File" a={`${report.aName} · ${formatBytes(report.aSize)}`} b={`${report.bName} · ${formatBytes(report.bSize)}`} />
            <Row label="Pages" a={String(report.aPages)} b={String(report.bPages)} />
            <Row label="Title" a={report.aTitle} b={report.bTitle} />
            <Row label="Author" a={report.aAuthor} b={report.bAuthor} />
          </div>

          {differentCount > 0 && (
            <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
              <p className="font-display text-[9px] text-ink-soft uppercase">Pages with different text</p>
              <p className="mt-2 font-body text-lg text-ink">
                {shownDiffs.join(", ")}
                {differentCount > shownDiffs.length && ` … and ${differentCount - shownDiffs.length} more`}
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                Text-level comparison — image-only changes aren&apos;t detected.
              </p>
            </div>
          )}

          <Button variant="secondary" onClick={() => { queue.clear(); setReport(null); reset(); }}>
            Compare another pair
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 font-display text-[9px] text-ink-soft uppercase">1 · Original</p>
              <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
            </div>
            <div>
              <p className="mb-1.5 font-display text-[9px] text-ink-soft uppercase">2 · Revised</p>
              <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
            </div>
          </div>
          <FileList files={queue.files} onRemove={queue.removeAt} />

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Both files stay on your device the whole time.</p>
            <Button size="lg" disabled={!a || !b} onClick={compare}>
              Compare
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
