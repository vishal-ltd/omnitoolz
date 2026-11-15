import type { NextConfig } from "next";

const SCRIPT_SRC =
  "'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com blob: 'wasm-unsafe-eval'";

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
    "img-src 'self' data: blob: https://cdn.jsdelivr.net",
    "font-src 'self' data:",
    "connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com blob: data:",
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
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
        // The cutout model's tensor library (ndarray) builds constructors with
        // new Function, so this page alone allows eval. Two CSP headers would
        // intersect, so every other route is matched by the lookahead below.
        source: "/image-tools/background-remover",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy", value: csp(`${SCRIPT_SRC} 'unsafe-eval'`) },
        ],
      },
      {
        source: "/((?!image-tools/background-remover).*)",
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
