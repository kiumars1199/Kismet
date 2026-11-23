// F10: /manifest.webmanifest. A plain route, not Next's `app/manifest.ts` metadata file: that one also streams its own
// <link rel="manifest"> into <body>, which made two links beside the one in <head> (app/layout.tsx).
import { manifest } from "@/lib/pwa-manifest";

export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(manifest()), { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } });
}
