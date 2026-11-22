// F6: "How to bet this": 3 steps per venue and a link that opens the market on the venue. One config, so a card, the checker
// and the tests read the same text. Steps are taken from each venue's own help pages (fetched Nov 22, 2026); each step carries its source URL and date.
import type { StoreMarket } from "@/lib/types";

export type VenueId = "polymarket" | "polymarket-us" | "kalshi";

/** One step and the fetched page that says it: `checked` = the day we read it, `printed` = the date the page shows, if any. */
export interface Step { text: string; source: { url: string; checked: string; printed?: string } }

export interface Guide {
  name: string;
  steps: readonly [Step, Step, Step];
}

const C = "2026-11-22";   // every page below was fetched (curl) on this day

export const GUIDES: Record<VenueId, Guide> = {
  polymarket: {
    name: "Polymarket",
    steps: [
      { text: "Sign up: click Sign Up, then continue with Google or your email address.", source: { url: "https://help.polymarket.com/en/articles/13369877-how-to-sign-up", checked: C, printed: "2026-01-12" } },
      { text: "Add money: click Deposit and choose a method, such as transferring crypto.", source: { url: "https://help.polymarket.com/en/articles/13369887-how-to-deposit", checked: C, printed: "2026-06-08" } },
      { text: "Open the market with the link below and tap Buy Yes or Buy No, then follow Polymarket's prompts.", source: { url: "https://docs.polymarket.com/polymarket-101", checked: C } },
    ],
  },
  "polymarket-us": {
    name: "Polymarket US",
    steps: [
      { text: "Create your account with Google or Apple ID, then enter your details so Polymarket US can verify your identity.", source: { url: "https://docs.polymarket.us/learn/get-started/signup.md", checked: C } },
      { text: "Add money from the app: debit card, bank transfer, Apple Pay, PayPal, Venmo, USDC or wire.", source: { url: "https://docs.polymarket.us/learn/get-started/fund-account.md", checked: C } },
      { text: "Open the market with the link below, choose Yes or No, enter the dollar amount and swipe up to confirm.", source: { url: "https://docs.polymarket.us/learn/get-started/place-order.md", checked: C } },
    ],
  },
  kalshi: {
    name: "Kalshi",
    steps: [
      { text: "Sign up on Kalshi. You'll be asked to verify your identity and confirm your country of residence.", source: { url: "https://help.kalshi.com/en/articles/14026044-can-i-trade-on-kalshi-from-outside-the-united-states", checked: C, printed: "2026-03-20" } },
      { text: "Add money: Kalshi takes debit card (including Apple Pay and Google Pay), bank transfer, PayPal, Venmo, Cash App, crypto or wire.", source: { url: "https://help.kalshi.com/en/articles/13823791-transfers-faq", checked: C, printed: "2026-08-24" } },
      { text: "Open the market with the link below, pick Yes or No, then enter a dollar amount or a number of contracts. Your order fills at the best available price.", source: { url: "https://help.kalshi.com/en/articles/13823812-quick-order-purchase", checked: C, printed: "2026-03-17" } },
    ],
  },
};

export const VENUE_IDS = Object.keys(GUIDES) as VenueId[];

type VenueQuoteLike = { venue?: string; url?: string | null };
type M = Pick<StoreMarket, "url" | "venue" | "us" | "kalshi_ticker"> & { venues?: VenueQuoteLike[] };

const https = (u: string | null | undefined) => (u && /^https:\/\/[^\s]+$/.test(u) ? u : null);

/** The link that opens this market on `venue`, or null. Never guessed: Polymarket and Polymarket US use the market's own
 *  url fields; Kalshi uses the `venues` quote's url (output/venues.json via the engine, F4) and nothing else. */
export function deepLink(m: M, venue: VenueId): string | null {
  const fromVenues = https(m.venues?.find((v) => v.venue === venue)?.url);
  if (venue === "polymarket") return fromVenues ?? (m.venue === "us" ? null : https(m.url));
  if (venue === "polymarket-us") return fromVenues ?? (m.venue === "us" ? https(m.url) : https(m.us?.url));
  return fromVenues;
}

/** The venues this market can be bet on, each with its link (null link = the guide shows without one). */
export function venueLinks(m: M): { venue: VenueId; url: string | null }[] {
  const out: { venue: VenueId; url: string | null }[] = [];
  if (m.venue !== "us") out.push({ venue: "polymarket", url: deepLink(m, "polymarket") });
  if (m.venue === "us" || m.us) out.push({ venue: "polymarket-us", url: deepLink(m, "polymarket-us") });
  if (m.venues?.some((v) => v.venue === "kalshi")) out.push({ venue: "kalshi", url: deepLink(m, "kalshi") });
  return out;
}

/** Thin adapter over F9 (trust lane, lib/venues/availability.ts: statusesFor(state) with kalshi | polymarket_us | polymarket_intl).
 *  Until F9 merges nothing is known, so every venue is "unverified". After the merge this is the one place to change. */
export type AvailStatus = "available" | "restricted" | "unverified";
export const venueStatus = (_venue: VenueId, _state: string | null = null): AvailStatus => "unverified";

/** The venue to preselect: the first one known available, else null (the user picks; we never assume). */
export function defaultVenue(links: { venue: VenueId }[], status: (v: VenueId) => AvailStatus): VenueId | null {
  return links.find((l) => status(l.venue) === "available")?.venue ?? null;
}

/** The one line shown above the link, same wording as F9. */
export function availabilityNote(venue: VenueId, status: AvailStatus, stateName: string | null): string {
  const name = GUIDES[venue].name;
  if (status === "available" && stateName) return `${name}: available in ${stateName}`;
  if (status === "restricted" && stateName) return `${name}: not available in ${stateName}`;
  return `Check ${name} for ${stateName ?? "your state"}`;
}
