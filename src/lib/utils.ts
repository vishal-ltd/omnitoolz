/** Small shared helpers used across tools and UI. */

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Strip the extension from a file name ("report.pdf" → "report"). */
export function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Replace the extension of a file name. */
export function withExtension(name: string, ext: string): string {
  return `${baseName(name)}.${ext.replace(/^\./, "")}`;
}

/** Append a suffix before the extension ("a.pdf", "-merged") → "a-merged.pdf". */
export function suffixedName(name: string, suffix: string): string {
  return `${baseName(name)}${suffix}.${extensionOf(name) || "bin"}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Copy engine bytes into a standalone ArrayBuffer-backed Blob. Some libraries
 * return Uint8Array views whose buffer may be larger than the data; copying
 * guarantees a valid, exactly-sized BlobPart.
 */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

/** A single processed output produced by a tool run. */
export interface ResultFile {
  name: string;
  blob: Blob;
  /** Image results get a lightweight preview in the result list. */
  previewUrl?: string;
}

export function isImageBlob(blob: Blob): boolean {
  return blob.type.startsWith("image/");
}

/* Text-tool helpers: pure logic shared with the Regex Tester and Word Counter. */

export interface RegexMatchInfo {
  text: string;
  index: number;
  groups: string[];
}

/**
 * Collect matches with a hard cap. Deliberately self-contained (no closure
 * references): the regex tester stringifies this function into a Web Worker,
 * so a catastrophic pattern can be terminated instead of freezing the tab.
 */
export function collectRegexMatches(
  pattern: string,
  flags: string,
  text: string,
  maxMatches: number,
): { matches: RegexMatchInfo[]; capped: boolean } {
  const regex = new RegExp(pattern, flags);
  const matches: RegexMatchInfo[] = [];
  let capped = false;
  if (regex.global) {
    for (const match of text.matchAll(regex)) {
      if (matches.length >= maxMatches) {
        capped = true;
        break;
      }
      matches.push({
        text: match[0],
        index: match.index ?? 0,
        groups: match.slice(1).map((group) => group ?? "—"),
      });
    }
  } else {
    const match = regex.exec(text);
    if (match) {
      matches.push({
        text: match[0],
        index: match.index,
        groups: match.slice(1).map((group) => group ?? "—"),
      });
    }
  }
  return { matches, capped };
}

/** Worker bootstrap running the exact same collector off the main thread. */
export function regexWorkerSource(): string {
  return [
    "self.onmessage = (event) => {",
    `  const collect = ${collectRegexMatches.toString()};`,
    "  const { pattern, flags, text, maxMatches } = event.data;",
    "  try {",
    "    const result = collect(pattern, flags, text, maxMatches);",
    "    self.postMessage({ ok: true, matches: result.matches, capped: result.capped });",
    "  } catch (error) {",
    "    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });",
    "  }",
    "};",
  ].join("\n");
}

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one",
  "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old",
  "see", "two", "way", "who", "did", "its", "let", "she", "too", "use", "that", "with",
  "have", "this", "will", "your", "from", "they", "know", "want", "been", "good",
  "much", "some", "time", "very", "when", "come", "here", "just", "like", "long",
  "make", "many", "over", "such", "take", "than", "them", "well", "were", "what",
]);

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingMinutes: number;
  speakingMinutes: number;
  topKeywords: Array<{ word: string; count: number }>;
}

/**
 * Unicode-aware text statistics. Words use letter/number properties so
 * "naïve résumé" counts as two words, not four; characters count code points
 * so an emoji isn't two.
 */
export function analyzeText(text: string): TextStats {
  const words = text.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((part) => part.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter((part) => part.trim().length > 0);

  const counts = new Map<string, number>();
  for (const word of words) {
    const lower = word.toLowerCase();
    if (lower.length < 4 || STOPWORDS.has(lower)) continue;
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }
  const topKeywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  return {
    words: words.length,
    characters: [...text].length,
    charactersNoSpaces: [...text.replace(/\s/g, "")].length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    lines: text.length === 0 ? 0 : text.split("\n").length,
    readingMinutes: words.length / 200,
    speakingMinutes: words.length / 130,
    topKeywords,
  };
}

/** Human reading/speaking time; rounds seconds without ever saying "60 sec". */
export function minutesLabel(minutes: number): string {
  if (minutes === 0) return "0 sec";
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`;
  let whole = Math.floor(minutes);
  let seconds = Math.round((minutes - whole) * 60);
  if (seconds === 60) {
    whole += 1;
    seconds = 0;
  }
  return seconds > 0 ? `${whole} min ${seconds} sec` : `${whole} min`;
}
