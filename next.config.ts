import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lint runs as its own gate via `npm run lint` (0 errors). The in-build
  // pass doesn't honor the flat-config severity override for
  // react-hooks/set-state-in-effect and would block on documented warnings.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
