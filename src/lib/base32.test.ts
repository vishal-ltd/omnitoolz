import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode } from "./base32";

describe("base32", () => {
  it("decodes the canonical TOTP example secret", () => {
    // RFC examples use "JBSWY3DPEHPK3PXP" for bytes 48 65 6c 6c 6f 21 de ad be ef
    const bytes = base32Decode("JBSWY3DPEHPK3PXP");
    expect([...bytes]).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0xde, 0xad, 0xbe, 0xef]);
  });

  it("accepts lowercase, spaces and padding", () => {
    expect([...base32Decode("jbsw y3dp ehpk 3pxp=")]).toEqual(
      [...base32Decode("JBSWY3DPEHPK3PXP")],
    );
  });

  it("round-trips arbitrary bytes", () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 255, 128, 64]);
    expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes]);
  });

  it("rejects invalid characters", () => {
    expect(() => base32Decode("ABC1")).toThrow(/invalid/i);
    expect(() => base32Decode("ABC8")).toThrow(/invalid/i);
  });

  it("handles empty input", () => {
    expect(base32Decode("").length).toBe(0);
    expect(base32Decode("  =- ").length).toBe(0);
  });

  it("rejects truncated secrets instead of silently dropping bits", () => {
    // 1, 3 and 6 characters mod 8 cannot encode whole bytes.
    expect(() => base32Decode("A")).toThrow(/truncated/i);
    expect(() => base32Decode("ABC")).toThrow(/truncated/i);
    expect(() => base32Decode("ABCDEF")).toThrow(/truncated/i);
    // Valid remainders (2, 4, 5, 7) still decode.
    expect(base32Decode("AB").length).toBe(1);
    expect(base32Decode("ABCD").length).toBe(2);
    expect(base32Decode("ABCDE").length).toBe(3);
    expect(base32Decode("ABCDEFG").length).toBe(4);
  });
});
