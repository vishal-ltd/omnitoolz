import type { MetadataRoute } from "next";
import { liveTools } from "@/lib/tools/registry";

/**
 * Served at /manifest.webmanifest. Generated so the tool count never drifts
 * from the registry, and the OS chrome tint matches the default light theme.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OmniToolz — Every Tool. One Place.",
    short_name: "OmniToolz",
    description: `${liveTools().length} free browser tools for PDFs, images, text, developers, security and media. No sign-up, no upload — everything runs on your device.`,
    start_url: "/",
    display: "standalone",
    background_color: "#e9e4d3",
    theme_color: "#e9e4d3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}