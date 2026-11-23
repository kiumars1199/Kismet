// The page a visitor returns to after /state. The home page is prerendered as "index", so usePathname() reads "/index"
// while rendering on the server; map it back to "/" so the server-rendered link (no JS, "open in new tab") returns home.
export const stateNext = (pathname: string): string => (pathname === "/index" ? "/" : pathname);

export const stateHref = (pathname: string | null | undefined): string =>
  pathname && pathname !== "/state" ? `/state?next=${encodeURIComponent(stateNext(pathname))}` : "/state";
