// F3: Kalshi matches on /markets. Prices are Kalshi's own (credited); Kismet has no win-chance estimate on these, so no
// edge, no Best bets. A market with no price says "No price yet".
import type { KalshiPage, KalshiRow } from "@/lib/data/kalshi-index";
import { DASH, closesIn, formatCount, price } from "@/lib/format";
import { KalshiLink, KalshiNum } from "@/components/kalshi/KalshiBoard";

const priceOf = (r: KalshiRow) => (r.price_cents === null ? "No price yet" : price(r.price_cents / 100));

function Row({ r }: { r: KalshiRow }) {
  return (
    <li className="flex items-start justify-between gap-4 border-t border-border px-4 py-3 first:border-t-0" data-testid="kalshi-row">
      <div className="min-w-0">
        <KalshiLink href={r.url} className="font-medium text-text">{r.title}</KalshiLink>
        {r.subtitle && r.subtitle !== r.title && <span className="block text-xs text-muted">{r.subtitle}</span>}
        <span className="block text-xs text-muted">Closes in {r.closes_at ? closesIn(r.closes_at) : DASH} · {formatCount(r.volume)} traded</span>
      </div>
      <KalshiNum>{r.price_cents === null ? <span className="text-muted" data-testid="kalshi-no-price">{priceOf(r)}</span> : priceOf(r)}</KalshiNum>
    </li>
  );
}

/** `also`: the short "Also on Kalshi" strip under Polymarket results (top 5), else the full Kalshi list. */
export function KalshiResults({ page, also = false }: { page: KalshiPage; also?: boolean }) {
  if (also && page.total === 0) return null;
  return (
    <section aria-labelledby="kalshi-res-h" className="flex flex-col gap-2" data-testid="kalshi-results">
      <h2 id="kalshi-res-h" className="font-heading text-base font-semibold">
        {also ? `Also on Kalshi (${formatCount(page.total)})` : `${formatCount(page.total)} ${page.total === 1 ? "Kalshi market" : "Kalshi markets"}`}
      </h2>
      <p className="text-xs text-muted">Kalshi&apos;s own prices. We have no win-chance estimate for these yet.</p>
      <ul className="rounded-card border border-border bg-surface">{page.rows.map((r) => <Row key={r.ticker} r={r} />)}</ul>
    </section>
  );
}
