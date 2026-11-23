// @vitest-environment jsdom
// F5: on Free, when the day's sample is filtered to nothing by the user's topics, say so plainly instead of "0 of 1 bet ...".
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BestBetsHeading } from "./BestBetsHeading";

afterEach(cleanup);
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;

describe("BestBetsHeading", () => {
  it("Free, sample filtered to 0 by topics: a plain line and a way to see it, never '0 of 1 bet'", () => {
    const onShow = vi.fn();
    render(<BestBetsHeading total={1} shown={0} sample daily={10} onShowAll={onShow} />);
    expect(heading()).toBe("Today's free bets aren't in your topics");   // Free gets 10 a day: "bets", even when one matched the topic
    expect(heading()).not.toMatch(/\b0 of\b/);
    fireEvent.click(screen.getByRole("button", { name: "Show today's free bets" }));
    expect(onShow).toHaveBeenCalledOnce();
  });
  it("reads 'pick' only when the daily allowance is one bet", () => {
    render(<BestBetsHeading total={7} shown={0} sample daily={1} onShowAll={() => {}} />);
    expect(heading()).toBe("Today's free pick isn't in your topics");
    expect(screen.getByRole("button", { name: "Show today's free pick" })).toBeTruthy();
  });
  it("the tap switches the heading at once (local state), so the row's height change lands inside the input window", () => {
    const onShow = vi.fn();
    render(<BestBetsHeading total={7} shown={0} sample daily={10} onShowAll={onShow} />);
    fireEvent.click(screen.getByRole("button", { name: "Show today's free bets" }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(heading()).toBe("Bets where the odds lean your way");
    expect(onShow).toHaveBeenCalledOnce();
  });
  it("the same line for every Free user: it depends only on counts, nothing personal", () => {
    const a = render(<BestBetsHeading total={1} shown={0} sample daily={10} onShowAll={() => {}} />).container.innerHTML;
    cleanup();
    expect(render(<BestBetsHeading total={1} shown={0} sample daily={10} onShowAll={() => {}} />).container.innerHTML).toBe(a);
  });
  it("unchanged elsewhere: Free with some shown, paid, and no data yet", () => {
    render(<BestBetsHeading total={34} shown={10} sample onShowAll={() => {}} />);
    expect(heading()).toBe("10 of 34 bets where the odds lean your way");
    cleanup();
    render(<BestBetsHeading total={1} shown={1} onShowAll={() => {}} />);
    expect(heading()).toBe("1 bet where the odds lean your way");
    cleanup();
    render(<BestBetsHeading total={0} shown={0} sample onShowAll={() => {}} />);   // nothing matches at all: the empty state speaks
    expect(heading()).toBe("0 bets where the odds lean your way");
    cleanup();
    render(<BestBetsHeading shown={0} onShowAll={() => {}} />);
    expect(heading()).toBe("Bets where the odds lean your way");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("BestBetsHeading layout", () => {
  it("the Show button takes the blurb's grid cell (the blurb stays, hidden), so the row does not grow when it appears", () => {
    const { container } = render(<BestBetsHeading total={7} shown={0} sample daily={10} onShowAll={() => {}}><p>blurb</p></BestBetsHeading>);
    const btn = screen.getByTestId("show-free-sample");
    const blurb = container.querySelector("p")!;
    expect(btn.parentElement).toBe(blurb.parentElement!.parentElement);   // both children of the one grid
    expect(blurb.parentElement!.className).toContain("invisible");
    cleanup();
    render(<BestBetsHeading total={34} shown={10} sample daily={10} onShowAll={() => {}}><p>blurb</p></BestBetsHeading>);
    expect(screen.getByText("blurb").parentElement!.className).not.toContain("invisible");
  });
});
