import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { activeCategories, liveTools } from "@/lib/tools/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...activeCategories().map((category) => ({
      url: `${site.url}/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...liveTools().map((tool) => ({
      url: `${site.url}${tool.route}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: `${site.url}/about`, lastModified: now, priority: 0.3 },
    { url: `${site.url}/privacy`, lastModified: now, priority: 0.3 },
    { url: `${site.url}/terms`, lastModified: now, priority: 0.3 },
  ];
}
