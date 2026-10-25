"use client";

import { CloudUpload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { validateFiles, type FileQueueOptions } from "./file-queue";

export interface FileDropZoneProps extends FileQueueOptions {
  onFiles: (files: File[]) => void;
  /** Existing file count so the single-file tools replace rather than add. */
  existingCount?: number;
  disabled?: boolean;
  hint?: string;
}

/**
 * Accessible drag-and-drop + browse upload zone with pixel styling.
 * Validation errors are shown inline immediately (plan §7).
 */
export function FileDropZone({
  accept,
  multiple,
  maxFiles,
  maxSizeMb,
  onFiles,
  existingCount = 0,
  disabled = false,
  hint,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const acceptAttr = accept.length > 0 ? accept.map((ext) => `.${ext}`).join(",") : undefined;

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = Array.from(event.dataTransfer.files);
    ingest(dropped);
  }

  function ingest(incoming: File[]) {
    const { accepted, errors: validationErrors } = validateFiles(incoming, existingCount, {
      accept,
      multiple,
      maxFiles,
      maxSizeMb,
    });
    setErrors(validationErrors);
    if (accepted.length > 0) onFiles(accepted);
  }

  const formatsLabel = accept.length > 0 ? accept.map((e) => e.toUpperCase()).join(" · ") : "Any file";

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Drop your ${multiple ? "files" : "file"} here — ${formatsLabel}, up to ${maxSizeMb} MB${multiple ? ` each, ${maxFiles} files max` : ""}`}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !disabled) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "bg-dither flex cursor-pointer flex-col items-center justify-center gap-3 border-[3px] border-dashed p-10 text-center",
          "transition-[transform,box-shadow,background-color,border-color] duration-100",
          "hover:-translate-y-0.5 hover:border-solid hover:shadow-[4px_4px_0_0_var(--color-shadow)]",
          dragging
            ? "border-brand border-solid bg-brand-soft shadow-[4px_4px_0_0_var(--color-shadow)]"
            : "border-line-strong bg-canvas/60",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <span className="flex size-14 animate-pixel-in items-center justify-center border-[3px] border-edge bg-brand shadow-[3px_3px_0_0_var(--color-shadow)]">
          <CloudUpload className="size-7 text-on-brand" aria-hidden />
        </span>
        <p className="font-display text-[11px] leading-relaxed text-ink uppercase">
          Drop {multiple ? "files" : "your file"} here
        </p>
        <p className="font-display text-[9px] text-ink-soft uppercase">
          or <span className="text-brand">click to browse</span>
        </p>
        <p className="font-body text-base text-ink-soft">
          {formatsLabel} · up to {maxSizeMb} MB{multiple ? ` each · max ${maxFiles} files` : ""}
        </p>
        {hint && <p className="max-w-md font-body text-sm text-ink-soft">{hint}</p>}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={acceptAttr}
          multiple={multiple}
          onChange={(event) => {
            if (event.target.files) ingest(Array.from(event.target.files));
            event.target.value = "";
          }}
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 border-[3px] border-err bg-err-soft p-3" role="alert">
          {errors.map((error) => (
            <li key={error} className="flex items-start gap-2 font-body text-base leading-snug text-err">
              <span aria-hidden className="font-display text-[9px]">✕</span>
              {error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
