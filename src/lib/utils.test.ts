import { describe, expect, it } from "vitest";
import {
  baseName,
  clamp,
  extensionOf,
  formatBytes,
  suffixedName,
  withExtension,
} from "./utils";

describe("formatBytes", () => {
  it("formats byte units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 * 5)).toBe("5.0 MB");
    expect(formatBytes(3.5 * 1024 ** 3)).toBe("3.5 GB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(-5)).toBe("—");
  });
});

describe("file name helpers", () => {
  it("baseName strips the last extension", () => {
    expect(baseName("report.pdf")).toBe("report");
    expect(baseName("archive.tar.gz")).toBe("archive.tar");
    expect(baseName("noext")).toBe("noext");
  });

  it("extensionOf lowercases", () => {
    expect(extensionOf("photo.JPG")).toBe("jpg");
    expect(extensionOf("noext")).toBe("");
  });

  it("withExtension swaps the extension", () => {
    expect(withExtension("photo.jpg", "png")).toBe("photo.png");
    expect(withExtension("photo", ".png")).toBe("photo.png");
  });

  it("suffixedName inserts before the extension", () => {
    expect(suffixedName("scan.pdf", "-rotated")).toBe("scan-rotated.pdf");
    expect(suffixedName("noext", "-x")).toBe("noext-x.bin");
  });
});

describe("clamp", () => {
  it("clamps to bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
