"use client";

import { CheckCircle2, Download, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadBlob, formatBytes, formatDuration, isImageBlob, type ResultFile } from "@/lib/utils";

export interface ResultsProps {
  results: ResultFile[];
  elapsedMs: number | null;
  /** Base name for the ZIP when several results are downloaded together. */
  zipBaseName?: string;
  onReset: () => void;
  resetLabel?: string;
  /** Optional context line, e.g. total savings for compression tools. */
  note?: string;
}

/**
 * Success panel: result summary, per-file downloads, a ZIP for batches and a
 * "start over" action (plan §7 items 10-12).
 */
export function Results({ results, elapsedMs, zipBaseName = "omnitoolz", onReset, resetLabel = "Start over", note }: ResultsProps) {
  const [zipping, setZipping] = useState(false);
  const totalSize = results.reduce((sum, file) => sum + file.blob.size, 0);

  const previewUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const file of results) {
      if (isImageBlob(file.blob)) map.set(file.name, URL.createObjectURL(file.blob));
    }
    return map;
  }, [results]);

  useEffect(() => {
    return () => {
      for (const url of previewUrls.values()) URL.revokeObjectURL(url);
    };
  }, [previewUrls]);

  async function downloadAll() {
    setZipping(true);
    try {
      const { zipSync } = await import("fflate");
      const entries: Record<string, Uint8Array> = {};
      const used = new Set<string>();
      for (const file of results) {
        let name = file.name;
        let n = 2;
        while (used.has(name)) {
          const dot = file.name.lastIndexOf(".");
          name = dot > 0 ? `${file.name.slice(0, dot)}-${n}${file.name.slice(dot)}` : `${file.name}-${n}`;
          n++;
        }
        used.add(name);
        entries[name] = new Uint8Array(await file.blob.arrayBuffer());
      }
      const zipped = zipSync(entries);
      const copy = new Uint8Array(zipped.byteLength);
      copy.set(zipped);
      downloadBlob(new Blob([copy.buffer], { type: "application/zip" }), `${zipBaseName}.zip`);
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="animate-pixel-in space-y-4">
      <div className="border-[3px] border-ok bg-ok-soft p-4 shadow-[4px_4px_0_0_var(--color-shadow)]" role="status">
        <p className="flex items-center gap-2.5 font-display text-[10px] leading-relaxed text-ok uppercase">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          Done — {results.length === 1 ? "file ready" : `${results.length} files ready`}
        </p>
        <p className="mt-2 font-body text-lg text-ink-soft">
          {formatBytes(totalSize)} total
          {elapsedMs !== null && ` · took ${formatDuration(elapsedMs)}`}
        </p>
        {note && <p className="mt-1 font-body text-lg font-medium text-ok">{note}</p>}
      </div>

      {results.length === 1 && previewUrls.size === 1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrls.values().next().value}
          alt={`Preview of ${results[0].name}`}
          className="max-h-72 w-auto border-[3px] border-edge bg-[repeating-conic-gradient(#d2ccb8_0%_25%,#fcfaf0_0%_50%)] bg-[length:16px_16px] object-contain shadow-[4px_4px_0_0_var(--color-shadow)]"
        />
      )}

      <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
        {results.map((file, index) => (
          <li
            key={file.name}
            className="flex animate-pixel-in items-center gap-3 px-4 py-3"
            style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
          >
            {previewUrls.has(file.name) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrls.get(file.name)} alt="" className="size-10 border-[3px] border-edge object-cover" />
            ) : (
              <span className="flex size-10 items-center justify-center border-[3px] border-edge bg-canvas font-display text-[8px] text-ink-soft">
                {file.name.split(".").pop()?.slice(0, 4).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-lg leading-tight text-ink" title={file.name}>
                {file.name}
              </p>
              <p className="font-body text-sm text-ink-soft">{formatBytes(file.blob.size)}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => downloadBlob(file.blob, file.name)}>
              <Download className="size-4" aria-hidden />
              Save
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        {results.length > 1 && (
          <Button onClick={downloadAll} loading={zipping}>
            <Download className="size-4" aria-hidden />
            Download all (ZIP)
          </Button>
        )}
        <Button variant="secondary" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          {resetLabel}
        </Button>
      </div>
    </div>
  );
}
