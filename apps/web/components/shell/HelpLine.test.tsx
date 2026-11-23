// @vitest-environment jsdom
// #85 review: the two actions are buttons with real 44 px boxes and no negative-margin overlap; "source" is an inline link.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HelpLine } from "./HelpLine";
afterEach(cleanup);

it("call and chat are >= 44 px buttons with no negative margins; source is the one inline link", () => {
  const { container } = render(<HelpLine />);
  for (const name of [/Call or text/, "Chat online"]) {
    const a = screen.getByRole("link", { name });
    expect(a.className).toContain("min-h-11");
    expect(a.className).toContain("min-w-11");
    expect(a.className).not.toMatch(/-m[yt b]-/);
    expect(a.hasAttribute("data-inline-link")).toBe(false);
  }
  expect(screen.getByRole("link", { name: /Call or text/ }).textContent).toContain("1-800-MY-RESET");
  const source = screen.getByRole("link", { name: "source" });
  expect(source.hasAttribute("data-inline-link")).toBe(true);
  expect(source.closest("p")).not.toBeNull();   // inside running text
  expect(container.querySelectorAll("a")).toHaveLength(3);
  expect(container.innerHTML).not.toMatch(/-my-/);
});
