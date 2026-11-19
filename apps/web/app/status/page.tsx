// Status (T-29, F-24): when each part of the data was last refreshed, and what it holds.
import { DATA_SOURCE } from "@/lib/config";
import { getTier } from "@/lib/auth/server";
import { pendingLine } from "@/lib/data/respond";
import { getStoreFor, type Store } from "@/lib/data/store";
import { PendingState } from "@/components/screener/States";
import { DASH, ago, delayWords, formatCount } from "@/lib/format";
import { freshness } from "@/lib/freshness";
import { delayMin } from "@/lib/settings-core";

export const metadata = { title: "Status", description: "When MarketEdge data last refreshed." };
export const dynamic = "force-dynamic";

const n = (x: number | null | undefined) => formatCount(x);   // docs/18 §4
const when = (unix: unknown) =>
  typeof unix === "number"
    ? `${new Date(unix * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`
    : DASH;
const VERDICT_LABEL: Record<string, string> = {
  "worth it": "Fair price", thin: "Spread eats most of it", "not worth it": "Price too high right now", "no sellers": "No sellers", "no book": "No order book",
};

export default async function Page() {
  // RT3-07: the scan this tier is served (Free / signed-out: the delayed copy), like /api/meta: its time and counts.
  const tier = await getTier();
  let s: Store;
  try {
    s = await getStoreFor(tier);
  } catch (e) {
    return <div className="mx-auto w-full max-w-[720px] pt-4 md:pt-10"><PendingState line={pendingLine(e)} /></div>;
  }
  const delay = delayMin(tier);
  const { meta, model, backtest, ledgerSummary: l } = s;
  const level = freshness(meta.scanned_at);
  const times: [string, unknown, string][] = [
    ["Last market scan", meta.scanned_at, "Prices, win chances and best bets"],
    ["Last model fit", model.fitted_at, "Win-chance curves from settled markets"],
    ["Last backtest", backtest.ran_at, "The test behind Results"],
    ["Live record updated", l?.updated_at, "Best bets graded after they settle"],
  ];

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-10 pb-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-[32px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[40px]">Status</h1>
        <p className={`flex items-center gap-2 text-[15px] ${level === "fresh" ? "text-soft" : level === "amber" ? "text-warning" : "text-negative"}`}>
          <span className={`size-2 rounded-full ${level === "fresh" ? "bg-accent" : level === "amber" ? "bg-warning" : "bg-negative"}`} aria-hidden="true" />
          {level === "fresh" ? `Data is current. Last scan ${ago(meta.scanned_at)}.` : `Data may be stale. Last scan ${ago(meta.scanned_at)}; prices normally refresh about every 10 minutes.`}
        </p>
        {delay > 0 && <p className="text-sm text-muted">On the Free plan and when signed out, you see each scan {delayWords(delay)} after it runs: the scan above is the one you see. Paid plans see the newest scan.</p>}
      </header>

      <section aria-labelledby="times-h" className="flex flex-col gap-3">
        <h2 id="times-h" className="text-xl font-semibold">Last updated</h2>
        <ul className="overflow-hidden rounded-card border border-border bg-surface">
          {times.map(([label, t, what]) => (
            <li key={label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border px-4 py-3 first:border-t-0 md:px-5">
              <span><span className="font-medium">{label}</span><span className="block text-xs text-muted">{what}</span></span>
              <span className="tabular-nums text-soft" title={typeof t === "number" ? undefined : "not available"}>
                {when(t)}{typeof t === "number" && <span className="text-muted"> · {ago(t)}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="counts-h" className="flex flex-col gap-3">
        <h2 id="counts-h" className="text-xl font-semibold">What&apos;s in the data</h2>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border md:grid-cols-4">
          <Stat label="Markets scanned" value={n(meta.markets_scanned)} />
          <Stat label="Best bets" value={n(meta.flags)} />
          <Stat label="Events" value={n(s.byEvent.size)} />
          <Stat label="Live record" value={l ? `${n(l.entries)} logged` : DASH} sub={l ? `${n(l.graded)} settled · ${n(l.wins)} won · ${n(l.losses)} lost` : "No live record yet"} />
        </dl>
      </section>

      <section aria-labelledby="checks-h" className="flex flex-col gap-3">
        <h2 id="checks-h" className="text-xl font-semibold">Price checks on best bets</h2>
        {meta.verdicts ? (
          <ul className="overflow-hidden rounded-card border border-border bg-surface">
            {Object.entries(meta.verdicts).map(([v, c]) => (
              <li key={v} className="flex justify-between border-t border-border px-4 py-3 first:border-t-0 md:px-5">
                <span>{VERDICT_LABEL[v] ?? v}</span><span className="tabular-nums text-soft">{n(c)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Not available in this scan.</p>}
      </section>

      <section aria-labelledby="source-h" className="flex flex-col gap-2 text-sm text-soft">
        <h2 id="source-h" className="text-xl font-semibold text-text">Data source</h2>
        <p>
          Venue: {meta.platform === "polymarket" ? "Polymarket" : "Kalshi"} public market data · engine instance {meta.instance} ·
          read from {DATA_SOURCE === "local" ? "local files" : "the published scan data"}.
        </p>
      </section>
    </article>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-4 md:p-5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-heading text-2xl font-bold tabular-nums">{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  );
}
