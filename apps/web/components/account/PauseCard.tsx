"use client";
// F8: "Take a break" on /account. 24 h, 7 d or 30 d; confirmed with a second tap; the server writes it (api/account/pause).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PAUSE_OPTIONS, type PauseKey } from "@/lib/account/pause";
import { card } from "@/components/kit";
import { HelpLine } from "@/components/shell/HelpLine";

const btn = "inline-flex min-h-11 items-center rounded-input border border-border bg-muted-bg px-4 text-sm font-medium hover:border-accent-border";

export function PauseCard() {
  const router = useRouter();
  const [pick, setPick] = useState<PauseKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = PAUSE_OPTIONS.find((o) => o.key === pick)?.label;

  async function confirm() {
    if (!pick) return;
    setBusy(true); setError("");
    const res = await fetch("/api/account/pause", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ length: pick }) }).catch(() => null);
    if (res?.ok) { router.refresh(); return; }   // the layout now renders the pause screen
    setBusy(false);
    setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't start the pause. Try again.");
  }

  return (
    <section aria-labelledby="pause-card-h" data-testid="pause-card" className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
      <h2 id="pause-card-h" className="text-lg font-semibold">Take a break</h2>
      <p className="text-sm text-soft">Pause your account for 24 hours, 7 days or 30 days. While it is paused Kismet shows only a pause screen, and it can&apos;t be ended early.</p>
      <div className="flex flex-wrap gap-2">
        {PAUSE_OPTIONS.map((o) => (
          <button key={o.key} type="button" className={`${btn} ${pick === o.key ? "border-accent-border" : ""}`} aria-pressed={pick === o.key}
            data-testid={`pause-${o.key}`} onClick={() => setPick(o.key)}>{o.label}</button>
        ))}
      </div>
      {pick && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn} disabled={busy} data-testid="pause-confirm" onClick={confirm}>{busy ? "Pausing…" : `Pause for ${label}`}</button>
          <button type="button" className="text-sm text-muted hover:text-text" onClick={() => setPick(null)}>Cancel</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-warning">{error}</p>}
      <HelpLine className="text-sm text-muted" />
    </section>
  );
}
