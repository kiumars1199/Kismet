"use client";
// /check (SPEC F1): paste a link or search by words, pick a side, edit price and stake; every number updates as you type.
// Only the first lookup calls /api/check (it counts toward Free's daily check); edits recompute here with the same
// pure function the server used (lib/check/compute.ts), so nothing waits on the network.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckSearchResponse } from "@/app/api/check/search/route";
import { compute, ERROR_TEXT } from "@/lib/check/compute";
import { parseLink } from "@/lib/check/parse-link";
import type { CheckResponse } from "@/lib/check/response";
import { SCORE_FORMULA } from "@/lib/check/score";
import { payoutMoney, pct, ret } from "@/lib/format";
import { multX, INTL_ONLY, US_SMALL_PRINT } from "@/lib/card";
import { gapPts } from "@/lib/betFigures";

type Found = { kind: "ok"; data: CheckResponse } | { kind: "limit" } | { kind: "missing" } | { kind: "error"; text: string } | null;
const pts = (e: number) => { const v = Math.round(e * 100); return `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v)} ${Math.abs(v) === 1 ? "point" : "points"}`; };

export function CheckClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found>(null);
  const [hits, setHits] = useState<CheckSearchResponse["markets"]>([]);
  const [side, setSide] = useState<0 | 1>(0);
  const [priceText, setPriceText] = useState("");
  const [stakeText, setStakeText] = useState("100");
  const started = useRef("");

  async function run(body: { m?: string; link?: string; side?: 0 | 1 }) {
    setBusy(true); setHits([]);
    try {
      const r = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, stake: 100 }) });
      if (r.status === 429) return setFound({ kind: "limit" });
      if (r.status === 404) return setFound({ kind: "missing" });
      if (!r.ok) return setFound({ kind: "error", text: "Something went wrong. Try again in a moment." });
      const data = (await r.json()) as CheckResponse;
      setFound({ kind: "ok", data });
      setSide(data.side);
      setPriceText(String(Math.round(data.result.price * 100)));
    } catch {
      setFound({ kind: "error", text: "Couldn't reach Kismet. Check your connection and try again." });
    } finally { setBusy(false); }
  }

  // /check?m=<id>&side=<0|1> (the "Check" link on a bet card)
  useEffect(() => {
    const m = sp.get("m");
    const key = `${m}|${sp.get("side")}`;
    if (!m || started.current === key) return;
    started.current = key;
    void run({ m, side: sp.get("side") === "1" ? 1 : 0 });
  }, [sp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    if (parseLink(q)) return void run({ link: q });
    setBusy(true); setFound(null);
    try {
      const r = await fetch(`/api/check/search?${new URLSearchParams({ q })}`);
      if (!r.ok) throw new Error(String(r.status));
      const list = ((await r.json()) as CheckSearchResponse).markets;
      setHits(list);
      if (!list.length) setFound({ kind: "error", text: "No open markets match those words. Try fewer or different words." });
    } catch { setFound({ kind: "error", text: "Search is unavailable right now." }); }
    finally { setBusy(false); }
  }

  const data = found?.kind === "ok" ? found.data : null;
  const deepLink = !!sp.get("m");
  const loading = busy || (deepLink && found === null);
  const cur = data?.sides.find((s) => s.index === side) ?? null;
  const price = priceText.trim() === "" ? NaN : Number(priceText) / 100;
  const stake = stakeText.trim() === "" ? NaN : Number(stakeText);
  const r = useMemo(() => (cur ? compute(cur.base, Number.isNaN(price) ? 0 : price, Number.isNaN(stake) ? 0 : stake) : null), [cur, price, stake]);

  return (
    <div className="flex flex-col gap-5 [--check-h:1000px] md:[--check-h:700px]" data-testid="check-page">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="check-q">Market link or words</label>
        <input id="check-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a Polymarket or Kalshi link, or type a team or topic"
          className="min-h-11 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 text-sm text-text placeholder:text-muted" />
        <button type="submit" disabled={busy} className="min-h-11 rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">Check</button>
      </form>

      {/* one fixed-height status row so loading never shifts the page */}
      <div className="min-h-6 text-[13px] text-muted" role="status" aria-live="polite">{busy ? "Looking it up…" : ""}</div>

      {hits.length > 0 && (
        <ul data-testid="check-hits" className="flex flex-col gap-2">
          {hits.map((h) => (
            <li key={`${h.id}-${h.side_index}`}>
              <button type="button" onClick={() => { router.replace(`/check?m=${encodeURIComponent(h.id)}&side=${h.side_index}`); }}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2 text-left text-sm hover:border-accent-border">
                <span className="min-w-0 truncate">{h.question}</span><span className="flex-none text-muted">{h.outcome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!busy && hits.length === 0 && text && found === null && null}

      {found?.kind === "missing" && (
        <p data-testid="check-missing" className="rounded-card border border-border bg-surface p-4 text-sm text-soft">We couldn&apos;t find an open market at that link. Try searching by words above.</p>
      )}
      {found?.kind === "error" && <p className="rounded-card border border-border bg-surface p-4 text-sm text-soft">{found.text}</p>}
      {found?.kind === "limit" && (
        <div data-testid="check-upgrade" className="flex flex-col items-start gap-3 rounded-card border border-accent-border bg-surface p-5">
          <p className="text-sm text-soft">Free includes 1 bet check a day, and you&apos;ve used it. Pro and Premium check as many bets as you like.</p>
          <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">See plans</Link>
        </div>
      )}

      {!data && deepLink && loading && <div data-testid="check-skeleton" aria-hidden="true" className="min-h-[var(--check-h)] animate-pulse rounded-card border border-border bg-surface" />}

      {data && cur && r && (
        <section aria-label="Check result" style={{ minHeight: "var(--check-h)" }} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-sm md:p-5">
          <div>
            <h2 className="font-heading text-[20px] font-bold leading-tight">{data.market.question}</h2>
            <p className="mt-1 text-[13px] text-muted">{data.market.event}</p>
          </div>

          <div role="group" aria-label="Side" className="flex flex-wrap gap-2">
            {data.sides.map((s) => (
              <button key={s.index} type="button" aria-pressed={s.index === side}
                onClick={() => { setSide(s.index); setPriceText(String(Math.round(s.base.ask * 100))); }}
                className={`min-h-11 rounded-input border px-4 text-sm font-semibold ${s.index === side ? "border-accent bg-accent-soft/10 text-accent-soft" : "border-border text-soft"}`}>
                {s.outcome}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[13px] text-muted">Price (%)
              <input data-testid="check-price" inputMode="numeric" value={priceText} onChange={(e) => setPriceText(e.target.value.replace(/[^\d.]/g, ""))}
                className="min-h-11 rounded-input border border-border bg-bg px-3 text-base text-text" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-muted">Stake ($)
              <input data-testid="check-stake" inputMode="numeric" value={stakeText} onChange={(e) => setStakeText(e.target.value.replace(/[^\d.]/g, ""))}
                className="min-h-11 rounded-input border border-border bg-bg px-3 text-base text-text" />
            </label>
          </div>

          <div data-testid="check-error" className="min-h-[1.5rem] text-[13px] text-negative" role="alert">{r.error && r.error !== "no_model" ? ERROR_TEXT[r.error] : ""}</div>

          {r.error === "no_model" ? (
            <p data-testid="check-nomodel" className="text-sm text-soft">{ERROR_TEXT.no_model}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat id="chance" label="Our chance" value={pct(r.chance)} />
              <Stat id="market" label="Market says" value={r.error ? "—" : pct(r.marketPct)} />
              <Stat id="mult" label="Pays" value={r.multiplier === null ? "—" : multX(r.multiplier)} />
              <Stat id="edge" label="Edge (points)" value={r.gap === null || r.chance === null ? "—" : gapPts({ ask: r.price, win_prob: r.chance, fee: 0, edge: 0 })} />
              <Stat id="return" label="Estimated return" value={r.multiplier === null || r.chance === null || r.error ? "—" : ret((r.chance * r.multiplier - 1) * 100)} />
            </dl>
          )}

          {r.error !== "no_model" && (
            <div className="rounded-card border border-border bg-bg p-4">
              <div className="flex items-baseline gap-3">
                <span data-testid="chk-score" className="font-heading text-[40px] font-bold leading-none text-accent-soft">{r.score === null ? "—" : r.score}</span>
                <span className="text-sm text-muted">out of 100</span>
              </div>
              {r.edge !== null && !r.error && <p data-testid="chk-netedge" className="mt-1 text-[13px] text-soft">After the fee: {pts(r.edge)} of win chance over the price.</p>}
              <p data-testid="check-formula" className="mt-2 text-[13px] leading-relaxed text-muted">{SCORE_FORMULA}</p>
              {r.payout !== null && !r.error && (
                <p className="mt-2 text-[13px] text-soft">A {payoutMoney(r.stake)} bet brings back {payoutMoney(r.payout)} if it wins{r.profit !== null ? `; estimated return ${r.profit >= 0 ? "+" : "−"}${payoutMoney(Math.abs(r.profit))} on average` : ""}. Any single bet can lose.</p>
              )}
            </div>
          )}

          <details className="text-[13px] text-muted">
            <summary className="min-h-11 cursor-pointer py-2">Why this number?</summary>
            <p data-testid="check-basis" className="pb-2">{cur.basis}</p>
          </details>
          {cur.base.venue !== "intl" && (
            <p data-testid="check-venue" className="text-xs text-muted">{cur.base.venue === "us" ? US_SMALL_PRINT : INTL_ONLY}</p>
          )}
          <p className="text-[12px] text-muted">Bet only what you can afford to lose.</p>
        </section>
      )}
    </div>
  );
}

function Stat({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-bg p-3">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd data-testid={`chk-${id}`} className="mt-1 font-heading text-[22px] font-bold leading-tight">{value}</dd>
    </div>
  );
}
