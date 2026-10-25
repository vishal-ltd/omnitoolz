/**
 * Tool registry types (plan.md §11). The registry is pure data so it can be
 * imported from server components, search, the sitemap and tests alike.
 * A tool is only marked "live" when its handler component exists and works.
 */

export type CategoryId = "pdf" | "image" | "text" | "developer" | "security" | "media";

export type ProcessingMode = "browser" | "server";

export type ToolStatus = "live" | "planned";

/** Keys into the icon map in components/icons.tsx — verified at build time. */
export type IconName =
  | "file-text"
  | "files"
  | "scissors"
  | "rotate-cw"
  | "file-output"
  | "image-down"
  | "file-image"
  | "hash"
  | "minimize-2"
  | "shrink"
  | "maximize-2"
  | "crop"
  | "arrow-left-right"
  | "stamp"
  | "type"
  | "case-sensitive"
  | "braces"
  | "qr-code"
  | "key-round"
  | "image"
  | "code-2"
  | "shield-check"
  | "lock"
  | "lock-open"
  | "layout-grid"
  | "file-minus-2"
  | "panel-top"
  | "info"
  | "eraser"
  | "layers"
  | "wrench"
  | "file-minus"
  | "scale"
  | "image-plus"
  | "book-open"
  | "receipt"
  | "file-json"
  | "binary"
  | "fingerprint"
  | "clock"
  | "palette"
  | "regex"
  | "scan-line"
  | "git-compare"
  | "smartphone"
  | "shield-alert"
  | "file-check"
  | "pen-line"
  | "scan-text"
  | "wand-2"
  | "camera"
  | "video"
  | "app-window";

export interface Category {
  id: CategoryId;
  /** Route slug, e.g. "pdf-tools" → /pdf-tools */
  slug: string;
  name: string;
  shortName: string;
  description: string;
  icon: IconName;
}

export interface Faq {
  q: string;
  a: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  /** One or two sentences, used on cards and in meta descriptions. */
  description: string;
  category: CategoryId;
  processingMode: ProcessingMode;
  status: ToolStatus;
  /** Shown on the homepage “Featured tools” section. */
  featured?: boolean;
  /** Extra search keywords (lowercase). */
  keywords: string[];
  icon: IconName;
  /** Human-readable accepted format list shown under the drop zone. */
  acceptedFormats: string[];
  maxFiles: number;
  maxFileSizeMb: number;
  supportsBatch: boolean;
  requiresMultipleFiles?: boolean;
  /** Short, tool-specific privacy statement. */
  privacyNote: string;
  howTo: string[];
  faqs: Faq[];
  relatedToolIds: string[];
}

export interface ToolWithRoute extends ToolDefinition {
  route: string;
  categorySlug: string;
  categoryName: string;
}
