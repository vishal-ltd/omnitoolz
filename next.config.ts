import type { NextConfig } from "next";

const SCRIPT_SRC =
  "'self' 'unsafe-inline' https://cdn.jsdelivr.net blob: 'wasm-unsafe-eval'";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), display-capture=(self)",
  },
];

function csp(scriptSrc: string): string {
  return [
    "default-src 'self'",
    // Next's hydration bootstrap and Tailwind both need inline script/style.
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://cdn.jsdelivr.net blob: data:",
    // Tesseract spawns a blob: worker that importScripts() its jsDelivr code —
    // script-src covers that; no worker or image ever loads from the CDN directly.
    "worker-src 'self' blob:",
    "media-src 'self' blob: mediastream:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy", value: csp(SCRIPT_SRC) },
        ],
      },
    ];
  },
  // Lint runs as its own CI gate via `npm run lint`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
