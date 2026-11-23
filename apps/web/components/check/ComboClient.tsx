"use client";
// /check/combo (SPEC F2). Add legs by words or by pasted link (or a card link: ?m=<id>&side=<0|1>). A leg is looked up without
// any model numbers (/api/check/leg). The set is scored only when the person taps "Check this combo" (/api/check/combo, ONE
// Free check for that set); the numbers, and the weakest-leg suggestion, are computed here from what it returns.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckSearchResponse } from "@/app/api/check/search/route";
import { checkCombo, MAX_COMBO_LEGS, MIN_COMBO_LEGS, type ComboLeg } from "@/lib/check/combo";
import { parseLink } from "@/lib/check/parse-link";
import type { ComboLegsResponse, LegLookup } from "@/lib/check/response";
import { SCORE_FORMULA } from "@/lib/check/score";
import { multX } from "@/lib/card";
import { pct } from "@/lib/format";

const pts = (e: number) => { const v = Math.round(e * 100); return `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v)} ${Math.abs(v) === 1 ? "point" : "points"}`; };

type Listed = { key: string; marketId: string; side: 0 | 1; question: string; outcome: string; eventId: string; event: string; price: number };
type Scored = { setKey: string; legs: Map<string, { base: ComboLeg["base"]; basis: string }> };
const listed = (d: LegLookup): Listed => ({ key: `${d.market.id}:${d.side}`, marketId: d.market.id, side: d.side, question: d.market.question, outcome: d.outcome, eventId: d.market.event_id, event: d.market.event, price: d.price });
const setKeyOf = (legs: Listed[]) => legs.map((l) => l.key).sort().join("|");

