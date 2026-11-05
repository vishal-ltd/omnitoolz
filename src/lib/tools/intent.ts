import type { ToolDefinition } from "./types";

/**
 * What a tool does to your stuff, as the user would say it. Category pages
 * group by this so 33 cards stop reading as one wall. Every live tool must be
 * mapped — intent.test.ts fails the build if a new tool ships unmapped.
 */
export type Intent = "convert" | "edit" | "inspect" | "create";

export const INTENTS: Array<{ id: Intent; label: string; blurb: string }> = [
  { id: "convert", label: "Convert", blurb: "Format in, format out" },
  { id: "edit", label: "Edit", blurb: "Change what the file says" },
  { id: "inspect", label: "Inspect", blurb: "Read, compare and verify" },
  { id: "create", label: "Create", blurb: "Make something new" },
];

const INTENT_BY_TOOL: Record<string, Intent> = {
  // pdf
  "merge-pdf": "edit",
  "split-pdf": "edit",
  "rotate-pdf": "edit",
  "extract-pdf-pages": "edit",
  "pdf-to-jpg": "convert",
  "jpg-to-pdf": "convert",
  "add-page-numbers": "edit",
  "protect-pdf": "edit",
  "unlock-pdf": "edit",
  "organize-pdf": "edit",
  "delete-pdf-pages": "edit",
  "watermark-pdf": "edit",
  "header-footer-pdf": "edit",
  "extract-pdf-text": "inspect",
  "pdf-information": "inspect",
  "clean-pdf": "edit",
  "flatten-pdf": "edit",
  "repair-pdf": "edit",
  "crop-pdf": "edit",
  "remove-blank-pages": "edit",
  "compare-pdf": "inspect",
  "extract-pdf-images": "inspect",
  "read-pdf": "inspect",
  "invoice-generator": "create",
  "sign-pdf": "edit",
  "camera-scan-pdf": "convert",
  "edit-pdf": "edit",
  "verify-pdf-signature": "inspect",
  "pptx-to-pdf": "convert",
  "word-to-pdf": "convert",
  "excel-to-pdf": "convert",
  "pdf-to-word": "convert",
  "compress-pdf": "edit",
  // image
  "compress-image": "edit",
  "resize-image": "edit",
  "crop-image": "edit",
  "jpg-to-png": "convert",
  "png-to-jpg": "convert",
  "webp-converter": "convert",
  "watermark-image": "edit",
  "background-remover": "edit",
  "heic-to-jpg": "convert",
  "favicon-generator": "create",
  // text
  "word-counter": "inspect",
  "text-case-converter": "convert",
  "image-to-text": "inspect",
  "diff-checker": "inspect",
  // developer
  "json-formatter": "convert",
  "qr-code-generator": "create",
  "jwt-decoder": "inspect",
  "base64-tool": "convert",
  "uuid-generator": "create",
  "hash-generator": "create",
  "timestamp-converter": "convert",
  "color-toolkit": "edit",
  "regex-tester": "inspect",
  "qr-scanner": "inspect",
  // security
  "password-generator": "create",
  "totp-generator": "create",
  "password-auditor": "inspect",
  "file-hash-verifier": "inspect",
  // media
  "screen-recorder": "create",
  "audio-trimmer": "edit",
};

/** Unmapped tools land in the last group so a page never drops a card. */
export function intentOf(tool: Pick<ToolDefinition, "id">): Intent {
  return INTENT_BY_TOOL[tool.id] ?? "create";
}

export function isMapped(id: string): boolean {
  return id in INTENT_BY_TOOL;
}

export function groupByIntent<T extends { id: string }>(tools: T[]): Array<{ intent: (typeof INTENTS)[number]; tools: T[] }> {
  return INTENTS.map((intent) => ({
    intent,
    tools: tools.filter((tool) => intentOf(tool) === intent.id),
  })).filter((group) => group.tools.length > 0);
}
