"use client";
// One-time "Choose your topics" prompt for people who haven't onboarded. Mount at the top of / (Best bets).
import Link from "next/link";
import { useEffect, useState } from "react";
import { useProfile } from "@/lib/repo/hooks";

const KEY = "me:v1:nudge_dismissed";

export function OnboardingNudge() {
  const { onboarded_at } = useProfile();
  // shown on the server render: first-time visitors (most of them) see no layout shift; a returning visitor who
  // dismissed it sees it leave at hydration, before any cards arrive
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(localStorage.getItem(KEY) === "1"); } catch { setHidden(false); }
  }, []);
  if (hidden || onboarded_at) return null;

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, "1"); } catch { /* storage off */ }
  };

  return (
    // docs/17 fix 7: one slim line, lighter than the content; dismissal is remembered
    <aside aria-label="Get started" className="flex min-h-11 items-center gap-3 rounded-input border border-border bg-surface pl-4 text-[13px] text-soft">
      <p className="min-w-0 flex-1 py-2 leading-snug sm:truncate sm:py-0">
        <Link href="/onboarding" className="font-semibold text-accent-hover hover:text-accent-soft">Choose your topics</Link>
        <span className="text-muted"> and we’ll show those bets first.</span>
      </p>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="flex size-11 flex-none items-center justify-center rounded-input text-muted hover:text-text">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </aside>
  );
}
