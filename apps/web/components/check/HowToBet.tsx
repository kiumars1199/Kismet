"use client";
// F6: "How to bet this": a 3-step guide for the venue and a link that opens the market there. Used on /check; the BetCard
// button is a separate task (BetCard is shared). Steps and sources: lib/venues/guides.ts.
import { useState, type ReactNode } from "react";
import { GUIDES, type VenueId } from "@/lib/venues/guides";

export function HowToBet({ links, availability }: { links: { venue: VenueId; url: string | null }[]; availability?: (venue: VenueId) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [venue, setVenue] = useState<VenueId | null>(null);
  if (!links.length) return null;
  const cur = links.find((l) => l.venue === venue) ?? links[0]!;
  const g = GUIDES[cur.venue];
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls="howto-panel" onClick={() => setOpen(!open)}
        className="min-h-11 rounded-input border border-border px-4 text-sm font-semibold text-soft hover:border-accent-border">
        How to bet this
      </button>
      {open && (
        <section id="howto-panel" aria-label="How to bet this" data-testid="howto" className="mt-3 flex flex-col gap-3 rounded-card border border-border bg-bg p-4">
          {links.length > 1 && (
            <div role="group" aria-label="Venue" className="flex flex-wrap gap-2">
              {links.map((l) => (
                <button key={l.venue} type="button" aria-pressed={l.venue === cur.venue} onClick={() => setVenue(l.venue)}
                  className={`min-h-11 rounded-input border px-3 text-sm ${l.venue === cur.venue ? "border-accent text-accent-soft" : "border-border text-soft"}`}>
                  {GUIDES[l.venue].name}
                </button>
              ))}
            </div>
          )}
          <h3 className="font-heading text-[17px] font-bold">Bet on {g.name}</h3>
          <ol data-testid="howto-steps" className="flex list-decimal flex-col gap-2 pl-5 text-sm text-soft">
            {g.steps.map((s) => <li key={s.text}>{s.text}</li>)}
          </ol>
          {/* F9 slot: the trust lane's "available in your state" line goes here, above the link (pass `availability`). */}
          {availability?.(cur.venue)}
          {/* RiskNote slot: reuse trust's RiskNote (PR #44) here once it has merged; until then the line below stands in. */}
          <p className="text-[12px] text-muted">Bet only what you can afford to lose.</p>
          {cur.url
            ? <a data-testid="howto-link" href={cur.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center self-start rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">Open on {g.name}</a>
            : <p data-testid="howto-nolink" className="text-[13px] text-muted">We don&apos;t have a direct link to this market on {g.name}. Search for it there.</p>}
          <p className="text-[11px] text-muted">Steps from {g.name}&apos;s own help pages.</p>
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 self-start rounded-input border border-border px-4 text-sm text-soft">Close</button>
        </section>
      )}
    </div>
  );
}
