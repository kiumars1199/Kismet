// T-wt2d: the signed-out /m/<id> teaser offers "Check this bet" beside "Add to combo checker", in the same row, so the first view doesn't move.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TeaserView } from "./Teaser";

const t = { kind: "market" as const, id: "6674492", title: "Denmark vs. Norway: O/U 2.5", category: "Sports", closes_at: 1795372009, price: 0.5, price_outcome: "Over" };

describe("TeaserView", () => {
  const html = renderToStaticMarkup(<TeaserView t={t} path="/m/6674492" />);
  it("links Check this bet to /check?m=<id>&side=0 and keeps Add to combo checker", () => {
    expect(html).toMatch(/<a[^>]*href="\/check\?m=6674492&amp;side=0"[^>]*>Check this bet<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/check\/combo\?m=6674492"[^>]*>Add to combo checker<\/a>/);
  });
  it("puts both in one row (one wrapper), so no extra line is added to the card", () => {
    const row = html.match(/<div[^>]*data-testid="teaser-checks"[^>]*>(.*?)<\/div>/s)![1]!;
    expect(row).toContain("Check this bet");
    expect(row).toContain("Add to combo checker");
  });
  it("an event teaser has neither", () => {
    const e = renderToStaticMarkup(<TeaserView t={{ ...t, kind: "event" }} path="/event/1" />);
    expect(e).not.toContain("Check this bet");
  });
});
