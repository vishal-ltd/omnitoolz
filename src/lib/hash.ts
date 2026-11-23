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

/*
 * Incremental SHA-1/256/384/512. WebCrypto's digest() has no update() — it
 * needs the whole message in one buffer, which would force large files to be
 * held in memory twice. These cores let the file verifier hash chunk-by-chunk
 * with a constant ~128-byte working buffer. Cross-checked against node:crypto
 * in hash.test.ts.
 */

export interface StreamingHash {
  update: (chunk: Uint8Array) => void;
  /** Finalizes and returns the hex digest; repeated calls return the same value. */
  hex: () => string;
}

interface HashCore {
  blockSize: number;
  process: (block: Uint8Array, offset: number) => void;
  digest: () => Uint8Array;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function wordsToBytes(words: Int32Array, byteLength: number): Uint8Array {
  const out = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) out[i] = (words[i >> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  return out;
}

function loadWords(block: Uint8Array, offset: number, words: Int32Array, count: number): void {
  for (let i = 0; i < count; i++) {
    const j = offset + i * 4;
    words[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3];
  }
}

function sha1Core(): HashCore {
  const h = Int32Array.from([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
  const w = new Int32Array(80);
  function process(block: Uint8Array, offset: number): void {
    loadWords(block, offset, w, 16);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0;
  }
  return { blockSize: 64, process, digest: () => wordsToBytes(h, 20) };
}

// FIPS 180-4 round constants (fractional parts of prime square/cube roots).
const K256 = Int32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Core(): HashCore {
  const h = Int32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Int32Array(64);
  function process(block: Uint8Array, offset: number): void {
    loadWords(block, offset, w, 16);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  return { blockSize: 64, process, digest: () => wordsToBytes(h, 32) };
}

// SHA-512 works on 64-bit words; JS numbers only hold 53 bits, so each word is
// a (hi, lo) pair of 32-bit halves. Helpers write results into RH/RL scratch —
// single-threaded and allocation-free. Rotation counts never equal 32.
let RH = 0;
let RL = 0;

function rotr64(hi: number, lo: number, n: number): void {
  if (n < 32) {
    RH = (hi >>> n) | (lo << (32 - n));
    RL = (lo >>> n) | (hi << (32 - n));
  } else {
    const m = n - 32;
    RH = (lo >>> m) | (hi << (32 - m));
    RL = (hi >>> m) | (lo << (32 - m));
  }
}

function shr64(hi: number, lo: number, n: number): void {
  RH = hi >>> n;
  RL = (lo >>> n) | (hi << (32 - n));
}

function add64(ahi: number, alo: number, bhi: number, blo: number): void {
  const lo = (alo >>> 0) + (blo >>> 0);
  RH = (ahi + bhi + (lo > 0xffffffff ? 1 : 0)) | 0;
  RL = lo | 0;
}

const IV512 = [
  0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1,
  0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179,
];
const IV384 = [
  0xcbbb9d5d, 0xc1059ed8, 0x629a292a, 0x367cd507, 0x9159015a, 0x3070dd17, 0x152fecd8, 0xf70e5939,
  0x67332667, 0xffc00b31, 0x8eb44a87, 0x68581511, 0xdb0c2e0d, 0x64f98fa7, 0x47b5481d, 0xbefa4fa4,
];
const K512 = Int32Array.from([
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
  0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019, 0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
  0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
  0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3, 0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
  0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
  0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725, 0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
  0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
  0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001, 0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
  0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
  0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb, 0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
  0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
  0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207, 0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
  0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
  0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a, 0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817,
]);

function sha512Core(iv: readonly number[], digestBytes: number): HashCore {
  const h = Int32Array.from(iv);
  const w = new Int32Array(160);
  function process(block: Uint8Array, offset: number): void {
    loadWords(block, offset, w, 32);
    for (let i = 16; i < 80; i++) {
      const xh = w[2 * i - 30], xl = w[2 * i - 29];
      const yh = w[2 * i - 4], yl = w[2 * i - 3];
      // σ0 = rotr1(x) ^ rotr8(x) ^ shr7(x)
      rotr64(xh, xl, 1); const r1h = RH, r1l = RL;
      rotr64(xh, xl, 8); const r2h = RH, r2l = RL;
      shr64(xh, xl, 7);
      const s0h = r1h ^ r2h ^ RH, s0l = r1l ^ r2l ^ RL;
      // σ1 = rotr19(y) ^ rotr61(y) ^ shr6(y)
      rotr64(yh, yl, 19); const r3h = RH, r3l = RL;
      rotr64(yh, yl, 61); const r4h = RH, r4l = RL;
      shr64(yh, yl, 6);
      const s1h = r3h ^ r4h ^ RH, s1l = r3l ^ r4l ^ RL;
      add64(w[2 * i - 32], w[2 * i - 31], s0h, s0l);
      add64(RH, RL, w[2 * i - 14], w[2 * i - 13]);
      add64(RH, RL, s1h, s1l);
      w[2 * i] = RH; w[2 * i + 1] = RL;
    }
    let ah = h[0], al = h[1], bh = h[2], bl = h[3], ch = h[4], cl = h[5], dh = h[6], dl = h[7];
    let eh = h[8], el = h[9], fh = h[10], fl = h[11], gh = h[12], gl = h[13], hh = h[14], hl = h[15];
    for (let i = 0; i < 80; i++) {
      // Σ1 = rotr14(e) ^ rotr18(e) ^ rotr41(e)
      rotr64(eh, el, 14); const u1h = RH, u1l = RL;
      rotr64(eh, el, 18); const u2h = RH, u2l = RL;
      rotr64(eh, el, 41);
      const S1h = u1h ^ u2h ^ RH, S1l = u1l ^ u2l ^ RL;
      const chh = (eh & fh) ^ (~eh & gh), chl = (el & fl) ^ (~el & gl);
      // t1 = h + Σ1 + Ch(e,f,g) + K[i] + W[i]
      add64(hh, hl, S1h, S1l);
      add64(RH, RL, chh, chl);
      add64(RH, RL, K512[2 * i], K512[2 * i + 1]);
      add64(RH, RL, w[2 * i], w[2 * i + 1]);
      const t1h = RH, t1l = RL;
      // Σ0 = rotr28(a) ^ rotr34(a) ^ rotr39(a)
      rotr64(ah, al, 28); const v1h = RH, v1l = RL;
      rotr64(ah, al, 34); const v2h = RH, v2l = RL;
      rotr64(ah, al, 39);
      const S0h = v1h ^ v2h ^ RH, S0l = v1l ^ v2l ^ RL;
      const majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const majl = (al & bl) ^ (al & cl) ^ (bl & cl);
      add64(S0h, S0l, majh, majl);
      const t2h = RH, t2l = RL;
      hh = gh; hl = gl;
      gh = fh; gl = fl;
      fh = eh; fl = el;
      add64(dh, dl, t1h, t1l); eh = RH; el = RL;
      dh = ch; dl = cl;
      ch = bh; cl = bl;
      bh = ah; bl = al;
      add64(t1h, t1l, t2h, t2l); ah = RH; al = RL;
    }
    add64(h[0], h[1], ah, al); h[0] = RH; h[1] = RL;
    add64(h[2], h[3], bh, bl); h[2] = RH; h[3] = RL;
    add64(h[4], h[5], ch, cl); h[4] = RH; h[5] = RL;
    add64(h[6], h[7], dh, dl); h[6] = RH; h[7] = RL;
    add64(h[8], h[9], eh, el); h[8] = RH; h[9] = RL;
    add64(h[10], h[11], fh, fl); h[10] = RH; h[11] = RL;
    add64(h[12], h[13], gh, gl); h[12] = RH; h[13] = RL;
    add64(h[14], h[15], hh, hl); h[14] = RH; h[15] = RL;
  }
  return { blockSize: 128, process, digest: () => wordsToBytes(h, digestBytes) };
}

export function createStreamingHash(algorithm: HashAlgorithm): StreamingHash {
  const core =
    algorithm === "SHA-1"
      ? sha1Core()
      : algorithm === "SHA-256"
        ? sha256Core()
        : sha512Core(algorithm === "SHA-384" ? IV384 : IV512, algorithm === "SHA-384" ? 48 : 64);
  const { blockSize } = core;
  const buffer = new Uint8Array(blockSize);
  let bufferLen = 0;
  let totalLen = 0;
  let cached: string | null = null;
  return {
    update(chunk) {
      totalLen += chunk.length;
      let offset = 0;
      if (bufferLen > 0) {
        const take = Math.min(blockSize - bufferLen, chunk.length);
        buffer.set(chunk.subarray(0, take), bufferLen);
        bufferLen += take;
        offset = take;
        if (bufferLen === blockSize) {
          core.process(buffer, 0);
          bufferLen = 0;
        }
      }
      while (offset + blockSize <= chunk.length) {
        core.process(chunk, offset);
        offset += blockSize;
      }
      if (offset < chunk.length) {
        buffer.set(chunk.subarray(offset), 0);
        bufferLen = chunk.length - offset;
      }
    },
    hex() {
      if (cached !== null) return cached;
      // FIPS 180-4 padding: 0x80, zeros, then the bit length big-endian in the
      // last 8 bytes (SHA-512/384 use a 128-bit field; its high half stays zero
      // for any input that fits in memory).
      const lengthBytes = blockSize === 64 ? 8 : 16;
      const blocks = bufferLen + 1 + lengthBytes <= blockSize ? 1 : 2;
      const tail = new Uint8Array(blocks * blockSize);
      tail.set(buffer.subarray(0, bufferLen), 0);
      tail[bufferLen] = 0x80;
      const end = tail.length;
      const bitsHi = Math.floor(totalLen / 536870912); // (totalLen * 8) >>> 32
      const bitsLo = (totalLen % 536870912) * 8;
      tail[end - 8] = (bitsHi >>> 24) & 0xff;
      tail[end - 7] = (bitsHi >>> 16) & 0xff;
      tail[end - 6] = (bitsHi >>> 8) & 0xff;
      tail[end - 5] = bitsHi & 0xff;
      tail[end - 4] = (bitsLo >>> 24) & 0xff;
      tail[end - 3] = (bitsLo >>> 16) & 0xff;
      tail[end - 2] = (bitsLo >>> 8) & 0xff;
      tail[end - 1] = bitsLo & 0xff;
      core.process(tail, 0);
      if (blocks === 2) core.process(tail, blockSize);
      cached = toHex(core.digest());
      return cached;
    },
  };
}
