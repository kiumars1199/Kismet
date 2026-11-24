// @vitest-environment jsdom
// Rule 3: the basis is one tap away. The proof line's definition ("Testing: ...", "About N events needed") used to live
// only in a title= attribute, which touch devices and keyboards can't reach. The dotted live line is now a toggle.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProofLine } from "./ProofLine";
import type { Proof } from "@/lib/proof";

afterEach(cleanup);
const p: Proof = { test: "In testing: +9.5% per bet.", live: "Live since Nov 17: 60 settled bets, +1%; still too few to judge (9 settled events so far; about 22 needed).",
  line: "", help: 'Testing: 1,234 past best bets. "About 22 events needed": settled games or weather days it takes.', needs: 22, settled: 60, liveRoi: 1, enough: false };

describe("ProofLine help", () => {
  it("is closed to start: the toggle says so and the definition is not on screen", () => {
    render(<ProofLine p={p} />);
    const t = screen.getByTestId("proof-live");
    expect(t.getAttribute("role")).toBe("button");
    expect(t.getAttribute("aria-expanded")).toBe("false");
    expect(t.tabIndex).toBe(0);
    expect(screen.queryByTestId("proof-help")).toBeNull();
  });
  it("a tap opens the definition as visible text, wired with aria-controls; a second tap closes it", () => {
    render(<ProofLine p={p} />);
    const t = screen.getByTestId("proof-live");
    fireEvent.click(t);
    expect(t.getAttribute("aria-expanded")).toBe("true");
    const help = screen.getByTestId("proof-help");
    expect(help.textContent).toContain("About 22 events needed");
    expect(help.id).toBe(t.getAttribute("aria-controls"));
    fireEvent.click(t);
    expect(screen.queryByTestId("proof-help")).toBeNull();
    expect(t.getAttribute("aria-expanded")).toBe("false");
  });
  it("Enter and Space toggle it from the keyboard; Escape closes it", () => {
    render(<ProofLine p={p} />);
    const t = screen.getByTestId("proof-live");
    fireEvent.keyDown(t, { key: "Enter" });
    expect(screen.getByTestId("proof-help")).toBeTruthy();
    fireEvent.keyDown(t, { key: "Escape" });
    expect(screen.queryByTestId("proof-help")).toBeNull();
    fireEvent.keyDown(t, { key: " " });
    expect(screen.getByTestId("proof-help")).toBeTruthy();
  });
  it("keeps the dotted look, the hover title, and the test half is untouched", () => {
    const { container } = render(<ProofLine p={p} />);
    expect(screen.getByTestId("proof-live").className).toContain("decoration-dotted");
    expect(container.querySelector("p")!.getAttribute("title")).toBe(p.help);
    expect(screen.getByTestId("proof-test").textContent).toContain("In testing");
  });
  it("each line has its own id, so two on one page don't collide", () => {
    render(<><ProofLine p={p} testId="a" /><ProofLine p={p} testId="b" liveOnly /></>);
    const [x, y] = screen.getAllByTestId("proof-live");
    expect(x!.getAttribute("aria-controls")).not.toBe(y!.getAttribute("aria-controls"));
  });
});
