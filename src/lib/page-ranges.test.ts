import { describe, expect, it } from "vitest";
import {
  computeSplitGroups,
  PageRangeError,
  parsePageRanges,
} from "./page-ranges";

describe("parsePageRanges", () => {
  it("parses single pages and spans to 0-based indexes", () => {
    expect(parsePageRanges("1-3, 5, 8-10", 10)).toEqual([0, 1, 2, 4, 7, 8, 9]);
  });

  it("ignores duplicates keeping first occurrence and order", () => {
    expect(parsePageRanges("3, 1, 3, 2-3", 5)).toEqual([2, 0, 1]);
  });

  it("accepts reversed spans", () => {
    expect(parsePageRanges("7-2", 10)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("tolerates whitespace around separators", () => {
    expect(parsePageRanges(" 1 , 2 ", 3)).toEqual([0, 1]);
  });

  it("rejects out-of-range pages with a friendly message", () => {
    expect(() => parsePageRanges("11", 10)).toThrow(PageRangeError);
    expect(() => parsePageRanges("1-20", 10)).toThrow(/out of range/i);
  });

  it("rejects malformed input", () => {
    expect(() => parsePageRanges("", 10)).toThrow(PageRangeError);
    expect(() => parsePageRanges("abc", 10)).toThrow(PageRangeError);
    expect(() => parsePageRanges("1,,2", 10)).toThrow(PageRangeError);
    expect(() => parsePageRanges("0", 10)).toThrow(PageRangeError);
  });
});

describe("computeSplitGroups", () => {
  it("splits into fixed chunks", () => {
    const groups = computeSplitGroups("chunks", "4", 12);
    expect(groups.map((g) => g.label)).toEqual(["pages-1-4", "pages-5-8", "pages-9-12"]);
    expect(groups[1].pages).toEqual([4, 5, 6, 7]);
  });

  it("produces a trailing partial chunk", () => {
    const groups = computeSplitGroups("chunks", "5", 12);
    expect(groups).toHaveLength(3);
    expect(groups[2].label).toBe("pages-11-12");
    expect(groups[2].pages).toEqual([10, 11]);
  });

  it("one file per page in single mode", () => {
    const groups = computeSplitGroups("single", "", 3);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toEqual({ label: "page-1", pages: [0] });
  });

  it("custom ranges map one-to-one to groups", () => {
    const groups = computeSplitGroups("ranges", "1-3, 5, 7-8", 8);
    expect(groups).toHaveLength(3);
    expect(groups[0].pages).toEqual([0, 1, 2]);
    expect(groups[1].pages).toEqual([4]);
  });

  it("rejects invalid chunk sizes and ranges", () => {
    expect(() => computeSplitGroups("chunks", "0", 10)).toThrow(PageRangeError);
    expect(() => computeSplitGroups("chunks", "99", 10)).toThrow(PageRangeError);
    expect(() => computeSplitGroups("chunks", "abc", 10)).toThrow(PageRangeError);
    expect(() => computeSplitGroups("ranges", "1-3,,5", 10)).toThrow(PageRangeError);
  });
});
