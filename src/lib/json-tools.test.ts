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
