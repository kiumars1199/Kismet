"use client";

// Best-bets card (Hybrid artboard). Exported for other lanes: <BetCard r={{ market, side }} />.
// docs/18 §6: the card leads with what happens on this one bet ("Pays 10x · wins about 1 in 7"), then the bet and
// the edge as "better price than usual (+4 pts)"; the return sits under it, smaller.
// docs/17: the return is what similar past bets returned when known (fix 1), with an ⓘ on every card (fix 4); the bet
// is one line under the number (fix 5); star + bell top-right as 44px buttons; footer (docs/19 P4): "Bet $10 → get $13
// if it wins" from the default stake, after the fee, and a "Strong record" / "Thin record" pill from the sample size; league and game time on top (fix 14); live price on Pro (60 s, from /api/book).
import { useRef } from "react";
import type { ApiRow } from "@/lib/api";
import { useEntitlements } from "@/lib/entitlements";
import { useWhen } from "./When";
import { basis, price, priceAsOf, recordHelp, sideEdge } from "@/lib/format";
import { betFigures, RETURN_HELP_ONE, RETURN_LABEL } from "@/lib/betFigures";
import { useProfile } from "@/lib/repo/hooks";
import { WatchStar } from "@/components/watch/WatchStar";
import { VenueIconLink } from "@/components/trade/TradeButton";
import { drawerHref, useOpenDrawer } from "./drawer";
import { AlertLink, InfoTip, Notes } from "./bits";
import { PTS_HELP, VERDICT_TONE, returnTone, rowNotes, topicLabel } from "./labels";
import { useLastVisit, useLiveAsk } from "./live";
import { LowerConfidence, TierNote } from "./TierNote";

export function BetCard({ r, pro = false }: { r: ApiRow; pro?: boolean }) {
  const { open } = useOpenDrawer();
  const { market: m, side: s } = r;
  const when = useWhen(m.closes_at);
  const ref = useRef<HTMLElement>(null);
  const live = useLiveAsk(m.tokens?.[s.side_index], useEntitlements().can("live_data"), ref);
  // T-289: every figure from one helper, at one price (the live ask when there is one), for the default stake
  const f = betFigures(s, { ask: live?.ask, stake: useProfile().default_stake_usd });
  const rec = f.record;
  const ret = f.ret;
  const since = useLastVisit();
  const isNew = since !== null && (m.created_at ?? 0) > since;
  const dir = live && Math.abs(live.ask - s.ask) >= 0.005 ? (live.ask > s.ask ? "up" : "down") : null;
  return (
    <article ref={ref} data-row data-market-id={m.id} data-tier={m.tier ?? undefined}
      className="relative flex w-full flex-1 flex-col gap-3 rounded-card border border-border bg-surface p-4 transition-colors duration-200 ease-out hover:border-soft/30 hover:bg-raised">
      {/* P7: the topic is plain text and the card carries one state tag at most (lower confidence wins over New) */}
      <div className="-mr-2 -mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate">{topicLabel(m)}</span>
          {m.tier === "edge" ? <LowerConfidence /> : isNew && <span data-testid="new-badge" title="Listed since your last visit" className="whitespace-nowrap rounded-full border border-accent-border px-2 py-px text-accent-softer">New</span>}
        </span>
        <span className="relative z-10 flex flex-none items-center">
          <WatchStar marketId={m.id} side={s.side_index} market={m} />
          <AlertLink marketId={m.id} side={s.side_index} />
        </span>
      </div>
      <div className="-mt-1">
        <h3 className="line-clamp-3 font-sans text-base font-semibold leading-[1.3]">
          <a
            href={drawerHref(m.id, s.side_index)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) return;
              e.preventDefault();
              open(m.id, s.side_index);
            }}
            className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
          >
            {m.question}
          </a>
        </h3>
        <p className="mt-1 text-xs text-muted" title={when.Closes} suppressHydrationWarning>{when.game} · {when.closes}</p>
      </div>
      <div>
        <p data-testid="one-bet" className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" title={basis(m, s)}>
          <span className="whitespace-nowrap font-heading text-[28px] font-bold leading-none tracking-[-0.02em]" title={f.feeHelp}>Pays {f.pays}</span>
          <span className="text-[15px] font-medium text-soft"><span className="whitespace-nowrap">before fees ·</span> <span className="whitespace-nowrap" title={`Won ${f.winPct} of the time in similar past bets`}>wins about {f.wins}</span></span>
        </p>
        <p className="mt-2 text-[13px] text-soft">
          Bet <strong className="font-semibold text-text">{s.outcome}</strong> at{" "}
          <span data-live={dir ?? undefined} key={live?.at} className={`tabular-nums text-text ${live && live.ask !== s.ask ? "price-pulse rounded px-0.5" : ""}`}>
            {price(live?.ask ?? s.ask)}
            {dir && (
              <svg role="img" aria-label={`price ${dir} since ${r.price_at ? "this page loaded" : "the scan"}`} width="10" height="10" viewBox="0 0 10 10"
                className={`ml-0.5 inline align-baseline ${dir === "up" ? "text-warning" : "text-accent"}`}>
                <path d={dir === "up" ? "M5 1.5 9 8H1z" : "M5 8.5 1 2h8z"} fill="currentColor" />
              </svg>
            )}
          </span>
          {/* own line on every card: a wrapping "·" left some cards with a dangling separator */}
          <span data-testid="verdict" className={`block ${VERDICT_TONE[f.verdict.tone]}`}>{f.verdict.text.toLowerCase()} <span className="whitespace-nowrap" title={PTS_HELP}>({f.pts})</span></span>
          {r.price_at && <span data-testid="price-as-of" className="block text-xs text-muted" title="Live Polymarket price read when this page loaded; edge, Pays and payout use it.">{priceAsOf(r.price_at)}</span>}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
          {pro ? "Edge per share" : RETURN_LABEL}
          <span data-testid="bet-return" className={`tabular-nums ${returnTone(pro ? s.roi_pct : ret.roi)}`}>{pro ? sideEdge(s) : ret.text}</span>
          <InfoTip text={RETURN_HELP_ONE} />
        </p>
      </div>
      {/* P7: "Market says / Won before" bars live in the drawer ("Why it's a good price"); on the card they repeated
          "wins about" and the price line. The basis stays on hover over the bet line and the record. */}
      <Notes notes={rowNotes(m.execution)} />
      {m.tier === "edge" && <TierNote s={s} />}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[13px]">
        <span data-testid="payout" className="text-muted" title={`Your default stake (Settings). ${f.feeHelp}`}>
          {f.payout !== null ? <><span className="whitespace-nowrap">Bet <span className="tabular-nums text-soft">{f.stakeText}</span> →</span>{" "}<span className="whitespace-nowrap">get <span className="font-semibold tabular-nums text-text">{f.payoutText}</span> after fees</span>{" "}<span className="whitespace-nowrap">if it wins</span></> : null}
        </span>
        <span className="flex items-center gap-1">
          {rec && <span title={`${recordHelp(s.model_neff)} ${basis(m, s)}`} className={`whitespace-nowrap text-xs ${rec === "Strong record" ? "text-soft" : "text-muted"}`}>{rec}</span>}
          <VenueIconLink m={m} className="-my-2 -mr-2" />
        </span>
      </div>
    </article>
  );
}
