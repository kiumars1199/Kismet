"use client";
// Combo builder tray (docs/18 §5.1): the user's own calculator, pinned to the bottom of every page once a leg is
// added. Shows combo chance, Pays Nx, return, the cautious check and a same-event warning. Venue actions:
// Polymarket has no combo contract, so each leg opens its own page; Kalshi (behind its data-permission flag) can
// quote a real combo, and in paper mode that combo can go to the demo order ticket. No "safe" combos, ever.
import { useEffect, useState } from "react";
import { btn, btnGhost, btnPrimary } from "@/components/kit";
import { useBacktest } from "@/components/market/TierNote";
import { combo, kalshiComboEdge, MIN_LEGS, type Leg } from "@/lib/combos";
import { LONG_SHOT_LINE, pct, price, ret, testedLine, winsAbout } from "@/lib/format";
import { openTicket, useTradeConfig } from "@/lib/trade/ext";
import { useCombo } from "./useCombo";

const paysX = (x: number) => `${x >= 10 ? Math.round(x) : x.toFixed(1)}x`;
type Quote = { ok: true; ticker: string; ask_cents: number } | { ok: false; error: string };

let kalshiP: Promise<boolean> | null = null;
function useKalshiCheck(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    kalshiP ??= fetch("/api/combos/kalshi").then((r) => (r.ok ? r.json() : { enabled: false })).then((b) => !!b.enabled, () => false);
    let live = true;
    kalshiP.then((v) => live && setOn(v));
    return () => void (live = false);
  }, []);
  return on;
}

export function ComboTray() {
  const { legs, open, remove, clear, setOpen } = useCombo();
  useEffect(() => void useCombo.persist.rehydrate(), []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, setOpen]);
  if (!legs.length) return null;

  const c = combo(legs);
  const ready = legs.length >= MIN_LEGS;
  return (
    <>
      <div aria-hidden="true" className="h-24 md:h-20" />
      <section
        aria-label="Your combo"
        data-testid="combo-tray"
        className="fixed inset-x-3 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-h-[72dvh] max-w-[760px] flex-col rounded-card border border-accent-border bg-surface md:bottom-4 md:inset-x-8"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button type="button" aria-expanded={open} aria-controls="combo-body" onClick={() => setOpen(!open)} className="flex min-h-11 min-w-0 flex-1 flex-col items-start text-left">
            <span className="text-xs text-muted">Your combo · {legs.length} {legs.length === 1 ? "leg" : "legs"}</span>
            <span data-testid="combo-summary" className="truncate font-heading text-[17px] font-bold">
              {ready ? <>Pays {paysX(c.pays)} <span className="font-sans text-sm font-medium text-soft">· wins about {winsAbout(c.q)}</span></> : <span className="font-sans text-sm font-medium text-soft">Add one more bet to see the combo</span>}
            </span>
          </button>
          {ready && (
            <span className="hidden flex-none text-right sm:block">
              <span className="block text-xs text-muted">Expected return</span>
              <span className={`font-heading text-[17px] font-bold ${c.ret >= 0 ? "text-accent" : "text-negative"}`}>{ret(c.ret * 100)}</span>
            </span>
          )}
          <button type="button" onClick={() => setOpen(!open)} aria-label={open ? "Collapse combo" : "Expand combo"} className="flex size-11 flex-none items-center justify-center rounded-input text-muted hover:bg-raised hover:text-text">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={open ? "" : "rotate-180"}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        {c.same_event.length > 0 && (
          <p role="alert" data-testid="same-event" className="mx-4 mb-3 rounded-input border border-warning/30 bg-warning/5 px-3 py-2 text-[13px] text-warning">
            Two legs come from the same event ({c.same_event.join(", ")}). Their results move together, so these numbers are off. Use legs from different events.
          </p>
        )}
        {open && <Body id="combo-body" legs={legs} onRemove={remove} onClear={clear} />}
      </section>
    </>
  );
}

