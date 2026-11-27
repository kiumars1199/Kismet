"use client";
// F8: while an account is paused this is all the app shows (root layout). The end time is in the user's time zone.
import { Pending, fullTime, useZone } from "@/components/clock";
import type { ReactNode } from "react";

/** `help` is the server-rendered <HelpLine />: importing it here would pull config/site.json into every page's first load. */
export function PauseScreen({ until, help }: { until: string; help: ReactNode }) {
  const { zone, known } = useZone();
  const unix = Math.floor(Date.parse(until) / 1000);
  const text = fullTime(unix, known ? zone : "UTC");
  return (
    <section data-testid="pause-screen" aria-labelledby="pause-h" className="mx-auto flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-muted-bg p-6 text-center shadow-sm">
      <h1 id="pause-h" className="font-heading text-2xl font-bold tracking-[-0.02em]">Your account is paused</h1>
      <p className="text-soft">
        You asked for a break. Kismet is off until{" "}
        <strong data-testid="pause-until" className="text-text">{known ? text : <Pending text={text} />}</strong>.
      </p>
      <p className="text-sm text-muted">There is nothing to do. The pause can&apos;t be ended early, and your plan and data are kept.</p>
      {help}
      <form method="post" action="/api/auth/signout" className="flex justify-center">
        <button className="inline-flex min-h-11 items-center rounded-input border border-border px-4 text-sm font-medium hover:border-accent-border">Sign out</button>
      </form>
    </section>
  );
}
