import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createStreamingHash, digest, HASH_ALGORITHMS, parseDigestInput } from "./hash";

/** Deterministic pseudo-random bytes so failures are reproducible. */
function lcgBytes(length: number, seed = 42): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed >>> 0;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out[i] = state >>> 24;
  }
  return out;
}

function nodeDigest(algorithm: string, bytes: Uint8Array): string {
  return createHash(algorithm.toLowerCase().replace("-", "")).update(bytes).digest("hex");
}

describe("createStreamingHash", () => {
  // Padding boundaries: 55/56 and 111/112 are where the length field spills
  // into a second block for 64- and 128-byte blocks respectively.
  const lengths = [0, 1, 3, 55, 56, 63, 64, 65, 111, 112, 119, 120, 127, 128, 129, 255, 1000, 4096];
  const chunkSizes = [1, 7, 64, 128, 1000, Infinity];

  for (const algorithm of HASH_ALGORITHMS) {
    it(`${algorithm} matches node:crypto across lengths and chunkings`, () => {
      for (const length of lengths) {
        const bytes = lcgBytes(length);
        const expected = nodeDigest(algorithm, bytes);
        for (const chunkSize of chunkSizes) {
          const hasher = createStreamingHash(algorithm);
          for (let offset = 0; offset < length; offset += chunkSize) {
            hasher.update(bytes.subarray(offset, Math.min(offset + chunkSize, length)));
          }
          expect(hasher.hex(), `${algorithm} len=${length} chunk=${chunkSize}`).toBe(expected);
        }
      }
    });
  }

  it("matches the classic 'abc' vectors", () => {
    const abc = new TextEncoder().encode("abc");
    const expected: Record<string, string> = {
      "SHA-1": "a9993e364706816aba3e25717850c26c9cd0d89d",
      "SHA-256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      "SHA-384": "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
      "SHA-512": "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    };
    for (const algorithm of HASH_ALGORITHMS) {
      const hasher = createStreamingHash(algorithm);
      hasher.update(abc);
      expect(hasher.hex()).toBe(expected[algorithm]);
    }
  });

  it("agrees with the WebCrypto digest helper on text", async () => {
    const text = "héllo wörld ✓ 你好 🌍";
    const bytes = new TextEncoder().encode(text);
    for (const algorithm of HASH_ALGORITHMS) {
      const hasher = createStreamingHash(algorithm);
      hasher.update(bytes.subarray(0, 5));
      hasher.update(new Uint8Array(0)); // empty chunks must be no-ops
      hasher.update(bytes.subarray(5));
      expect(hasher.hex()).toBe(await digest(algorithm, text));
    }
  });

  it("hex() is idempotent after finalization", () => {
    const hasher = createStreamingHash("SHA-256");
    hasher.update(lcgBytes(200));
    const first = hasher.hex();
    expect(hasher.hex()).toBe(first);
    expect(hasher.hex()).toBe(first);
  });

  it("hashes a multi-megabyte input correctly", () => {
    const bytes = lcgBytes(3 * 1024 * 1024, 7);
    const hasher = createStreamingHash("SHA-256");
    for (let offset = 0; offset < bytes.length; offset += 65_536) {
      hasher.update(bytes.subarray(offset, offset + 65_536));
    }
    expect(hasher.hex()).toBe(nodeDigest("SHA-256", bytes));
  });
});

describe("digest / parseDigestInput", () => {
  it("digest encodes strings as UTF-8", async () => {
    expect(await digest("SHA-256", "abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("normalizes published checksums for comparison", () => {
    expect(parseDigestInput(" AB:CD ef ")).toBe("abcdef");
  });
});
