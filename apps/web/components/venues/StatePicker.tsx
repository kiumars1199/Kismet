"use client";
// F9: where the visitor picks their state (saved in a cookie). /settings#state, and /state for anyone (no account).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { card } from "@/components/kit";
import { US_STATES } from "@/lib/venues/states";
import { useAvailability } from "./VenueAvailability";

/** `next`: a same-site path (already checked by safeNext) to go back to after saving, e.g. from /state. */
export function StatePicker({ next = null, as: Heading = "h2" }: { next?: string | null; as?: "h1" | "h2" } = {}) {
  const router = useRouter();
  const { state } = useAvailability();
  const [error, setError] = useState("");
  async function pick(value: string) {
    setError("");
    const res = await fetch("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: value || null }) }).catch(() => null);
    if (res?.ok) { if (next) window.location.assign(next); else router.refresh(); }
    else setError("Couldn't save your state. Try again.");
  }
  return (
    <section id="state" aria-labelledby="state-h" data-testid="state-picker" className={`${card} flex flex-col gap-3 p-5 md:p-6`}>
      <Heading id="state-h" className="text-lg font-semibold">Your state</Heading>
      <p className="text-sm text-soft">Pick the US state you bet from. Kismet shows above each bet button whether the venue is available there. Saved in this browser.</p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">State</span>
        <select value={state ?? ""} onChange={(e) => void pick(e.target.value)} data-testid="state-select"
          className="min-h-11 w-full max-w-xs rounded-input border border-border bg-surface px-3 text-text">
          <option value="">Not set</option>
          {Object.entries(US_STATES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-sm text-warning">{error}</p>}
    </section>
  );
}
