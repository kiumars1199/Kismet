"use client";

// Best-bets card (Hybrid artboard). Exported for other lanes: <BetCard r={{ market, side }} />.
// docs/18 §6: the card leads with what happens on this one bet ("Pays 10x · wins about 1 in 7"), then the edge as
// "better price than usual (+4 pts)"; expected return sits under it, smaller.
import type { ApiRow } from "@/lib/api";
import { RETURN_HELP, basis, chance, closesIn, expectedProfit, money, pays, PAYS_HELP, price, sideRet, sideEdge, sidePts, winsAbout } from "@/lib/format";
import { WatchStar } from "@/components/watch/WatchStar";
import { VenueIconLink } from "@/components/trade/TradeButton";
import { drawerHref, useOpenDrawer } from "./DrawerHost";
import { AlertLink, Notes, OddsBars } from "./bits";
import { chanceTone, priceVerdict, returnTone, rowNotes, topicLabel } from "./labels";
import { LowerConfidence, TierNote } from "./TierNote";

export function BetCard({ r, highlight = false, help = false, pro = false }: { r: ApiRow; highlight?: boolean; help?: boolean; pro?: boolean }) {
  const { open } = useOpenDrawer();
  const { market: m, side: s } = r;
  const c = chance(s.win_prob);
  const profit = expectedProfit(s.roi_pct);
  const edgeTier = m.tier === "edge";
  return (
    <article data-row data-market-id={m.id} data-tier={m.tier ?? undefined} className={`relative flex w-full flex-col gap-3.5 rounded-card border p-[18px] hover:border-accent ${highlight ? "border-accent-border bg-accent-bg/40" : "border-border bg-surface"}`}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate rounded-full bg-muted-bg px-2.5 py-[3px]">{topicLabel(m)}</span>
          {edgeTier && <LowerConfidence />}
        </span>
        <span className="flex flex-none items-center gap-1">
          Closes in {closesIn(m.closes_at)}
          <span className="relative z-10 -my-2 -mr-2"><WatchStar marketId={m.id} side={s.side_index} market={m} /></span>
        </span>
      </div>
      <h3 className="min-h-[42px] font-sans text-base font-semibold leading-[1.3]">
        <a
          href={drawerHref(m.id, s.side_index)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            open(m.id, s.side_index);
          }}
          className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-accent"
        >
          {m.question}
        </a>
      </h3>
      <div className="flex items-start justify-between gap-3">
        <p data-testid="one-bet" className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" title={basis(m, s)}>
          <span className="whitespace-nowrap font-heading text-[32px] font-bold leading-none tracking-[-0.02em]" title={PAYS_HELP}>Pays {pays(s.ask)}</span>
          <span className="text-[15px] font-medium text-soft">wins about {winsAbout(s.win_prob)}</span>
        </p>
        <div className="max-w-[45%] flex-none text-right">
          <div className="text-xs text-muted">Bet</div>
          <div className="font-semibold tabular-nums">{s.outcome} · {price(s.ask)}</div>
        </div>
      </div>
      <div className="-mt-1 flex flex-col gap-0.5 text-[13px]">
        <span className={s.ranges || s.edge > 0 ? "text-accent-softer" : "text-negative"}>
          {priceVerdict(s)} <span className="font-semibold tabular-nums text-accent">({sidePts(s)})</span>
        </span>
        <span className="text-muted" title={help ? RETURN_HELP : basis(m, s)}>
          {pro ? "Edge per share" : help ? <span className="underline decoration-dotted underline-offset-4">Expected return</span> : "Expected return"}{" "}
          <span className={`tabular-nums ${returnTone(s.roi_pct)}`}>{pro ? sideEdge(s) : sideRet(s)}</span>
        </span>
      </div>
      <OddsBars market={s.ask} won={s.win_prob} basis={basis(m, s)} />
      <Notes notes={rowNotes(m.execution, s)} />
      {edgeTier && <TierNote s={s} />}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[13px]">
        <span className="text-muted">$100 bet → <span className="text-text">expect {money(profit === null ? null : Math.round(profit), true)}</span></span>
        <span className="flex items-center gap-1">
          {c && <span className={chanceTone(c)}>{c}</span>}
          <VenueIconLink m={m} className="-my-2" />
          <AlertLink marketId={m.id} side={s.side_index} className="-my-2 -mr-2" />
        </span>
      </div>
    </article>
  );
}
