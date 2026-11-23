"use client";
// "Open on Kalshi / Polymarket" (every bet, on by default) and the paper "Trade" button (docs/16 §2, §4).
import { ExternalLink } from "@/components/kit/icons";
import { openTicket, useTradeConfigState } from "@/lib/trade/ext";
import type { Market, Side } from "@/lib/types";

/** Kalshi when the market has a mapped ticker, else Polymarket. */
import { venueOf } from "@/lib/trade/venue";
import { RISK_NOTE, RiskNote } from "./RiskNote";
export { venueOf };

export function VenueLink({ m, className = "" }: { m: Pick<Market, "url" | "kalshi_ticker">; className?: string }) {
  const v = venueOf(m);
  return (
    <>
    <a href={v.href} target="_blank" rel="noopener noreferrer" className={className} onClick={(e) => e.stopPropagation()}>
      Open on {v.name} <ExternalLink size={15} className="inline-block align-[-2px]" />
    </a>
    <RiskNote />
    </>
  );
}

/** Icon-size venue link for cards; sits above the card's full-cover link like the alert bell. */
export function VenueIconLink({ m, className = "" }: { m: Pick<Market, "url" | "kalshi_ticker">; className?: string }) {
  const v = venueOf(m);
  return (
    <a
      data-venue={v.name.toLowerCase()} href={v.href} target="_blank" rel="noopener noreferrer"
      aria-label={`Open on ${v.name}. ${RISK_NOTE}`} title={`Open on ${v.name}. ${RISK_NOTE}`} onClick={(e) => e.stopPropagation()}
      className={`relative z-10 flex size-11 flex-none items-center justify-center rounded-input text-muted hover:bg-raised hover:text-text ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
    </a>
  );
}

/** Shown only when KALSHI_TRADING_ENV=demo and the user is allow-listed (or demo mode). */
export function TradeButton({ m, s, className, reserve = false }: { m: Market; s: Side; className: string; reserve?: boolean }) {
  const { cfg, ready } = useTradeConfigState();
  // `reserve`: the server says this user can use paper trading (same allow-list check as /api/trade/config), so until the config
  // answers keep an invisible button with the real one's markup in the row: mounting the real one then changes nothing (without it the
  // row wrapped and the page below jumped 50 px at 390 px). Once the config has answered "off" the slot is gone.
  if (!cfg) return reserve && !ready ? <TradeLabel className={`${className} invisible`} slot /> : null;
  const yes = m.sides[0], no = m.sides[1];
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        openTicket({
          title: m.question,
          ticker: m.kalshi_ticker ?? null,
          side: s.side_index,
          sides: [
            { label: yes?.outcome ?? "Yes", winProb: yes?.win_prob ?? null, ask: yes?.ask ?? null },
            { label: no?.outcome ?? "No", winProb: no?.win_prob ?? null, ask: no?.ask ?? null },
          ],
          journal: { market_id: m.id, question: m.question, category: m.category, niche: m.niche },
        })
      }
    >
      <TradeLabel />
    </button>
  );
}

/** The button's content; also the invisible slot (same markup, so the same width). */
function TradeLabel({ className, slot }: { className?: string; slot?: boolean }) {
  const inner = <>Trade <span className="rounded-full bg-warning/15 px-1.5 text-[11px] font-medium text-warning">paper</span></>;
  return slot ? <span aria-hidden="true" data-testid="trade-slot" className={className}>{inner}</span> : inner;
}
