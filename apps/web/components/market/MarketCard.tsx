"use client";

// Compact row card (MobileHybrid artboard): topic · closes, question, then what happens on this one bet
// ("Pays 10x · wins about 1 in 7", docs/18 §6), the price line, and the return on the right, smaller.
// The question link covers the card (opens the drawer); star and alert sit above it.
import type { ApiRow } from "@/lib/api";
import { basis, cardReturn, closesIn, gameTime, pays, PAYS_HELP, price, sideEdge, sidePts, winsAbout } from "@/lib/format";
import { WatchStar } from "@/components/watch/WatchStar";
import { VenueIconLink } from "@/components/trade/TradeButton";
import { drawerHref, useOpenDrawer } from "./DrawerHost";
import { AlertLink, Notes } from "./bits";
import { priceVerdict, returnTone, rowNotes, topicLabel } from "./labels";
import { LowerConfidence, TierNote } from "./TierNote";

export function MarketCard({ r, pro = false, notes = true }: { r: ApiRow; pro?: boolean; notes?: boolean }) {
  const { open } = useOpenDrawer();
  const { market: m, side: s } = r;
  const edgeTier = m.tier === "edge";
  const ret = cardReturn(s);
  return (
    <div data-row data-market-id={m.id} data-tier={m.tier ?? undefined} className="relative flex gap-3 rounded-inner border border-border bg-surface p-3.5 hover:border-accent-border focus-within:border-accent-border">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span title={`Closes in ${closesIn(m.closes_at)}`}>{topicLabel(m)} · <span className="whitespace-nowrap">{gameTime(m.closes_at)}</span></span>
          {edgeTier && <LowerConfidence className="py-0" />}
        </div>
        <a
          href={drawerHref(m.id, s.side_index)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            open(m.id, s.side_index);
          }}
          className="mt-0.5 block text-[15px] font-semibold leading-snug after:absolute after:inset-0 after:rounded-inner focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-accent focus-visible:after:outline-offset-2"
        >
          {m.question}
        </a>
        {/* no "·" separators: on a 390 px card they wrapped to the start or end of a line */}
        <p data-testid="one-bet" className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-sm" title={basis(m, s)}>
          <span className="font-heading font-bold" title={PAYS_HELP}>Pays {pays(s.ask)}</span>
          <span className="whitespace-nowrap text-soft">wins about {winsAbout(s.win_prob)}</span>
        </p>
        <div className="mt-0.5 text-xs text-muted">
          Bet {s.outcome} at {price(s.ask)}
          <span className={`block ${s.ranges || s.edge > 0 ? "text-accent-softer" : "text-negative"}`}>{priceVerdict(s).toLowerCase()} ({sidePts(s)})</span>
        </div>
        {notes && <Notes notes={rowNotes(m.execution)} className="mt-1" />}
        {edgeTier && <TierNote s={s} className="mt-1" />}
      </div>
      <div className="flex flex-none flex-col items-end justify-between gap-1">
        <div className="text-right">
          <div className={`font-heading text-lg leading-tight ${returnTone(pro ? s.roi_pct : ret.roi)}`} title={ret.realistic ? "What similar past bets returned" : undefined}>{pro ? sideEdge(s) : ret.text}</div>
          <div className="text-[11px] text-muted">{pro ? "edge" : ret.realistic ? "similar bets" : "expected"}</div>
        </div>
        <div className="relative z-10 -mb-2 -mr-2 flex">
          <WatchStar marketId={m.id} side={s.side_index} market={m} />
          <VenueIconLink m={m} />
          <AlertLink marketId={m.id} side={s.side_index} />
        </div>
      </div>
    </div>
  );
}
