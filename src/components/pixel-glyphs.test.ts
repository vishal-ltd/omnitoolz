import { describe, expect, it } from "vitest";
import { PIXEL_GLYPHS } from "./pixel-glyphs";
import { activeCategories, tools } from "@/lib/tools/registry";

describe("pixel glyph set", () => {
  it("has a glyph for every icon the registry can ask for", () => {
    const used = new Set([...tools.map((tool) => tool.icon), ...activeCategories().map((category) => category.icon)]);
    expect([...used].filter((name) => !PIXEL_GLYPHS[name])).toEqual([]);
  });

  it("keeps every glyph on the 16x16 grid and non-empty", () => {
    for (const [name, rows] of Object.entries(PIXEL_GLYPHS)) {
      expect(rows, name).toHaveLength(16);
      for (const row of rows) expect(row, `${name} row width`).toHaveLength(16);
      expect(rows.join("").includes("#"), `${name} is blank`).toBe(true);
    }
  });
});
