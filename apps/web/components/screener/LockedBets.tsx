"use client";
// docs/19 P3, docs/OVERHAUL.md §B (T-302): on the Free plan, where the day's free list ends, one solid card with a
// lock and "Unlock N more bets" linking to /pricing. No blurred or faded fake cards: the server never sends the
// locked rows (lib/data/respond.ts freeFlagsPage), and the card says so plainly. It sits inline in the list, so it
// covers nothing and needs no close button (the T-291 #11 overlay it replaces did).
import Link from "next/link";
import { FREE_BEST_BETS_A_DAY } from "@/lib/entitlements";
import { plural } from "@/lib/format";
import { track } from "@/lib/telemetry";

/** `total`: every Best bet matching the filters (the real N, lib/data/counts.ts); `shown`: how many of the day's
 *  sample match them and are on the page; `daily`: the Free allowance the server sampled (FREE_BEST_BETS_A_DAY). */
export function LockedBets({ total, shown, daily }: { total: number; shown: number; daily: number; desktop?: boolean }) {
  const locked = total - shown;
  if (locked <= 0) return null;
  const none = shown === 0;   // none of today's free bets match: nothing to "unlock more" of, so offer the whole list
  const label = none ? "See it with Pro" : `Unlock ${plural(locked, "more bet", "more bets")}`;
  return (
    <section aria-label={label} data-testid="locked-bets"
      className="flex flex-col items-start gap-3 rounded-xl border border-accent-border bg-surface p-5 shadow-sm shadow-black/20 sm:flex-row sm:items-center sm:gap-5">
      <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-full bg-accent-bg">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <p className="flex-1 text-[13px] leading-relaxed text-muted">
        {none
          ? `None of today's ${daily} free bets match these filters. Pro shows all ${total.toLocaleString("en-US")}, live.`
          : `Free shows ${FREE_BEST_BETS_A_DAY} of today's best bets, picked at random each day, with delayed prices. Pro shows every one, live.`}
      </p>
      <Link href="/pricing" onClick={() => track("upgrade_clicked", { source: "locked_bets" })} data-testid="unlock-all"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-11 sm:w-auto">
        {label}
      </Link>
    </section>
  );
}
