// @vitest-environment jsdom
// F11 review: Free sees ONE upsell per list (not one per card); the slot is reserved until the plan is known (CLS).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(cleanup);

let ent = { known: true, can: (_: string) => false };
vi.mock("@/lib/entitlements", () => ({ useEntitlements: () => ent }));
vi.mock("@/lib/repo/hooks", () => ({ useProfile: () => ({ default_stake_usd: 100 }) }));
vi.mock("@/lib/repo", () => ({ getRepo: () => ({ journal: { insert: vi.fn(), remove: vi.fn() } }) }));
const { LogBetButton, LogUpsell } = await import("./LogBetButton");
const target = { id: "m1", question: "Q?", category: "sports", niche: "nfl", side_index: 0 as const, outcome: "Yes", win_prob: 0.7 };

describe("LogBetButton", () => {
  it("Free: a card shows nothing; the list shows one upsell", () => {
    ent = { known: true, can: () => false };
    const { container } = render(<>{[1, 2, 3].map((i) => <LogBetButton key={i} target={target} price={0.6} />)}<LogUpsell /></>);
    expect(screen.getAllByTestId("log-bet-upgrade")).toHaveLength(1);
    expect(container.querySelector('[data-testid="log-bet"]')).toBeNull();
  });
  it("plan unknown: a fixed-height slot, no button and no upsell", () => {
    ent = { known: false, can: () => false };
    render(<><LogBetButton target={target} price={0.6} /><LogUpsell /></>);
    expect(screen.getByTestId("log-bet-slot").className).toContain("min-h-11");
    expect(screen.queryByTestId("log-bet-upgrade")).toBeNull();
  });
  it("Pro: the button, from a checker target (no Market needed)", () => {
    ent = { known: true, can: () => true };
    render(<><LogBetButton target={target} price={0.6} stakeUsd={50} /><LogUpsell /></>);
    expect(screen.getByTestId("log-bet").getAttribute("aria-label")).toContain("$50");
    expect(screen.queryByTestId("log-bet-upgrade")).toBeNull();
  });
});
