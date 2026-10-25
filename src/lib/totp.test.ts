import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { base32Decode } from "./base32";
import { secondsRemaining, totpAt, totpFromBase32 } from "./totp";

/** Independent reference implementation via node:crypto. */
function referenceTotp(secretHex: string, counter: number, digits: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const bytes = createHmac("sha1", Buffer.from(secretHex, "hex"))
    .update(message)
    .digest();
  const offset = bytes[bytes.length - 1] & 0x0f;
  const binary =
    ((bytes[offset] & 0x7f) << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

// The classic RFC test key: "12345678901234567890" in base32.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  it("matches an independent HMAC implementation across time steps", async () => {
    const secretBytes = base32Decode(RFC_SECRET);
    const secretHex = [...secretBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    for (const timestampMs of [0, 59_000, 1_111_111_109_000, 2_000_000_000_000, Date.now()]) {
      const counter = Math.floor(timestampMs / 1000 / 30);
      expect(await totpAt(secretBytes, timestampMs)).toBe(referenceTotp(secretHex, counter, 6));
    }
  });

  it("produces six digits with leading zeros preserved", async () => {
    const code = await totpFromBase32(RFC_SECRET, 1_111_111_109_000);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("generates the same code within one 30s window and a new one after", async () => {
    const windowStart = 990_000; // counter 33: [990000, 1020000)
    const a = await totpFromBase32(RFC_SECRET, windowStart);
    const b = await totpFromBase32(RFC_SECRET, windowStart + 29_999);
    const c = await totpFromBase32(RFC_SECRET, windowStart + 30_000);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("counts down to the next window", () => {
    expect(secondsRemaining(0)).toBe(30);
    expect(secondsRemaining(1_000)).toBe(29);
    expect(secondsRemaining(29_999)).toBe(1);
    expect(secondsRemaining(30_000)).toBe(30);
  });
});
