"use client";
// First-run spotlight tour (docs/19 P2c): 5 short steps over the real Best bets page, Skip on every step.
// Starts once after onboarding (Onboarding.finish sets TOUR_KEY) or from "Replay the tour" on /account (/?tour=1).
// Each step points at the first visible element its selectors match; when a section isn't on screen (another
// layout, nothing loaded yet) the step still shows, centered, without a spotlight. Escape skips.
// The bet drawer is modal too (it makes the page behind it inert), so while it is open the tour waits: exactly one
// modal is on top and dismissable. It resumes where it was once the drawer closes.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const TOUR_KEY = "me:v1:tour";

const STEPS = [
  { sel: ['[data-testid="bet-card"]', "article[data-row]", "[data-tour-empty]"], title: "A best bet",
    body: "Each bet looks like good value today: how often bets like it win, what it pays (like \"Pays 1.45x\"), and when it closes. Tap \"Why this bet?\" for details. Any bet can lose." },
  { sel: ['[data-testid="filter-bar"]', '[role="group"][aria-label="Quick filters"]'], title: "Narrow the list",
    body: "Pick a sport, a multiplier and a date, then Apply. Bigger multipliers pay more and win less often." },
  { sel: ['header [role="combobox"]', '[role="combobox"]'], title: "Search any market",
    body: "Find a team, an election or a ticker and see whether it's priced well today." },
  { sel: ['article[data-row] button[aria-label="Save"]', 'a[href="/watchlist"]'], title: "Save and get alerts",
    body: "Star a market to follow it on My list. Alerts tell you when a saved market's price moves." },
  { sel: ['header nav a[href="/track-record"]', 'a[href="/track-record"]'], title: "Check the results",
    body: "Results shows how past flagged bets actually did, wins and losses, so you can judge the numbers yourself." },
] as const;

/** Step 1 over a Best bets list that came back empty (a topic with no bets today): the tour points at that empty state, in its own words. */
const EMPTY_STEP = { title: "No best bets in your topics today", body: "Nothing in your topics looks like good value right now. Widen your topics, or see all best bets, and the cards appear here." };

/** Really drawn: laid out, and not inside a closed <details> (Chrome still gives its content a position without painting it). */
const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  if (typeof el.checkVisibility === "function") return el.checkVisibility();
  return !el.closest("details:not([open])");
};
/** Inside a fixed or sticky element (the phone tab bar, the desktop header): it is always on screen, so the page never scrolls for it. */
const pinned = (el: Element) => {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === "fixed" || p === "sticky") return true; }
  return false;
};
const find = (sel: readonly string[]) => {
  for (const s of sel) for (const el of document.querySelectorAll(s)) if (visible(el)) return el as HTMLElement;
  return null;
};

/** The bottom edge of the part of the viewport the tour can use: the top of the phone tab bar, else the viewport's bottom. */
const bandBottom = () => {
  const bar = document.querySelector<HTMLElement>('nav.fixed[aria-label="Main"]');
  const r = bar?.getBoundingClientRect();
  return r && r.height > 0 ? r.top : innerHeight;
};

const DRAWER = '[role="dialog"][aria-label="Market details"]';
/** True while the bet drawer is open (it is mounted only then). Observes the page only while a tour step is pending
 *  (`active`); otherwise it is disconnected, so a visitor with no tour pays nothing for it. */
function useDrawerOpen(active: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) { setOpen(false); return; }
    const check = () => setOpen(!!document.querySelector(DRAWER));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [active]);
  return open;
}

