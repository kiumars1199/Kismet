"use client";
// "Why this bet?" (docs/OVERHAUL.md §B, rule 3): everything a card used to show on its face, one tap away and in plain
// words. First line is the payout with the stake added back (Polymarket's own sheet says "To win $X" meaning the total
// payout; the card says "$10 wins $5.60" for the profit, so this line spells out both). No banned words (lib/banned.ts):
// no "edge", "spread", "model", "pts"; counts stay under four digits.
import type { ReactNode } from "react";
import type { ApiRow } from "@/lib/api";
import { backLine, cardVenue, INTL_ONLY, NOT_FOR_US, priceText, stars, starsHelp, type CardVenue } from "@/lib/card";
import { paysBand } from "@/lib/filters/apply";
import { money, pct, ret, sideRet, testedLine } from "@/lib/format";
import type { Execution, Market, Side } from "@/lib/types";
import { WatchStar } from "@/components/watch/WatchStar";
import { venueOf } from "@/components/trade/TradeButton";
import { AlertLink } from "../bits";
import { drawerHref, useOpenDrawer } from "../drawer";
import { topicLabel } from "../labels";
import { useBacktest } from "../TierNote";

const TYPE_WORDS: Record<Market["market_type"], string> = {
  moneyline: "match-winner bets", spreads: "handicap bets", totals: "over/under bets", props: "in-game bets",
  "yes/no": "yes/no bets", "multi-outcome": "multiple-choice bets",
};
/** What the estimate is built from, in words: model_level nmt / niche / cat / all. */
function basisWords(m: Pick<Market, "category" | "niche" | "tags" | "market_type">, s: Pick<Side, "model_level">): string {
  const topic = topicLabel(m);
  switch (s.model_level) {
    case "nmt": return `${topic} ${TYPE_WORDS[m.market_type]}`;
    case "niche": return `${topic} bets`;
    case "cat": return `${topic} bets of every kind`;
    default: return "bets of every kind";
  }
}
/** "about 240 similar past bets"; never a four-digit count on a card. */
const pastBets = (n: number) => (n >= 1000 ? "over a thousand similar past bets" : `about ${Math.max(1, Math.round(n))} similar past bets`);

/** Free sees the US return as its band's low end (lib/data/gate.ts ROI cuts): say the band, never a made-up exact. */
function usReturnText(v: Extract<CardVenue, { kind: "us" }>, banded: boolean): string | null {
  if (v.roi_pct == null) return null;
  if (!banded) return ret(v.roi_pct);
  const cuts = [0, 5, 10, 20, 50];
  if (v.roi_pct < 0) return "below 0%";
  const hi = cuts.find((c) => c > v.roi_pct!);
  return hi === undefined ? `${v.roi_pct}% or more` : `${v.roi_pct}–${hi}%`;
}

/** Quiet price warnings, in plain words (lib/data verdicts; no "spread"). */
function priceNotes(x: Execution | undefined): string[] {
  const out: string[] = [];
  if (x?.verdict === "not worth it") out.push("Price too high right now.");
  else if (x?.verdict === "thin") out.push("The gap between the buy and sell price takes most of the value.");
  if (x && x.book_ok !== false && x.verdict !== "not worth it" && x.capacity_usd != null && x.capacity_usd < 100)
    out.push(`Only about ${money(Math.round(x.capacity_usd))} can be bet at this price.`);
  return out;
}

function Line({ label, children, testid }: { label: string; children: ReactNode; testid?: string }) {
  return (
    <div data-testid={testid} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-t border-border/60 py-2 first:border-t-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-text">{children}</dd>
    </div>
  );
}

export function Why({ r, livePrice }: { r: ApiRow; livePrice?: ReactNode }) {
  const { market: m, side: s } = r;
  const { open } = useOpenDrawer();
  const bt = useBacktest();
  const v = cardVenue(m, s);
  const banded = !!s.ranges;
  const back = backLine(v);
  const st = stars({ roi_pct: v.roi_pct, model_neff: s.model_neff });
  const band = paysBand({ ask: v.ask ?? s.ask });
  const tested = testedLine(band ? bt?.chosen?.by_pays?.[m.tier ?? "best"]?.[band] : undefined);
  const intl = venueOf(m);
  const notes = priceNotes(m.execution);
  const usRet = v.kind === "us" ? usReturnText(v, banded) : null;
  return (
    <details data-testid="why" className="group relative z-10 rounded-xl border border-border/70 bg-background/40 open:bg-background/60"
      onClick={(e) => e.stopPropagation()}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 text-sm font-medium text-soft hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        Why this bet?
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="px-3 pb-3 text-[13px] leading-relaxed">
        {back && <p data-testid="why-back" className="pb-2 font-medium text-text">{back}</p>}
        <dl>
          <Line label="Value" testid="why-value">{st ? st.label : "No value at today's price"}<span className="block text-xs text-muted">{starsHelp(st)}</span></Line>
          <Line label="Our estimate">Wins {pct(s.win_prob)} of the time{banded ? " (rounded down)" : ""}</Line>
          <Line label="Price">
            {v.kind === "us"
              ? <>{v.ask == null ? "No Polymarket US price right now" : <>{priceText(v.ask)} on Polymarket US, fee {priceText(v.fee)}</>}</>
              : <>{priceText(s.ask)} on Polymarket, fee {priceText(s.fee)}</>}
            {livePrice}
          </Line>
          <Line label="Estimated return">
            {v.kind === "us" ? (usRet ?? "No Polymarket US price right now") : sideRet(s)}
            <span className="block text-xs text-muted">Per bet, on average, at today&apos;s price after the fee. Any single bet can lose.</span>
          </Line>
          <Line label="How sure we are" testid="why-basis">
            {s.model_neff >= 100 ? "Strong record" : "Thin record"}: based on {pastBets(s.model_neff)} in {basisWords(m, s)}
          </Line>
          {tested && <Line label="In testing" testid="why-tested">{tested}</Line>}
          {m.tier === "edge" && <Line label="Confidence">Lower: the price beats past results by less than our cautious estimate needs.</Line>}
        </dl>
        {notes.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-warning">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        {v.kind === "intl-only" && (
          <p data-testid="why-intl" className="mt-2 text-xs text-muted">
            {INTL_ONLY}.{" "}
            <a href={intl.href} target="_blank" rel="noopener noreferrer" data-venue="polymarket-intl"
              className="inline-flex min-h-11 items-center text-soft underline underline-offset-4 hover:text-text">
              Open on international Polymarket
            </a>{" "}
            <span className="font-medium text-warning">{NOT_FOR_US}.</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border/60 pt-2">
          <a href={drawerHref(m.id, s.side_index)}
            onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); open(m.id, s.side_index); }}
            className="inline-flex min-h-11 items-center rounded-input px-2 text-soft underline underline-offset-4 hover:text-text">
            Full details
          </a>
          <span className="ml-auto flex items-center">
            <WatchStar marketId={m.id} side={s.side_index} market={m} />
            <AlertLink marketId={m.id} side={s.side_index} />
          </span>
        </div>
      </div>
    </details>
  );
}
