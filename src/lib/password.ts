/**
 * Password generation with an unbiased, cryptographically secure random source.
 * Works in browsers and Node 20+ (both expose crypto.getRandomValues).
 */

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** Drop look-alike characters I, l, 1, O, 0 (and the easily confused |). */
  excludeAmbiguous: boolean;
}

export const AMBIGUOUS_CHARS = "Il1O0|";

export const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
} as const;

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

/** Uniform random integer in [0, max) using rejection sampling (no modulo bias). */
export function secureRandomInt(max: number): number {
  if (max <= 0 || !Number.isInteger(max)) throw new RangeError("max must be a positive integer");
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error("A cryptographic random source is required but unavailable.");
  }
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  // Rejection sampling: values >= limit would skew the distribution.
  for (;;) {
    cryptoObj.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

export function buildPool(options: PasswordOptions): string {
  const active: string[] = [];
  if (options.uppercase) active.push(CHARSETS.uppercase);
  if (options.lowercase) active.push(CHARSETS.lowercase);
  if (options.digits) active.push(CHARSETS.digits);
  if (options.symbols) active.push(CHARSETS.symbols);
  let pool = active.join("");
  if (!pool) return "";
  if (options.excludeAmbiguous) {
    const drop = new Set(AMBIGUOUS_CHARS);
    pool = [...pool].filter((c) => !drop.has(c)).join("");
  }
  return pool;
}

/** Shannon entropy of a random password: length × log2(pool size). */
export function entropyBits(length: number, poolSize: number): number {
  if (length <= 0 || poolSize <= 1) return 0;
  return length * Math.log2(poolSize);
}

export function generatePassword(options: PasswordOptions): string {
  const pool = buildPool(options);
  if (!pool) throw new Error("Select at least one character set.");
  const length = Math.round(options.length);
  if (length < 4) throw new Error("Password length must be at least 4.");

  // Guarantee at least one character from each selected set, then fill randomly.
  const required: string[] = [];
  if (options.uppercase) required.push(pickFrom(filterSet(CHARSETS.uppercase, options.excludeAmbiguous)));
  if (options.lowercase) required.push(pickFrom(filterSet(CHARSETS.lowercase, options.excludeAmbiguous)));
  if (options.digits) required.push(pickFrom(filterSet(CHARSETS.digits, options.excludeAmbiguous)));
  if (options.symbols) required.push(pickFrom(filterSet(CHARSETS.symbols, options.excludeAmbiguous)));

  const chars: string[] = required.slice(0, length);
  while (chars.length < length) chars.push(pool[secureRandomInt(pool.length)]);

  // Fisher–Yates with the secure source so the guaranteed chars aren't predictable.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function filterSet(set: string, excludeAmbiguous: boolean): string {
  if (!excludeAmbiguous) return set;
  const drop = new Set(AMBIGUOUS_CHARS);
  return [...set].filter((c) => !drop.has(c)).join("");
}

function pickFrom(set: string): string {
  return set[secureRandomInt(set.length)];
}

export type StrengthLevel = "weak" | "fair" | "strong" | "excellent";

export function strengthFromEntropy(bits: number): StrengthLevel {
  if (bits < 40) return "weak";
  if (bits < 65) return "fair";
  if (bits < 90) return "strong";
  return "excellent";
}

export const strengthLabels: Record<StrengthLevel, string> = {
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
  excellent: "Excellent",
};
