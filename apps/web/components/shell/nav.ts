// Shell navigation (docs/06 § App shell, "Words to use").
export const MAIN_TABS = [
  { href: "/bets", label: "Best bets" },   // "/" is the landing page when signed out (docs/19 P1)
  { href: "/markets", label: "All markets" },
  { href: "/watchlist", label: "My list" },
  { href: "/journal", label: "My bets" },
  { href: "/track-record", label: "Results" },
] as const;

/** Signed out (T-276): the app needs an account, so the header shows the sales pages instead. */
export const SALES_TABS = [
  { href: "/about", label: "How it works" },
  { href: "/track-record", label: "Results" },
  { href: "/pricing", label: "Pricing" },
] as const;

export const MORE_LINKS = [
  { href: "/journal", label: "My bets" },
  { href: "/track-record", label: "Results" },
  { href: "/check", label: "Check a bet" },
  { href: "/tools", label: "Tools" },
  { href: "/check/combo", label: "Check a combo" },
  { href: "/alerts", label: "Alerts" },
  { href: "/dashboards", label: "Dashboards" },
  { href: "/settings", label: "Settings" },
  { href: "/status", label: "Status" },
  { href: "/about", label: "How it works" },
] as const;

/** The bet checker: its own item in the desktop header from 1440 px (below that the header has no room: the footer and the phone More menu list it). */
export const CHECK_TAB = { href: "/check", label: "Check a bet" } as const;

/** Beta features (lib/beta.ts): shown only to testers, each with a Beta pill. */
export const BETA_LINKS = [
  { href: "/combos", label: "Combos", feature: "combos" },
  { href: "/kalshi", label: "Kalshi", feature: "kalshi" },
] as const;

/** The current page's item: an exact match, or a sub-page of it. /check is exact only: /check/combo has its own item ("Check a combo"). */
export const isActive = (pathname: string, href: string) =>
  pathname === href || (href !== "/check" && pathname.startsWith(href + "/")) || (href === "/bets" && pathname === "/");
