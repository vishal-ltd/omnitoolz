"use client";

import { useCallback, useMemo, useReducer } from "react";
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

/** Same name + size + mtime = the same dropped file; queue it once. */
function isDuplicate(file: File, existing: File[]): boolean {
  return existing.some(
    (other) =>
      other.name === file.name &&
      other.size === file.size &&
      other.lastModified === file.lastModified,
  );
}

interface QueueState {
  files: File[];
  errors: string[];
  removed: { file: File; index: number } | null;
}

type QueueAction =
  | { type: "add"; incoming: File[]; options: FileQueueOptions }
  | { type: "remove"; index: number }
  | { type: "move"; index: number; direction: -1 | 1 }
  | { type: "clear" }
  | { type: "undo"; maxFiles: number };

/**
 * Reducer so two adds in one tick validate against the latest queue, not a
 * stale render closure — capacity and dedupe can't be raced past.
 */
function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case "add": {
      const fresh: File[] = [];
      for (const file of action.incoming) {
        if (!isDuplicate(file, state.files) && !isDuplicate(file, fresh)) fresh.push(file);
      }
      const existingSizeBytes = state.files.reduce((sum, file) => sum + file.size, 0);
      const { accepted, errors } = validateFiles(
        fresh,
        state.files.length,
        action.options,
        existingSizeBytes,
      );
      return {
        files:
          accepted.length > 0
            ? action.options.multiple
              ? [...state.files, ...accepted]
              : accepted.slice(0, 1)
            : state.files,
        errors,
        removed: null,
      };
    }
    case "remove": {
      const file = state.files[action.index];
      return {
        files: state.files.filter((_, i) => i !== action.index),
        errors: [],
        removed: file ? { file, index: action.index } : null,
      };
    }
    case "move": {
      const target = action.index + action.direction;
      if (target < 0 || target >= state.files.length) return state;
      const next = [...state.files];
      [next[action.index], next[target]] = [next[target], next[action.index]];
      return { ...state, files: next };
    }
    case "clear":
      return { files: [], errors: [], removed: null };
    case "undo":
      if (!state.removed) return state;
      return {
        ...state,
        files: insertAt(state.files, state.removed.file, state.removed.index, action.maxFiles),
        removed: null,
      };
  }
}

export function useFileQueue(options: FileQueueOptions): FileQueue {
  const [state, dispatch] = useReducer(queueReducer, {
    files: [],
    errors: [],
    removed: null,
  });
  const { files, errors, removed } = state;

  const addFiles = useCallback(
    (incoming: File[] | FileList) => {
      dispatch({ type: "add", incoming: Array.from(incoming), options });
    },
    [options],
  );

  const removeAt = useCallback((index: number) => dispatch({ type: "remove", index }), []);

  /** Puts the last removed file back where it was, unless the queue filled up. */
  const undoRemove = useCallback(
    () => dispatch({ type: "undo", maxFiles: options.maxFiles }),
    [options.maxFiles],
  );

  const move = useCallback(
    (index: number, direction: -1 | 1) => dispatch({ type: "move", index, direction }),
    [],
  );

  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  const canAddMore = options.multiple ? files.length < options.maxFiles : files.length === 0;
  const lastRemoved = removed?.file.name ?? null;

  return useMemo(
    () => ({ files, errors, addFiles, removeAt, move, clear, canAddMore, lastRemoved, undoRemove }),
    [files, errors, addFiles, removeAt, move, clear, canAddMore, lastRemoved, undoRemove],
  );
}
