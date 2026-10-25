"use client";

import { useEffect } from "react";
import { takePendingFile } from "@/lib/file-handoff";

/**
 * Adopt a file handed off from the PDF viewer (if any) exactly once, when a
 * tool mounts and doesn't already hold a file.
 */
export function useHandoffFile(addFiles: (files: File[]) => void, hasFile: boolean): void {
  useEffect(() => {
    if (hasFile) return;
    const pending = takePendingFile();
    if (pending) addFiles([pending]);
    // takePendingFile clears the slot, so re-running is a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFile]);
}
