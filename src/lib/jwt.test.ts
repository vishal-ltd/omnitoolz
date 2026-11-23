import { describe, expect, it } from "vitest";
import { decodeJwt } from "./jwt";

const b64u = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const token = (header: unknown, payload: unknown, signature = "sig") =>
  `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}.${signature}`;

describe("decodeJwt", () => {
  it("decodes header, payload and unicode claims", () => {
    const decoded = decodeJwt(token({ alg: "HS256", typ: "JWT" }, { sub: "123", name: "Jürgen 你好 🌍" }));
    expect(decoded.header.alg).toBe("HS256");
    expect(decoded.payload.name).toBe("Jürgen 你好 🌍");
    expect(decoded.signature).toBe("sig");
  });

  it("rejects tokens without three parts", () => {
    expect(() => decodeJwt("only.two")).toThrow(/three dot-separated/i);
  });

  it("rejects non-object parts with a friendly error, not a TypeError", () => {
    for (const bad of ["null", "[1,2]", '"text"', "42"]) {
      const raw = `${b64u(JSON.stringify({ alg: "HS256" }))}.${b64u(bad)}.sig`;
      expect(() => decodeJwt(raw)).toThrow(/must be a JSON object/i);
    }
    const badHeader = `${b64u("null")}.${b64u(JSON.stringify({}))}.sig`;
    expect(() => decodeJwt(badHeader)).toThrow(/header/i);
  });

  it("rejects invalid base64url with a friendly error", () => {
    expect(() => decodeJwt("!!!.eyJ9.sig")).toThrow(/header isn't valid base64url/i);
  });

  it("flags alg=none as unsigned", () => {
    const decoded = decodeJwt(token({ alg: "none" }, { sub: "x" }, ""));
    expect(decoded.problems.some((p) => /unsigned/i.test(p))).toBe(true);
  });

  it("flags an empty signature even when alg is set", () => {
    const decoded = decodeJwt(token({ alg: "HS256" }, { sub: "x" }, ""));
    expect(decoded.problems.some((p) => /signature part is empty/i.test(p))).toBe(true);
  });

  it("reports expiry, issuance and not-before", () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const future = Math.floor(Date.now() / 1000) + 3600;
    const expired = decodeJwt(token({ alg: "HS256" }, { exp: past, iat: past }));
    expect(expired.problems.some((p) => /^Expired/.test(p))).toBe(true);
    const live = decodeJwt(token({ alg: "HS256" }, { exp: future, nbf: future }));
    expect(live.problems.some((p) => /^Valid until/.test(p))).toBe(true);
    expect(live.problems.some((p) => /^Not valid until/.test(p))).toBe(true);
  });

  it("notes a missing exp claim", () => {
    const decoded = decodeJwt(token({ alg: "HS256" }, { sub: "x" }));
    expect(decoded.problems.some((p) => /No expiry/.test(p))).toBe(true);
  });

  it("treats __proto__ as data without polluting Object.prototype", () => {
    const payloadJson = '{"__proto__":{"polluted":true},"sub":"x"}';
    const raw = `${b64u(JSON.stringify({ alg: "HS256" }))}.${b64u(payloadJson)}.sig`;
    const decoded = decodeJwt(raw);
    expect(Object.keys(decoded.payload)).toContain("__proto__");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(decoded.payload, "__proto__")).toBe(true);
  });
});
