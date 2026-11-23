"use client";
// F11: one tap "I placed this" adds the bet to /journal (My bets) with the side, price and stake prefilled.
// Used on the bet card and in the checker result. Props are stable:
//   <LogBetButton market={m} side={s} />   (side = a Side, or its index 0 | 1)
// Optional: `price` (0-1, what the user pays per share; default = the card's price), `stakeUsd` (default = the
// user's default stake from Settings), `className`. Never ranks or recommends: it only records what the user did.
import Link from "next/link";
import { useState } from "react";
import { feePerShare } from "@/lib/calc";
import { cardVenue } from "@/lib/card";
import { useEntitlements } from "@/lib/entitlements";
import { feeRate } from "@/lib/execution";
import { money, price as fmtPrice } from "@/lib/format";
import { getRepo } from "@/lib/repo";
import { useProfile } from "@/lib/repo/hooks";
import type { Market, Side } from "@/lib/types";

interface Props { market: Market; side: Side | 0 | 1; price?: number; stakeUsd?: number; className?: string }

export function LogBetButton({ market, side, price, stakeUsd, className = "" }: Props) {
  const { can, known } = useEntitlements();
  const profile = useProfile();
  const [saved, setSaved] = useState<{ id: string; stake: number; p: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const s = typeof side === "number" ? market.sides[side] ?? market.best : side;
  const cardAsk = cardVenue(market, s).ask;
  const p = price ?? (typeof cardAsk === "number" ? cardAsk : s.ask);
  const stake = stakeUsd ?? profile.default_stake_usd;
  const base = `relative z-10 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-medium text-soft hover:bg-raised hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`;

  if (!known) return null;
  if (!can("journal")) {
    return <Link data-testid="log-bet-upgrade" href="/pricing" onClick={(e) => e.stopPropagation()} className={base}>Track your bets with Pro</Link>;
  }
  if (saved) {
    return (
      <p data-testid="log-bet-done" role="status" className="relative z-10 text-xs text-muted">
        Logged {money(saved.stake)} at {fmtPrice(saved.p)}.{" "}
        <Link href="/journal" onClick={(e) => e.stopPropagation()} className="text-accent-hover hover:underline">See My bets</Link>{" "}
        <button type="button" className="underline-offset-2 hover:text-text hover:underline"
          onClick={(e) => { e.stopPropagation(); void getRepo().journal.remove(saved.id); setSaved(null); }}>Undo</button>
      </p>
    );
  }
  const valid = p > 0 && p < 1 && stake > 0;
  const log = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!valid || busy) return;
    setBusy(true); setErr(false);
    const fee = feePerShare(p, feeRate(market.category));
    const shares = stake / (p + fee);
    try {
      const row = await getRepo().journal.insert({
        market_id: market.id, side_index: s.side_index, outcome: s.outcome, question: market.question,
        category: market.category, niche: market.niche, price: p, shares, fee, placed_at: new Date().toISOString(),
        model_win_prob: s.win_prob, model_edge: s.win_prob - p - fee, closing_price: null,
        result: null, settled_at: null, pnl_usd: null, tags: [], note: null,
      });
      setSaved({ id: row.id, stake, p });
    } catch { setErr(true); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" data-testid="log-bet" disabled={!valid || busy} onClick={log} className={base}
        aria-label={`I placed this: log ${money(stake)} on ${s.outcome ?? "this side"} at ${fmtPrice(p)} in My bets`}>
        I placed this
      </button>
      {err && <span role="alert" className="text-xs text-negative">Couldn&apos;t save. Try again.</span>}
    </>
  );
}
