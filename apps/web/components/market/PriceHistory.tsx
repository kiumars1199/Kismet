"use client";

// F14: the market's price over time (best side, % chance), with its basis line. Fixed height in every state, so the
// drawer never jumps. Data: GET /api/markets/<id>/history (Polymarket prices only).
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { Ago } from "@/components/clock";
import { basisLine, tickPct, type HistoryPoint } from "@/lib/history/points";

type Body = { points: HistoryPoint[]; interval_s: number | null; venue: string; source?: "file" | "live" | null; as_of?: number | null };
type State = { status: "loading" } | { status: "error" } | { status: "ok"; body: Body };

const H = "h-[200px]";
/** The whole card is one fixed height in every state (loading, chart, empty, error): nothing below it ever moves. */
export const HISTORY_CARD_H = "h-[340px]";
const day = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const when = (t: number) => new Date(t * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });

export function PriceHistory({ id, outcome }: { id: string; outcome: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/markets/${encodeURIComponent(id)}/history`, { signal: ac.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Body>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => setState({ status: "ok", body }))
      .catch(() => { if (!ac.signal.aborted) setState({ status: "error" }); });
    return () => ac.abort();
  }, [id, retry]);

  const body = state.status === "ok" ? state.body : null;
  const pts = body?.points ?? [];
  return (
    <figure className={`m-0 flex ${HISTORY_CARD_H} flex-col overflow-hidden rounded-card border border-border bg-surface p-4`} data-testid="price-history">
      <figcaption className="mb-2 h-5 shrink-0 text-sm font-semibold">Price over time</figcaption>
      <div className={`${H} w-full shrink-0`}>
        {state.status === "loading" ? (
          <div className={`${H} animate-pulse rounded-input bg-muted-bg`} aria-busy="true" aria-label="Loading price history" />
        ) : state.status === "error" ? (
          <div className={`${H} flex flex-col items-start justify-center gap-2 text-sm text-muted`} role="alert">
            <p>Couldn&apos;t load the price history.</p>
            <button type="button" onClick={() => setRetry((n) => n + 1)} className="min-h-11 rounded-input border border-border px-4 text-text hover:border-accent-border">Try again</button>
          </div>
        ) : pts.length < 2 ? (
          <div className={`${H} flex items-center text-sm text-muted`} data-testid="history-empty">No price history for this market yet</div>
        ) : (
          <div className={`${H} w-full`} role="img" aria-label={`Chart: the price of ${outcome} from ${tickPct(pts[0]!.p)} on ${day(pts[0]!.t)} to ${tickPct(pts.at(-1)!.p)} on ${day(pts.at(-1)!.t)}.`} data-testid="history-chart">
            <LineChart responsive style={{ width: "100%", height: "100%" }} data={pts} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={day} stroke="var(--muted)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
              <YAxis type="number" domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={tickPct} stroke="var(--muted)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--raised)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                labelFormatter={(v) => when(Number(v))}
                formatter={(v) => [tickPct(Number(v)), outcome]}
              />
              <Line dataKey="p" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </div>
        )}
      </div>
      <p className="mt-2 h-8 shrink-0 overflow-hidden text-xs text-muted" data-testid="history-basis">
        {body && body.interval_s && pts.length >= 2 ? `${basisLine(body.venue, body.interval_s)}. Chance of ${outcome}.` : "Prices from Polymarket."}
      </p>
      <details className="mt-1 shrink-0 text-xs text-muted" data-testid="history-details">
        <summary className="cursor-pointer py-1 text-soft">Where this comes from</summary>
        <p className="mt-1" data-testid="history-source">
          {body && pts.length >= 2
            ? <>Polymarket&apos;s own price history for this outcome{body.source === "live" ? ", fetched when you opened this" : ", saved with the latest scan"} · latest point <Ago at={body.as_of} />. Free accounts see it up to their delayed scan.</>
            : "Polymarket's own price history for this outcome, when it has one."}
        </p>
      </details>
    </figure>
  );
}
