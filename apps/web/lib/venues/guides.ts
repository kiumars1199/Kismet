// F6: "How to bet this": 3 steps per venue and a link that opens the market on the venue. One config, so a card, the checker
// and the tests read the same text. Steps are taken from each venue's own help pages (fetched Nov 22, 2026); sources below.
import type { StoreMarket } from "@/lib/types";

export type VenueId = "polymarket" | "polymarket-us" | "kalshi";

export interface Guide {
  name: string;
  steps: readonly [string, string, string];
  /** Where each fact came from: the venue's own page and its date as printed there (fetched 2026-11-22). */
  sources: readonly { url: string; page: string }[];
}

export const GUIDES: Record<VenueId, Guide> = {
  polymarket: {
    name: "Polymarket",
    steps: [
      "Sign up: click Sign Up, then continue with Google or your email address.",
      "Add money: click Deposit and choose a method, such as transferring crypto.",
      "Open the market with the link below, choose Buy Yes or Buy No for your side, enter the amount and confirm.",
    ],
    sources: [
      { url: "https://help.polymarket.com/en/articles/13369877-how-to-sign-up", page: "How to sign up (Jan 12, 2026)" },
      { url: "https://help.polymarket.com/en/articles/13369887-how-to-deposit", page: "How to deposit (Jun 8, 2026)" },
      { url: "https://docs.polymarket.com/polymarket-101", page: "Polymarket 101: Buy Yes / Buy No" },
    ],
  },
  "polymarket-us": {
    name: "Polymarket US",
    steps: [
      "Create your account with Google or Apple ID, then enter your details so Polymarket US can verify your identity.",
      "Add money from the app: debit card, bank transfer, Apple Pay, PayPal, Venmo, USDC or wire.",
      "Open the market with the link below, choose Yes or No, enter the dollar amount and swipe up to confirm.",
    ],
    sources: [
      { url: "https://docs.polymarket.us/learn/get-started/signup.md", page: "Create an Account" },
      { url: "https://docs.polymarket.us/learn/get-started/fund-account.md", page: "Fund Your Account" },
      { url: "https://docs.polymarket.us/learn/get-started/place-order.md", page: "Place a Trade" },
    ],
  },
  kalshi: {
    name: "Kalshi",
    steps: [
      "Sign up on Kalshi and verify your identity. You confirm your country of residence during signup.",
      "Add money: Kalshi takes debit card (including Apple Pay and Google Pay), bank transfer, PayPal, Venmo, Cash App, crypto or wire.",
      "Open the market with the link below, pick Yes or No, then enter a dollar amount or a number of contracts. Your order fills at the best available price.",
    ],
    sources: [
      { url: "https://help.kalshi.com/en/articles/14026044-can-i-trade-on-kalshi-from-outside-the-united-states", page: "Mar 20, 2026" },
      { url: "https://help.kalshi.com/en/articles/13823791-transfers-faq", page: "Transfers FAQ (Aug 24, 2026)" },
      { url: "https://help.kalshi.com/en/articles/13823812-quick-order-purchase", page: "Quick Order Purchase (Mar 17, 2026)" },
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
