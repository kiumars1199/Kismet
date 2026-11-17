// Shell navigation (docs/06 § App shell, "Words to use").
export const MAIN_TABS = [
  { href: "/", label: "Best bets" },
  { href: "/markets", label: "All markets" },
  { href: "/watchlist", label: "My list" },
  { href: "/journal", label: "My bets" },
  { href: "/track-record", label: "Results" },
] as const;

export const MORE_LINKS = [
  { href: "/journal", label: "My bets" },
  { href: "/track-record", label: "Results" },
  { href: "/tools", label: "Tools" },
  { href: "/alerts", label: "Alerts" },
  { href: "/dashboards", label: "Dashboards" },
  { href: "/settings", label: "Settings" },
  { href: "/status", label: "Status" },
  { href: "/about", label: "How it works" },
] as const;

export const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/");
