// T-276: what a signed-out visitor's HTML carries. /m/* and /event/* are teasers (title, category, closing time,
// sign-up), with no verdict or model number in the page or its metadata. The landing shows 3 real best bets through
// the Free gate; its 6 blurred placeholders are empty shapes with no market text at all.
import type { ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ApiRow } from "@/lib/api";

vi.mock("@/lib/auth/server", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/server")>()),
  authEnabled: () => true,
  getUser: async () => null,
  getMe: async () => ({ user: null, tier: "free", status: null, current_period_end: null, cancel_at_period_end: false, beta: false }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
// Client components: the landing test only needs which rows reach them.
vi.mock("@/components/market/BetCard", () => ({
  BetCard: ({ r }: { r: ApiRow }) => createElement("article", { "data-row": "", "data-market-id": r.market.id }, r.market.question),
}));
vi.mock("@/components/pricing/Plans", async (orig) => ({
  ...(await orig<typeof import("@/components/pricing/Plans")>()),   // the real Faq (T-290 reads the FAQ text)
  Plans: () => createElement("div", { "data-plans": "" }),
}));

const { getStore, getStoreFor } = await import("@/lib/data/store");
const { TEASER_DESCRIPTION, TEASER_LINE } = await import("@/lib/teaser");
const { price, pct } = await import("@/lib/format");
const market = await import("@/app/m/[id]/page");
const event = await import("@/app/event/[id]/page");
const { Landing, LANDING_PLACEHOLDERS, LANDING_REAL, LANDING_SAMPLE, ctaLine } = await import("@/components/landing/Landing");
const { freeSample } = await import("@/lib/data/respond");

const html = async (el: Promise<unknown>) => renderToStaticMarkup((await el) as ReactElement);
/** Words and keys that only come from the model or the scan's prices. */
const MODEL = [/Pays \d/, /wins about/i, /\bedge\b/i, /est(imated)? return/i, /Best bet\b/, /Good price/, /win chance/i, /side_index/, /win_prob/, /"ask"/, /ranges/];

describe("signed-out market and event pages are teasers", async () => {
  const store = await getStore();
  const flagged = [...store.flagsById.values()].slice(0, 5);

  it("/m/[id]: title, category, closing time and sign-up with next; no verdict or numbers in the page or metadata", async () => {
    for (const m of flagged) {
      const props = { params: Promise.resolve({ id: m.id }), searchParams: Promise.resolve({}) };
      const out = await html(market.default(props));
      expect(out).toContain('data-testid="teaser"');
      expect(out).toContain(TEASER_LINE);
      expect(out).toContain(`/signup?next=${encodeURIComponent(`/m/${m.id}`)}`);
      for (const re of MODEL) expect(out, `${m.id}: ${re}`).not.toMatch(re);
      for (const s of m.sides ?? []) {
        if (typeof s.ask === "number") expect(out).not.toContain(price(s.ask));
        if (typeof s.win_prob === "number") expect(out).not.toContain(pct(s.win_prob));
      }
      const meta = await market.generateMetadata(props);
      expect(meta.description).toBe(TEASER_DESCRIPTION);
      expect(JSON.stringify(meta)).not.toMatch(/\d+¢|\d+%/);
    }
  });

  it("/event/[id]: same teaser, no numbers", async () => {
    const ids = [...new Set(flagged.map((m) => m.event_id))].filter(Boolean).slice(0, 3) as string[];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const props = { params: Promise.resolve({ id }), searchParams: Promise.resolve({}) };
      const out = await html(event.default(props as never));
      expect(out).toContain(TEASER_LINE);
      for (const re of MODEL) expect(out, `${id}: ${re}`).not.toMatch(re);
      expect(JSON.stringify(await event.generateMetadata(props as never))).not.toMatch(/\d+¢|\d+%/);
    }
  });
});

describe("signed-out landing", () => {
  it(`shows ${LANDING_REAL} real best bets (Free gate) and ${LANDING_PLACEHOLDERS} placeholders that carry no market text`, async () => {
    const out = await html(Landing());
    const real = [...out.matchAll(/data-market-id="([^"]+)"/g)].map((x) => x[1]!);
    expect(real.length).toBeGreaterThan(0);
    expect(real.length).toBeLessThanOrEqual(LANDING_REAL);
    const free = await getStoreFor("free");
    const sample = freeSample(free, LANDING_SAMPLE);   // the Free daily sample, like a Free account's /api/flags
    for (const id of real) expect(sample.has(id), id).toBe(true);

    const placeholders = [...out.matchAll(/<li aria-hidden="true" data-testid="placeholder"[\s\S]*?<\/li>/g)].map((x) => x[0]);
    expect(placeholders).toHaveLength(LANDING_PLACEHOLDERS);
    const titles = [...(await getStore()).byId.values()].map((m) => m.question);
    for (const p of placeholders) {
      expect(p.replace(/<[^>]+>/g, "").trim(), "placeholder has no text").toBe("");
      for (const t of titles) expect(p).not.toContain(t);
    }
    expect(out).toMatch(/Sign up free to see (all [\d,.]+[KkMm]?|10 of all [\d,.]+[KkMm]?) bets/);
    expect(ctaLine(4)).toBe("Sign up free to see all 4 bets");
    expect(ctaLine(250)).toBe("Sign up free to see 10 of all 250 bets");   // Free sees 10 a day; never promise all
    expect(out).not.toContain('href="/bets"');   // every CTA leads to sign-up, not to a page that redirects
  });

  it("proof is read from backtest.json, in plain words, with its basis on hover", async () => {
    const out = await html(Landing());
    const bt = (await getStore()).backtest;
    const taker = bt.results[String(bt.chosen_half_life_days ?? "None")]!.taker;
    expect(out).toContain(`won ${pct(taker.win_rate)} of the time vs ${pct(taker.avg_price)} the price implied`);
    expect(out).toMatch(/title="[\d,]+ best bets/);
  });

  it("order: hero, teaser, proof, plans, FAQ (with the three questions), disclaimer", async () => {
    const out = await html(Landing());
    const at = (s: string) => { const i = out.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
    const order = [at('id="hero-h"'), at('id="teaser-h"'), at('id="proof-h"'), at('id="price-h"'), at('id="faq-h"'), at('data-testid="landing-disclaimer"')];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const q of ["Is it free?", "Do you place bets?", "Is this advice?"]) at(q);
    at("Market analytics, not financial advice. Based on past results. 18+.");
  });
});

describe("signed-out teaser while the store isn't there yet", () => {
  it("renders the pending state, not a 404", async () => {
    vi.resetModules();
    vi.doMock("@/lib/data/store", async (orig) => {
      const real = await orig<typeof import("@/lib/data/store")>();
      return { ...real, getStoreFor: async () => { throw new real.DelayedPending(); } };   // Free's delayed copy not published yet
    });
    const page = await import("@/app/m/[id]/page");
    const ev = await import("@/app/event/[id]/page");
    const props = { params: Promise.resolve({ id: "6674492" }), searchParams: Promise.resolve({}) };
    for (const out of [await html(page.default(props)), await html(ev.default(props as never))]) {
      expect(out).not.toContain('data-testid="teaser"');
      expect(out).toMatch(/role="status"|pending|being prepared|Couldn/i);
    }
    vi.doUnmock("@/lib/data/store");
  });
});

// T-290: on every page that shows the test return, the live record is printed beside it (lib/proof siteProof), and
// the FAQ splits hit rate from profit with the one shared sentence.
describe("the test return never stands alone (T-290)", async () => {
  const { HIT_RATE_VS_PROFIT, siteProof } = await import("@/lib/proof");
  const store = await getStore();
  const p = siteProof({ backtest: store.backtest, ledger: store.ledgerSummary, since: store.ledgerSince });
  const text = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const pages: [string, () => Promise<unknown>][] = [
    ["landing", () => Landing()],
    ["/about", async () => (await import("@/app/about/page")).default()],
    ["/track-record", async () => (await import("@/app/track-record/page")).default()],
    ["/pricing", async () => (await import("@/app/pricing/page")).default()],
  ];
  for (const [name, el] of pages) {
    it(`${name}: test line and live line together, with the basis on hover`, async () => {
      const out = await html(el());
      expect(p.test).toBeTruthy();
      expect(text(out), name).toContain(p.line);
      expect(out).toContain('data-testid="proof-line"');
      expect(out).toMatch(/data-testid="proof-line"[^>]*title="Testing: /);
    });
  }
  it("landing, /about and /pricing FAQs use the hit-rate vs profit sentence verbatim; no 'many best bets do' lose", async () => {
    for (const [name, el] of pages.filter(([n]) => n !== "/track-record")) {
      const t = text(await html(el()));
      expect(t, name).toContain(HIT_RATE_VS_PROFIT);
      expect(t, name).not.toMatch(/many best bets do|Plenty still lost/);
    }
  });
});
