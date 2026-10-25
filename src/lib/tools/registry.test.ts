import { describe, expect, it } from "vitest";
import { toolLoaders } from "@/features/tool-loaders";
import {
  activeCategories,
  categories,
  featuredTools,
  getCategory,
  liveTools,
  relatedTools,
  tools,
  toolsInCategory,
  toolRoute,
} from "./registry";

const liveIds = liveTools().map((t) => t.id);
const loaderIds = Object.keys(toolLoaders);

describe("registry integrity", () => {
  it("has unique tool ids", () => {
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
  });

  it("every live tool has a registered handler component", () => {
    const missing = liveIds.filter((id) => !loaderIds.includes(id));
    expect(missing).toEqual([]);
  });

  it("every registered handler belongs to a live tool", () => {
    const orphans = loaderIds.filter((id) => !liveIds.includes(id));
    expect(orphans).toEqual([]);
  });

  it("has unique routes across live tools", () => {
    const routes = liveTools().map((t) => t.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("all categories referenced by tools exist", () => {
    for (const tool of tools) {
      expect(getCategory(tool.category), `category of ${tool.id}`).toBeDefined();
    }
  });

  it("every live tool has content for the tool page", () => {
    for (const tool of liveTools()) {
      expect(tool.howTo.length).toBeGreaterThanOrEqual(3);
      expect(tool.faqs.length).toBeGreaterThanOrEqual(3);
      expect(tool.privacyNote.length).toBeGreaterThan(20);
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it("related tools only reference live tools and never self", () => {
    for (const tool of liveTools()) {
      for (const related of relatedTools(tool)) {
        expect(related.status).toBe("live");
        expect(related.id).not.toBe(tool.id);
      }
    }
  });

  it("active categories all have live tools and valid slugs", () => {
    for (const category of activeCategories()) {
      expect(category.toolCount).toBeGreaterThan(0);
      expect(category.slug).toMatch(/^[a-z]+-tools$/);
    }
  });

  it("featured tools exist and are live", () => {
    expect(featuredTools().length).toBeGreaterThanOrEqual(6);
    for (const tool of featuredTools()) {
      expect(tool.status).toBe("live");
    }
  });

  it("category page listing matches live tools per category", () => {
    const total = activeCategories().reduce(
      (sum, c) => sum + toolsInCategory(c.id).length,
      0,
    );
    expect(total).toBe(liveTools().length);
  });

  it("planned tools are excluded from live listings", () => {
    expect(liveIds).not.toContain("pptx-to-pdf");
    expect(categories.length).toBeGreaterThanOrEqual(activeCategories().length);
  });

  it("routes follow the /category-slug/tool-id convention", () => {
    expect(toolRoute({ id: "merge-pdf", category: "pdf" })).toBe("/pdf-tools/merge-pdf");
    expect(toolRoute({ id: "password-generator", category: "security" })).toBe(
      "/security-tools/password-generator",
    );
  });
});
