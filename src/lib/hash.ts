/** WebCrypto digest helpers — SHA-1/256/384/512 over text or buffers. */

export const HASH_ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

export async function digest(
  algorithm: HashAlgorithm,
  data: Uint8Array | string,
): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const buffer = await crypto.subtle.digest(algorithm, bytes as unknown as BufferSource);
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseDigestInput(input: string): string {
  return input.trim().toLowerCase().replace(/[\s:]/g, "");
}
