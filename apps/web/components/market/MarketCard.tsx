"use client";

// Compact row card (MobileHybrid artboard): topic · closes, question, "Bet X at Y · won Z before", big return.
import type { ApiRow } from "@/lib/api";
import { basis, closesIn, edge, pct, price, ret } from "@/lib/format";
import { drawerHref, useOpenDrawer } from "./DrawerHost";
import { Notes } from "./bits";
import { returnTone, rowNotes, topicLabel } from "./labels";

export function MarketCard({ r, pro = false, notes = true }: { r: ApiRow; pro?: boolean; notes?: boolean }) {
  const { open } = useOpenDrawer();
  const { market: m, side: s } = r;
  return (
    <a
      href={drawerHref(m.id, s.side_index)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        open(m.id, s.side_index);
      }}
      className="flex items-center gap-3 rounded-inner border border-border bg-surface p-3.5 hover:border-accent-border"
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{topicLabel(m)} · {closesIn(m.closes_at)}</div>
        <div className="mt-0.5 text-[15px] font-semibold leading-snug">{m.question}</div>
        <div className="mt-1 text-xs text-muted" title={basis(m, s)}>Bet {s.outcome} at {price(s.ask)} · won {pct(s.win_prob)} before</div>
        {notes && <Notes notes={rowNotes(m.execution, s)} className="mt-1" />}
      </div>
      <div className="flex-none text-right">
        <div className={`font-heading text-2xl font-bold ${returnTone(s.roi_pct)}`}>{pro ? edge(s.edge) : ret(s.roi_pct)}</div>
        <div className="text-[11px] text-muted">{pro ? "edge" : "expected"}</div>
      </div>
    </a>
  );
}
