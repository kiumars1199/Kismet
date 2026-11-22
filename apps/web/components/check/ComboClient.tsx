"use client";
// /check/combo (SPEC F2). Add legs by words or by pasted link (and, later, "Add to combo" on a card: ?m=<id>&side=<0|1>).
// Each leg is looked up once (/api/check/leg; the whole combo is one Free check); the numbers are computed here.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckSearchResponse } from "@/app/api/check/search/route";
import { addLeg, checkCombo, MAX_COMBO_LEGS, MIN_COMBO_LEGS, type ComboLeg } from "@/lib/check/combo";
import { parseLink } from "@/lib/check/parse-link";
import type { CheckResponse } from "@/lib/check/response";
import { SCORE_FORMULA } from "@/lib/check/score";
import { multX } from "@/lib/card";
import { pct } from "@/lib/format";

const pts = (e: number) => { const v = Math.round(e * 100); return `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v)} ${Math.abs(v) === 1 ? "point" : "points"}`; };
const legOf = (d: CheckResponse): ComboLeg => {
  const s = d.sides.find((x) => x.index === d.side)!;
  return { key: `${d.market.id}:${d.side}`, marketId: d.market.id, side: d.side, question: d.market.question, outcome: s.outcome, eventId: d.market.event_id, event: d.market.event, base: s.base };
};

export function ComboClient() {
  const sp = useSearchParams();
  const [legs, setLegs] = useState<ComboLeg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [limit, setLimit] = useState(false);
  const [hits, setHits] = useState<CheckSearchResponse["markets"]>([]);
  const legsRef = useRef(legs);
  legsRef.current = legs;
  const started = useRef("");

  async function add(body: { m?: string; link?: string; side?: 0 | 1 }) {
    setBusy(true); setNote(""); setHits([]);
    try {
      const r = await fetch("/api/check/leg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.status === 429) return setLimit(true);
      if (r.status === 404) return setNote("We couldn't find an open market at that link.");
      if (!r.ok) return setNote("Something went wrong. Try again in a moment.");
      const out = addLeg(legsRef.current, legOf((await r.json()) as CheckResponse));
      if (out.refused === "duplicate") setNote("That bet is already in your combo.");
      else if (out.refused === "full") setNote(`A combo holds at most ${MAX_COMBO_LEGS} legs.`);
      else { setLegs(out.legs); setText(""); }
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

  const c = useMemo(() => checkCombo(legs), [legs]);
  const n = c.numbers;
  const dropLeg = c.drop ? legs[c.drop.index] : null;

  return (
    <div className="flex flex-col gap-5" data-testid="combo-check">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="combo-q">Add a bet by link or words</label>
        <input id="combo-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a bet: paste a link or type a team or topic"
          className="min-h-11 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 text-sm text-text placeholder:text-muted" />
        <button type="submit" disabled={busy} className="min-h-11 rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">Add</button>
      </form>
      <div className="min-h-6 text-[13px] text-muted" role="status" aria-live="polite" data-testid="combo-note">{busy ? "Looking it up…" : note}</div>

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

      <ul data-testid="combo-legs" className="flex flex-col gap-2">
        {legs.map((l, i) => (
          <li key={l.key} data-testid="combo-leg" className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{l.question}</p>
              <p className="text-[12px] text-muted">Bet {l.outcome} · {l.base.winProb === null ? "No model chance" : `${pct(l.base.winProb)} chance`} · pays {multX(1 / (l.base.ask + l.base.fee))}</p>
            </div>
            <button type="button" aria-label={`Remove ${l.question}`} onClick={() => setLegs(legs.filter((_, j) => j !== i))} className="min-h-11 min-w-11 rounded-input border border-border text-soft">✕</button>
          </li>
        ))}
      </ul>

      <section aria-label="Combo result" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 md:p-5">
        {c.error === "too_few" && <p data-testid="combo-msg" className="text-sm text-soft">{legs.length === 0 ? "Add at least two bets to check a combo." : "Add at least one more leg."}</p>}
        {c.error === "no_model" && <p data-testid="combo-msg" className="text-sm text-soft">No model chance for &ldquo;{c.noModel}&rdquo;, so this combo can&apos;t be scored. Remove that leg.</p>}
        {c.sameEvent.length > 0 && (
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
