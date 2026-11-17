// Lane U (docs/17): axe over every page, plus the drawer. Zero serious or critical violations (WCAG 2.1 A/AA).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const STATIC = [
  "/", "/markets", "/about", "/pricing", "/login", "/onboarding", "/account", "/watchlist", "/journal", "/alerts",
  "/dashboards", "/settings", "/tools", "/track-record", "/status", "/terms", "/privacy", "/refunds", "/disclaimer",
  "/contact", "/ext/connect", "/no-such-page",
];

async function serious(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

async function check(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  // the page's own footer disclaimer is on every page (CLAUDE.md rule 5)
  await expect(page.getByRole("contentinfo")).toContainText("Market analytics, not financial advice. Based on past results. 18+.");
  expect(await serious(page), path).toEqual([]);
}

test.describe.configure({ mode: "parallel" });

for (const path of STATIC) test(`axe ${path}`, async ({ page }) => check(page, path));

test("axe /event, /m and the open drawer", async ({ page, request }) => {
  const { rows } = await (await request.get("/api/flags?ps=1")).json();
  const m = rows[0].market;
  await check(page, `/event/${m.event_id}`);
  await check(page, `/m/${m.id}`);
  await check(page, `/?m=${m.id}&side=${rows[0].side.side_index}`);
  await expect(page.getByRole("dialog")).toBeVisible();
});
