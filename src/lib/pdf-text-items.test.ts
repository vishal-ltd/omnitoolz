import { describe, expect, it } from "vitest";
import { hitTestTextItem, mergeLineItems, textItemBox, type PdfTextItem } from "./pdf-text-items";

function item(overrides: Partial<PdfTextItem> & { str: string; x: number }): PdfTextItem {
  return {
    y: 700,
    width: 50,
    fontSize: 12,
    ascent: 0.8,
    descent: -0.2,
    fontLabel: null,
    ...overrides,
  };
}

describe("textItemBox", () => {
  it("wraps the ascent→descent band around the baseline", () => {
    const box = textItemBox(item({ str: "Hi", x: 100, y: 700, fontSize: 10, ascent: 0.8, descent: -0.2 }));
    expect(box.x0).toBe(100);
    expect(box.x1).toBe(150);
    expect(box.y0).toBeCloseTo(698, 5); // baseline - descent depth
    expect(box.y1).toBeCloseTo(708, 5); // baseline + ascent height
  });
});

describe("mergeLineItems", () => {
  it("joins split fragments on one baseline without adding spaces", () => {
    const merged = mergeLineItems([
      item({ str: "diddi.vishal27", x: 100, width: 60 }),
      item({ str: "@gmail.com", x: 160, width: 45 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].str).toBe("diddi.vishal27@gmail.com");
    expect(merged[0].x).toBe(100);
    expect(merged[0].width).toBeCloseTo(105, 5);
  });

  it("inserts a space across a visible word gap", () => {
    const merged = mergeLineItems([
      item({ str: "Hello", x: 100, width: 24 }),
      item({ str: "World", x: 128, width: 24 }), // 4pt gap at 12pt ≈ 0.33em
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].str).toBe("Hello World");
  });

  it("keeps separate cells when the gap is large (columns)", () => {
    const merged = mergeLineItems([
      item({ str: "Skills", x: 100, width: 30 }),
      item({ str: "Rating", x: 300, width: 30 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("does not merge across different baselines", () => {
    const merged = mergeLineItems([
      item({ str: "line one", x: 100, y: 700 }),
      item({ str: "line two", x: 100, y: 715 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("takes font info from the first run that has one", () => {
    const merged = mergeLineItems([
      item({ str: "A", x: 100, width: 6, fontLabel: null }),
      item({ str: "B", x: 106, width: 6, fontLabel: "SourceSansPro-Regular" }),
    ]);
    expect(merged[0].fontLabel).toBe("SourceSansPro-Regular");
  });

  it("returns items unchanged for single or empty input", () => {
    const single = [item({ str: "solo", x: 10 })];
    expect(mergeLineItems(single)).toEqual(single);
    expect(mergeLineItems([])).toEqual([]);
  });
});

describe("hitTestTextItem", () => {
  const line = mergeLineItems([
    item({ str: "email@example.com", x: 100, y: 700, width: 80, fontSize: 12 }),
    item({ str: "second.run", x: 250, y: 700, width: 50, fontSize: 12 }),
  ]);

  it("hits inside the box", () => {
    const hit = hitTestTextItem(line, 120, 702);
    expect(hit?.str).toBe("email@example.com");
  });

  it("honours horizontal padding for imprecise taps", () => {
    const hit = hitTestTextItem(line, 98, 702, 3);
    expect(hit?.str).toBe("email@example.com");
  });

  it("misses below the descent band", () => {
    expect(hitTestTextItem(line, 120, 694)).toBeNull();
  });

  it("misses in the gap between runs", () => {
    expect(hitTestTextItem(line, 200, 702)).toBeNull();
  });

  it("resolves the run on the tapped line when two lines are close", () => {
    const twoLines = [
      ...line,
      item({ str: "next line", x: 100, y: 714, width: 80, fontSize: 12 }),
    ];
    const hit = hitTestTextItem(twoLines, 130, 716);
    expect(hit?.str).toBe("next line");
  });
});
