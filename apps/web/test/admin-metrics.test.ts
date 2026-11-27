// F15: the admin's 30-day numbers against a seeded fixture (the shape admin_metrics() returns), hand-computed.
import { describe, expect, it } from "vitest";
import { dollars, summarize, toCents, type RawMetrics } from "@/lib/admin/metrics";

const d = (day: string, o: Partial<RawMetrics["days"][number]> = {}) =>
  ({ day, signups: 0, trials: 0, payments: 0, revenue_cents: null, churned: 0, invites_sent: 0, invites_verified: 0, ...o });

const FIXTURE: RawMetrics = {
  days: [
    d("2026-11-18"),
    d("2026-11-19", { signups: 3, payments: 1, revenue_cents: 500 }),
    d("2026-11-20", { signups: 1, trials: 2, churned: 2, revenue_cents: 0, invites_sent: 2 }),
    d("2026-11-21", { signups: 4, payments: 2, revenue_cents: 1999 + 1199, invites_sent: 1, invites_verified: 1 }),
    d("2026-11-22", { signups: 2, trials: 1, payments: 1, revenue_cents: 123456, churned: 1, invites_verified: 2 }),
  ],
  revenue_since: "2026-11-19",
  paying: { pro: 3, premium: 2 },
  mrr_cents: 3 * 1199 + 2 * 1999,
};

describe("dollars()", () => {
  it("formats cents as $1,234.56, never as raw cents", () => {
    expect(dollars(123456)).toBe("$1,234.56");
    expect(dollars(0)).toBe("$0.00");
    expect(dollars(5)).toBe("$0.05");
    expect(dollars(1199)).toBe("$11.99");
    expect(dollars(100_000_000)).toBe("$1,000,000.00");
    expect(dollars(-250)).toBe("−$2.50");
  });
  it("turns list prices into whole cents without float drift", () => {
    expect(toCents(11.99)).toBe(1199);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(119.99)).toBe(11999);
    expect(toCents(0.29)).toBe(29);
  });
});

describe("summarize()", () => {
  const s = summarize(FIXTURE);
  it("lists days newest first", () => {
    expect(s.rows.map((r) => r.day)).toEqual(["2026-11-22", "2026-11-21", "2026-11-20", "2026-11-19", "2026-11-18"]);
    expect(s.rows[0]!.label).toBe("Nov 22");
  });
  it("totals every column", () => {
    expect(s.totals).toMatchObject({ signups: 10, trials: 3, payments: 4, churned: 3, invites_sent: 3, invites_verified: 3 });
  });
  it("revenue: daily dollars, totals only known days, unknown days are a dash", () => {
    expect(s.rows.map((r) => r.revenue)).toEqual(["$1,234.56", "$31.98", "$0.00", "$5.00", "—"]);
    expect(s.totals.revenue_cents).toBe(500 + 0 + 3198 + 123456);
    expect(s.totals.revenue).toBe("$1,271.54");
  });
  it("says where the revenue record starts", () => {
    expect(s.revenueNote).toBe("Revenue is recorded from Nov 19, 2026; earlier days show a dash.");
    expect(summarize({ ...FIXTURE, days: FIXTURE.days.slice(1) }).revenueNote).toBeNull();
  });
  it("paying users and MRR", () => {
    expect(s.payingTotal).toBe(5);
    expect(s.mrr).toBe("$75.95");   // 3 x 11.99 + 2 x 19.99
  });
  it("no ledger yet: every day is a dash and the total is a dash, not $0.00", () => {
    const none = summarize({ days: FIXTURE.days.map((x) => ({ ...x, revenue_cents: null })), revenue_since: null, paying: { pro: 0, premium: 0 }, mrr_cents: 0 });
    expect(none.rows.every((r) => r.revenue === "—")).toBe(true);
    expect(none.totals.revenue).toBe("—");
    expect(none.revenueNote).toMatch(/first paid invoice/);
    expect(none.mrr).toBe("$0.00");
  });
  it("an empty window is all zeros", () => {
    const e = summarize({ days: [], revenue_since: null, paying: { pro: 0, premium: 0 }, mrr_cents: 0 });
    expect(e.rows).toEqual([]);
    expect(e.totals.signups).toBe(0);
    expect(e.revenueNote).toBeNull();
  });
});

describe("mrrView: one MRR for both admin blocks", async () => {
  const { mrrView } = await import("@/lib/admin/metrics");
  it("without admin_mrr (migration not applied): the old estimate, labelled as monthly list price", () => {
    expect(mrrView(null, 3 * 1199)).toMatchObject({ value: "$35.97", sub: "at monthly list price" });
  });
  it("with admin_mrr: its cents, how many are yearly, and how many plan lengths are still unknown", () => {
    expect(mrrView({ mrr_cents: 2998, paying: { pro: 1, premium: 1 }, yearly: 1, unknown_interval: 0 }, 0))
      .toMatchObject({ value: "$29.98", sub: "1 yearly at price ÷ 12" });
    expect(mrrView({ mrr_cents: 3198, paying: { pro: 1, premium: 1 }, yearly: 0, unknown_interval: 2 }, 0).sub)
      .toBe("monthly list prices · 2 plan length not recorded yet, counted monthly");
  });
});
