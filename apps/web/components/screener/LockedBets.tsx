"use client";
// docs/19 P3: on the Free plan the rest of Best bets shows as blurred locked cards with one "Unlock all N bets" link
// to /pricing. The server never sends those rows (lib/data/respond.ts freeFlagsPage), so the cards are drawn from
// fixed shapes only: there is no market data on the page to unblur.
// T-291 #11: the "N more bets on Pro" panel sits over the cards like a modal, so it can be closed: a close button and
// Esc. It is inline (nothing opens it), so instead of a focus trap it collapses to one button that brings it back;
// focus moves to that button on close and to the close button when it reopens.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatCount } from "@/lib/format";
import { track } from "@/lib/telemetry";

// Varied widths so the stack reads as different bets, not one repeated skeleton.
const SHAPES = [[72, 48, 56], [88, 40, 64], [64, 52, 44], [80, 36, 60], [70, 44, 52], [92, 48, 40], [60, 56, 64], [84, 40, 48]];

function GhostCard({ w }: { w: number[] }) {
  const [q, pay, bet] = w as [number, number, number];
  return (
    <div className="flex w-full flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="h-5 w-20 rounded-full bg-muted-bg" />
      <div className="flex flex-col gap-1.5">
        <div className="h-4 rounded bg-soft/25" style={{ width: `${q}%` }} />
        <div className="h-4 rounded bg-soft/25" style={{ width: `${q - 30}%` }} />
      </div>
      <div className="h-8 rounded bg-text/30" style={{ width: `${pay}%` }} />
      <div className="h-3.5 rounded bg-accent/30" style={{ width: `${bet}%` }} />
      <div className="mt-2 flex gap-2"><div className="h-2 flex-1 rounded-full bg-muted-bg" /><div className="h-2 w-1/3 rounded-full bg-accent/40" /></div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="h-3.5 w-2/5 rounded bg-soft/20" />
        <div className="h-5 w-16 rounded-full bg-muted-bg" />
      </div>
    </div>
  );
}

/** `total`: every Best bet matching the filters (the real N); `shown`: how many the Free sample put on the page. */
export function LockedBets({ total, shown, desktop }: { total: number; shown: number; desktop: boolean }) {
  const locked = total - shown;
  const [open, setOpen] = useState(true);
  const section = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const reopenBtn = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);   // move focus only after the person closed or reopened it, never on first render

  useEffect(() => {
    if (!moved.current) return;
    (open ? closeBtn : reopenBtn).current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // a real modal (drawer, filter panel, any open <dialog>) owns Esc
      if (document.querySelector("dialog[open], [aria-modal='true']")) return;
      const el = section.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!el.contains(document.activeElement) && (r.bottom <= 0 || r.top >= window.innerHeight)) return;   // off screen
      moved.current = true;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (locked <= 0) return null;
  const title = `${formatCount(locked)} more ${locked === 1 ? "bet" : "bets"} on Pro`;
  if (!open) return (
    <section aria-label={title} data-testid="locked-bets" className="flex justify-center">
      <button ref={reopenBtn} type="button" aria-expanded={false} data-testid="locked-reopen"
        onClick={() => { moved.current = true; setOpen(true); }}
        className="min-h-11 rounded-input border border-accent-border bg-surface px-5 text-sm hover:bg-accent-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {title}
      </button>
    </section>
  );
  const ghosts = SHAPES.slice(0, Math.min(locked, desktop ? 8 : 3));
  return (
    <section ref={section} aria-labelledby="locked-h" data-testid="locked-bets" className="relative">
      <ul aria-hidden="true" inert className={`pointer-events-none select-none blur-[5px] ${desktop ? "grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2.5"}`}>
        {ghosts.map((w, i) => <li key={i} className="flex"><GhostCard w={w} /></li>)}
      </ul>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-background/60 to-background p-4">
        <div className="relative flex max-w-sm flex-col items-center gap-3 rounded-card border border-accent-border bg-surface px-6 py-5 text-center shadow-[0_12px_32px_-12px_rgb(0_0_0/0.5)]">
          <button ref={closeBtn} type="button" aria-label="Close" title="Close (Esc)" data-testid="locked-close"
            onClick={() => { moved.current = true; setOpen(false); }}
            className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          </svg>
          <h2 id="locked-h" className="px-8 text-lg font-semibold leading-snug">{title}</h2>
          <p className="text-[13px] leading-relaxed text-muted">
            {shown === 0
              ? "Your free Best bets for today don't match these filters."
              : `Free shows ${shown} of today's Best bets, chosen at random, with delayed prices.`}{" "}
            Pro shows every one, live.
          </p>
          <Link href="/pricing" onClick={() => track("upgrade_clicked", { source: "locked_bets" })} data-testid="unlock-all"
            className="flex min-h-11 items-center justify-center rounded-input bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Unlock all {formatCount(total)} bets
          </Link>
        </div>
      </div>
    </section>
  );
}
