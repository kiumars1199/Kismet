// @vitest-environment jsdom
// docs/19 P3, T-302: Free sees the day's sample, then one solid card with a lock and "Unlock N more bets" to /pricing.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("@/lib/telemetry", () => ({ track }));
const { LockedBets } = await import("./LockedBets");
afterEach(cleanup);

describe("LockedBets", () => {
  it("one link to pricing naming the locked count, with no market rows and no fake cards", () => {
    const { container } = render(<LockedBets total={2778} shown={10} daily={10} desktop />);
    const link = screen.getByRole("link", { name: "Unlock 2,768 more bets" });
    expect(link.getAttribute("href")).toBe("/pricing");
    expect(container.querySelectorAll("[data-row], [data-market-id], ul, [inert]")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/blur|gradient/);
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("upgrade_clicked", { source: "locked_bets" });
  });

  it("renders nothing when every bet is already shown", () => {
    const { container } = render(<LockedBets total={10} shown={10} daily={10} />);
    expect(container.innerHTML).toBe("");
  });

  it("one locked bet reads in the singular", () => {
    render(<LockedBets total={11} shown={10} daily={10} />);
    expect(screen.getByRole("link").textContent).toBe("Unlock 1 more bet");
  });

  it("T-288: states the daily allowance, never the number of rows on the page", () => {
    const { container } = render(<LockedBets total={1070} shown={4} daily={10} desktop />);
    expect(container.textContent).toContain("Free shows 10 of today's best bets, picked at random each day, with delayed prices.");
    expect(screen.getByRole("link").textContent).toBe("Unlock 1,066 more bets");
    expect(container.textContent).not.toMatch(/Free shows 4\b/);
  });

  it("says when none of the free bets match the filters, and offers Pro in plain words", () => {
    const { container } = render(<LockedBets total={30} shown={0} daily={10} />);
    expect(container.textContent).toContain("None of today's 10 free bets match these filters. Pro shows all 30, live.");
    expect(screen.getByRole("link").textContent).toBe("See it with Pro");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/pricing");
    cleanup();
    const big = render(<LockedBets total={2778} shown={0} daily={10} />);
    expect(big.container.textContent).toContain("Pro shows all 2,778, live.");
  });
});
