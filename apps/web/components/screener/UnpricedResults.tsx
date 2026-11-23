// F3 fix: open Polymarket markets the model has not priced (no live book, or closing past 10 days). No price, no win
// chance, never a Best bet: the row says "Not priced yet" and links to Polymarket. Top 10 by volume, with the total.
import type { UnpricedPage } from "@/lib/data/polymarket-index";
import { DASH, closesIn, formatCount } from "@/lib/format";

export function UnpricedResults({ page, also = false }: { page: UnpricedPage; also?: boolean }) {
  if (page.total === 0) return null;
  return (
    <section aria-labelledby="unpriced-h" className="flex flex-col gap-2" data-testid="unpriced-results">
      <h2 id="unpriced-h" className="font-heading text-base font-semibold">
        {also ? "Also open on Polymarket" : "Open on Polymarket"} ({formatCount(page.total)})
      </h2>
      <p className="text-xs text-muted">Not priced yet: we have no live price or win chance for these, so they are never in Best bets. Add a word to narrow the list.</p>
      <ul className="rounded-card border border-border bg-surface">
        {page.rows.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-4 border-t border-border px-4 py-3 first:border-t-0" data-testid="unpriced-row">
            <div className="min-w-0">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-text underline-offset-2 hover:underline">{r.question}</a>
              {r.event && r.event !== r.question && <span className="block text-xs text-muted">{r.event}</span>}
              <span className="block text-xs text-muted">Closes in {r.closes_at ? closesIn(r.closes_at) : DASH} · {formatCount(r.volume)} traded</span>
            </div>
            <span className="shrink-0 text-sm text-muted" data-testid="unpriced-label">Not priced yet</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
