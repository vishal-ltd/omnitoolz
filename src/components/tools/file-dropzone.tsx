"use client";

import { CloudUpload } from "lucide-react";
import { useRef, useId, useState, type DragEvent } from "react";
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
  const describeId = useId();
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
  const constraints = `${formatsLabel} · up to ${maxSizeMb} MB${multiple ? ` each · max ${maxFiles} files` : ""}`;
  /** Once files are queued the zone shrinks so the action stays on screen. */
  const compact = existingCount > 0;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={compact ? "Add more files" : `Drop ${multiple ? "files" : "your file"} here or click to browse`}
        aria-describedby={describeId}
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
          "cursor-pointer border-[3px] border-dashed",
          "transition-[transform,box-shadow,background-color,border-color] duration-100",
          "hover:-translate-y-0.5 hover:border-solid hover:shadow-[4px_4px_0_0_var(--color-shadow)]",
          dragging
            ? "border-brand border-solid bg-brand-soft shadow-[4px_4px_0_0_var(--color-shadow)]"
            : "border-line-strong bg-canvas/60",
          disabled && "pointer-events-none opacity-60",
          compact
            ? "flex flex-wrap items-center gap-x-4 gap-y-2 p-3"
            : "bg-dither flex flex-col items-center justify-center gap-3 p-8 text-center",
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center border-[3px] border-edge bg-brand shadow-[3px_3px_0_0_var(--color-shadow)]",
            compact ? "size-9" : "size-12 animate-pixel-in",
          )}
        >
          <CloudUpload className={cn("text-on-brand", compact ? "size-4" : "size-6")} aria-hidden />
        </span>
        <p
          className={cn(
            "font-display uppercase leading-relaxed text-ink",
            compact ? "text-display-xs" : "text-display-sm",
          )}
        >
          {compact ? `${existingCount} queued — add more` : `Drop ${multiple ? "files" : "your file"} here`}
        </p>
        {!compact && (
          <p className="font-display text-display-xs uppercase text-ink-soft">
            or <span className="text-brand">click to browse</span>
          </p>
        )}
        <p
          id={describeId}
          className={cn("font-body text-base text-ink-soft", compact && "w-full sm:ml-auto sm:w-auto")}
        >
          {constraints}
          {hint ? ` · ${hint}` : ""}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          aria-label="Choose files to upload"
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
              <span aria-hidden className="font-display text-display-xs">✕</span>
              {error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
