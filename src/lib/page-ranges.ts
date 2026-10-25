/**
 * Page-range parsing shared by the PDF tools.
 *
 * Syntax: comma-separated items; each item is a single page ("5") or an
 * inclusive span ("2-7"). Whitespace is tolerated. Pages are 1-based in the
 * user-facing syntax and returned as 0-based indexes for processing.
 */

export class PageRangeError extends Error {}

function parsePositiveInt(token: string): number {
  if (!/^\d+$/.test(token)) {
    throw new PageRangeError(`“${token}” is not a valid page number.`);
  }
  const value = Number.parseInt(token, 10);
  if (value < 1) throw new PageRangeError("Page numbers start at 1.");
  return value;
}

/**
 * Parse a range expression into 0-based page indexes in the order given.
 * Duplicates are ignored (first occurrence wins); spans may be reversed
 * ("7-2" is interpreted as 2..7).
 */
export function parsePageRanges(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) throw new PageRangeError("Enter at least one page or range, e.g. “1-3, 5”.");
  if (pageCount < 1) throw new PageRangeError("The document has no pages.");

  const seen = new Set<number>();
  const pages: number[] = [];
  for (const itemRaw of trimmed.split(",")) {
    const item = itemRaw.trim();
    if (!item) throw new PageRangeError("Empty item in the page list — check for double commas.");
    const match = /^(\d+)\s*-\s*(\d+)$/.exec(item);
    if (match) {
      let from = parsePositiveInt(match[1]);
      let to = parsePositiveInt(match[2]);
      if (from > to) [from, to] = [to, from];
      for (let page = from; page <= to; page++) push(page);
    } else {
      push(parsePositiveInt(item));
    }
  }

  function push(page: number): void {
    if (page > pageCount) {
      throw new PageRangeError(`Page ${page} is out of range — the document has ${pageCount} ${pageCount === 1 ? "page" : "pages"}.`);
    }
    const index = page - 1;
    if (!seen.has(index)) {
      seen.add(index);
      pages.push(index);
    }
  }

  return pages;
}

export interface PageGroup {
  label: string;
  /** 0-based page indexes. */
  pages: number[];
}

/** Split mode used by the Split PDF tool. */
export type SplitMode = "ranges" | "chunks" | "single";

/**
 * Compute the split groups for a document.
 * - "ranges": `spec` is a comma-separated list; each item becomes one output file.
 * - "chunks": `spec` is the chunk size as a decimal string.
 * - "single": one group per page.
 */
export function computeSplitGroups(mode: SplitMode, spec: string, pageCount: number): PageGroup[] {
  if (pageCount < 1) throw new PageRangeError("The document has no pages.");
  if (mode === "single") {
    return Array.from({ length: pageCount }, (_, i) => ({
      label: `page-${i + 1}`,
      pages: [i],
    }));
  }
  if (mode === "chunks") {
    if (!/^\d+$/.test(spec.trim())) throw new PageRangeError("Chunk size must be a whole number.");
    const size = Number.parseInt(spec, 10);
    if (size < 1) throw new PageRangeError("Chunk size must be at least 1.");
    if (size > pageCount) throw new PageRangeError(`Chunk size (${size}) is larger than the document (${pageCount} pages).`);
    const groups: PageGroup[] = [];
    for (let start = 0; start < pageCount; start += size) {
      const end = Math.min(start + size, pageCount);
      groups.push({
        label: start + 1 === end ? `page-${start + 1}` : `pages-${start + 1}-${end}`,
        pages: Array.from({ length: end - start }, (_, i) => start + i),
      });
    }
    return groups;
  }
  // ranges
  const trimmed = spec.trim();
  if (!trimmed) throw new PageRangeError("Enter at least one range, e.g. “1-3, 4-8”.");
  return trimmed.split(",").map((itemRaw, i) => {
    const item = itemRaw.trim();
    if (!item) throw new PageRangeError("Empty item in the range list — check for double commas.");
    const match = /^(\d+)\s*-\s*(\d+)$/.exec(item);
    if (match) {
      let from = Number.parseInt(match[1], 10);
      let to = Number.parseInt(match[2], 10);
      if (from < 1 || to < 1) throw new PageRangeError("Page numbers start at 1.");
      if (from > to) [from, to] = [to, from];
      if (to > pageCount) {
        throw new PageRangeError(`Range “${item}” is out of range — the document has ${pageCount} pages.`);
      }
      return {
        label: from === to ? `page-${from}` : `pages-${from}-${to}`,
        pages: Array.from({ length: to - from + 1 }, (_, k) => from - 1 + k),
      };
    }
    if (/^\d+$/.test(item)) {
      const page = Number.parseInt(item, 10);
      if (page < 1 || page > pageCount) {
        throw new PageRangeError(`Page ${page} is out of range — the document has ${pageCount} pages.`);
      }
      return { label: `page-${page}`, pages: [page - 1] };
    }
    throw new PageRangeError(`“${item}” is not a valid page or range (item ${i + 1}).`);
  });
}

export function pageCountLabel(count: number): string {
  return `${count} ${count === 1 ? "page" : "pages"}`;
}
