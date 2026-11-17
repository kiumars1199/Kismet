"use client";

import Link from "next/link";
import { ago } from "@/lib/format";

const STALE_S = 3 * 3600;

/** Amber banner when the scan is more than 3 h old. */
export function StaleBanner({ scannedAt }: { scannedAt?: number }) {
  if (!scannedAt || Date.now() / 1000 - scannedAt < STALE_S) return null;
  return (
    <p role="status" className="rounded-input border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
      These prices are from a scan {ago(scannedAt)}. They may have moved since; check the live price before you bet.
    </p>
  );
}

export function ErrorState({ onRetry, what = "markets" }: { onRetry: () => void; what?: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-6">
      <p className="font-semibold">Couldn&apos;t load {what}.</p>
      <p className="text-sm text-muted">The data server didn&apos;t answer. Try again, or check whether a scan is running.</p>
      <div className="flex gap-2">
        <button type="button" onClick={onRetry} className="min-h-11 rounded-input bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
          Try again
        </button>
        <Link href="/status" className="flex min-h-11 items-center rounded-input border border-border px-4 hover:border-accent-border">
          Data status
        </Link>
      </div>
    </div>
  );
}

export function EmptyState({ title, line, onReset }: { title: string; line: string; onReset?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-6">
      <p className="font-semibold">{title}</p>
      <p className="max-w-prose text-sm text-muted">{line}</p>
      {onReset && (
        <button type="button" onClick={onReset} className="min-h-11 rounded-input border border-accent-border bg-accent-bg px-4 text-accent-soft hover:border-accent">
          Reset filters
        </button>
      )}
    </div>
  );
}
