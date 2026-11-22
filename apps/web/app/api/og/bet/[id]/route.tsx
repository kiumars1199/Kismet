// F13 share image for one bet: GET /api/og/bet/<id>[?side=0|1] -> 1200x630 PNG with the bet, what it pays (1.47x) and
// the chance to win (68%). The numbers are the Free card's (lib/share/bet-facts.ts bands them), so the image is
// identical for everyone and a signed-out crawler learns nothing a Free account doesn't see. No cents, no profit
// wording. Fonts and colors as app/opengraph-image.tsx.
import { ImageResponse } from "next/og";
import { DISCLAIMER } from "@/components/shell/Footer";
import { getStoreFor } from "@/lib/data/store";
import { betFacts } from "@/lib/share/bet-facts";
import { C, Wordmark, brandFonts } from "@/app/_brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = new URL(req.url).searchParams.get("side");
  const f = betFacts(await getStoreFor("free"), id, raw === null ? undefined : Number(raw));
  if (!f) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: C.bg, color: C.text, fontFamily: "Inter" }}>
        <Wordmark size={34} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "block", fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 52, lineHeight: 1.15, lineClamp: 3 }}>{f.title}</div>
          <div style={{ display: "flex", color: C.soft, fontSize: 30 }}>{f.side}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
            {f.mult && <div style={{ display: "flex", fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 120, lineHeight: 1, color: C.accent }}>{`Pays ${f.mult}`}</div>}
            {f.chance && <div style={{ display: "flex", fontSize: 38, color: C.muted, paddingBottom: 14 }}>{f.chance}</div>}
          </div>
        </div>
        <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, paddingTop: 24, color: C.muted, fontSize: 24 }}>{DISCLAIMER}</div>
      </div>
    ),
    { ...SIZE, fonts: await brandFonts(), headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
