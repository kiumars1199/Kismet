"use client";

// Best-bets card (Hybrid artboard). Exported for other lanes: <BetCard r={{ market, side }} />.
// docs/18 §6: the card leads with what happens on this one bet ("Pays 10x · wins about 1 in 7"), then the bet and
// the edge as "better price than usual (+4 pts)"; the return sits under it, smaller.
// docs/17: the return is what similar past bets returned when known (fix 1), with an ⓘ on every card (fix 4); the bet
// is one line under the number (fix 5); star + bell top-right as 44px buttons, "$100 → +$24" left and the chance
// pill right in the footer (fix 9); league and game time on top (fix 14); live price on Pro (60 s, from /api/book).
import { useRef } from "react";
import type { ApiRow } from "@/lib/api";
import { useEntitlements } from "@/lib/entitlements";
import { REALISTIC_HELP, RETURN_HELP, basis, cardReturn, chance, closesLine, gameTime, pays, PAYS_HELP, price, sideEdge, sidePts, winsAbout } from "@/lib/format";
import { WatchStar } from "@/components/watch/WatchStar";
import { VenueIconLink } from "@/components/trade/TradeButton";
import { drawerHref, useOpenDrawer } from "./drawer";
import { AlertLink, InfoTip, Notes, OddsBars } from "./bits";
import { chanceTone, priceVerdict, returnTone, rowNotes, topicLabel } from "./labels";
import { useLastVisit, useLiveAsk } from "./live";
import { LowerConfidence, TierNote } from "./TierNote";

export function BetCard({ r, pro = false }: { r: ApiRow; pro?: boolean }) {
  const { open } = useOpenDrawer();
  const { market: m, side: s } = r;
  const c = chance(s.win_prob);
  const ret = cardReturn(s);
  const ref = useRef<HTMLElement>(null);
  const live = useLiveAsk(m.tokens?.[s.side_index], useEntitlements().can("live_data"), ref);
  const since = useLastVisit();
  const isNew = since !== null && (m.created_at ?? 0) > since;
  const dir = live && Math.abs(live.ask - s.ask) >= 0.005 ? (live.ask > s.ask ? "up" : "down") : null;
  return (
    <article ref={ref} data-row data-market-id={m.id} data-tier={m.tier ?? undefined}
      className="relative flex w-full flex-1 flex-col gap-3 rounded-card border border-border bg-surface p-4 transition-colors duration-200 ease-out hover:border-accent-border">
      <div className="-mr-2 -mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate rounded-full bg-muted-bg px-2.5 py-[3px]">{topicLabel(m)}</span>
          {isNew && <span data-testid="new-badge" title="Listed since your last visit" className="whitespace-nowrap rounded-full border border-accent-border px-2 py-[2px] text-accent-softer">New</span>}
          {m.tier === "edge" && <LowerConfidence />}
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
        <p className="mt-1 text-xs text-muted" title={closesLine(m.closes_at, undefined, true)}>{gameTime(m.closes_at)} · {closesLine(m.closes_at)}</p>
      </div>
      <div>
        <p data-testid="one-bet" className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" title={basis(m, s)}>
          <span className="whitespace-nowrap font-heading text-[32px] font-bold leading-none tracking-[-0.02em]" title={PAYS_HELP}>Pays {pays(s.ask)}</span>
          <span className="text-[15px] font-medium text-soft">wins about {winsAbout(s.win_prob)}</span>
        </p>
        <p className="mt-2 text-[13px] text-soft">
          Bet <strong className="font-semibold text-text">{s.outcome}</strong> at{" "}
          <span data-live={dir ?? undefined} key={live?.at} className={`tabular-nums text-text ${live && live.ask !== s.ask ? "price-pulse rounded px-0.5" : ""}`}>
            {price(live?.ask ?? s.ask)}
            {dir && (
              <svg role="img" aria-label={dir === "up" ? "price up since the scan" : "price down since the scan"} width="10" height="10" viewBox="0 0 10 10"
                className={`ml-0.5 inline align-baseline ${dir === "up" ? "text-warning" : "text-accent"}`}>
                <path d={dir === "up" ? "M5 1.5 9 8H1z" : "M5 8.5 1 2h8z"} fill="currentColor" />
              </svg>
            )}
          </span>
          {/* own line on every card: a wrapping "·" left some cards with a dangling separator */}
          <span className={`block ${s.ranges || s.edge > 0 ? "text-accent-softer" : "text-negative"}`}>{priceVerdict(s).toLowerCase()} <span className="tabular-nums">({sidePts(s)})</span></span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
          {pro ? "Edge per share" : ret.realistic ? "Similar past bets returned" : "Estimated return"}
          <span className={`tabular-nums ${returnTone(pro ? s.roi_pct : ret.roi)}`}>{pro ? sideEdge(s) : ret.text}</span>
          <InfoTip text={ret.realistic && !pro ? REALISTIC_HELP : RETURN_HELP} />
        </p>
      </div>
      <OddsBars market={s.ask} won={s.win_prob} basis={basis(m, s)} />
      <Notes notes={rowNotes(m.execution)} />
      {m.tier === "edge" && <TierNote s={s} />}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[13px]">
        <span className="text-muted">$100 → <span className="font-semibold tabular-nums text-text">{ret.profit}</span></span>
        <span className="flex items-center gap-1">
          {c && <span className={`whitespace-nowrap rounded-full bg-muted-bg px-2.5 py-[3px] text-xs ${chanceTone(c)}`}>{c}</span>}
          <VenueIconLink m={m} className="-my-2 -mr-2" />
        </span>
      </div>
    </article>
  );
}
