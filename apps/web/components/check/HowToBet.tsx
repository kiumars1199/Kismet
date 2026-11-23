"use client";
// F6: "How to bet this": a 3-step guide for the venue and a link that opens the market there. Used on /check; the BetCard
// button is a separate task (BetCard is shared). Steps and sources: lib/venues/guides.ts.
import { useState } from "react";
import { RiskNote } from "@/components/trade/RiskNote";
import { useAvailability } from "@/components/venues/VenueAvailability";
import { availabilityNote, defaultVenue, GUIDES, venueStatus, type VenueId } from "@/lib/venues/guides";

export function HowToBet({ links }: { links: { venue: VenueId; url: string | null }[] }) {
  const { stateName, statuses } = useAvailability();
  const status = (v: VenueId) => venueStatus(v, statuses);
  const [open, setOpen] = useState(false);
  const [venue, setVenue] = useState<VenueId | null>(null);
  if (!links.length) return null;
  // Never assume a venue: preselect one only if it is known available; otherwise the user picks.
  const pick = venue ?? defaultVenue(links, status);
  const cur = links.find((l) => l.venue === pick) ?? null;
  const g = cur ? GUIDES[cur.venue] : null;
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls="howto-panel" onClick={() => setOpen(!open)}
        className="min-h-11 rounded-input border border-border px-4 text-sm font-semibold text-soft hover:border-accent-border">
        How to bet this
      </button>
      {open && (
        <section id="howto-panel" aria-label="How to bet this" data-testid="howto" className="mt-3 flex flex-col gap-3 rounded-card border border-border bg-bg p-4">
          <div role="group" aria-label="Venue" className="flex flex-col gap-2">
            <p className="text-sm text-soft">{cur ? "Where to bet:" : "Pick where you want to bet:"}</p>
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <button key={l.venue} type="button" aria-pressed={l.venue === cur?.venue} data-testid={`howto-venue-${l.venue}`} onClick={() => setVenue(l.venue)}
                  className={`min-h-11 rounded-input border px-3 text-left text-sm ${l.venue === cur?.venue ? "border-accent text-accent-soft" : "border-border text-soft"}`}>
                  <span className="block font-semibold">{GUIDES[l.venue].name}</span>
                  <span data-testid="howto-avail" className={`block text-xs ${status(l.venue) === "restricted" ? "text-warning" : "text-muted"}`}>{availabilityNote(l.venue, status(l.venue), stateName)}</span>
                </button>
              ))}
            </div>
          </div>
          {cur && g && (
            <>
              <h3 className="font-heading text-[17px] font-bold">Bet on {g.name}</h3>
              <ol data-testid="howto-steps" className="flex list-decimal flex-col gap-2 pl-5 text-sm text-soft">
                {g.steps.map((s) => <li key={s.text}>{s.text}</li>)}
              </ol>
              <details data-testid="howto-sources" className="text-[13px] text-muted">
                <summary className="min-h-11 cursor-pointer py-2">Where these steps come from</summary>
                <ol className="flex list-decimal flex-col gap-1.5 pl-5 pb-2">
                  {g.steps.map((s) => (
                    <li key={s.text}>
                      <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">{s.source.url}</a>
                      <span className="block">Read {s.source.checked}{s.source.printed ? `, page dated ${s.source.printed}` : ""}</span>
                    </li>
                  ))}
                </ol>
              </details>
              <p data-testid="howto-avail-line" className="text-[13px] text-soft">{availabilityNote(cur.venue, status(cur.venue), stateName)}</p>
              {cur.url
                ? <><a data-testid="howto-link" href={cur.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center self-start rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">Open on {g.name}</a><RiskNote className="!text-left" /></>
                : <p data-testid="howto-nolink" className="text-[13px] text-muted">We don&apos;t have a direct link to this market on {g.name}. Search for it there.</p>}
            </>
          )}
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 self-start rounded-input border border-border px-4 text-sm text-soft">Close</button>
        </section>
      )}
    </div>
  );
}
