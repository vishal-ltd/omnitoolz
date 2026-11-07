"use client";

import { useCallback, useMemo, useState } from "react";
import { extensionOf, formatBytes } from "@/lib/utils";

export interface FileQueueOptions {
  /** Lowercase extensions without the dot, e.g. ["pdf"]. Empty = any file. */
  accept: string[];
  multiple: boolean;
  maxFiles: number;
  maxSizeMb: number;
  /** Optional aggregate limit for one in-memory processing batch. */
  maxTotalSizeMb?: number;
}

export const DEFAULT_MAX_TOTAL_SIZE_MB = 500;

export interface FileQueue {
  files: File[];
  errors: string[];
  addFiles: (incoming: File[] | FileList) => void;
  removeAt: (index: number) => void;
  move: (index: number, direction: -1 | 1) => void;
  clear: () => void;
  canAddMore: boolean;
  /** Name of the file just removed, so the list can offer a way back. */
  lastRemoved: string | null;
  undoRemove: () => void;
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
  existingSizeBytes = 0,
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
        : room === 0
          ? "This tool already has a file selected — remove it before choosing another."
          : `This tool accepts a single file — only “${accepted[0]?.name}” was kept.`,
    );
  }

  const countLimited = accepted.slice(0, room);
  const totalLimitMb = options.maxTotalSizeMb ?? Math.min(
    DEFAULT_MAX_TOTAL_SIZE_MB,
    options.maxSizeMb * Math.max(1, options.maxFiles),
  );
  const totalLimitBytes = totalLimitMb * 1024 * 1024;
  const totalRoomBytes = Math.max(0, totalLimitBytes - existingSizeBytes);
  const totalAccepted: File[] = [];
  let totalBytes = 0;
  for (const file of countLimited) {
    if (totalBytes + file.size > totalRoomBytes) break;
    totalAccepted.push(file);
    totalBytes += file.size;
  }
  if (totalAccepted.length < countLimited.length) {
    errors.push(
      `This batch would exceed the ${totalLimitMb} MB total in-memory limit. Choose fewer or smaller files.`,
    );
  }

  return { accepted: totalAccepted, errors };
}

/**
 * Puts a removed file back at its old position. Pure so the rule is testable
 * without rendering: never duplicates, never exceeds the tool's file limit.
 */
export function insertAt(files: File[], file: File, index: number, maxFiles: number): File[] {
  if (files.length >= maxFiles || files.includes(file)) return files;
  const next = [...files];
  next.splice(Math.min(Math.max(0, index), next.length), 0, file);
  return next;
}

export function useFileQueue(options: FileQueueOptions): FileQueue {
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [removed, setRemoved] = useState<{ file: File; index: number } | null>(null);

  const addFiles = useCallback(
    (incoming: File[] | FileList) => {
      const list = Array.from(incoming);
      const existingSizeBytes = files.reduce((sum, file) => sum + file.size, 0);
      const { accepted, errors: validationErrors } = validateFiles(
        list,
        files.length,
        options,
        existingSizeBytes,
      );
      setErrors(validationErrors);
      setRemoved(null);
      if (accepted.length > 0) {
        setFiles((prev) => (options.multiple ? [...prev, ...accepted] : accepted.slice(0, 1)));
      }
    },
    [files, options],
  );

  const removeAt = useCallback(
    (index: number) => {
      const file = files[index];
      if (file) setRemoved({ file, index });
      setFiles((prev) => prev.filter((_, i) => i !== index));
      setErrors([]);
    },
    [files],
  );

  /** Puts the last removed file back where it was, unless the queue filled up. */
  const undoRemove = useCallback(() => {
    if (!removed) return;
    setFiles((prev) => insertAt(prev, removed.file, removed.index, options.maxFiles));
    setRemoved(null);
  }, [removed, options.maxFiles]);

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
    setRemoved(null);
  }, []);

  const canAddMore = options.multiple ? files.length < options.maxFiles : files.length === 0;
  const lastRemoved = removed?.file.name ?? null;

  return useMemo(
    () => ({ files, errors, addFiles, removeAt, move, clear, canAddMore, lastRemoved, undoRemove }),
    [files, errors, addFiles, removeAt, move, clear, canAddMore, lastRemoved, undoRemove],
  );
}
