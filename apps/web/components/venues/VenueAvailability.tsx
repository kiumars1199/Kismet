"use client";
// F9: "Kalshi: available in Texas" above a bet button or deep link. The server hands the visitor's state and the three
// statuses to <AvailabilityProvider> (root layout); no state chosen: "Check your state", linking to where it is set.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { availabilityLine, type AvailStatus, type VenueKey } from "@/lib/venues/availability-text";

export interface Avail { state: string | null; stateName: string | null; statuses: Record<VenueKey, AvailStatus> | null }
const Ctx = createContext<Avail>({ state: null, stateName: null, statuses: null });

/** The layout's value comes from the cookie, but a static page ("/") renders with no cookies. Then the client asks
 *  GET /api/state once (the cookie is httpOnly, so the browser script can't read it). */
export function AvailabilityProvider({ value, children }: { value: Avail; children: ReactNode }) {
  const [fetched, setFetched] = useState<Avail | null>(null);
  useEffect(() => {
    if (value.state) return;
    let live = true;
    fetch("/api/state", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Avail>) : null))
      .then((a) => { if (live && a?.state && a.statuses) setFetched(a); })
      .catch(() => {});
    return () => { live = false; };
  }, [value.state]);
  return <Ctx.Provider value={value.state ? value : (fetched ?? value)}>{children}</Ctx.Provider>;
}
export const useAvailability = () => useContext(Ctx);

/** "Check your state" goes to the public /state page (works signed out), coming back here after the pick. */
export function useStateLink() {
  const router = useRouter();
  return (e: MouseEvent) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    router.push(`/state?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  };
}

/** The link that opens the state picker (public /state, back here after the pick). Reuse it anywhere a "set your state"
 *  action is needed, e.g. F6's How to bet guide. Safe inside a card's full-cover link (stops propagation, sits above it). */
export function StateLink({ children, className = "" }: { children: ReactNode; className?: string }) {
  const toState = useStateLink();
  // The server-rendered href already carries the page to come back to (the path; the query is added on click, since a
  // static page like "/" is rendered without it), so a tap before hydration or "open in new tab" still returns here.
  const pathname = usePathname();
  const href = pathname && pathname !== "/state" ? `/state?next=${encodeURIComponent(pathname)}` : "/state";
  return <Link href={href} data-testid="state-link" className={`relative z-10 -my-3.5 inline-flex min-h-11 items-center underline underline-offset-2 hover:text-text ${className}`} onClick={toState}>{children}</Link>;
}

export function VenueAvailability({ venue, className = "" }: { venue: VenueKey; className?: string }) {
  const { stateName, statuses } = useAvailability();
  const status = statuses?.[venue] ?? null;
  const text = availabilityLine(venue, stateName, status);
  const tone = status === "restricted" ? "text-warning" : "text-muted";
  return (
    <span data-testid="venue-availability" data-status={status ?? "no-state"} className={`block min-h-4 text-center text-xs ${tone} ${className}`}>
      {stateName ? text : <StateLink>{text}</StateLink>}
    </span>
  );
}

/** One visible line (or two) above a list whose rows only have icon links: what each venue's availability is in your state. */
export function VenueAvailabilityBar({ venues, className = "" }: { venues: VenueKey[]; className?: string }) {
  const { stateName, statuses } = useAvailability();
  return (
    <div data-testid="markets-availability" className={`flex flex-col gap-0.5 text-xs text-muted ${className}`}>
      {stateName && statuses
        ? venues.map((v) => <span key={v} className={statuses[v] === "restricted" ? "text-warning" : undefined}>{availabilityLine(v, stateName, statuses[v])}</span>)
        : <StateLink>Check your state</StateLink>}
    </div>
  );
}
