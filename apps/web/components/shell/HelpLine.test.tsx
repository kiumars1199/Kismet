// @vitest-environment jsdom
// #80 note: the "source" link keeps its 44 x 44 tap target but its text starts at the left edge, so no gap shows before the comma.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HelpLine } from "./HelpLine";
afterEach(cleanup);

it("source link: >=44 x 44 target, text left-aligned; the phone and chat links stay centered", () => {
  render(<HelpLine />);
  const source = screen.getByRole("link", { name: "source" });
  expect(source.className).toContain("min-h-11");
  expect(source.className).toContain("min-w-11");
  expect(source.className).toContain("justify-start");
  // the comma sits inside the 44 px box right after the word (not underlined), so the spare width falls after the comma, not before it
  expect(source.textContent).toBe("source,");
  expect(source.querySelector("span")!.textContent).toBe("source");
  expect(source.className).not.toContain("justify-center");
  expect(screen.getByRole("link", { name: "chat online" }).className).toContain("justify-center");
});
