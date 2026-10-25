import { describe, expect, it } from "vitest";
import { buildIco, parseIcoDirectory } from "./ico";

function fakePng(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  // PNG signature for realism
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
}

describe("buildIco", () => {
  it("writes a valid header and one directory entry per image", () => {
    const pngA = fakePng(1000);
    const pngB = fakePng(2000);
    const ico = buildIco([
      { size: 16, png: pngA },
      { size: 48, png: pngB },
    ]);

    const view = new DataView(ico.buffer);
    expect(view.getUint16(0, true)).toBe(0); // reserved
    expect(view.getUint16(2, true)).toBe(1); // type icon
    expect(view.getUint16(4, true)).toBe(2); // count

    const entries = parseIcoDirectory(ico);
    expect(entries).toEqual([
      { width: 16, height: 16, byteSize: 1000 },
      { width: 48, height: 48, byteSize: 2000 },
    ]);
  });

  it("stores 256px as the 0 byte per the spec", () => {
    const ico = buildIco([{ size: 256, png: fakePng(500) }]);
    const entries = parseIcoDirectory(ico);
    expect(entries[0].width).toBe(256);
  });

  it("places PNG payloads contiguously after the directory", () => {
    const pngA = fakePng(100);
    const pngB = fakePng(300);
    const ico = buildIco([
      { size: 16, png: pngA },
      { size: 32, png: pngB },
    ]);
    expect(ico.length).toBe(6 + 2 * 16 + 400);
    // First PNG starts at 38 and carries the PNG signature
    expect([...ico.slice(38, 46)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // Second payload follows immediately
    expect([...ico.slice(138, 146)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("rejects empty sets and out-of-range sizes", () => {
    expect(() => buildIco([])).toThrow();
    expect(() => buildIco([{ size: 300, png: fakePng(10) }])).toThrow();
    expect(() => buildIco([{ size: 0, png: fakePng(10) }])).toThrow();
  });
});
