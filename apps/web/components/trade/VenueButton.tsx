"use client";
// docs/OVERHAUL.md §B/§F1: the one "Bet on …" button on a bet card. Lane B places it; lane F1 owns what's inside
// (which venue a visitor can actually use, e.g. Polymarket US for US users). Keep the props stable.
import type { Market, Side } from "@/lib/types";
import { venueOf } from "./TradeButton";

export function VenueButton({ m, className = "" }: { m: Pick<Market, "url" | "kalshi_ticker" | "id">; s?: Pick<Side, "side_index">; className?: string }) {
  const v = venueOf(m);
  return (
    <a data-venue={v.name.toLowerCase()} data-testid="venue-button" href={v.href} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`relative z-10 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-bg hover:bg-accent/90 ${className}`}>
      Bet on {v.name}
    </a>
  );
}
