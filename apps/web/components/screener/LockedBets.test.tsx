// @vitest-environment jsdom
// docs/19 P3: Free sees the day's sample, then blurred locked cards and one "Unlock all N bets" link to /pricing.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
const { LockedBets } = await import("./LockedBets");

describe("LockedBets", () => {
  it("links every locked bet to pricing, with the real total and no market rows", () => {
    const { container } = render(<LockedBets total={2778} shown={10} daily={10} desktop />);
    const link = screen.getByRole("link", { name: "Unlock all 2.7K bets" });
    expect(link.getAttribute("href")).toBe("/pricing");
    expect(screen.getByRole("heading").textContent).toBe("2.7K more bets on Pro");
    expect(container.querySelectorAll("[data-row], [data-market-id]")).toHaveLength(0);
    expect(container.querySelector("ul")!.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("ul > li")).toHaveLength(8);
  });

  it("renders nothing when every bet is already shown", () => {
    const { container } = render(<LockedBets total={10} shown={10} daily={10} desktop={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("T-288: states the daily allowance, never the number of rows on the page", () => {
    const { container } = render(<LockedBets total={1070} shown={4} daily={10} desktop />);
    expect(container.textContent).toContain("Free shows 10 Best bets a day, chosen at random");
    expect(container.querySelector("h2")!.textContent).toBe("1K more bets on Pro");
    expect(container.textContent).not.toMatch(/Free shows 4\b/);
  });
});
