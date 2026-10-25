import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StructuredData } from "@/components/structured-data";
import { ToolIcon } from "@/components/icons";
import { ToolCard } from "@/components/tools/tool-card";
import { activeCategories, toolsInCategory } from "@/lib/tools/registry";
import { site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return activeCategories().map((category) => ({ category: category.slug }));
}

function findCategory(slug: string) {
  return activeCategories().find((category) => category.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = findCategory(slug);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = findCategory(slug);
  if (!category) notFound();

  const tools = toolsInCategory(category.id);

  const graph = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: category.name, item: `${site.url}/${category.slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: category.name,
      numberOfItems: tools.length,
      itemListElement: tools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.name,
        url: `${site.url}${tool.route}`,
      })),
    },
  ];

  return (
    <>
      <StructuredData data={graph} />
      <nav aria-label="Breadcrumb" className="font-body text-base text-ink-soft">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="transition-colors hover:text-brand">Home</Link></li>
          <li aria-hidden className="font-display text-[8px]">▸</li>
          <li aria-current="page" className="text-ink">{category.name}</li>
        </ol>
      </nav>

      <header className="mt-5">
        <span className="flex size-16 animate-pixel-in items-center justify-center border-[3px] border-edge bg-brand-soft shadow-[4px_4px_0_0_var(--color-shadow)]">
          <ToolIcon name={category.icon} className="size-8 text-brand" />
        </span>
        <h1 className="mt-4 text-lg text-ink sm:text-xl">{category.name}</h1>
        <p className="mt-2 max-w-2xl text-base leading-snug text-ink-soft">{category.description}</p>
        <p className="mt-1 font-body text-lg text-ink-soft">
          <span className="border-[3px] border-edge bg-brand px-2 py-0.5 font-display text-[9px] text-on-brand">{tools.length}</span>{" "}
          {tools.length === 1 ? "tool" : "tools"} · all run in your browser
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool, index) => (
          <ToolCard key={tool.id} tool={tool} index={index} />
        ))}
      </div>
    </>
  );
}