function Body({ id, legs, onRemove, onClear }: { id: string; legs: Leg[]; onRemove: (id: string) => void; onClear: () => void }) {
  const c = combo(legs);
  const ready = legs.length >= MIN_LEGS;
  const record = useBacktest()?.combos?.[String(legs.length)];
  const tested = testedLine(record, `${legs.length}-leg combos`);
  const kalshiOn = useKalshiCheck();
  const trade = useTradeConfig();
  const allKalshi = legs.every((l) => l.kalshi_ticker);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [checking, setChecking] = useState(false);
  const key = legs.map((l) => `${l.market_id}:${l.side_index}`).join(",");
  useEffect(() => setQuote(null), [key]);

  const check = async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/combos/kalshi", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ legs: legs.map((l) => ({ ticker: l.kalshi_ticker, side: l.side_index === 0 ? "yes" : "no" })) }),
      });
      setQuote(r.ok ? await r.json() : { ok: false, error: "Couldn't check Kalshi right now." });
    } finally {
      setChecking(false);
    }
  };
  const k = quote?.ok ? kalshiComboEdge(c.q, quote.ask_cents) : null;
  const paper = () =>
    openTicket({
      title: `Combo: ${legs.map((l) => `${l.outcome} (${l.question})`).join(" + ")}`,
      ticker: quote?.ok ? quote.ticker : null,
      side: 0,
      sides: [
        { label: "Yes, every leg wins", winProb: c.q, ask: quote?.ok ? quote.ask_cents / 100 : null },
        { label: "No", winProb: 1 - c.q, ask: null },
      ],
      journal: {
        market_id: quote?.ok ? `kalshi-${quote.ticker.replace(/[^\w-]/g, "_")}` : `combo-${legs.map((l) => l.market_id).join("-")}`.slice(0, 120),
        question: `Combo · ${legs.length} legs: ${legs.map((l) => l.question).join(" + ")}`.slice(0, 300),
        category: null, niche: null,
      },
    });

  return (
    <div id={id} className="flex flex-col gap-4 overflow-y-auto border-t border-border px-4 pb-4 pt-3">
      <ol className="flex flex-col">
        {legs.map((l, i) => (
          <li key={l.market_id} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
            <span className="flex size-6 flex-none items-center justify-center rounded-full bg-muted-bg text-xs tabular-nums text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{l.question}</p>
              <p className="text-xs text-muted">Bet {l.outcome} at {price(l.ask)} · won {pct(l.q)} before</p>
            </div>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 flex-none items-center px-2 text-[13px] text-accent-hover hover:text-accent-soft">
              Open<span className="sr-only"> {l.question} on Polymarket</span> ↗
            </a>
            <button type="button" onClick={() => onRemove(l.market_id)} aria-label={`Remove ${l.question}`} className="flex size-11 flex-none items-center justify-center rounded-input text-muted hover:bg-raised hover:text-negative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </li>
        ))}
      </ol>

      {ready && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted">Wins about</dt><dd className="font-semibold">{winsAbout(c.q)} <span className="font-normal text-muted">({pct(c.q)})</span></dd></div>
            <div><dt className="text-xs text-muted">Pays</dt><dd className="font-semibold">{paysX(c.pays)} <span className="font-normal text-muted">at {price(c.price)}</span></dd></div>
            <div><dt className="text-xs text-muted">Expected return</dt><dd className={`font-semibold ${c.ret >= 0 ? "text-accent" : "text-negative"}`}>{ret(c.ret * 100)}</dd></div>
            <div title="Our cautious chance for every leg, multiplied. The combo only counts as a better price than usual if this still beats the price.">
              <dt className="text-xs text-muted">Cautious chance</dt>
              <dd className={`font-semibold ${c.has_edge ? "text-accent-softer" : "text-warning"}`}>{pct(c.q_low)} {c.has_edge ? "· still beats the price" : "· doesn't beat the price"}</dd>
            </div>
          </dl>
          <p className="text-xs leading-relaxed text-muted">
            Price = every leg bought and the winnings rolled into the next, fees included. Prices are from when you added each leg.
            {c.q < 0.25 && <> {LONG_SHOT_LINE}</>} Small errors in each leg multiply in a combo.
            {tested && <> <span className={(record?.roi_pct ?? 0) < 0 ? "text-warning" : "text-soft"}>{tested}.</span></>}
          </p>
          {k && quote?.ok && (
            <p data-testid="kalshi-quote" className="rounded-input border border-border bg-raised px-3 py-2 text-[13px] text-soft">
              Kalshi combo <span className="font-mono text-xs">{quote.ticker}</span> at {quote.ask_cents}¢ (pays {paysX(100 / quote.ask_cents)}):{" "}
              {k.edge > 0 ? <span className="text-accent">better than our price by {Math.round(k.edge * 100)} pts after Kalshi&apos;s fee ({ret(k.ret * 100)})</span>
                : <span className="text-warning">no edge after Kalshi&apos;s fee ({ret(k.ret * 100)})</span>}
            </p>
          )}
          {quote && !quote.ok && <p className="text-[13px] text-muted">{quote.error}</p>}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {ready && kalshiOn && allKalshi && (
          <button type="button" onClick={check} disabled={checking} className={btn}>{checking ? "Checking Kalshi…" : "Check Kalshi combo price"}</button>
        )}
        {ready && trade && <button type="button" onClick={paper} className={btnPrimary}>Trade combo <span className="rounded-full bg-on-accent/15 px-1.5 text-[11px] font-medium">paper</span></button>}
        <button type="button" onClick={onClear} className={`${btnGhost} ml-auto`}>Clear combo</button>
      </div>
    </div>
  );
}
