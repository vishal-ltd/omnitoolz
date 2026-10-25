import { describe, expect, it } from "vitest";
import { searchTools } from "./search";
import { liveTools } from "./tools/registry";

describe("searchTools", () => {
  it("finds by name prefix with top rank", () => {
    const hits = searchTools("merge");
    expect(hits[0]?.id).toBe("merge-pdf");
  });

  it("is case-insensitive and tolerates extra spaces", () => {
    expect(searchTools("  MERGE  ").length).toBeGreaterThan(0);
  });

  it("matches keywords like 'combine'", () => {
    const hits = searchTools("combine");
    expect(hits.some((h) => h.id === "merge-pdf")).toBe(true);
  });

  it("matches across category names", () => {
    const hits = searchTools("pdf");
    expect(hits.length).toBeGreaterThanOrEqual(5);
  });

  it("requires every term to match somewhere", () => {
    const hits = searchTools("merge unicorns");
    expect(hits.some((h) => h.id === "merge-pdf")).toBe(false);
  });

  it("returns nothing for short queries", () => {
    expect(searchTools("m")).toEqual([]);
    expect(searchTools("")).toEqual([]);
  });

  it("never returns planned tools", () => {
    for (const hit of searchTools("compress")) {
      expect(hit.status).toBe("live");
    }
  });

  it("covers every live tool with its route", () => {
    for (const tool of liveTools()) {
      expect(tool.route).toMatch(/^\/[a-z-]+\/[a-z0-9-]+$/);
    }
  });
});
