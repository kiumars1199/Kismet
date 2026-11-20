// T-302 (docs/OVERHAUL.md §B, §G1, §G2): the plain-language Best bets card and page, in a real browser.
//
// Seven-slot rule, as checked here: on a card, every visible text node outside "Why this bet?" ([data-testid=why]) sits
// inside an element carrying data-slot, and a card has at most 7 distinct slots (title, side, chance, value, money,
// closes, bet). A text node counts as visible when its element has a non-zero box and is not visibility:hidden.
import { expect, test, type Page } from "@playwright/test";
import { bannedHits, readableText } from "../lib/banned";

type Probe = { id: string; venue: string; slots: string[]; loose: string[] };
const probe = (page: Page) =>
  page.locator("article[data-testid=bet-card]").evaluateAll((cards) =>
    cards.map((card) => {
      const slots = new Set<string>();
      const loose: string[] = [];
      const walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const t = n.textContent?.trim();
        const el = n.parentElement!;
        if (!t || el.closest("[data-testid=why]")) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") continue;
        const slot = el.closest("[data-slot]");
        if (slot) slots.add(slot.getAttribute("data-slot")!);
        else loose.push(t);
      }
      return { id: card.getAttribute("data-market-id")!, venue: card.getAttribute("data-venue")!, slots: [...slots], loose };
    }));

test("every card face: at most 7 slots, no loose text, 'Why this bet?' starts with the payout line", async ({ page }) => {
  for (const url of ["/", "/?us=0"]) {
    await page.goto(url);
    await expect(page.locator("article[data-testid=bet-card]").first()).toBeVisible();
    const cards: Probe[] = await probe(page);
    expect(cards.length).toBeGreaterThan(4);
    for (const c of cards) {
      expect(c.loose, `${url} ${c.id}`).toEqual([]);
      expect(c.slots.length, `${url} ${c.id}: ${c.slots}`).toBeLessThanOrEqual(7);
    }
  }
  const card = page.locator("article[data-testid=bet-card]").first();
  await expect(card.getByTestId("card-money")).toContainText(/^\$10 wins \$[\d,.]+/);
  await card.getByText("Why this bet?").click();
  const first = card.getByTestId("why").locator("p, dl").first();
  await expect(first).toHaveText(/^If it wins you get \$[\d,.]+ back \(\$10 \+ \$[\d,.]+\)$/);
  await expect(page.locator("main")).not.toContainText(/\bTo win\b/);
});

test("venue: a US quote gets 'Bet on Polymarket US' to its US link; us null gets no primary button", async ({ page, request }) => {
  const { rows } = await (await request.get("/api/flags?us=0&ps=200&g=0")).json();
  const us = new Map<string, { url: string } | null>(rows.map((r: { market: { id: string; us: { url: string } | null } }) => [r.market.id, r.market.us]));
  await page.goto("/?us=0&g=0&ps=50");
  await expect(page.locator("article[data-testid=bet-card]").first()).toBeVisible();
  const cards = await page.locator("article[data-testid=bet-card]").evaluateAll((els) => els.map((e) => ({
    id: e.getAttribute("data-market-id")!,
    venue: e.getAttribute("data-venue"),
    buttons: [...e.querySelectorAll("[data-testid=venue-button]")].map((b) => ({ href: b.getAttribute("href"), text: b.textContent?.trim() })),
    intlOnly: e.querySelector("[data-testid=intl-only]")?.textContent?.trim() ?? null,
  })));
  let onUs = 0, off = 0;
  for (const c of cards) {
    const q = us.get(c.id);
    if (q) {
      onUs++;
      expect(c.venue, c.id).toBe("us");
      expect(c.buttons, c.id).toEqual([{ href: q.url, text: "Bet on Polymarket US" }]);
      for (const b of c.buttons) expect(b.href, c.id).not.toMatch(/^https:\/\/(www\.)?polymarket\.com/);
    } else if (q === null) {
      off++;
      expect(c.venue, c.id).toBe("intl-only");
      expect(c.buttons, c.id).toEqual([]);
      expect(c.intlOnly, c.id).toBe("International only, not on Polymarket US");
    }
  }
  expect(onUs).toBeGreaterThan(0);
  expect(off).toBeGreaterThan(0);
  // the international link lives inside "Why this bet?", with the warning
  const intl = page.locator("article[data-venue=intl-only]").first();
  await intl.getByText("Why this bet?").click();
  await expect(intl.getByTestId("why-intl")).toContainText("Not available to US residents");
  await expect(intl.getByTestId("why-intl").getByRole("link", { name: "Open on international Polymarket" })).toHaveAttribute("href", /polymarket\.com/);
});

