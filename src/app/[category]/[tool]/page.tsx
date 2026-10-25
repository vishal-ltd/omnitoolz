import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "@/components/structured-data";
import { ToolShell } from "@/components/tools/tool-shell";
import { getCategory, liveTools } from "@/lib/tools/registry";
import { site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return liveTools().map((tool) => ({ category: tool.categorySlug, tool: tool.id }));
}

async function resolveTool(categorySlug: string, toolId: string) {
  const tool = liveTools().find((entry) => entry.id === toolId);
  if (!tool) return undefined;
  const category = getCategory(tool.category);
  if (!category || category.slug !== categorySlug) return undefined;
  return { tool, category };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; tool: string }>;
}): Promise<Metadata> {
  const { category, tool: toolId } = await params;
  const resolved = await resolveTool(category, toolId);
  if (!resolved) return {};
  const { tool } = resolved;
  return {
    title: `${tool.name} — Free Online Tool`,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: tool.route },
    openGraph: {
      title: `${tool.name} | ${resolved.category.name}`,
      description: tool.description,
      url: tool.route,
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ category: string; tool: string }>;
}) {
  const { category, tool: toolId } = await params;
  const resolved = await resolveTool(category, toolId);
  if (!resolved) notFound();
  const { tool } = resolved;
  const url = `${site.url}${tool.route}`;

  const graph = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: tool.name,
      description: tool.description,
      url,
      applicationCategory: `${resolved.category.name} Application`,
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript. All processing happens locally in your browser.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: resolved.category.name, item: `${site.url}/${resolved.category.slug}` },
        { "@type": "ListItem", position: 3, name: tool.name, item: url },
      ],
    },
    ...(tool.faqs.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: tool.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          },
        ]
      : []),
  ];

  return (
    <>
      <StructuredData data={graph} />
      <ToolShell tool={tool} categoryName={resolved.category.name} categorySlug={resolved.category.slug} />
    </>
  );
}
