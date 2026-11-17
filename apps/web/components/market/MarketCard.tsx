"use client";

// Compact row card (MobileHybrid artboard): topic · closes, question, "Bet X at Y · won Z before", big return.
// The question link covers the card (opens the drawer); star and alert sit above it.
import type { ApiRow } from "@/lib/api";
import { basis, closesIn, edge, pays, PAYS_HELP, pct, price, ret } from "@/lib/format";
import { WatchStar } from "@/components/watch/WatchStar";
import { VenueIconLink } from "@/components/trade/TradeButton";
import { drawerHref, useOpenDrawer } from "./DrawerHost";
import { AlertLink, Notes } from "./bits";
import { returnTone, rowNotes, topicLabel } from "./labels";

export function MarketCard({ r, pro = false, notes = true }: { r: ApiRow; pro?: boolean; notes?: boolean }) {
  const { open } = useOpenDrawer();
  const { market: m, side: s } = r;
  return (
    <div data-row data-market-id={m.id} className="relative flex gap-3 rounded-inner border border-border bg-surface p-3.5 hover:border-accent-border focus-within:border-accent-border">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{topicLabel(m)} · {closesIn(m.closes_at)}</div>
        <a
          href={drawerHref(m.id, s.side_index)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            open(m.id, s.side_index);
          }}
          className="mt-0.5 block text-[15px] font-semibold leading-snug after:absolute after:inset-0 after:rounded-inner focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-accent"
        >
          {m.question}
        </a>
        <div className="mt-1 text-xs text-muted"><span title={basis(m, s)}>Bet {s.outcome} at {price(s.ask)} · won {pct(s.win_prob)} before</span> · <span className="whitespace-nowrap text-soft" title={PAYS_HELP}>pays {pays(s.ask)}</span></div>
        {notes && <Notes notes={rowNotes(m.execution, s)} className="mt-1" />}
      </div>
      <div className="flex flex-none flex-col items-end justify-between gap-1">
        <div className="text-right">
          <div className={`font-heading text-2xl font-bold ${returnTone(s.roi_pct)}`}>{pro ? edge(s.edge) : ret(s.roi_pct)}</div>
          <div className="text-[11px] text-muted">{pro ? "edge" : "expected"}</div>
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
