import { describe, expect, it } from "vitest";
import { auditPassword } from "./auditor";

describe("auditPassword", () => {
  it("flags the classics as weak and common", () => {
    for (const weak of ["password", "123456", "qwerty123", "P@ssw0rd"]) {
      const audit = auditPassword(weak);
      expect(audit.verdict).toBe("weak");
      expect(audit.isCommon).toBe(true);
    }
  });

  it("recognizes genuinely strong passwords", () => {
    const audit = auditPassword("7x$Kp2#mQz9!vR4t");
    expect(audit.verdict).toMatch(/strong/);
    expect(audit.isCommon).toBe(false);
    expect(audit.advice.length).toBe(0);
  });

  it("counts length, classes and entropy", () => {
    const audit = auditPassword("Abc123!x");
    expect(audit.length).toBe(8);
    expect(audit.hasLower && audit.hasUpper && audit.hasDigit && audit.hasSymbol).toBe(true);
    expect(audit.pool).toBe(26 + 26 + 10 + 33);
    expect(audit.entropyBits).toBeGreaterThan(0);
  });

  it("warns about short lengths", () => {
    const audit = auditPassword("aB1!");
    expect(audit.verdict).toBe("weak");
    expect(audit.advice.some((a) => a.includes("12 characters"))).toBe(true);
  });

  it("flags keyboard sequences and repeats", () => {
    expect(auditPassword("qwertyyy1").hasSequence).toBe(true);
    expect(auditPassword("aaaaaaaa1").hasRepeated).toBe(true);
  });

  it("handles the empty string safely", () => {
    const audit = auditPassword("");
    expect(audit.length).toBe(0);
    expect(audit.entropyBits).toBe(0);
    expect(audit.verdict).toBe("weak");
  });
});
