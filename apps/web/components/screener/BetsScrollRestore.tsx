"use client";
// T-wt3l (decisions.md, Nov 25 later): /bets restores its own scroll position. A full-load Back (or a reload) first paints
// app/bets/loading.tsx, which is shorter than the list, and the browser's own restore was clamped to that height, then the
// list arrived and pushed the footer down (CLS 0.55 at 390). Here the browser restores nothing on /bets entries
// (history.scrollRestoration = "manual" while /bets is mounted), the position is saved per history entry as the user
// scrolls, and once the list is in the page it is put back. Scrolling is not a layout shift, so nothing counts as CLS.
// Trade-off: on a full-load Back the user sees the top of the list for a moment before it moves to their place.
import { useEffect } from "react";

const PREFIX = "bets-scroll:";
/** Give up putting the position back after this long (a list that never gets tall enough, a slow page). */
const WAIT_MS = 4_000;

type Nav = { currentEntry?: { key?: string } | null };
/** The history entry: the Navigation API key (one per entry, kept across reloads and full-load Back), else the address. */
function entryKey(): { key: string } {
  const k = (globalThis as unknown as { navigation?: Nav }).navigation?.currentEntry?.key;
  return { key: PREFIX + (k ?? location.pathname + location.search) };
}
const read = (key: string) => { try { const v = Number(sessionStorage.getItem(key)); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; } };
const write = (key: string, y: number) => { try { sessionStorage.setItem(key, String(Math.round(y))); } catch { /* private mode, quota */ } };

/** A saved position is only put back on a return to the entry: Back/Forward or a reload. Opening /bets again (a tab tap, the
 *  same address typed: that can reuse the same entry) starts at the top. The document's own navigation type counts for its
 *  first /bets mount only; after that, a client-side Back or Forward is a popstate. */
const docRevisit = () => {
  const t = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
  return t === "back_forward" || t === "reload";
};
let firstMount = true;
let traversedAt = -Infinity;   // a popstate inside /bets (a filter Back) mounts nothing: only one just before this mount counts
if (typeof window !== "undefined") window.addEventListener("popstate", () => { traversedAt = performance.now(); });

export function BetsScrollRestore() {
  useEffect(() => {
    const h = window.history;
    h.scrollRestoration = "manual";
    const { key } = entryKey();
    const target = (firstMount && docRevisit()) || performance.now() - traversedAt < 1_000 ? read(key) : null;
    firstMount = false;
    traversedAt = -Infinity;

    let stop = () => {};
    if (target != null) {
      // Put it back once the page is tall enough to hold it; stop if the user scrolls, taps or types first.
      const started = performance.now();
      let raf = 0;
      const place = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max >= target - 1 || performance.now() - started > WAIT_MS) {
          window.scrollTo(0, Math.min(target, max));
          stop();
          return;
        }
        raf = requestAnimationFrame(place);
      };
      const cancel = () => stop();
      stop = () => {
        cancelAnimationFrame(raf);
        for (const e of ["wheel", "touchstart", "keydown", "pointerdown"]) window.removeEventListener(e, cancel);
        stop = () => {};
      };
      for (const e of ["wheel", "touchstart", "keydown", "pointerdown"]) window.addEventListener(e, cancel, { passive: true });
      place();
    }

    // Save as the user scrolls (once a frame), keyed by the entry at that moment: a filter push on /bets is a new entry.
    let pending = 0;
    const onScroll = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => { pending = 0; write(entryKey().key, window.scrollY); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      stop();
      cancelAnimationFrame(pending);
      window.removeEventListener("scroll", onScroll);
      // A client-side move to another page: the new entry (pushed in the same commit) inherits "manual" from this one.
      // Hand it back to the browser once that entry exists; this /bets entry keeps "manual" for its own Back.
      setTimeout(() => { if (!location.pathname.startsWith("/bets")) h.scrollRestoration = "auto"; }, 0);
    };
  }, []);
  return null;
}
