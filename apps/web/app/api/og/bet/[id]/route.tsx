// F13 share image for one bet: GET /api/og/bet/<id>?s=<side>&sig=<hmac> -> 1200x630 PNG. With a valid signature (issued by
// /api/share/link to a signed-in person who tapped Share) it shows the bet, what it pays (1.47x) and how bets like it
// did, as the Free card's banded numbers. Without one (or with a forged one) it is the teaser card: title, category and
// a sign-up line, no model output (T-276). No cents, no profit wording. Fonts and colors as app/opengraph-image.tsx.
import { ImageResponse } from "next/og";
import { DISCLAIMER } from "@/components/shell/Footer";
import { shareCardData } from "@/lib/share/card-data";
import { TEASER_LINE } from "@/lib/teaser";
import { C, Wordmark, brandFonts } from "@/app/_brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const side = Number(q.get("s"));
  const card = await shareCardData(id, Number.isInteger(side) ? side : -1, q.get("sig"));
  if (!card) return new Response("Not found", { status: 404 });
  const fonts = await brandFonts();
  const headers = { "Cache-Control": "public, max-age=300, s-maxage=300" };
  const frame = (body: React.ReactNode) => (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: C.bg, color: C.text, fontFamily: "Inter" }}>
      <Wordmark size={34} />
      {body}
      <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, paddingTop: 24, color: C.muted, fontSize: 24 }}>{DISCLAIMER}</div>
    </div>
  );
  if (card.kind === "teaser") {
    const t = card.teaser;
    return new ImageResponse(frame(
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", color: C.muted, fontSize: 26, textTransform: "uppercase", letterSpacing: 2 }}>{t.category}</div>
        <div style={{ display: "block", fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 54, lineHeight: 1.15, lineClamp: 3 }}>{t.title}</div>
        <div style={{ display: "block", fontSize: 32, color: C.accent, lineClamp: 2 }}>{TEASER_LINE}</div>
      </div>), { ...SIZE, fonts, headers });
  }
  const f = card.facts;
  return new ImageResponse(frame(
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "block", fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 52, lineHeight: 1.15, lineClamp: 3 }}>{f.title}</div>
      <div style={{ display: "flex", color: C.soft, fontSize: 30 }}>{f.side}</div>
      {f.mult && <div style={{ display: "flex", whiteSpace: "nowrap", fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 120, lineHeight: 1, color: C.accent }}>{`Pays ${f.mult}`}</div>}
      {f.chance && <div style={{ display: "flex", fontSize: 38, color: C.muted }}>{f.chance}</div>}
    </div>), { ...SIZE, fonts, headers });
}
