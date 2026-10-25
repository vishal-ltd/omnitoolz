/**
 * ICO container builder — packs PNG images into a valid .ico file
 * (PNG-compressed entries are the modern, Vista+ flavor all browsers write).
 */

export interface IcoEntry {
  /** 1–256. 256 is stored as 0 in the directory byte. */
  size: number;
  /** A complete PNG file, header included. */
  png: Uint8Array;
}

export function buildIco(entries: IcoEntry[]): Uint8Array {
  if (entries.length === 0) throw new Error("An ICO needs at least one image.");
  const headerSize = 6;
  const entrySize = 16;
  const directorySize = headerSize + entries.length * entrySize;
  const totalPngBytes = entries.reduce((sum, entry) => sum + entry.png.length, 0);
  const out = new Uint8Array(directorySize + totalPngBytes);
  const view = new DataView(out.buffer);

  // ICONDIR
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, entries.length, true);

  let offset = directorySize;
  entries.forEach((entry, index) => {
    if (entry.size < 1 || entry.size > 256) throw new Error(`ICO size ${entry.size} is out of range 1–256.`);
    const base = headerSize + index * entrySize;
    const byte = entry.size === 256 ? 0 : entry.size;
    out[base] = byte; // width
    out[base + 1] = byte; // height
    out[base + 2] = 0; // palette count
    out[base + 3] = 0; // reserved
    view.setUint16(base + 4, 1, true); // color planes
    view.setUint16(base + 6, 32, true); // bits per pixel
    view.setUint32(base + 8, entry.png.length, true);
    view.setUint32(base + 12, offset, true);
    out.set(entry.png, offset);
    offset += entry.png.length;
  });

  return out;
}

/** Parse an ICO back into its directory — used by tests and quick sanity checks. */
export function parseIcoDirectory(
  ico: Uint8Array,
): Array<{ width: number; height: number; byteSize: number }> {
  const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
  const count = view.getUint16(4, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const base = 6 + i * 16;
    const rawWidth = ico[base];
    const rawHeight = ico[base + 1];
    entries.push({
      width: rawWidth === 0 ? 256 : rawWidth,
      height: rawHeight === 0 ? 256 : rawHeight,
      byteSize: view.getUint32(base + 8, true),
    });
  }
  return entries;
}