export function Tour() {
  const [step, setStep] = useState<number | null>(null);
  const drawerOpen = useDrawerOpen(step !== null);
  const live = step !== null && !drawerOpen;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [onEmpty, setOnEmpty] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);   // scroll position when the tour began
  const next = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    let start = false;
    try {
      const url = new URL(location.href);
      if (url.searchParams.get("tour") === "1") {
        start = true;
        url.searchParams.delete("tour");
        history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      }
      start ||= localStorage.getItem(TOUR_KEY) === "1";
    } catch { /* storage off: replay link still works */ }
    if (start) { startY.current = scrollY; setStep(0); }
  }, []);

  const end = useCallback(() => {
    setStep(null);
    // the tour scrolled the page to its targets: put the visitor back where they were (a pill or heading they saw stays where it was)
    if (startY.current !== null) { scrollTo({ top: startY.current, behavior: "instant" }); startY.current = null; }
    try { localStorage.removeItem(TOUR_KEY); } catch { /* storage off */ }
  }, []);

  // Bring the target into view, clear of the phone tab bar (fixed to the bottom; the visible band ends at its top edge) and of the
  // sticky header (desktop), with room for the tour card below or above it. A target already in that band stays put. Otherwise the
  // page moves so the target sits as near the top of the band as the card needs, with the card beneath it. Scrolling is instant
  // (never smooth: reduced motion). A target too tall for both still gets its top edge in view.
  const reveal = (el: HTMLElement) => {
    const barTop = bandBottom();
    const head = document.querySelector("header");
    const headBottom = head && getComputedStyle(head).position === "sticky" ? head.getBoundingClientRect().bottom : 0;
    const r = el.getBoundingClientRect();
    if (pinned(el)) return;
    const ch = card.current?.offsetHeight ?? 220, cw = card.current?.offsetWidth ?? 360;
    const need = ch + 12 + 16;   // the tour card, its gap and its margin
    const lo = headBottom + 4, hi = barTop - 4;
    const room = (top: number, bottom: number) => bottom + need <= barTop || top - need >= lo || r.right + 12 + cw <= innerWidth - 16 || r.left - 12 - cw >= 16;   // the card fits below, above or beside
    if (r.top >= lo && r.bottom <= hi && room(r.top, r.bottom)) return;   // already in the band with room for the card: no scrolling
    // otherwise move as little as keeps the target in the band (the heading above it stays in view where it can) ...
    // On a desktop the heading that explains the free-bets fallback never scrolls out of view (a phone shows the whole card instead): past that point the card is only partly shown.
    const h1 = document.querySelector("h1[data-free-fallback]");
    const cap = h1 && innerWidth >= 1024 ? Math.max(0, h1.getBoundingClientRect().top - (lo + 4)) : Infinity;
    if (r.height <= hi - lo) {
      const d = r.top < lo ? r.top - (lo + 4) : r.bottom > hi ? r.bottom - (hi - 4) : 0;
      if (d > cap) return scrollBy({ top: cap, behavior: "instant" });
      if (room(r.top - d, r.bottom - d)) return scrollBy({ top: d, behavior: "instant" });
    }
    // ... else put the target as near the top of the band as the card needs (a tall card on a phone)
    const top = Math.min(88, Math.max(headBottom + 8, barTop - need - r.height));
    scrollBy({ top: r.top - top, behavior: "instant" });
  };

  // Find the target (cards may still be loading: retry briefly), bring it into view, track it on scroll/resize.
  useEffect(() => {
    if (step === null || !live) return;
    let el: HTMLElement | null = null;
    let tries = 0;
    let shifts = 0;
    let settle = 0;
    const measure = () => setRect(el ? el.getBoundingClientRect() : null);
    // the page still loading above the target moves it: bring it back into place a few times, then leave scrolling to the user
    const reflow = () => {
      if (el && shifts++ < 5) reveal(el);   // a no-op while the target is in the band with room for the card
      measure();
    };
    const look = () => {
      el = find(STEPS[step].sel);
      if (el) {
        setOnEmpty(step === 0 && el.hasAttribute("data-tour-empty"));
        reveal(el); measure();
        // step 1 renders its card only once it has a target, so the first reveal could only guess the card's height: settle it with the real one
        settle = window.setTimeout(() => { if (el) { reveal(el); measure(); } }, 120);
      }
      else if (++tries < 40) timer = window.setTimeout(look, 250);   // up to 10 s for the list to load
      else if (step === 0) setStep(1);   // still no card (an empty list): skip "A best bet" instead of pointing at nothing
      else setRect(null);
    };
    let timer = window.setTimeout(look, 0);
    const ro = new ResizeObserver(reflow);
    ro.observe(document.body);
    addEventListener("scroll", measure, { passive: true });
    addEventListener("resize", measure);
    return () => { clearTimeout(timer); clearTimeout(settle); ro.disconnect(); removeEventListener("scroll", measure); removeEventListener("resize", measure); };
  }, [step, live]);

  // Popover below the target when it fits, else above; centered when there is no target. Clamped to the viewport.
  useLayoutEffect(() => {
    const c = card.current;
    if (step === null || !live || !c) return;
    const w = c.offsetWidth, h = c.offsetHeight, vw = innerWidth, vh = bandBottom(), gap = 12;   // vh: the card never sits over the phone tab bar
    if (!rect) return setPos({ top: Math.max(16, (vh - h) / 2), left: Math.max(16, (vw - w) / 2) });
    const clampX = (x: number) => Math.min(Math.max(16, x), vw - w - 16);
    const clampY = (y: number) => Math.min(Math.max(16, y), vh - h - 16);
    const x = clampX(rect.left + rect.width / 2 - w / 2);
    if (rect.bottom >= 0 && rect.bottom + gap + h <= vh - 16) return setPos({ top: rect.bottom + gap, left: x });   // below
    if (rect.top <= vh && rect.top - gap - h >= 16) return setPos({ top: rect.top - gap - h, left: x });            // above
    if (rect.right + gap + w <= vw - 16) return setPos({ top: clampY(rect.top), left: rect.right + gap }); // right (tall cards)
    if (rect.left - gap - w >= 16) return setPos({ top: clampY(rect.top), left: rect.left - gap - w });   // left
    setPos({ top: vh - h - 16, left: x });   // phone, tall target: pinned to the bottom edge
  }, [rect, step, live]);

  // Keyboard users land on the tour's controls: focus Next once the card is visible (it is hidden until positioned), at a
  // normal start and again on a resume after the drawer closed.
  const shown = pos !== null;
  useEffect(() => {
    if (!live || !shown) return;
    // The page behind a closing drawer is still inert for a moment: retry until the button really holds focus.
    let tries = 0;
    const focus = () => {
      next.current?.focus({ preventScroll: true });
      if (document.activeElement !== next.current && ++tries < 10) timer = window.setTimeout(focus, 100);
    };
    let timer = window.setTimeout(focus, 0);
    return () => clearTimeout(timer);
  }, [live, shown, step]);

  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") end(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [live, end]);

  if (step === null || !live) return null;
  if (step === 0 && !rect) return null;   // "A best bet" opens only over a rendered card
  const s = step === 0 && onEmpty ? { ...STEPS[0], ...EMPTY_STEP } : STEPS[step];
  const last = step === STEPS.length - 1;
  const pad = 6;

  return (
    <div className="fixed inset-0 z-[60]" data-testid="tour">
      {/* the click shield; the spotlight's own shadow dims everything else */}
      <div className="absolute inset-0" onClick={end} aria-hidden="true" style={rect ? undefined : { background: "rgb(0 0 0 / 0.6)" }} />
      {rect && (
        <div aria-hidden="true" data-testid="tour-spot" className="pointer-events-none absolute rounded-card ring-2 ring-accent transition-transform duration-300 ease-out motion-reduce:transition-none"
          // moves with transform, not top/left: animating top/left counts as layout shift (CLS) on every frame
          style={{ top: 0, left: 0, transform: `translate(${rect.left - pad}px, ${rect.top - pad}px)`, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.6)" }} />
      )}
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby="tour-h" aria-describedby="tour-b"
        className="absolute w-[min(360px,calc(100vw-32px))] rounded-card border border-border bg-surface p-4 shadow-[0_12px_32px_rgb(0_0_0/0.45)] transition-transform duration-300 ease-out motion-reduce:transition-none md:p-5"
        style={pos ? { top: 0, left: 0, transform: `translate(${pos.left}px, ${pos.top}px)` } : { visibility: "hidden" }}>
        <p className="text-xs tabular-nums text-muted">{step + 1} of {STEPS.length}</p>
        <h2 id="tour-h" className="mt-1 font-heading text-lg font-semibold">{s.title}</h2>
        <p id="tour-b" className="mt-1.5 text-sm leading-relaxed text-soft">{s.body}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={end} className="-ml-3 min-h-11 rounded-input px-3 text-sm text-muted hover:text-text">Skip tour</button>
          <div className="flex items-center gap-2">
            {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="min-h-11 rounded-input px-3 text-sm text-muted hover:text-text">Back</button>}
            <button ref={next} type="button" onClick={() => (last ? end() : setStep(step + 1))}
              className="min-h-11 rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
