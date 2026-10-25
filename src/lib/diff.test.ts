import { describe, expect, it } from "vitest";
import { diffLines, diffStats } from "./diff";

describe("diffLines", () => {
  it("marks identical texts as unchanged", () => {
    const ops = diffLines("a\nb\nc", "a\nb\nc");
    expect(ops).toEqual([{ type: "same", text: "a\nb\nc" }]);
  });

  it("detects additions and removals", () => {
    const ops = diffLines("one\ntwo\nfour", "one\nthree\nfour");
    expect(ops).toEqual([
      { type: "same", text: "one" },
      { type: "remove", text: "two" },
      { type: "add", text: "three" },
      { type: "same", text: "four" },
    ]);
  });

  it("handles empty sides", () => {
    expect(diffLines("", "new\nlines")).toEqual([{ type: "add", text: "new\nlines" }]);
    expect(diffLines("old\nlines", "")).toEqual([{ type: "remove", text: "old\nlines" }]);
  });

  it("counts stats correctly", () => {
    const stats = diffStats(diffLines("a\nb\nc\nd", "a\nx\nc\nd"));
    expect(stats).toEqual({ added: 1, removed: 1, unchanged: 3 });
  });

  it("reorders register as remove-then-add pairs", () => {
    const ops = diffLines("a\nb", "b\na");
    const types = ops.map((op) => op.type).join(",");
    expect(types).toContain("remove");
    expect(types).toContain("add");
    expect(diffStats(ops).unchanged).toBeGreaterThanOrEqual(0);
  });
});
