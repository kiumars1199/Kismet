"use client";
// One-time "Pick your topics" prompt for people who haven't onboarded. Mount at the top of /flags.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useProfile } from "@/lib/repo/hooks";

const KEY = "me:v1:nudge_dismissed";

export function OnboardingNudge() {
  const { onboarded_at } = useProfile();
  const [hidden, setHidden] = useState(true); // until storage is read, so it never flashes
  useEffect(() => {
    try { setHidden(localStorage.getItem(KEY) === "1"); } catch { setHidden(false); }
  }, []);
  if (hidden || onboarded_at) return null;

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, "1"); } catch { /* storage off */ }
  };

  return (
    <aside aria-label="Get started" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-accent-border bg-accent-bg px-4 py-3 text-sm text-accent-soft">
      <p className="min-w-0 flex-1 basis-60">Pick your topics and we’ll show those bets first.</p>
      <div className="flex items-center gap-1">
        <Link href="/onboarding" className="rounded-input bg-accent px-3.5 py-2 font-semibold text-on-accent hover:bg-accent-hover">Pick your topics</Link>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="flex size-9 items-center justify-center rounded-input text-accent-softer hover:text-text">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </aside>
  );
}
