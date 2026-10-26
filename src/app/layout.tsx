import type { Metadata, Viewport } from "next";
import "@fontsource/press-start-2p";
import "@fontsource/vt323";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SearchDialog } from "@/components/layout/search-dialog";
import { ServiceWorkerCleanup } from "@/components/layout/sw-cleanup";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  manifest: "/manifest.webmanifest",
  applicationName: site.name,
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: `${site.name} — ${site.tagline}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: site.name,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E9E4D3" },
    { media: "(prefers-color-scheme: dark)", color: "#12131F" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Runs before first paint: applies the stored (or system) theme and color
 * palette so the page never flashes the wrong scheme. Kept tiny and inline.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('omnitoolz:theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);var p=localStorage.getItem('omnitoolz:accent');if(p==='gameboy'||p==='synthwave'||p==='amber'||p==='mono'){document.documentElement.dataset.accent=p;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:border-[3px] focus:border-edge focus:bg-brand focus:px-4 focus:py-2 focus:font-display focus:text-[10px] focus:text-on-brand focus:uppercase"
        >
          Skip to content
        </a>
        <Header />
        <main id="content" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-20">
          {children}
        </main>
        <Footer />
        <SearchDialog />
        <ServiceWorkerCleanup />
        <SpeedInsights />
      </body>
    </html>
  );
}
