"use client";
// /check/combo (SPEC F2). Add legs by words or by pasted link (or a card link: ?m=<id>&side=<0|1>). A leg is looked up without
// any model numbers (/api/check/leg). The set is scored only when the person taps "Check this combo" (/api/check/combo, ONE
// Free check for that set); the numbers, and the weakest-leg suggestion, are computed here from what it returns.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckSearchResponse } from "@/app/api/check/search/route";
import { checkCombo, MAX_COMBO_LEGS, MIN_COMBO_LEGS, sameEventAdvice, type ComboLeg } from "@/lib/check/combo";
import { addStored, comboUrl, parseLegsParam, readStored, writeStored } from "@/lib/check/comboLegs";
import { COMBO_CHECK_FREE_NOTE, COMBO_LIMIT_USED } from "@/lib/check/copy";
import { useMe } from "@/lib/me";
import { useCombo } from "@/components/combo/useCombo";
import { parseLink } from "@/lib/check/parse-link";
import type { ComboLegsResponse, LegLookup } from "@/lib/check/response";
import { SCORE_FORMULA } from "@/lib/check/score";
import { multX } from "@/lib/card";
import { cleanEventLine, pct } from "@/lib/format";

const pts = (e: number) => { const v = Math.round(e * 100); return `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v)} ${Math.abs(v) === 1 ? "point" : "points"}`; };

type Listed = { key: string; marketId: string; side: 0 | 1; question: string; outcome: string; eventId: string; event: string; price: number };
type Scored = { setKey: string; legs: Map<string, { base: ComboLeg["base"]; basis: string }> };
const listed = (d: LegLookup): Listed => ({ key: `${d.market.id}:${d.side}`, marketId: d.market.id, side: d.side, question: d.market.question, outcome: d.outcome, eventId: d.market.event_id, event: d.market.event, price: d.price });
const setKeyOf = (legs: Listed[]) => legs.map((l) => l.key).sort().join("|");

