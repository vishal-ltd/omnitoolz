import { describe, expect, it } from "vitest";
import { insertAt, validateFiles } from "./file-queue";

function file(name: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type: "application/octet-stream" });
}

describe("validateFiles", () => {
  it("keeps a batch within the aggregate memory limit", () => {
    const result = validateFiles(
      [file("one.bin", 200), file("two.bin", 200), file("three.bin", 200)],
      0,
      { accept: [], multiple: true, maxFiles: 3, maxSizeMb: 1, maxTotalSizeMb: 0.0005 },
    );

    expect(result.accepted).toHaveLength(2);
    expect(result.errors[0]).toContain("total in-memory limit");
  });

  it("reports when a single-file queue is already occupied", () => {
    const result = validateFiles(
      [file("next.txt", 1)],
      1,
      { accept: ["txt"], multiple: false, maxFiles: 1, maxSizeMb: 1 },
    );

    expect(result.accepted).toEqual([]);
    expect(result.errors.some((error) => error.includes("remove it before choosing another"))).toBe(true);
  });
});

describe("insertAt (undo a removal)", () => {
  const make = (name: string) => new File(["x"], name, { type: "application/pdf" });

  it("puts the file back at its original position", () => {
    const a = make("a.pdf");
    const b = make("b.pdf");
    const c = make("c.pdf");
    expect(insertAt([a, c], b, 1, 5).map((f) => f.name)).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
  });

  it("appends when the queue shrank past the old index", () => {
    const a = make("a.pdf");
    const b = make("b.pdf");
    expect(insertAt([a], b, 4, 5).map((f) => f.name)).toEqual(["a.pdf", "b.pdf"]);
  });

  it("refuses to exceed the tool's file limit", () => {
    const a = make("a.pdf");
    const b = make("b.pdf");
    expect(insertAt([a], b, 0, 1)).toEqual([a]);
  });

  it("never duplicates a file already in the queue", () => {
    const a = make("a.pdf");
    expect(insertAt([a], a, 0, 5)).toEqual([a]);
  });
});
