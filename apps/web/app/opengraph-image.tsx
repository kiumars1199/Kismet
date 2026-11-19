// Default share card for every page without its own (/, /about, /pricing…). /m/[id] overrides it.
// Plain facts only: no return figures or profit wording (docs/01 Compliance). Colors = dark theme tokens.
import { ImageResponse } from "next/og";
import { DISCLAIMER } from "@/components/shell/Footer";

export const alt = "Kismet: prediction-market prices next to how often similar bets won";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = { bg: "#070a09", border: "#1a2520", text: "#e6efe9", muted: "#a9bab1", accent: "#10b981" };

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: C.bg, color: C.text }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.accent }}>Kismet</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>Prediction-market prices, next to how often similar bets won</div>
          <div style={{ fontSize: 32, color: C.muted }}>After fees and the cost of crossing the spread.</div>
        </div>
        <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, paddingTop: 24, color: C.muted, fontSize: 24 }}>{DISCLAIMER}</div>
      </div>
    ),
    size,
  );
}
