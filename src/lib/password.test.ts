import { describe, expect, it } from "vitest";
import {
  buildPool,
  entropyBits,
  generatePassword,
  secureRandomInt,
  strengthFromEntropy,
} from "./password";

describe("secureRandomInt", () => {
  it("returns values within range", () => {
    for (let i = 0; i < 200; i++) {
      const value = secureRandomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it("throws on invalid max", () => {
    expect(() => secureRandomInt(0)).toThrow(RangeError);
  });
});

describe("buildPool", () => {
  it("combines selected charsets", () => {
    const pool = buildPool({
      length: 10, uppercase: true, lowercase: false, digits: true, symbols: false, excludeAmbiguous: false,
    });
    expect(pool).toMatch(/^[A-Z0-9]+$/);
  });

  it("excludes ambiguous characters when asked", () => {
    const pool = buildPool({
      length: 10, uppercase: true, lowercase: true, digits: true, symbols: false, excludeAmbiguous: true,
    });
    expect(pool).not.toMatch(/[Il1O0|]/);
  });

  it("is empty when nothing is selected", () => {
    const pool = buildPool({
      length: 10, uppercase: false, lowercase: false, digits: false, symbols: false, excludeAmbiguous: false,
    });
    expect(pool).toBe("");
  });
});

describe("generatePassword", () => {
  const options = {
    length: 24, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: false,
  };

  it("matches the requested length", () => {
    expect(generatePassword(options)).toHaveLength(24);
  });

  it("includes at least one char from every selected set", () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword(options);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("produces different passwords across calls", () => {
    const set = new Set(Array.from({ length: 20 }, () => generatePassword(options)));
    expect(set.size).toBeGreaterThan(15);
  });

  it("respects excludeAmbiguous", () => {
    const strict = { ...options, excludeAmbiguous: true };
    for (let i = 0; i < 20; i++) {
      expect(generatePassword(strict)).not.toMatch(/[Il1O0|]/);
    }
  });

  it("throws when no charset is selected", () => {
    expect(() =>
      generatePassword({ ...options, uppercase: false, lowercase: false, digits: false, symbols: false }),
    ).toThrow(/at least one/i);
  });
});

describe("entropy and strength", () => {
  it("computes entropy as length × log2(pool)", () => {
    expect(entropyBits(16, 62)).toBeCloseTo(16 * Math.log2(62), 5);
    expect(entropyBits(0, 62)).toBe(0);
  });

  it("buckets strength levels", () => {
    expect(strengthFromEntropy(20)).toBe("weak");
    expect(strengthFromEntropy(50)).toBe("fair");
    expect(strengthFromEntropy(75)).toBe("strong");
    expect(strengthFromEntropy(128)).toBe("excellent");
  });
});
