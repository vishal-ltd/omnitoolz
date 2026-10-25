"use client";

import { ArrowDown, ArrowUp, FileText, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { formatBytes } from "@/lib/utils";

export interface FileListProps {
  files: File[];
  onRemove?: (index: number) => void;
  /** Show reorder arrows (e.g. merge order matters). */
  onMove?: (index: number, direction: -1 | 1) => void;
  thumbnails?: boolean;
  disabled?: boolean;
}

/** Queued files as pixel rows with size, thumbnail and remove/reorder controls. */
export function FileList({
  files,
  onRemove,
  onMove,
  thumbnails = false,
  disabled = false,
}: FileListProps) {
  const previewUrls = useMemo(() => {
    if (!thumbnails) return new Map<File, string>();
    const map = new Map<File, string>();
    for (const file of files) {
      if (file.type.startsWith("image/")) map.set(file, URL.createObjectURL(file));
    }
    return map;
  }, [files, thumbnails]);

  useEffect(() => {
    return () => {
      for (const url of previewUrls.values()) URL.revokeObjectURL(url);
    };
  }, [previewUrls]);

  if (files.length === 0) return null;

  return (
    <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
      {files.map((file, index) => {
        const preview = previewUrls.get(file);
        return (
          <li
            key={`${file.name}-${index}`}
            className="flex animate-pixel-in items-center gap-3 px-4 py-3"
            style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
          >
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden border-[3px] border-edge bg-canvas">
              {preview ? (
                // Object URL preview of a locally selected file — not a remote image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                <FileText className="size-5 text-ink-soft" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-lg leading-tight text-ink" title={file.name}>
                {index + 1}. {file.name}
              </p>
              <p className="font-body text-sm text-ink-soft">{formatBytes(file.size)}</p>
            </div>
            {!disabled && onMove && (
              <div className="flex flex-col" aria-label={`Reorder ${file.name}`}>
                <button
                  type="button"
                  aria-label={`Move ${file.name} up`}
                  disabled={index === 0}
                  onClick={() => onMove(index, -1)}
                  className="border-2 border-edge bg-card p-0.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${file.name} down`}
                  disabled={index === files.length - 1}
                  onClick={() => onMove(index, 1)}
                  className="mt-0.5 border-2 border-edge bg-card p-0.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </button>
              </div>
            )}
            {!disabled && onRemove && (
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemove(index)}
                className="border-[3px] border-edge bg-card p-1.5 text-ink-soft transition-colors hover:border-err hover:bg-err hover:text-canvas"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
