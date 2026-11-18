// Share card for /m/[id]: question, the bet, estimated return (past results), won-before, disclaimer. Colors = dark theme tokens (globals.css).
import { ImageResponse } from "next/og";
import { getStoreFor } from "@/lib/data/store";
import { gateMarket } from "@/lib/data/gate";
import { betLine, pct, sideRet } from "@/lib/format";
import { DISCLAIMER } from "@/components/shell/Footer";

export const runtime = "nodejs";
export const alt = "MarketEdge market";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = { bg: "#070a09", surface: "#0c120f", border: "#1a2520", text: "#e6efe9", muted: "#a9bab1", accent: "#10b981", soft: "#d1fae5" };

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStoreFor("free").catch(() => null);   // public image: Free shape and Free delay
  const raw = store?.flagsById.get(id) ?? store?.byId.get(id);
  const m = raw && gateMarket(raw, "free");   // public image: Free-tier shape (T-44)
  const s = m?.best;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: C.bg, color: C.text, fontSize: 28 }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.accent }}>MarketEdge</div>
        {m && s ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {/* 3 lines at most, ellipsis after (the longest real titles are ~120 characters) */}
            <div style={{ display: "block", fontSize: 54, fontWeight: 700, lineHeight: 1.15, lineClamp: 3 }}>{m.question}</div>
            <div style={{ display: "flex", gap: 48, alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, maxWidth: 420 }}>
                <div style={{ fontSize: 96, fontWeight: 700, color: s.roi_pct >= 0 ? C.accent : C.muted, lineHeight: 1 }}>{sideRet(s)}</div>
                <div style={{ color: C.muted }}>estimated return, based on past results</div>
              </div>
              {/* right column: takes what's left of the 1072 px and wraps, 2 lines per item at most */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 32, flex: 1, minWidth: 0 }}>
                <div style={{ display: "block", color: C.soft, lineClamp: 2 }}>{betLine(s)}</div>
                <div style={{ display: "block", color: C.muted, lineClamp: 2 }}>{`Similar bets won ${pct(s.win_prob)} before`}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 54, fontWeight: 700 }}>Bets where the odds lean your way</div>
        )}
        <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, paddingTop: 24, color: C.muted, fontSize: 24 }}>{DISCLAIMER}</div>
      </div>
    ),
    size,
  );
}
