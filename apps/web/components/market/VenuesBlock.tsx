// F4: the same outcome on each venue, side by side. Shown only for a market listed on 2+ venues (engine/venues.py).
// Basis: prices are each venue's own best ask for this side; payout includes that venue's fee.
import { Ago } from "@/components/clock";
import { venueBasis, venueRows } from "@/lib/venues/rows";
import type { Market } from "@/lib/types";

export function VenuesBlock({ market }: { market: Pick<Market, "venues" | "best"> }) {
  if ((market.venues?.length ?? 0) < 2) return null;
  const rows = venueRows(market.venues);
  return (
    <section aria-labelledby="venues-h" className="rounded-card border border-border bg-surface p-4" data-testid="venues-block">
      <h3 id="venues-h" className="font-heading text-sm font-semibold">{market.best.outcome}: same outcome, every venue</h3>
      <ul className="mt-2 flex flex-col">
        {rows.map((r) => (
          <li key={r.venue} data-venue={r.venue} className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0">
            <span className="flex flex-wrap items-center gap-2 text-sm">
              {r.label}
              {r.best && <span className="rounded-sm bg-accent-bg px-1.5 py-0.5 text-[11px] font-semibold text-accent-soft" data-testid="pays-most">{r.bestLabel}</span>}
            </span>
            {r.listed ? (
              <span className="text-right text-sm tabular-nums">
                {r.pays && <span className="font-semibold">{r.pays}</span>}
                <span className={r.pays ? "ml-2 text-muted" : ""}>{r.chance}</span>
              </span>
            ) : (
              <span className="text-sm text-muted">Not listed</span>
            )}
          </li>
        ))}
      </ul>
      {rows.some((r) => r.listed && !r.pays) && <p className="mt-2 text-xs text-muted">Kalshi shows its price only: its payout after fees is not worked out here yet.</p>}
      <details className="mt-2 text-xs text-muted" data-testid="venues-basis">
        <summary className="cursor-pointer py-1 text-soft">Where these prices come from</summary>
        <ul className="mt-1 flex flex-col gap-1">
          {venueBasis(market.venues).map((b) => (
            <li key={b.venue} data-basis={b.venue}>
              <span className="font-medium text-text">{b.label}</span>: {b.source}
              {b.at ? <> · as of <Ago at={b.at} /></> : null}
              {b.match ? <> · {b.match}</> : null}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