test("/bets reads plainly: no banned words, Today's top 5 then More bets", async ({ page, request }) => {
  for (const path of ["/bets", "/"]) {
    const html = await (await request.get(path)).text();
    expect(bannedHits(readableText(html)), path).toEqual([]);
  }
  await page.goto("/bets");
  const h2 = page.locator("main h2");
  await expect(h2.filter({ hasText: /^Today's top \d$/ })).toHaveCount(1);
  await expect(h2.filter({ hasText: /^More bets$/ })).toHaveCount(1);
  await expect(page.getByTestId("big-payouts")).toHaveCount(0);
  await expect(page.getByTestId("more-edge")).toHaveCount(0);
  // the filter sheet's words are not on the page until it opens
  expect(await page.locator("dialog[aria-label=Filters]").innerText()).not.toContain("Min price gap");
});

test("'On Polymarket US' is on by default; turning it off includes international bets", async ({ page, request }) => {
  const on = await (await request.get("/api/flags")).json();
  const off = await (await request.get("/api/flags?us=0")).json();
  expect(off.total).toBeGreaterThan(on.total);
  await page.goto("/");
  const chip = page.getByTestId("us-chip");
  await expect(chip).toHaveText("On Polymarket US");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`${on.total} bets`);
  for (const v of await page.locator("article[data-testid=bet-card]").evaluateAll((els) => els.map((e) => e.getAttribute("data-venue")))) expect(v).toBe("us");
  await chip.click();
  await expect(page).toHaveURL(/[?&]us=0/);
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`${off.total} bets`);
  // also in the filter sheet
  await page.getByRole("button", { name: /^More filters/ }).click();
  await expect(page.getByRole("dialog", { name: "Filters" }).getByRole("checkbox", { name: "On Polymarket US only" })).not.toBeChecked();
});

test("chip row: sports, Today / This week, Safer / Balanced / Bigger payouts land in the URL", async ({ page }) => {
  await page.goto("/");
  const row = page.getByRole("group", { name: "Quick filters" });
  for (const name of ["Today", "This week", "Safer", "Balanced", "Bigger payouts", "More sports"]) await expect(row.getByRole("button", { name, exact: true })).toBeVisible();
  // sports with best bets under the other filters, biggest first (a sport with none left drops off the row)
  await row.getByRole("button", { name: "Soccer", exact: true }).click();
  await expect(page).toHaveURL(/t=sports\.soccer/);
  await expect(row.getByRole("button", { name: "Soccer", exact: true })).toHaveAttribute("aria-pressed", "true");
  await row.getByRole("button", { name: "Safer", exact: true }).click();
  await expect(page).toHaveURL(/wp=0\.85/);
  await expect(row.getByRole("button", { name: "Safer", exact: true })).toHaveAttribute("aria-pressed", "true");
  await row.getByRole("button", { name: "Bigger payouts", exact: true }).click();
  await expect(page).toHaveURL(/wp1=0\.7/);
  await expect(page).not.toHaveURL(/[?&]wp=/);
  await row.getByRole("button", { name: "This week", exact: true }).click();
  await expect(page).toHaveURL(/cw=/);
  // a pressed chip hides its own pill; it stays pressed after a reload (the window is matched with a tolerance)
  await expect(page.getByLabel("Applied filters").getByRole("button", { name: /Closes|Chance|Soccer/ })).toHaveCount(0);
  await page.reload();
  await expect(row.getByRole("button", { name: "This week", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(row.getByRole("button", { name: "Bigger payouts", exact: true })).toHaveAttribute("aria-pressed", "true");
  await row.getByRole("button", { name: "More sports" }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
});

test("a filter set outside the chips keeps its removable pill", async ({ page }) => {
  await page.goto("/?wp=0.6");
  const row = page.getByRole("group", { name: "Quick filters" });
  for (const name of ["Safer", "Balanced", "Bigger payouts"]) await expect(row.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /^Remove filter: Chance ≥ 60/ })).toBeVisible();
});

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`tap targets at ${w}px: chips and controls 44px, bet button 48px full width on phones`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await expect(page.locator("article[data-testid=bet-card]").first()).toBeVisible();
    const small = await page.evaluate(() => {
      const sel = [
        "[aria-label='Quick filters'] button", "article[data-testid=bet-card] h3 a", "article[data-testid=bet-card] summary",
        "[data-testid=venue-button]", "[aria-label='Applied filters'] button",
      ].join(",");
      return [...document.querySelectorAll<HTMLElement>(sel)]
        .map((e) => ({ t: (e.textContent ?? "").trim().slice(0, 40), h: e.getBoundingClientRect().height }))
        .filter((x) => x.h > 0 && x.h < 44);
    });
    expect(small).toEqual([]);
    if (w < 640) {
      const card = page.locator("article[data-testid=bet-card]").first();
      const [btn, box] = [await card.getByTestId("venue-button").boundingBox(), await card.boundingBox()];
      expect(btn!.height).toBeGreaterThanOrEqual(48);
      expect(btn!.width).toBeGreaterThan(box!.width - 40);   // full width inside the card's padding
    }
  });
}