export function ComboClient({ reserve = 0 }: { reserve?: number }) {
  const sp = useSearchParams();
  const [legs, setLegs] = useState<Listed[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [note, setNote] = useState("");
  const [limit, setLimit] = useState(false);
  const [scored, setScored] = useState<Scored | null>(null);
  const [hits, setHits] = useState<CheckSearchResponse["markets"]>([]);
  const [loaded, setLoaded] = useState(false);   // the legs of this tab (or of the link) are in; until then the legs region is hidden, not moved
  const [known, setKnown] = useState<Map<string, ComboLeg["base"]>>(new Map());   // every leg's numbers once scored: they stay after a 429 or an added leg
  const [copied, setCopied] = useState("");
  const [engaged, setEngaged] = useState(false);
  const [incoming, setIncoming] = useState(false);   // a leg is being looked up: its room is held from the tap, so it lands in it
  const [touch, setTouch] = useState(false);   // a touch device: the link button opens the share sheet
  const pendingCheck = useRef<Listed[] | null>(null);   // a shared link asked for a score; Pro and Premium get it without a tap   // the person has started adding: from then on the page keeps its reserved height
  const me = useMe();
  const trayLegs = useCombo((c) => c.legs.length);   // Premium's combo tray is fixed to the bottom of the screen: leave room under the page for it
  const legsRef = useRef(legs);
  legsRef.current = legs;
  const started = useRef("");
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  // The legs come from the link (?legs=id:side,... : a shared or reloaded URL, scored again when it says check=1), else from what this
  // tab kept (a card, the drawer or /m added them). Until they are in, the legs region is hidden (it keeps its place), so restoring
  // them moves nothing visible.
  useEffect(() => {
    const refs = parseLegsParam(sp.get("legs"));
    const wantCheck = sp.get("check") === "1";
    void (async () => {
      let initial: Listed[];
      if (refs.length) {
        setBusy(true);
        const got = await Promise.all(refs.map((r) => lookup({ m: r.m, side: r.side })));
        initial = got.filter((x): x is Listed => !!x);
        if (initial.length < refs.length) setNote("Some bets in that link aren't open any more.");
        setBusy(false);
      } else initial = readStored();
      legsRef.current = initial; setLegs(initial);
      setLoaded(true);
      if (wantCheck && initial.length >= MIN_COMBO_LEGS) pendingCheck.current = initial;
    })();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps -- once, on mount

  // A shared link (&check=1) loads the legs; Pro and Premium see the score at once. Signed-out and Free visitors tap to score:
  // that tap spends the day's one check, so a link must not spend it for them (nor show a 429 for a check they never asked for).
  useEffect(() => { setTouch(window.matchMedia("(pointer: coarse)").matches); }, []);
  useEffect(() => {
    const list = pendingCheck.current;
    if (!loaded || !list || !me) return;
    pendingCheck.current = null;
    if (me.tier === "pro" || me.tier === "premium") void checkNow(list);
  }, [loaded, me]);   // eslint-disable-line react-hooks/exhaustive-deps
  // the search dropdown closes on Escape or a tap outside it
  useEffect(() => {
    if (!hits.length) return;
    const away = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setHits([]); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setHits([]); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [hits.length]);

  /** One leg's lookup (no model numbers, not a check). null = not found or not reachable. */
  async function lookup(body: { m?: string; link?: string; side?: 0 | 1 }): Promise<Listed | null> {
    try {
      const r = await fetch("/api/check/leg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return r.ok ? listed((await r.json()) as LegLookup) : null;
    } catch { return null; }
  }

  async function add(body: { m?: string; link?: string; side?: 0 | 1 }) {
    setEngaged(true); setIncoming(true); setBusy(true); setNote(""); setHits([]);
    try {
      const r = await fetch("/api/check/leg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.status === 404) return setNote("We couldn't find an open market at that link.");
      if (!r.ok) return setNote("Something went wrong. Try again in a moment.");
      const l = listed((await r.json()) as LegLookup);
      const cur = legsRef.current;
      const r2 = addStored(cur, l);
      if (r2.refused === "duplicate") return setNote("That bet is already in your combo.");
      if (r2.refused === "full") return setNote(`A combo holds at most ${MAX_COMBO_LEGS} legs.`);
      legsRef.current = r2.legs; setLegs(r2.legs); setText("");
    } catch { setNote("Couldn't reach Kismet. Check your connection and try again."); }
    finally { setBusy(false); setIncoming(false); }
  }

  // A card, the drawer or /m links here with ?m=<id>&side=<n>: add that bet once the tab's legs are in. The URL then holds the legs
  // (below), so a reload keeps them and never says "already in your combo".
  useEffect(() => {
    const m = sp.get("m");
    const key = `${m}|${sp.get("side")}`;
    if (!loaded || !m || started.current === key) return;
    started.current = key;
    void add({ m, side: sp.get("side") === "1" ? 1 : 0 }).then(() => window.history.replaceState(window.history.state, "", comboUrl(legsRef.current.map((l) => ({ m: l.marketId, side: l.side })), false)));
  }, [sp, loaded]);

  // Scoring is an explicit tap ("Check this combo"): one Free check for this set. The response carries every leg's inputs, so
  // removing legs afterwards (including "Drop that leg") recomputes here and never asks the server again. Adding a leg is a new set.
  async function checkNow(list: Listed[] = legsRef.current) {
    if (list.length < MIN_COMBO_LEGS || scoring) return;
    const mine = ++seq.current;
    setScoring(true); setLimit(false); setNote("");
    try {
      const r = await fetch("/api/check/combo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legs: list.map((l) => ({ m: l.marketId, side: l.side })) }) });
      if (mine !== seq.current) return;
      if (r.status === 429) { setLimit(true); setScored(null); return; }   // the legs keep the numbers they already have (known)
      if (!r.ok) { setNote("Couldn't score this combo. Try again in a moment."); return; }
      const out = ((await r.json()) as ComboLegsResponse).legs;
      const map = new Map<string, { base: ComboLeg["base"]; basis: string }>();
      for (const d of out) map.set(`${d.m}:${d.side}`, { base: d.base, basis: d.basis });
      setScored({ setKey: setKeyOf(list), legs: map });
      setKnown((prev) => { const next = new Map(prev); for (const [k, v] of map) next.set(k, v.base); return next; });
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
    setEngaged(true);
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

  // The legs are kept in this tab and in the URL (a reload or a shared link brings them back; check=1 scores them again).
  useEffect(() => { if (loaded) writeStored(legs); }, [legs, loaded]);
  useEffect(() => {
    if (!loaded) return;
    const m = new URLSearchParams(window.location.search).get("m");
    if (m && started.current !== `${m}|${new URLSearchParams(window.location.search).get("side")}`) return;   // a ?m= add is still to come: it writes the URL
    window.history.replaceState(window.history.state, "", comboUrl(legs.map((l) => ({ m: l.marketId, side: l.side })), ready));
  }, [legs, ready, loaded]);

  async function copyLink() {
    const url = `${window.location.origin}${comboUrl(legs.map((l) => ({ m: l.marketId, side: l.side })), true)}`;
    try {
      if (touch && typeof navigator.share === "function") {
        await navigator.share({ title: "A combo on Kismet", url });
        setCopied("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        setCopied("Link copied");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;   // the share sheet was closed
      try { await navigator.clipboard.writeText(url); setCopied("Link copied"); } catch { setCopied("Couldn't copy. Copy the address bar instead."); }
    }
    setTimeout(() => setCopied(""), 2500);
  }

  const smallest = ready ? Math.min(...combos.map((l) => l.base.n ?? 0)) : null;

  return (
    <div className={`flex flex-col gap-5 ${trayLegs > 0 ? "pb-36 md:pb-24" : ""}`} data-testid="combo-check">
      <div ref={box} className="relative">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="combo-q">Add a bet by link or words</label>
        <input id="combo-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a bet: paste a link or type a team or topic"
          className="min-h-11 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 text-sm text-text placeholder:text-muted" />
        <button type="submit" disabled={busy} className="min-h-11 rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">Add</button>
      </form>
      {hits.length > 0 && (
        <ul data-testid="combo-hits" className="absolute inset-x-0 top-full z-30 mt-1 flex max-h-72 flex-col gap-1 overflow-auto rounded-card border border-border bg-surface p-1.5 shadow-lg">
          {hits.map((h) => (
            <li key={`${h.id}-${h.side_index}`}>
              <button type="button" onClick={() => void add({ m: h.id, side: h.side_index })}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-input px-3 py-2 text-left text-sm hover:bg-raised">
                <span className="min-w-0 truncate">{h.question}</span><span className="flex-none text-muted">{h.outcome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
      <div className="min-h-6 text-[13px] text-muted" role="status" aria-live="polite" data-testid="combo-note">{busy ? "Looking it up…" : scoring ? "Scoring your combo…" : note}</div>


      {/* Once there is a leg, a link with legs, or the person has started adding, this region holds the height of the legs and a scored result (the sub-line wraps to 36 px once scored, the result
          grows to about 533 px on a phone and 360 on a desktop: those final sizes are reserved), so adding legs and scoring grow inside
          it and the page below never moves. The empty result card itself stays small: the room is blank space under it, not a box. */}
      <div data-combo-pending={loaded ? undefined : ""} className={`flex flex-col gap-5 ${legs.length || reserve || engaged ? "min-h-[760px] md:min-h-[700px]" : ""} ${loaded || reserve ? "" : "invisible"}`}>
      <ul data-testid="combo-legs" style={{ "--n": Math.min(MAX_COMBO_LEGS, Math.max(legs.length + (incoming ? 1 : 0), reserve, 2)) } as React.CSSProperties}
        className={`flex flex-col gap-2 ${legs.length || reserve || incoming ? "min-h-[calc(var(--n)*84px+(var(--n)-1)*8px)] sm:min-h-[calc(var(--n)*70px+(var(--n)-1)*8px)]" : ""}`}>
        {legs.map((l, i) => {
          const b = known.get(l.key);
          return (
            <li key={l.key} data-testid="combo-leg" className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{l.question}</p>
                <p className="min-h-9 text-[12px] text-muted sm:min-h-4">Bet {l.outcome} at {pct(l.price)}{b ? ` · ${b.winProb === null ? "No model chance" : `${pct(b.winProb)} chance`} · pays ${multX(1 / (b.ask + b.fee))}` : ""}</p>
              </div>
              <button type="button" aria-label={`Remove ${l.question}`} onClick={() => setLegs(legs.filter((_, j) => j !== i))} className="min-h-11 min-w-11 rounded-input border border-border text-soft">✕</button>
            </li>
          );
        })}
      </ul>

      <section aria-label="Combo result" className={`flex flex-col gap-3 rounded-card border border-border bg-surface p-4 md:p-5 ${Math.max(legs.length, reserve) >= MIN_COMBO_LEGS ? "min-h-[560px] md:min-h-[380px]" : ""}`}>
        {limit && (
        <div data-testid="check-upgrade" className="flex flex-col items-start gap-3 rounded-input border border-accent-border bg-bg p-4">
          <p className="text-sm text-soft">{COMBO_LIMIT_USED}</p>
          <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">See plans</Link>
        </div>
        )}
        {legs.length < MIN_COMBO_LEGS && <p data-testid="combo-msg" className="text-sm text-soft">{legs.length === 0 ? "Add at least two bets to check a combo." : "Add at least one more leg."}</p>}
        {legs.length < MIN_COMBO_LEGS && <p data-testid="combo-how" className="text-[13px] leading-relaxed text-muted">How it works: every leg has to win, so the chances multiply and so do the payouts.</p>}
        {legs.length >= MIN_COMBO_LEGS && !ready && !limit && (
          <div className="flex flex-col items-start gap-2">
            <p data-testid="combo-msg" className="text-sm text-soft">{scoring ? "Scoring your combo…" : "Ready when you are."}</p>
            <p data-testid="combo-free-note" className="min-h-10 text-[13px] text-muted sm:min-h-5">{me?.tier === "free" && !scoring ? COMBO_CHECK_FREE_NOTE : ""}</p>
            <button type="button" data-testid="combo-check-btn" disabled={scoring} onClick={() => void checkNow()} className="min-h-11 rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">Check this combo</button>
          </div>
        )}
        {ready && c.error === "no_model" && <p data-testid="combo-msg" className="text-sm text-soft">No model chance for &ldquo;{c.noModel}&rdquo;, so this combo can&apos;t be scored. Remove that leg.</p>}
        {ready && c.sameEvent.length > 0 && (
          <p data-testid="combo-same-event" className="rounded-input border border-border bg-bg p-3 text-[13px] text-soft">
            Same event ({c.sameEvent.map(cleanEventLine).join(", ")}): these legs move together, the combined chance is likely off. {sameEventAdvice(legs).join(" ")}
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
            <p data-testid="combo-formula" className="text-[13px] leading-relaxed text-muted">{c.scoreNote ? `${c.scoreNote}. ` : ""}{SCORE_FORMULA} For a combo, the chance is each leg&apos;s chance multiplied together and the sample is the smallest leg&apos;s. That assumes the legs are independent; legs from the same event aren&apos;t.</p>
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
        {/* pinned to the bottom of the (reserved) result box, so the answer growing above them moves nothing */}
        <div className="mt-auto flex flex-col gap-3">
          {legs.length >= MIN_COMBO_LEGS && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => void copyLink()} className="min-h-11 rounded-input border border-border px-4 text-sm font-medium text-text hover:border-accent-border">{touch ? "Share link" : "Copy link"}</button>
              <span role="status" data-testid="combo-copied" className="text-[13px] text-accent-softer empty:hidden">{copied}</span>
            </div>
          )}
          <p className="text-[12px] text-muted">{MIN_COMBO_LEGS} to {MAX_COMBO_LEGS} legs. Bet only what you can afford to lose.</p>
        </div>
      </section>
      </div>
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
