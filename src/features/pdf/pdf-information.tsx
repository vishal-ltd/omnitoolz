"use client";

import Link from "next/link";

import { useCallback, useEffect, useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useJob } from "@/components/tools/use-job";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { ToolWidget } from "@/components/tools/job-ui";
import { formatBytes } from "@/lib/utils";

interface InfoReport {
  fileName: string;
  fileSize: number;
  pageCount: number;
  pageSizes: string;
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  created: string;
  modified: string;
}

const KNOWN_SIZES: Array<[string, number, number]> = [
  ["A3", 842, 1191],
  ["A4", 595, 842],
  ["A5", 420, 595],
  ["Letter", 612, 792],
  ["Legal", 612, 1008],
];

function describePageSize(width: number, height: number): string {
  const orientation = width > height ? "landscape" : "portrait";
  const match = KNOWN_SIZES.find(
    ([, w, h]) =>
      (Math.abs(width - w) <= 3 && Math.abs(height - h) <= 3) ||
      (Math.abs(width - h) <= 3 && Math.abs(height - w) <= 3),
  );
  const name = match ? ` (${match[0]})` : "";
  return `${Math.round(width)} × ${Math.round(height)} pt${name} ${orientation}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function InfoTile({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      className={`border-[3px] border-edge bg-card p-3 shadow-[3px_3px_0_0_var(--color-shadow)] ${wide ? "sm:col-span-2" : ""}`}
    >
      <p className="font-display text-[8px] text-ink-soft uppercase">{label}</p>
      <p className="mt-1.5 break-words font-body text-lg leading-snug text-ink">{value || "—"}</p>
    </div>
  );
}

export default function PdfInformationTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [report, setReport] = useState<InfoReport | null>(null);
  const [encrypted, setEncrypted] = useState(false);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  const inspect = useCallback(
    (source: File) => {
      setReport(null);
      setEncrypted(false);
      start(async ({ report: progress }) => {
        progress("Reading document…", 0.8);
        try {
          const { PDFDocument } = await import("pdf-lib");
          const bytes = new Uint8Array(await source.arrayBuffer());
          const doc = await PDFDocument.load(bytes, { updateMetadata: false });
          const pages = doc.getPages();
          const groups = new Map<string, number>();
          for (const page of pages) {
            const { width, height } = page.getSize();
            const key = describePageSize(width, height);
            groups.set(key, (groups.get(key) ?? 0) + 1);
          }
          const sizes = [...groups.entries()]
            .map(([size, count]) => `${size}${count > 1 ? ` × ${count}` : ""}`)
            .join("; ");

          let created: Date | null = null;
          let modified: Date | null = null;
          try {
            created = doc.getCreationDate() ?? null;
            modified = doc.getModificationDate() ?? null;
          } catch {
            // Dates are optional — leave them blank.
          }

          const info: InfoReport = {
            fileName: source.name,
            fileSize: source.size,
            pageCount: pages.length,
            pageSizes: sizes,
            title: doc.getTitle() ?? "",
            author: doc.getAuthor() ?? "",
            subject: doc.getSubject() ?? "",
            keywords: doc.getKeywords() ?? "",
            creator: doc.getCreator() ?? "",
            producer: doc.getProducer() ?? "",
            created: formatDate(created),
            modified: formatDate(modified),
          };
          setReport(info);
          return [];
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/encrypt/i.test(message)) {
            setEncrypted(true);
            return [];
          }
          throw error;
        }
      }, "Reading document…");
    },
    [start],
  );

  useEffect(() => {
    if (file && state.phase === "idle") inspect(file);
    // Re-inspect whenever a new file lands while idle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return (
    <ToolWidget>
      {state.phase === "running" ? (
        <div className="border-[3px] border-edge bg-card p-4 font-body text-lg text-ink-soft shadow-[4px_4px_0_0_var(--color-shadow)]">
          Reading document…
        </div>
      ) : state.phase === "error" ? (
        <div className="space-y-4">
          <div className="border-[3px] border-err bg-err-soft p-4 font-body text-lg text-ink shadow-[4px_4px_0_0_var(--color-shadow)]">
            {state.error}
          </div>
          <button
            className="font-body text-lg text-brand underline"
            onClick={() => {
              queue.clear();
              reset();
            }}
          >
            Try another file
          </button>
        </div>
      ) : encrypted ? (
        <div className="space-y-4">
          <div className="border-[3px] border-warn bg-warn-soft p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <p className="font-display text-[10px] text-warn uppercase">Password-protected</p>
            <p className="mt-2 font-body text-lg text-ink">
              “{file?.name}” is encrypted, so its details can&apos;t be read. Unlock it first — the
              unlocked copy can be inspected here.
            </p>
          </div>
          <Link href="/pdf-tools/unlock-pdf" className="inline-block font-body text-lg text-brand underline">
            Go to Unlock PDF →
          </Link>
        </div>
      ) : report ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoTile label="File" value={`${report.fileName} · ${formatBytes(report.fileSize)}`} wide />
            <InfoTile label="Pages" value={String(report.pageCount)} />
            <InfoTile label="Page sizes" value={report.pageSizes} />
            <InfoTile label="Title" value={report.title} />
            <InfoTile label="Author" value={report.author} />
            <InfoTile label="Subject" value={report.subject} wide />
            <InfoTile label="Keywords" value={report.keywords} />
            <InfoTile label="Created" value={report.created} />
            <InfoTile label="Modified" value={report.modified} />
            <InfoTile label="Created with" value={report.creator} />
            <InfoTile label="Producer" value={report.producer} />
          </div>
          <Link href="/pdf-tools/clean-pdf" className="inline-block font-body text-lg text-brand underline">
            Want these details gone? Clean the PDF →
          </Link>
          <button
            className="block font-body text-lg text-ink-soft underline"
            onClick={() => {
              queue.clear();
              setReport(null);
              reset();
            }}
          >
            Inspect another file
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />
          <p className="text-sm text-ink-soft">
            The report appears instantly — nothing is uploaded anywhere.
          </p>
        </div>
      )}
    </ToolWidget>
  );
}
