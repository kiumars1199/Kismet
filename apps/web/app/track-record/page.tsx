// Results (T-26, F-14, F-29): walk-forward backtest from backtest.json (chosen half-life), model calibration
// from model.json, live forward record from ledger_summary.json. Every figure is read, never invented.
import { Tiles } from "@/components/results/Tiles";
import { chosenResult, curve } from "@/lib/data/model";
import { getStore, readSource } from "@/lib/data/store";
import { DASH, RETURN_HELP, edge, pct } from "@/lib/format";
import { TAXONOMY } from "@/lib/taxonomy";
import { bucketRows, foldRows, recordRows, tiles } from "@/lib/trackRecord";
import type { BacktestRecord, LedgerSummary } from "@/lib/types";
import { CalibrationChart, EdgeChart, FoldCharts, type CalibrationSet } from "./Charts";

export const metadata = { title: "Results", description: "How MarketEdge estimates have done: walk-forward backtest, calibration and settled-bet ledger.", alternates: { canonical: "/track-record" } };
export const dynamic = "force-dynamic";

const DATE = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" } as const;
const date = (unix: unknown) => (typeof unix === "number" ? new Date(unix * 1000).toLocaleDateString("en-US", DATE) : DASH);
const label = (cat: string) => TAXONOMY[cat]?.label ?? cat;
const H_NAME: Record<string, string> = { "1": "~1 hour", "6": "~6 hours", "24": "~1 day", "72": "~3 days", "168": "~1 week" };

/** First flag date of the live ledger (append-only file, oldest line first). */
async function firstFlaggedAt(): Promise<number | null> {
  const text = await readSource("ledger.jsonl").catch(() => undefined);
  let min: number | null = null;
  for (const line of text?.split("\n") ?? []) {
    const t = line ? (JSON.parse(line) as { flagged_at?: number }).flagged_at : undefined;
    if (typeof t === "number" && (min === null || t < min)) min = t;
  }
  return min;
}

