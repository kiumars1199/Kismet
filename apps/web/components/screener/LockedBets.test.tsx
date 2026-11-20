// @vitest-environment jsdom
// docs/19 P3: Free sees the day's sample, then blurred locked cards and one "Unlock all N bets" link to /pricing.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
const { LockedBets } = await import("./LockedBets");
afterEach(cleanup);

describe("LockedBets", () => {
  it("links every locked bet to pricing, with the real total and no market rows", () => {
    const { container } = render(<LockedBets total={2778} shown={10} desktop />);
    const link = screen.getByRole("link", { name: "Unlock all 2.7K bets" });
    expect(link.getAttribute("href")).toBe("/pricing");
    expect(screen.getByRole("heading").textContent).toBe("2.7K more bets on Pro");
    expect(container.querySelectorAll("[data-row], [data-market-id]")).toHaveLength(0);
    expect(container.querySelector("ul")!.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("ul > li")).toHaveLength(8);
  });

  it("renders nothing when every bet is already shown", () => {
    const { container } = render(<LockedBets total={10} shown={10} desktop={false} />);
    expect(container.innerHTML).toBe("");
  });

  // T-291 #11: the panel over the cards closes (button or Esc) and comes back; focus follows it
  it("closes with the close button, focus moves to the button that brings it back, and back again", () => {
    render(<LockedBets total={50} shown={10} desktop />);
    const close = screen.getByRole("button", { name: "Close" });
    fireEvent.click(close);
    expect(screen.queryByRole("link", { name: /Unlock all/ })).toBeNull();
    const reopen = screen.getByRole("button", { name: "40 more bets on Pro" });
    expect(document.activeElement).toBe(reopen);
    expect(reopen.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(reopen);
    expect(screen.getByRole("link", { name: /Unlock all/ })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });

  it("closes on Esc, but leaves Esc to an open modal (drawer, dialog)", () => {
    render(<LockedBets total={50} shown={10} desktop />);
    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
    screen.getByRole("link", { name: /Unlock all/ }).focus();   // jsdom has no layout: Esc applies with focus in the panel
    act(() => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    modal.remove();
    act(() => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("locked-reopen"));
  });
});
