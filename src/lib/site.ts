/**
 * Site-wide configuration — the single source of brand truth. Titles,
 * footer, metadata, canonical links and the sitemap all derive from here.
 *
 * The site URL resolves in order:
 *   1. NEXT_PUBLIC_SITE_URL      — set this once you have a final domain
 *   2. Vercel's automatic URL     — VERCEL_PROJECT_PRODUCTION_URL (production)
 *                                   or VERCEL_URL (preview deployments)
 *   3. http://localhost:3000      — local development
 *
 * Deploying to Vercel with no environment variables configured just works.
 */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
  // Tolerate scheme-less or trailing-slash overrides: canonical links, the
  // sitemap and JSON-LD must never double slashes, and new URL() must not throw.
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

export const site = {
  name: "OmniToolz",
  tagline: "Every Tool. One Place.",
  description:
    "Free online tools for PDFs, images, text, developers, security and media. Convert, merge, split, sign, scan and more — processed right in your browser.",
  url: resolveSiteUrl(),
} as const;

export function absoluteUrl(path: string): string {
  return `${site.url.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
