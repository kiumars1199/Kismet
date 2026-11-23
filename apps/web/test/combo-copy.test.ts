// T-wt3: the plan copy for the combo checker, and the leg basis in the drawer's own words.
import { describe, expect, it } from "vitest";
import { COMBOS_PAGE_FREE_PRO, COMBO_CHECK_FREE_NOTE, FREE_CHECK_LIMIT_LINE, PRO_CHECKER_POINT } from "@/lib/check/copy";
import { similarBasis } from "@/components/market/labels";
import { quota } from "@/lib/entitlements";
import { PLANS } from "@/components/pricing/Plans";

describe("combo checker copy", () => {
  it("/combos for Free and Pro says what they have and what Premium adds", () => {
    expect(COMBOS_PAGE_FREE_PRO.have).toBe("Check any combo you build in the combo checker.");
    expect(COMBOS_PAGE_FREE_PRO.premium).toBe("Premium adds suggested combos and the combo tray.");
  });
  it("Free's note names the real limit and only Free sees it", () => {
    expect(quota("free", "checks_day")).toBe(1);
    expect(COMBO_CHECK_FREE_NOTE).toBe("Free includes 1 check a day; this combo counts as one.");
    expect(FREE_CHECK_LIMIT_LINE).toContain(`${quota("free", "checks_day")} bet or combo check a day`);
  });
  it("/pricing: Pro lists the checker as unlimited, Free lists its real limit, Premium does not repeat Pro's line", () => {
    const [free, pro, premium] = PLANS;
    expect(pro.points).toContain(PRO_CHECKER_POINT);
    expect(PRO_CHECKER_POINT).toBe("Bet and combo checker, unlimited");
    expect(free.points.some((p) => p === FREE_CHECK_LIMIT_LINE)).toBe(true);
    expect(premium.points).toContain("Everything in Pro");
  });
});

describe("similarBasis (the drawer's plain wording, reused for the combo's 'Why these numbers?')", () => {
  const m = { category: "sports", niche: "nfl", tags: ["sports", "nfl"], market_type: "moneyline" } as never;
  it("about N similar past bets in <topic> <type> bets", () => {
    expect(similarBasis(m, { model_level: "nmt", model_neff: 130.4 } as never)).toBe("about 130 similar past bets in NFL match-winner bets");
    expect(similarBasis(m, { model_level: "niche", model_neff: 12 } as never)).toBe("about 12 similar past bets in NFL bets");
    expect(similarBasis(m, { model_level: "all", model_neff: 4000 } as never)).toBe("over a thousand similar past bets in bets of every kind");
  });
});
