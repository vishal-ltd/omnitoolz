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

describe("search vocabulary", () => {
  // People do not type the catalogue's words. These are the phrasings that used
  // to return nothing at all.
  it.each([
    ["resize photo", "resize-image"],
    ["resize picture", "resize-image"],
    ["shrink a picture", "compress-image"],
    ["make an image smaller", "compress-image"],
    ["combine pdfs", "merge-pdf"],
    ["join two pdfs", "merge-pdf"],
    ["erase background", "background-remover"],
    ["remove background", "background-remover"],
    ["make a qr code", "qr-code-generator"],
    ["secure a pdf", "protect-pdf"],
    ["check a password", "password-auditor"],
    ["count words", "word-counter"],
  ])("finds %s", (query, expectedId) => {
    const hits = searchTools(query);
    expect(hits.map((hit) => hit.id)).toContain(expectedId);
  });

  it("still returns nothing when a word means nothing here", () => {
    expect(searchTools("merge unicorns")).toEqual([]);
  });
});