export default async function Page() {
  const store = await getStore();
  const b = store.backtest;
  const r = chosenResult(b);
  const folds = foldRows(b);
  const buckets = bucketRows(b);
  const horizons = recordRows(r?.by_horizon).sort((x, y) => Number(x.key) - Number(y.key));

  const cats = ["all", ...((store.model.vocab as { cat?: string[] } | undefined)?.cat ?? [])];
  const sets: Record<string, CalibrationSet> = Object.fromEntries(cats.map((c) => [c, {
    label: c === "all" ? "All categories" : label(c),
    byH: Object.fromEntries(Object.keys(H_NAME).map((h) => {
      const cv = curve(store.model, c === "all" ? "all" : `cat:${c}`, Number(h));
      return [h, cv ? { points: cv.points, events: cv.events } : null];
    })),
  }]));

  const ledger = store.ledgerSummary;
  const since = ledger ? await firstFlaggedAt() : null;

  return (
    <article className="mx-auto flex max-w-6xl flex-col gap-12 pb-8">
      <header className="flex flex-col gap-3">
        <h1 className="max-w-3xl text-[32px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[40px]">How best bets did in testing</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
          We replayed {(b.folds as number | undefined) ?? DASH} weeks, one at a time. Each week the model only knew what happened before
          it, chose its best bets, and we checked how they settled. Each bet pays the estimated asking price plus Polymarket&apos;s fee.
          Last run {date(b.ran_at)}.
        </p>
      </header>

      <section aria-labelledby="tiles-h" className="flex flex-col gap-3">
        <h2 id="tiles-h" className="sr-only">Headline results</h2>
        <Tiles tiles={tiles(b)} />
        <p className="text-xs text-muted" title={RETURN_HELP}>
          &ldquo;Every bet, no filter&rdquo; buys every side of every market in the same weeks. It shows what the fee and the
          spread cost you without a filter. Past results, not a promise: any single bet can lose.
        </p>
      </section>

      <Section id="weeks" title="Week by week" note="Each bar is one test week. Weeks with no bars had no best bets. Red weeks lost money.">
        <FoldCharts rows={folds} />
        <TableDetails summary="Show weeks as a table">
          <Table head={["Week of", "Bets", "Return"]} rows={folds.map((f) => [f.week, f.bets.toLocaleString("en-US"), f.retText])} />
        </TableDetails>
      </Section>

      <Section id="edges" title="Do predicted edges come true?"
        note="Bets grouped by how big an edge the model predicted, in cents per $1 share, next to what that group actually earned. Smaller than predicted means the model was too optimistic there.">
        <EdgeChart rows={buckets} />
        <TableDetails summary="Show as a table">
          <Table head={["Predicted edge", "Bets", "Predicted", "Actually earned"]}
            rows={buckets.map((x) => [x.bucket, x.bets.toLocaleString("en-US"), edge(x.predicted / 100), edge(x.realized / 100)])} />
        </TableDetails>
      </Section>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-8">
        <Section id="cats" title="By category" note="Small samples swing a lot. Check the bets and events columns before trusting a row.">
          <RecordTable first="Category" rows={recordRows(r?.by_category).map((x) => ({ ...x, name: label(x.key) }))} />
        </Section>
        <Section id="close" title="By time before close" note="How long before the market closed the bet was placed.">
          <RecordTable first="Placed" rows={horizons.map((x) => ({ ...x, name: H_NAME[x.key] ?? `${x.key} h` }))} />
        </Section>
      </div>

      <Section id="calibration" title="Are the win chances honest?"
        note="For every price, how often bets at that price actually won in past markets (the model's curve). A curve on the dashed line means the market priced it right.">
        <CalibrationChart sets={sets} />
      </Section>

      <Section id="live" title="Live record" note="Every best bet is logged the moment it is shown, then graded when the market settles. This is the forward test, with no hindsight.">
        <LiveRecord ledger={ledger} since={since} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="limits-h" className="rounded-card border border-border bg-surface p-5 md:p-6">
          <h2 id="limits-h" className="text-xl font-semibold">Limitations</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-soft">
            <li>Past prices are mid prices (halfway between buy and sell). The real asking price was higher.</li>
            <li>To cover that gap, each test bet is charged half of today&apos;s typical spread for its kind of market. Spreads at the time are estimated, not recorded.</li>
            <li>Weather history is short, only a few weeks so far.</li>
            <li>Some categories and weeks have very few bets. Their numbers can be luck either way.</li>
            <li>Bets on the same game or day move together, so the true sample is the number of events, not bets.</li>
          </ul>
        </section>
        <section aria-labelledby="method-h" className="rounded-card border border-border bg-surface p-5 md:p-6">
          <h2 id="method-h" className="text-xl font-semibold">How it works</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-soft">
            <p>For thousands of settled markets we record the price some hours before close and whether it won. Grouped by sport,
              topic, bet type and time before close, that gives a curve: at 70¢, how often did bets like this win?</p>
            <p>When a group is small, its curve leans toward its broader parent (a niche leans on its category, a category on all
              markets), so a few lucky results can&apos;t drive it alone.</p>
            <p>Older results count less than recent ones, and bets from one game or one weather day are treated as one piece of
              evidence, not many.</p>
            <p>A bet is a best bet when its win chance beats the asking price plus the fee by at least {edge(store.meta.rule?.min_edge)} per $1
              share, still beats it on a pessimistic estimate, and its category and timing made money in this test.</p>
          </div>
        </section>
      </div>
    </article>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 id={`${id}-h`} className="text-2xl font-semibold tracking-[-0.01em]">{title}</h2>
        {note && <p className="max-w-2xl text-sm leading-relaxed text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function TableDetails({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-accent-hover">{summary}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            {head.map((h, i) => <th key={h} scope="col" className={`px-3 py-3 font-medium md:px-4 ${i ? "text-right" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((c, j) => <td key={j} className={`px-3 py-2.5 md:px-4 ${j ? "text-right" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RecRow = { key: string; name: string; r: BacktestRecord; f: ReturnType<typeof recordRows>[number]["f"] };
function RecordTable({ first, rows }: { first: string; rows: RecRow[] }) {
  return (
    <Table head={[first, "Bets", "Events", "Won", "Return"]} rows={rows.map(({ name, r, f }) => [
      name, f.bets, f.events, f.won,
      <span key="r" className={!r.flags ? "text-muted" : (r.roi_pct ?? 0) < 0 ? "text-negative" : "text-positive"} title={r.flags ? undefined : "not available"}>
        {r.flags ? f.ret : DASH}
      </span>,
    ])} />
  );
}

function LiveRecord({ ledger, since }: { ledger?: LedgerSummary; since: number | null }) {
  if (!ledger) {
    return <p className="rounded-card border border-border bg-surface p-5 text-sm text-soft">No live record on this data yet. It starts with the first logged best bet.</p>;
  }
  const n = ledger.entries.toLocaleString("en-US");
  const cats = Object.entries(ledger.by_category).sort((a, b) => b[1].entries - a[1].entries);
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 md:p-6">
      {ledger.graded === 0 ? (
        <p data-testid="live-summary" className="font-heading text-xl font-semibold leading-snug">
          Tracking {n} best bets{since ? ` since ${date(since)}` : ""}, none settled yet.
          <span className="mt-1 block font-sans text-sm font-normal text-muted">Results appear here as markets close. Updated {date(ledger.updated_at)}.</span>
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Logged best bets" value={n} />
          <Stat label="Settled" value={`${ledger.wins.toLocaleString("en-US")} won · ${ledger.losses.toLocaleString("en-US")} lost`} />
          <Stat label="Won" value={pct(ledger.wins / ledger.graded)} />
          <Stat label="Average profit per $1 share" value={edge(ledger.avg_pnl)} />
        </dl>
      )}
      {cats.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs text-soft">
          {cats.map(([c, s]) => (
            <li key={c} className="rounded-full bg-muted-bg px-3 py-1">{label(c)} {s.entries.toLocaleString("en-US")} logged · {s.graded.toLocaleString("en-US")} settled</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-heading text-2xl font-bold">{value}</dd>
    </div>
  );
}
