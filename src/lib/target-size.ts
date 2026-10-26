/**
 * Target-size image compression core — binary-search the encoder quality,
 * fall back to dimension scaling when quality alone can't reach the target.
 * Pure and DOM-free: the caller injects the encode function.
 */

export interface QualitySearchResult {
  /** Best quality whose output fits the target. */
  quality: number;
  /** Encoded size in bytes at that quality. */
  sizeBytes: number;
  /** True when the target was met; false = closest possible below min quality. */
  hit: boolean;
}

export interface SearchOptions {
  /** Lowest quality the search may use (artifacts dominate below this). */
  minQ?: number;
  /** Highest quality tried first (never need to exceed this). */
  maxQ?: number;
  /** Max search iterations (log2 of the range is ~7; cap defensively). */
  maxIterations?: number;
}

/**
 * Binary-search encoder quality for the largest quality whose output size
 * fits `targetBytes`. The encoder must return monotonic (non-strictly)
 * decreasing sizes for decreasing quality — true for JPEG/WebP encoders.
 */
export async function findQualityForTarget(
  encode: (quality: number) => Promise<number> | number,
  targetBytes: number,
  options: SearchOptions = {},
): Promise<QualitySearchResult> {
  const minQ = options.minQ ?? 20;
  const maxQ = options.maxQ ?? 95;
  const maxIterations = options.maxIterations ?? 8;

  if (targetBytes <= 0) throw new Error("Target size must be positive.");

  let lo = minQ; // known: size(minQ) is the smallest we can offer
  let hi = maxQ; // known: size(maxQ) is the largest
  const sizeAt = async (q: number) => await encode(q);

  const minSize = await sizeAt(minQ);
  if (minSize > targetBytes) {
    // Even minimum quality can't fit — return the smallest possible honestly.
    return { quality: minQ, sizeBytes: minSize, hit: false };
  }
  const maxSize = await sizeAt(maxQ);
  if (maxSize <= targetBytes) {
    // Everything fits — give the best quality outright.
    return { quality: maxQ, sizeBytes: maxSize, hit: true };
  }

  // Invariant: size(lo) <= target < size(hi). Converge on the boundary.
  let bestQ = minQ;
  let bestSize = minSize;
  for (let i = 0; i < maxIterations && hi - lo > 1; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const size = await sizeAt(mid);
    if (size <= targetBytes) {
      lo = mid;
      bestQ = mid;
      bestSize = size;
    } else {
      hi = mid;
    }
  }
  return { quality: bestQ, sizeBytes: bestSize, hit: true };
}

export interface ScaleStepResult {
  scale: number;
  quality: number;
  sizeBytes: number;
}

/**
 * Dimension fallback: given an encoder that takes (quality, scale), find a
 * scale below `startScale` that lets the quality search fit the target.
 * Returns the closest attempt when nothing fits before `minScale`.
 */
export async function findScaleForTarget(
  encode: (quality: number, scale: number) => Promise<number> | number,
  targetBytes: number,
  options: SearchOptions & { startScale?: number; minScale?: number; scaleStep?: number } = {},
): Promise<{ search: QualitySearchResult; scale: number } | null> {
  const startScale = options.startScale ?? 1;
  const minScale = options.minScale ?? 0.15;
  const step = options.scaleStep ?? 0.2;

  let scale = startScale;
  let closest: { search: QualitySearchResult; scale: number } | null = null;
  while (scale >= minScale) {
    const search = await findQualityForTarget(
      (q) => encode(q, scale),
      targetBytes,
      options,
    );
    if (search.hit) return { search, scale };
    if (!closest || search.sizeBytes < closest.search.sizeBytes) {
      closest = { search, scale };
    }
    scale = Math.round((scale - step) * 100) / 100;
  }
  return closest;
}

/** Parse user input like "150kb", "1.5 mb", "200" into bytes (null if invalid). */
export function parseTargetSize(input: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(kb|mb)?\s*$/i.exec(input);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] ?? "kb").toLowerCase();
  return Math.round(value * (unit === "mb" ? 1024 * 1024 : 1024));
}
