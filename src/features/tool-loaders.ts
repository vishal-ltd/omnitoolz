import type { ComponentType } from "react";

/**
 * Map of live tool IDs to lazy component loaders. Kept as a plain TS module
 * (no JSX, no React runtime dependencies) so the registry integrity test can
 * import it and verify that every "live" tool has a real handler component.
 * tool-renderer.tsx wraps these in next/dynamic for code splitting.
 */
export const toolLoaders: Record<string, () => Promise<{ default: ComponentType }>> = {
  // PDF
  "merge-pdf": () => import("./pdf/merge-pdf"),
  "split-pdf": () => import("./pdf/split-pdf"),
  "rotate-pdf": () => import("./pdf/rotate-pdf"),
  "extract-pdf-pages": () => import("./pdf/extract-pdf-pages"),
  "pdf-to-jpg": () => import("./pdf/pdf-to-jpg"),
  "jpg-to-pdf": () => import("./pdf/jpg-to-pdf"),
  "add-page-numbers": () => import("./pdf/add-page-numbers"),
  "protect-pdf": () => import("./pdf/protect-pdf"),
  "unlock-pdf": () => import("./pdf/unlock-pdf"),
  "organize-pdf": () => import("./pdf/organize-pdf"),
  "delete-pdf-pages": () => import("./pdf/delete-pdf-pages"),
  "watermark-pdf": () => import("./pdf/watermark-pdf"),
  "header-footer-pdf": () => import("./pdf/header-footer-pdf"),
  "extract-pdf-text": () => import("./pdf/extract-pdf-text"),
  "pdf-information": () => import("./pdf/pdf-information"),
  "clean-pdf": () => import("./pdf/clean-pdf"),
  "flatten-pdf": () => import("./pdf/flatten-pdf"),
  "repair-pdf": () => import("./pdf/repair-pdf"),
  "crop-pdf": () => import("./pdf/crop-pdf"),
  "remove-blank-pages": () => import("./pdf/remove-blank-pages"),
  "compare-pdf": () => import("./pdf/compare-pdf"),
  "extract-pdf-images": () => import("./pdf/extract-pdf-images"),
  "read-pdf": () => import("./pdf/read-pdf"),
  "invoice-generator": () => import("./pdf/invoice-generator"),
  "sign-pdf": () => import("./pdf/sign-pdf"),
  // Images
  "compress-image": () => import("./images/compress-image"),
  "resize-image": () => import("./images/resize-image"),
  "crop-image": () => import("./images/crop-image"),
  "jpg-to-png": () => import("./images/jpg-to-png"),
  "png-to-jpg": () => import("./images/png-to-jpg"),
  "webp-converter": () => import("./images/webp-converter"),
  "watermark-image": () => import("./images/watermark-image"),
  // Text
  "word-counter": () => import("./text/word-counter"),
  "text-case-converter": () => import("./text/case-converter"),
  "diff-checker": () => import("./text/diff-checker"),
  "image-to-text": () => import("./developer/image-to-text"),
  "background-remover": () => import("./images/background-remover"),
  "heic-to-jpg": () => import("./images/heic-to-jpg"),
  "favicon-generator": () => import("./images/favicon-generator"),
  "camera-scan-pdf": () => import("./pdf/camera-scan-pdf"),
  "screen-recorder": () => import("./media/screen-recorder"),
  "audio-trimmer": () => import("./media/audio-trimmer"),
  "compress-pdf": () => import("./pdf/compress-pdf"),
  "word-to-pdf": () => import("./pdf/word-to-pdf"),
  "edit-pdf": () => import("./pdf/edit-pdf"),
  "excel-to-pdf": () => import("./pdf/excel-to-pdf"),
  "pdf-to-word": () => import("./pdf/pdf-to-word"),
  // Developer
  "json-formatter": () => import("./developer/json-formatter"),
  "qr-code-generator": () => import("./developer/qr-generator"),
  "jwt-decoder": () => import("./developer/jwt-decoder"),
  "base64-tool": () => import("./developer/base64-tool"),
  "uuid-generator": () => import("./developer/uuid-generator"),
  "hash-generator": () => import("./developer/hash-generator"),
  "timestamp-converter": () => import("./developer/timestamp-converter"),
  "color-toolkit": () => import("./developer/color-toolkit"),
  "regex-tester": () => import("./developer/regex-tester"),
  "qr-scanner": () => import("./developer/qr-scanner"),
  // Security
  "password-generator": () => import("./security/password-generator"),
  "totp-generator": () => import("./security/totp-generator"),
  "password-auditor": () => import("./security/password-auditor"),
  "file-hash-verifier": () => import("./security/file-hash-verifier"),
};