export function ComboClient() {
  const sp = useSearchParams();
  const [legs, setLegs] = useState<Listed[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [note, setNote] = useState("");
  const [limit, setLimit] = useState(false);
  const [scored, setScored] = useState<Scored | null>(null);
  const [hits, setHits] = useState<CheckSearchResponse["markets"]>([]);
  const legsRef = useRef(legs);
  legsRef.current = legs;
  const started = useRef("");
  const seq = useRef(0);

  async function add(body: { m?: string; link?: string; side?: 0 | 1 }) {
    setBusy(true); setNote(""); setHits([]);
    try {
      const r = await fetch("/api/check/leg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.status === 404) return setNote("We couldn't find an open market at that link.");
      if (!r.ok) return setNote("Something went wrong. Try again in a moment.");
      const l = listed((await r.json()) as LegLookup);
      const cur = legsRef.current;
      if (cur.some((x) => x.marketId === l.marketId)) return setNote("That bet is already in your combo.");
      if (cur.length >= MAX_COMBO_LEGS) return setNote(`A combo holds at most ${MAX_COMBO_LEGS} legs.`);
      setLegs([...cur, l]); setText("");
    } catch { setNote("Couldn't reach Kismet. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const m = sp.get("m");
    const key = `${m}|${sp.get("side")}`;
    if (!m || started.current === key) return;
    started.current = key;
    void add({ m, side: sp.get("side") === "1" ? 1 : 0 });
  }, [sp]);

  // Scoring is an explicit tap ("Check this combo"): one Free check for this set. The response carries every leg's inputs, so
  // removing legs afterwards (including "Drop that leg") recomputes here and never asks the server again. Adding a leg is a new set.
  const setKey = useMemo(() => setKeyOf(legs), [legs]);
  async function checkNow() {
    if (legs.length < MIN_COMBO_LEGS || scoring) return;
    const mine = ++seq.current;
    setScoring(true); setLimit(false); setNote("");
    try {
      const r = await fetch("/api/check/combo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legs: legs.map((l) => ({ m: l.marketId, side: l.side })) }) });
      if (mine !== seq.current) return;
      if (r.status === 429) { setLimit(true); setScored(null); return; }
      if (!r.ok) { setNote("Couldn't score this combo. Try again in a moment."); return; }
      const out = ((await r.json()) as ComboLegsResponse).legs;
      const map = new Map<string, { base: ComboLeg["base"]; basis: string }>();
      for (const d of out) map.set(`${d.m}:${d.side}`, { base: d.base, basis: d.basis });
      setScored({ setKey, legs: map });
    } catch { if (mine === seq.current) setNote("Couldn't reach Kismet. Check your connection and try again."); }
    finally { if (mine === seq.current) setScoring(false); }
  }

  const ready = !!scored && legs.length >= MIN_COMBO_LEGS && legs.every((l) => scored.legs.has(l.key));
  const combos: ComboLeg[] = useMemo(() => (ready ? legs.map((l) => ({ ...l, base: scored!.legs.get(l.key)!.base })) : []), [ready, legs, scored]);
  const c = useMemo(() => checkCombo(combos), [combos]);
  const n = ready ? c.numbers : null;
  const dropLeg = c.drop ? legs[c.drop.index] : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    if (parseLink(q)) return void add({ link: q });
    setBusy(true); setNote("");
    try {
      const r = await fetch(`/api/check/search?${new URLSearchParams({ q })}`);
      if (!r.ok) throw new Error(String(r.status));
      const list = ((await r.json()) as CheckSearchResponse).markets;
      setHits(list);
      if (!list.length) setNote("No open markets match those words.");
    } catch { setNote("Search is unavailable right now."); }
    finally { setBusy(false); }
  }

  const smallest = ready ? Math.min(...combos.map((l) => l.base.n ?? 0)) : null;

  return (
    <div className="flex flex-col gap-5" data-testid="combo-check">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="combo-q">Add a bet by link or words</label>
        <input id="combo-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a bet: paste a link or type a team or topic"
          className="min-h-11 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 text-sm text-text placeholder:text-muted" />
        <button type="submit" disabled={busy} className="min-h-11 rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">Add</button>
      </form>
      <div className="min-h-6 text-[13px] text-muted" role="status" aria-live="polite" data-testid="combo-note">{busy ? "Looking it up…" : scoring ? "Scoring your combo…" : note}</div>

      {hits.length > 0 && (
        <ul data-testid="combo-hits" className="flex flex-col gap-2">
          {hits.map((h) => (
            <li key={`${h.id}-${h.side_index}`}>
              <button type="button" onClick={() => void add({ m: h.id, side: h.side_index })}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2 text-left text-sm hover:border-accent-border">
                <span className="min-w-0 truncate">{h.question}</span><span className="flex-none text-muted">{h.outcome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {limit && (
        <div data-testid="check-upgrade" className="flex flex-col items-start gap-3 rounded-card border border-accent-border bg-surface p-5">
          <p className="text-sm text-soft">Free includes 1 bet check a day, and you&apos;ve used it. Pro and Premium check as many bets and combos as you like.</p>
          <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">See plans</Link>
        </div>
      )}

      {/* room for two legs from the start, so legs arriving after a slow lookup don't push the result down */}
      <ul data-testid="combo-legs" className="flex min-h-[148px] flex-col gap-2">
        {legs.map((l, i) => {
          const b = ready ? scored!.legs.get(l.key)?.base : undefined;
          return (
            <li key={l.key} data-testid="combo-leg" className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{l.question}</p>
                <p className="text-[12px] text-muted">Bet {l.outcome} at {pct(l.price)}{b ? ` · ${b.winProb === null ? "No model chance" : `${pct(b.winProb)} chance`} · pays ${multX(1 / (b.ask + b.fee))}` : ""}</p>
              </div>
              <button type="button" aria-label={`Remove ${l.question}`} onClick={() => setLegs(legs.filter((_, j) => j !== i))} className="min-h-11 min-w-11 rounded-input border border-border text-soft">✕</button>
            </li>
          );
        })}
      </ul>

      <section aria-label="Combo result" className="flex min-h-[150px] flex-col gap-3 rounded-card border border-border bg-surface p-4 md:p-5">
        {legs.length < MIN_COMBO_LEGS && <p data-testid="combo-msg" className="text-sm text-soft">{legs.length === 0 ? "Add at least two bets to check a combo." : "Add at least one more leg."}</p>}
        {legs.length >= MIN_COMBO_LEGS && !ready && !limit && (
          <div className="flex flex-col items-start gap-2">
            <p data-testid="combo-msg" className="text-sm text-soft">{scoring ? "Scoring your combo…" : "Ready when you are. Free includes 1 check a day; this combo counts as one."}</p>
            <button type="button" data-testid="combo-check-btn" disabled={scoring} onClick={() => void checkNow()} className="min-h-11 rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">Check this combo</button>
          </div>
        )}
        {ready && c.error === "no_model" && <p data-testid="combo-msg" className="text-sm text-soft">No model chance for &ldquo;{c.noModel}&rdquo;, so this combo can&apos;t be scored. Remove that leg.</p>}
        {ready && c.sameEvent.length > 0 && (
          <p data-testid="combo-same-event" className="rounded-input border border-border bg-bg p-3 text-[13px] text-soft">
            Same event ({c.sameEvent.join(", ")}): these legs move together, the combined chance is likely off.
          </p>
        )}
        {n && (
          <>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat id="chance" label="Combined chance" value={pct(n.chance)} />
              <Stat id="mult" label="Pays" value={multX(n.multiplier)} />
              <Stat id="edge" label="Edge after fee" value={pts(n.edge)} />
              <Stat id="score" label="Score (of 100)" value={n.score === null ? "—" : String(n.score)} />
            </dl>
            <p data-testid="combo-formula" className="text-[13px] leading-relaxed text-muted">{SCORE_FORMULA} For a combo, the chance is each leg&apos;s chance multiplied together and the sample is the smallest leg&apos;s. That assumes the legs are independent; legs from the same event aren&apos;t.</p>
            {c.drop && dropLeg && c.drop.numbers.score !== null && n.score !== null && c.drop.numbers.score > n.score && (
              <div data-testid="combo-drop" className="flex flex-col gap-2 rounded-input border border-accent-border bg-bg p-3">
                <p className="text-[13px] text-soft">Weakest leg: &ldquo;{dropLeg.question}&rdquo;. Without it: {pct(c.drop.numbers.chance)} chance, pays {multX(c.drop.numbers.multiplier)}, score {c.drop.numbers.score}.</p>
                <button type="button" onClick={() => setLegs(legs.filter((_, j) => j !== c.drop!.index))} className="min-h-11 self-start rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">Drop that leg</button>
              </div>
            )}
            <details data-testid="combo-why" className="text-[13px] text-muted">
              <summary className="min-h-11 cursor-pointer py-2">Why these numbers?</summary>
              <div className="flex flex-col gap-2 pb-2">
                <p data-testid="combo-why-pays">Pays {combos.map((l) => multX(1 / (l.base.ask + l.base.fee))).join(" × ")} = {multX(n.multiplier)}: each leg&apos;s payout after its fee, multiplied.</p>
                <p data-testid="combo-why-chance">Combined chance {combos.map((l) => pct(l.base.winProb)).join(" × ")} = {pct(n.chance)}.</p>
                <p data-testid="combo-why-sample">Score sample: the smallest leg, about {smallest === null ? "—" : Math.round(smallest).toLocaleString("en-US")} similar past bets.</p>
                <ul className="flex flex-col gap-1">
                  {legs.map((l) => <li key={l.key} data-testid="combo-why-leg"><span className="text-soft">{l.question} ({l.outcome}):</span> {scored!.legs.get(l.key)?.basis}</li>)}
                </ul>
              </div>
            </details>
          </>
        )}
        <p className="text-[12px] text-muted">{MIN_COMBO_LEGS} to {MAX_COMBO_LEGS} legs. Bet only what you can afford to lose.</p>
      </section>
    </div>
  );
}

function Stat({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-bg p-3">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd data-testid={`combo-${id}`} className="mt-1 font-heading text-[22px] font-bold leading-tight">{value}</dd>
    </div>
  );
}
