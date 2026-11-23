// F10: web app manifest, served at /manifest.webmanifest. With public/sw.js it makes Kismet installable (Chrome, Android)
// and addable to the Home Screen on iOS 16.4+, which web push needs. Icons are generated from app/icon.svg.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kismet",
    short_name: "Kismet",
    description: "Bets priced below their true win chance, after fees. Market analytics, not financial advice. 18+.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070a09",   // same as the page's theme-color meta (app/layout.tsx viewport)
    theme_color: "#070a09",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
