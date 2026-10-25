"use client";

import { useCallback, useMemo, useState } from "react";
import { extensionOf, formatBytes } from "@/lib/utils";

export interface FileQueueOptions {
  /** Lowercase extensions without the dot, e.g. ["pdf"]. Empty = any file. */
  accept: string[];
  multiple: boolean;
  maxFiles: number;
  maxSizeMb: number;
}

export interface FileQueue {
  files: File[];
  errors: string[];
  addFiles: (incoming: File[] | FileList) => void;
  removeAt: (index: number) => void;
  move: (index: number, direction: -1 | 1) => void;
  clear: () => void;
  canAddMore: boolean;
}

/**
 * Validate a batch of dropped/selected files against a tool's constraints.
 * Returns accepted files plus user-readable error messages. The same helper
 * powers the drop zone (instant feedback) and the queue (safety net).
 */
export function validateFiles(
  incoming: File[],
  existingCount: number,
  options: FileQueueOptions,
): { accepted: File[]; errors: string[] } {
  const errors: string[] = [];
  const accepted: File[] = [];

  for (const file of incoming) {
    if (options.accept.length > 0 && !options.accept.includes(extensionOf(file.name))) {
      errors.push(
        `“${file.name}” isn't a supported format (allowed: ${options.accept.map((e) => e.toUpperCase()).join(", ")}).`,
      );
      continue;
    }
    if (file.size > options.maxSizeMb * 1024 * 1024) {
      errors.push(
        `“${file.name}” is ${formatBytes(file.size)} — the limit is ${options.maxSizeMb} MB per file.`,
      );
      continue;
    }
    if (file.size === 0) {
      errors.push(`“${file.name}” is empty.`);
      continue;
    }
    accepted.push(file);
  }

  const room = Math.max(0, options.maxFiles - existingCount);
  if (accepted.length > room) {
    errors.push(
      options.multiple
        ? `Only ${options.maxFiles} files can be processed at once — the first ${room} ${room === 1 ? "was" : "were"} kept.`
        : `This tool accepts a single file — only “${accepted[0]?.name}” was kept.`,
    );
  }

  return { accepted: accepted.slice(0, room), errors };
}

export function useFileQueue(options: FileQueueOptions): FileQueue {
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const addFiles = useCallback(
    (incoming: File[] | FileList) => {
      const list = Array.from(incoming);
      const { accepted, errors: validationErrors } = validateFiles(list, files.length, options);
      setErrors(validationErrors);
      if (accepted.length > 0) {
        setFiles((prev) => (options.multiple ? [...prev, ...accepted] : accepted.slice(0, 1)));
      }
    },
    [files.length, options],
  );

  const removeAt = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setErrors([]);
  }, []);

  const move = useCallback((index: number, direction: -1 | 1) => {
    setFiles((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
    setErrors([]);
  }, []);

  const canAddMore = options.multiple ? files.length < options.maxFiles : files.length === 0;

  return useMemo(
    () => ({ files, errors, addFiles, removeAt, move, clear, canAddMore }),
    [files, errors, addFiles, removeAt, move, clear, canAddMore],
  );
}
