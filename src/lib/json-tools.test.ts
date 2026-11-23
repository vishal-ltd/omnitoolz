import { describe, expect, it } from "vitest";
import { countJsonNodes, formatJson, locateJsonError, minifyJson } from "./json-tools";

describe("formatJson", () => {
  it("pretty prints with the chosen indent", () => {
    expect(formatJson('{"a":1}', 2)).toBe('{\n  "a": 1\n}');
    expect(formatJson('{"a":1}', 4)).toBe('{\n    "a": 1\n}');
    expect(formatJson('{"a":1}', "tab")).toBe('{\n\t"a": 1\n}');
  });

  it("minifies", () => {
    expect(minifyJson('{ "a" : [ 1, 2 ] }')).toBe('{"a":[1,2]}');
  });

  it("throws on invalid json", () => {
    expect(() => formatJson("{oops}", 2)).toThrow();
  });

  it("preserves integers beyond Number.MAX_SAFE_INTEGER exactly", () => {
    const input = '{"id":9007199254740993,"big":123456789012345678901234567890}';
    expect(minifyJson(input)).toBe(input);
    expect(formatJson(input, 2)).toBe(
      '{\n  "id": 9007199254740993,\n  "big": 123456789012345678901234567890\n}',
    );
  });

  it("preserves -0, exponents and literal spelling", () => {
    const input = '{"z":-0,"e":1e+3,"t":true,"n":null}';
    expect(minifyJson(input)).toBe(input);
  });

  it("preserves duplicate keys and key order", () => {
    expect(minifyJson('{"a":1,"a":2,"b":3}')).toBe('{"a":1,"a":2,"b":3}');
  });

  it("keeps __proto__ payloads as inert data", () => {
    const input = '{"__proto__":{"polluted":true},"constructor":{"x":1}}';
    expect(minifyJson(input)).toBe(input);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("does not touch whitespace or escapes inside strings", () => {
    const input = '{"s":"a  b\\tc\\n\\"d\\\\","u":"héllo 🌍"}';
    expect(minifyJson(` { "s" : "a  b\\tc\\n\\"d\\\\" , "u" : "héllo 🌍" } `)).toBe(input);
  });

  it("formats nested and empty containers like a pretty printer", () => {
    expect(formatJson('{"a":[1,{"b":2}],"e":{},"z":[]}', 2)).toBe(
      '{\n  "a": [\n    1,\n    {\n      "b": 2\n    }\n  ],\n  "e": {},\n  "z": []\n}',
    );
    expect(formatJson("42", 2)).toBe("42");
    expect(formatJson('"hi"', 2)).toBe('"hi"');
  });
});

describe("locateJsonError", () => {
  it("maps V8 position to line and column", () => {
    try {
      JSON.parse('{\n  "a": 1,\n  oops\n}');
      expect.unreachable();
    } catch (error) {
      const location = locateJsonError(error, '{\n  "a": 1,\n  oops\n}');
      expect(location.line).toBeGreaterThan(1);
      expect(location.column).toBeGreaterThan(0);
    }
  });

  it("falls back gracefully for unknown error shapes", () => {
    const location = locateJsonError("boom", "");
    expect(location.line).toBe(1);
  });

  it("extracts line/column from standard V8 error message", () => {
    try {
      JSON.parse('{"a":1,');
    } catch (error) {
      const location = locateJsonError(error, '{"a":1,');
      expect(location.line).toBe(1);
      expect(location.column).toBeGreaterThan(0);
    }
  });

  it("handles error message without position info", () => {
    const location = locateJsonError(new Error("invalid json"), "");
    expect(location.line).toBe(1);
    expect(location.column).toBe(1);
  });
});

describe("countJsonNodes", () => {
  it("counts keys and depth outside strings", () => {
    const result = countJsonNodes('{"a":{"b":[{"c":1}]}, "d{": 2}');
    expect(result.keys).toBe(4);
    expect(result.depth).toBe(4);
  });
});
