import { describe, expect, it } from "vitest";
import { validateFiles } from "./file-queue";

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
