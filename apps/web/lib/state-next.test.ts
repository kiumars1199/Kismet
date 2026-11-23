// StateLink's ?next=: the prerendered home reports usePathname() "/index" on the server, so Back from /state went to /index.
import { describe, expect, it } from "vitest";
import { stateHref, stateNext } from "./state-next";

describe("stateNext", () => {
  it('maps the prerendered home "/index" to "/"', () => expect(stateNext("/index")).toBe("/"));
  it("keeps real paths", () => {
    expect(stateNext("/bets")).toBe("/bets");
    expect(stateNext("/")).toBe("/");
  });
  it('leaves "/index/x" and look-alikes untouched', () => {
    expect(stateNext("/index/x")).toBe("/index/x");
    expect(stateNext("/indexes")).toBe("/indexes");
  });
});

describe("stateHref", () => {
  it("encodes next, using / for the prerendered home", () => {
    expect(stateHref("/index")).toBe("/state?next=%2F");
    expect(stateHref("/bets")).toBe("/state?next=%2Fbets");
  });
  it("has no next on /state itself or with no path", () => {
    expect(stateHref("/state")).toBe("/state");
    expect(stateHref(null)).toBe("/state");
  });
});
