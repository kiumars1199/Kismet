// Walk-through 1 note: Polymarket's " - More Markets" suffix never shows on the signed-in /event page (title, h1,
// breadcrumb) or the /m breadcrumb. Accounts off = the data path (the signed-in view), like test/page-limits.test.ts.
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({ getMe: async () => ({ user: null, tier: "pro" }), getTier: async () => "pro", authEnabled: () => false, getUser: async () => null }));
vi.mock("botid/server", () => ({ checkBotId: async () => ({ isBot: false, isVerifiedBot: false }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, prefetch() {} }), usePathname: () => "/event/x", useSearchParams: () => new URLSearchParams(), notFound: () => { throw new Error("notFound"); }, redirect: () => { throw new Error("redirect"); } }));

const { getStore } = await import("@/lib/data/store");
const EventPage = await import("@/app/event/[id]/page");
const { EventView } = await import("@/components/screener/EventView");

const SUFFIX = /\s-\smore markets\s*$/i;
/** Props of the first <EventView> in the rendered tree. */
const findView = (n: ReactNode): { ev: { event: string } } | null => {
  if (!isValidElement(n)) return null;
  const e = n as ReactElement<{ children?: ReactNode; ev?: { event: string } }>;
  if (e.type === EventView) return { ev: e.props.ev! };
  for (const c of [e.props.children].flat()) { const r = findView(c); if (r) return r; }
  return null;
};

describe("signed-in /event hides ' - More Markets'", async () => {
  const s = await getStore();
  const m = s.markets.find((x) => SUFFIX.test(x.event))!;

  it("fixture has such an event", () => expect(m).toBeTruthy());

  it("<title> has no suffix", async () => {
    const meta = await EventPage.generateMetadata({ params: Promise.resolve({ id: m.event_id }) } as never);
    expect(String(meta.title)).not.toMatch(/more markets/i);
    expect(String(meta.title)).toBe(m.event.replace(SUFFIX, "").trim());
  });

  it("h1 and breadcrumb have no suffix", async () => {
    const tree = await EventPage.default({ params: Promise.resolve({ id: m.event_id }) });
    const ev = findView(tree)!.ev;
    const html = renderToStaticMarkup(createElement(EventView, { ev: ev as never }));
    expect(html).not.toMatch(/more markets/i);
    expect(html).toContain(`>${m.event.replace(SUFFIX, "").trim().replace(/&/g, "&amp;")}</h1>`);
  });
});
