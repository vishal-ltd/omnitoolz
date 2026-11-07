"use client";

import { ChromeIcon, ToolIcon } from "@/components/icons";
import { useEffect, useMemo } from "react";
import { formatBytes } from "@/lib/utils";

export interface FileListProps {
  files: File[];
  onRemove?: (index: number) => void;
  /** Show reorder arrows (e.g. merge order matters). */
  onMove?: (index: number, direction: -1 | 1) => void;
  thumbnails?: boolean;
  disabled?: boolean;
  /** Name of the file just removed, with a way to put it back. */
  undoLabel?: string | null;
  onUndo?: () => void;
}

/** Queued files as pixel rows with size, thumbnail and remove/reorder controls. */
export function FileList({
  files,
  onRemove,
  onMove,
  thumbnails = false,
  disabled = false,
  undoLabel = null,
  onUndo,
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

  if (files.length === 0 && !(undoLabel && onUndo)) return null;

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
      {files.map((file, index) => {
        const preview = previewUrls.get(file);
        return (
          <li
            key={`${file.name}-${index}`}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden border-[3px] border-edge bg-canvas">
              {preview ? (
                // Object URL preview of a locally selected file — not a remote image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                <ToolIcon name="file-text" className="size-4" />
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
                  className="min-h-6 min-w-6 border-2 border-edge bg-card p-0.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand disabled:opacity-30"
                >
                  <ChromeIcon name="arrow-up" className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${file.name} down`}
                  disabled={index === files.length - 1}
                  onClick={() => onMove(index, 1)}
                  className="mt-0.5 min-h-6 min-w-6 border-2 border-edge bg-card p-0.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand disabled:opacity-30"
                >
                  <ChromeIcon name="arrow-down" className="size-3.5" />
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
                <ChromeIcon name="close" className="size-4" />
              </button>
            )}
          </li>
        );
      })}
        </ul>
      )}
      {undoLabel && onUndo && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-[3px] border-line bg-canvas px-3 py-2 font-body text-base text-ink-soft"
        >
          Removed “{undoLabel}”
          <button
            type="button"
            onClick={onUndo}
            className="min-h-8 border-2 border-edge bg-card px-2 font-display text-display-xs text-ink uppercase transition-colors hover:bg-brand-soft hover:text-brand"
          >
            Undo
          </button>
        </p>
      )}
    </div>
  );
}
