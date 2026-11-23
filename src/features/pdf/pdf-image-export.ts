import { bytesToBlob } from "@/lib/utils";
import type { PDFDocument, PDFRawStream } from "pdf-lib";

/**
 * Lossless export of embedded PDF pictures. JPEGs pass through untouched; the
 * Flate/uncompressed RGB and grey images that producers write for PNGs and
 * screenshots are decoded to raw samples and re-encoded as PNG.
 */

export interface ExportedImage {
  name: string;
  blob: Blob;
}

type PdfLib = typeof import("pdf-lib");

interface Samples {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
}

/** Reverse the PNG row filters (PDF /Predictor 10-15). */
function undoPredictors(data: Uint8Array, rowBytes: number, bpp: number): Uint8Array {
  const rows = Math.floor(data.length / (rowBytes + 1));
  const out = new Uint8Array(rowBytes * rows);
  let source = 0;
  for (let row = 0; row < rows; row++) {
    const filter = data[source++];
    const target = row * rowBytes;
    const previous = row > 0 ? target - rowBytes : -1;
    for (let i = 0; i < rowBytes; i++) {
      const left = i >= bpp ? out[target + i - bpp] : 0;
      const up = previous >= 0 ? out[previous + i] : 0;
      const upLeft = previous >= 0 && i >= bpp ? out[previous + i - bpp] : 0;
      let value = data[source + i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      out[target + i] = value & 0xff;
    }
    source += rowBytes;
  }
  return out;
}

/** Decode an 8-bit grey/RGB image XObject to raw samples, or null when unsupported. */
async function decodeSamples(
  lib: PdfLib,
  doc: PDFDocument,
  stream: PDFRawStream,
  withAlpha: boolean,
): Promise<Samples | null> {
  const { PDFArray, PDFBool, PDFDict, PDFName, PDFNumber, PDFStream } = lib;
  const dict = stream.dict;
  const key = (name: string) => dict.get(PDFName.of(name));
  const numberOf = (value: ReturnType<typeof key>, fallback: number): number => {
    const resolved = doc.context.lookupMaybe(value!, PDFNumber);
    return resolved ? resolved.asNumber() : fallback;
  };

  if (doc.context.lookupMaybe(key("ImageMask")!, PDFBool)?.asBoolean()) return null;
  if (numberOf(key("BitsPerComponent"), 8) !== 8) return null;

  const width = numberOf(key("Width"), 0);
  const height = numberOf(key("Height"), 0);
  if (width <= 0 || height <= 0 || width * height > 40_000_000) return null;

  const space = doc.context.lookup(key("ColorSpace")!);
  const spaceName = space instanceof PDFName ? space.toString() : null;
  let channels: number;
  if (spaceName === "/DeviceRGB") channels = 3;
  else if (spaceName === "/DeviceGray") channels = 1;
  else if (space instanceof PDFArray && space.get(0) instanceof PDFName && space.get(0).toString() === "/ICCBased") {
    const profile = doc.context.lookupMaybe(space.get(1)!, PDFStream);
    const n = profile ? doc.context.lookupMaybe(profile.dict.get(PDFName.of("N"))!, PDFNumber) : undefined;
    channels = n?.asNumber() ?? 0;
    if (channels !== 1 && channels !== 3) return null;
  } else return null;

  const filterValue = doc.context.lookup(key("Filter")!);
  const filters =
    filterValue instanceof PDFArray
      ? filterValue.asArray().map((entry) => doc.context.lookup(entry)?.toString() ?? "")
      : [filterValue?.toString() ?? ""];
  if (filters.some((filter) => filter !== "" && filter !== "/FlateDecode")) return null;

  const parms = doc.context.lookupMaybe(key("DecodeParms")!, PDFDict);
  const parm = (name: string, fallback: number): number => {
    const value = parms?.get(PDFName.of(name));
    const resolved = value ? doc.context.lookupMaybe(value, PDFNumber) : undefined;
    return resolved ? resolved.asNumber() : fallback;
  };
  const predictor = parm("Predictor", 1);
  if (predictor !== 1 && predictor < 10) return null;
  if (parm("Colors", channels) !== channels) return null;
  const columns = parm("Columns", width);
  // Predictor rows are strided by Columns but toPng reads contiguously by
  // Width — a mismatch would shear the image. Refuse instead of corrupting.
  if (columns !== width) return null;

  let data: Uint8Array = stream.contents;
  if (filters.includes("/FlateDecode")) {
    const { unzlibSync, inflateSync } = await import("fflate");
    try {
      data = unzlibSync(data);
    } catch {
      try {
        data = inflateSync(data);
      } catch {
        return null;
      }
    }
  }

  const rowBytes = columns * channels;
  if (predictor >= 10) data = undoPredictors(data, rowBytes, channels);
  if (data.length < rowBytes * height) return null;
  if (!withAlpha) return { width, height, channels, data };

  const mask = doc.context.lookupMaybe(key("SMask")!, PDFStream);
  if (mask instanceof lib.PDFRawStream) {
    const alpha = await decodeSamples(lib, doc, mask, false);
    if (alpha && alpha.channels === 1 && alpha.width === width && alpha.height === height) {
      const merged = new Uint8Array(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        const grey = data[i * channels];
        merged[i * 4] = grey;
        merged[i * 4 + 1] = channels === 3 ? data[i * 3 + 1] : grey;
        merged[i * 4 + 2] = channels === 3 ? data[i * 3 + 2] : grey;
        merged[i * 4 + 3] = alpha.data[i];
      }
      return { width, height, channels: 4, data: merged };
    }
  }
  return { width, height, channels, data };
}

async function toPng({ width, height, channels, data }: Samples): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    if (channels === 4) {
      image.data.set(data.subarray(i * 4, i * 4 + 4), i * 4);
    } else if (channels === 3) {
      image.data[i * 4] = data[i * 3];
      image.data[i * 4 + 1] = data[i * 3 + 1];
      image.data[i * 4 + 2] = data[i * 3 + 2];
      image.data[i * 4 + 3] = 255;
    } else {
      image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = data[i];
      image.data[i * 4 + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Export one embedded image, or null when its encoding can't be handled losslessly. */
export async function exportEmbeddedImage(
  doc: PDFDocument,
  stream: PDFRawStream,
  index: number,
): Promise<ExportedImage | null> {
  const lib = await import("pdf-lib");
  const { PDFArray, PDFName, PDFStream } = lib;
  const filterValue = doc.context.lookup(stream.dict.get(PDFName.of("Filter"))!);
  const filters =
    filterValue instanceof PDFArray
      ? filterValue.asArray().map((entry) => doc.context.lookup(entry)?.toString() ?? "")
      : [filterValue?.toString() ?? ""];

  if (filters.length === 1 && filters[0] === "/DCTDecode") {
    // JPEG can't carry the attached SMask (alpha). Merge it into a PNG when
    // possible; otherwise skip honestly rather than silently dropping alpha.
    const maskRef = stream.dict.get(PDFName.of("SMask"));
    const mask = maskRef ? doc.context.lookupMaybe(maskRef, PDFStream) : undefined;
    if (mask instanceof lib.PDFRawStream) {
      const alpha = await decodeSamples(lib, doc, mask, false);
      const jpeg = new Blob([stream.contents.slice().buffer], { type: "image/jpeg" });
      const bitmap = await createImageBitmap(jpeg).catch(() => null);
      if (alpha && alpha.channels === 1 && bitmap && alpha.width === bitmap.width && alpha.height === bitmap.height) {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(bitmap, 0, 0);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < alpha.data.length; i++) image.data[i * 4 + 3] = alpha.data[i];
          context.putImageData(image, 0, 0);
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
          bitmap.close();
          if (blob) return { name: `image-${index}.png`, blob };
        } else {
          bitmap.close();
        }
      } else {
        bitmap?.close();
      }
      return null;
    }
    return { name: `image-${index}.jpg`, blob: bytesToBlob(stream.contents, "image/jpeg") };
  }

  const samples = await decodeSamples(lib, doc, stream, true);
  if (!samples) return null;
  const blob = await toPng(samples);
  return blob ? { name: `image-${index}.png`, blob } : null;
}