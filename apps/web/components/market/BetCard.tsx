"use client";

// Best-bets card (Hybrid artboard). Exported for other lanes: <BetCard r={{ market, side }} />.
import type { ApiRow } from "@/lib/api";
import { RETURN_HELP, basis, chance, closesIn, edge, expectedProfit, money, price, ret } from "@/lib/format";
import { WatchStar } from "@/components/watch/WatchStar";
import { drawerHref, useOpenDrawer } from "./DrawerHost";
import { AlertLink, Notes, OddsBars } from "./bits";
import { chanceTone, rowNotes, topicLabel } from "./labels";

export function BetCard({ r, highlight = false, help = false, pro = false }: { r: ApiRow; highlight?: boolean; help?: boolean; pro?: boolean }) {
  const { open } = useOpenDrawer();
  const { market: m, side: s } = r;
  const c = chance(s.win_prob);
  const profit = expectedProfit(s.roi_pct);
  return (
    <article data-row data-market-id={m.id} className={`relative flex w-full flex-col gap-3.5 rounded-card border p-[18px] hover:border-accent ${highlight ? "border-accent-border bg-accent-bg/40" : "border-border bg-surface"}`}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="rounded-full bg-muted-bg px-2.5 py-[3px]">{topicLabel(m)}</span>
        <span className="flex items-center gap-1">
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
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted" title={help ? RETURN_HELP : undefined}>
            {pro ? "Edge per share" : help ? <span className="underline decoration-dotted underline-offset-4">Expected return</span> : "Expected return"}
          </div>
          <div className={`font-heading text-4xl font-bold leading-[1.1] tracking-[-0.02em] ${s.roi_pct >= 0 ? "text-accent" : "text-negative"}`} title={basis(m, s)}>
            {pro ? edge(s.edge) : ret(s.roi_pct)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Bet</div>
          <div className="font-semibold">{s.outcome} · {price(s.ask)}</div>
        </div>
      </div>
      <OddsBars market={s.ask} won={s.win_prob} basis={basis(m, s)} />
      <Notes notes={rowNotes(m.execution, s)} />
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[13px]">
        <span className="text-muted">$100 bet → <span className="text-text">expect {money(profit === null ? null : Math.round(profit), true)}</span></span>
        <span className="flex items-center gap-1">
          {c && <span className={chanceTone(c)}>{c}</span>}
          <AlertLink marketId={m.id} side={s.side_index} className="-my-2 -mr-2" />
        </span>
      </div>
    </article>
  );
}
