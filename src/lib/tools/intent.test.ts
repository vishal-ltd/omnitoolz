import { describe, expect, it } from "vitest";
import { liveTools } from "./registry";
import { INTENTS, intentOf, isMapped } from "./intent";

describe("tool intent map", () => {
  it("maps every live tool so no card disappears from a category group", () => {
    const unmapped = liveTools().filter((tool) => !isMapped(tool.id)).map((tool) => tool.id);
    expect(unmapped).toEqual([]);
  });

  it("uses only declared intents", () => {
    const declared = new Set(INTENTS.map((intent) => intent.id));
    const unknown = liveTools().map(intentOf).filter((intent) => !declared.has(intent));
    expect(unknown).toEqual([]);
  });

  it("keeps every intent populated somewhere in the catalogue", () => {
    const used = new Set(liveTools().map(intentOf));
    expect([...INTENTS.map((intent) => intent.id).filter((id) => !used.has(id))]).toEqual([]);
  });
});
