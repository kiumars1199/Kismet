// T-wt2k: follow-ups to T-wt2i. (1) Tab and Shift+Tab through the quick chips at 390, 1100 and 1280: every focused chip is fully visible and
// clear of the pinned chips. (2) Below 1280 the column menu closes when its button leaves the viewport (it stayed pinned at top 68 px).
// (3) Tab or Shift+Tab out of the menu closes it and returns focus to its button.
import { expect, test, type Page } from "./fixtures";

async function signUpWithTopics(page: Page, email: string, topics: RegExp[]) {
  await page.goto("/login");
  await expect(async () => {
    await page.getByRole("tab", { name: "Email link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
  for (const t of topics) {   // one at a time, each confirmed (see launch-wt2i)
    const b = page.getByRole("button", { name: t });
    await expect(async () => {
      if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
      await expect(b).toHaveAttribute("aria-pressed", "true", { timeout: 1_500 });
    }).toPass({ timeout: 30_000 });
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/bets", { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
}
const THREE = [/^NFL/, /^Soccer/, /^College basketball/];

/** The focused chip inside the quick-chips row: its rect against the row and the pinned chips. */
const focusedChip = (page: Page) => page.evaluate(() => {
  const row = document.querySelectorAll('[aria-label="Quick filters"]')[1] as HTMLElement;
  const a = document.activeElement as HTMLElement | null;
  if (!a || !row.contains(a)) return null;
  const r = a.getBoundingClientRect(), rr = row.getBoundingClientRect();
  const pin = [...row.querySelectorAll("button")].find((x) => x.textContent === "+ Save this view");
  const pinnedLeft = pin && getComputedStyle(pin.parentElement!).position === "sticky" ? pin.getBoundingClientRect().left : rr.right;
  const pinned = !!pin && pin.parentElement!.contains(a);
  return { text: (a.textContent ?? "").trim(), left: r.left, right: r.right, width: r.width, rowLeft: rr.left, rowRight: rr.right, pinnedLeft, pinned };
});

for (const w of [390, 1100, 1280]) {
  test(`Tab and Shift+Tab through the quick chips at ${w}px: every focused chip is fully visible and clear of the pinned chips`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: 800 });
    await signUpWithTopics(page, `wt2k-chips-${w}-${Date.now()}@example.com`, THREE);
    await page.goto("/markets?q=texans", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "All markets" })).toBeVisible();
    await page.waitForTimeout(1_500);
    const check = async (dir: string) => {
      const f = (await focusedChip(page))!;
      expect(f, `${dir}: focus is in the chips row`).not.toBeNull();
      const lo = f.rowLeft + (w < 768 ? 0 : 0), hi = f.pinned ? f.rowRight : f.pinnedLeft;
      const seen = Math.max(0, Math.min(f.right, hi) - Math.max(f.left, lo));
      expect(seen, `${dir}: "${f.text}" is fully visible (${Math.round(seen)} of ${Math.round(f.width)} px)`).toBeGreaterThanOrEqual(f.width - 1);
      return f.text;
    };
    await page.locator('[aria-label="Quick filters"]').nth(1).getByRole("button").first().focus();
    const forward: string[] = [await check("start")];
    for (let i = 0; i < 20 && forward.at(-1) !== "Saved views"; i++) { await page.keyboard.press("Tab"); forward.push(await check("Tab")); }
    expect(forward.at(-1), "Tab reached the end of the row").toBe("Saved views");
    expect(forward.length, "many chips were visited").toBeGreaterThan(8);
    for (let i = 0; i < 20 && (await focusedChip(page))?.text !== forward[0]; i++) { await page.keyboard.press("Shift+Tab"); await check("Shift+Tab"); }
    expect((await focusedChip(page))?.text).toBe(forward[0]);
  });
}

for (const { w, h } of [{ w: 1100, h: 800 }, { w: 1024, h: 600 }]) {
  test(`column menu at ${w}x${h}: closes when its button scrolls out of the viewport`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: h });
    await signUpWithTopics(page, `wt2k-leave-${w}-${Date.now()}@example.com`, []);
    await page.goto("/markets", { waitUntil: "networkidle" });
    await expect(page.locator("tbody tr[data-row]").first()).toBeVisible({ timeout: 30_000 });
    const choose = page.getByTitle("Choose columns");
    await choose.click();
    const panel = page.getByTestId("column-menu");
    await expect(panel).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect.poll(() => page.evaluate(() => window.scrollY), { message: "the page scrolled" }).toBeGreaterThan(500);
    const gone = await choose.evaluate((e) => { const r = e.getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight; });
    expect(gone, "the button is out of the viewport at this width (the header is not sticky here)").toBe(true);
    await expect(panel, "the menu does not stay behind at the top of the screen").toBeHidden();
  });
}

// T-wt2l: below xl the table header is not sticky, so the button scrolls up behind the 64 px top bar. Once its bottom is at or above the bar's
// bottom it is hidden (an open menu would be left pinned under it): the menu closes. While part of the button is still visible it stays.
for (const { w, h } of [{ w: 1100, h: 800 }, { w: 1024, h: 600 }]) {
  test(`column menu at ${w}x${h}: closes when its button is hidden behind the top bar, stays while part of it shows`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: h });
    await signUpWithTopics(page, `wt2l-bar-${w}-${Date.now()}@example.com`, []);
    await page.goto("/markets", { waitUntil: "networkidle" });
    await expect(page.locator("tbody tr[data-row]").first()).toBeVisible({ timeout: 30_000 });
    const choose = page.getByTitle("Choose columns");
    const panel = page.getByTestId("column-menu");
    const topAbs = await choose.evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
    for (const [btnTop, open] of [[100, true], [40, true], [10, false], [-20, false], [-44, false]] as const) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await choose.click();
      await expect(panel).toBeVisible();
      await page.evaluate((y) => window.scrollTo(0, y), topAbs - btnTop);
      await expect.poll(() => choose.evaluate((e) => Math.round(e.getBoundingClientRect().top)), { message: `button top at ${btnTop}` }).toBe(btnTop);
      await page.waitForTimeout(300);   // a frame or two for the measure
      if (open) await expect(panel, `button top ${btnTop}: part of it shows below the top bar, the menu stays`).toBeVisible();
      else await expect(panel, `button top ${btnTop}: hidden behind the top bar, the menu closes`).toBeHidden();
      await page.keyboard.press("Escape");
    }
  });
}

test("column menu: Tab past the last checkbox, or Shift+Tab from the first, closes it and returns focus to its button", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUpWithTopics(page, `wt2k-tab-${Date.now()}@example.com`, []);
  await page.goto("/markets", { waitUntil: "networkidle" });
  await expect(page.locator("tbody tr[data-row]").first()).toBeVisible({ timeout: 30_000 });
  const choose = page.getByTitle("Choose columns");
  const panel = page.getByTestId("column-menu");
  const boxes = panel.locator("input[type=checkbox]");
  for (const [name, edge, key] of [["last", "last", "Tab"], ["first", "first", "Shift+Tab"]] as const) {
    await choose.click();
    await expect(panel).toBeVisible();
    await (edge === "last" ? boxes.last() : boxes.first()).focus();
    await page.keyboard.press(key);
    await expect(panel, `${key} from the ${name} checkbox closes the menu`).toBeHidden();
    await expect(choose, "focus returns to the button").toBeFocused();
  }
  // clicking inside the menu (on its padding or a label) must not close it
  await choose.click();
  await panel.click({ position: { x: 4, y: 4 } });
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(choose).toBeFocused();
});

// Item 4: /markets with N saved topics (1, 3, 6, all) loads without the page moving (CLS <= 0.02). The favorite chips are added to the quick-chips
// row after the profile lands; with 6 the row used to wrap to a second line and push the table down 52 px (CLS 0.27 at 1440).
const installCls = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __cls: number; __src: string[] };
  w.__cls = 0; w.__src = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: { node: Element | null; previousRect: DOMRect; currentRect: DOMRect }[] }[]) if (!e.hadRecentInput) {
      w.__cls += e.value;
      for (const x of e.sources.slice(0, 3)) w.__src.push(`${e.value.toFixed(3)} ${x.node?.tagName}.${String((x.node as HTMLElement | null)?.className ?? "").slice(0, 30)} y ${Math.round(x.previousRect.y)}->${Math.round(x.currentRect.y)} x ${Math.round(x.previousRect.x)}->${Math.round(x.currentRect.x)}`);
    }
  }).observe({ type: "layout-shift", buffered: true });
});
async function signUpWithN(page: Page, email: string, n: number | "all") {
  await page.goto("/login");
  await expect(async () => {
    await page.getByRole("tab", { name: "Email link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
  const topics = page.locator("button[aria-pressed][aria-describedby]");   // the topic buttons (TopicsPicker)
  await expect(topics.first()).toBeVisible({ timeout: 30_000 });
  const total = await topics.count();
  const want = n === "all" ? total : n;
  for (let i = 0; i < want; i++) {
    const b = topics.nth(i);
    await expect(async () => {
      if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
      await expect(b).toHaveAttribute("aria-pressed", "true", { timeout: 1_500 });
    }).toPass({ timeout: 30_000 });
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/bets", { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  return want;
}
for (const w of [390, 1100, 1440]) {
  for (const [n, url] of ([1, 3, 6, "all"] as const).flatMap((n) => ["/markets?q=texans", "/markets"].map((u) => [n, u] as const))) {
    test(`${url} at ${w}px with ${n} saved topic${n === 1 ? "" : "s"}: CLS <= 0.02`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.setViewportSize({ width: w, height: 800 });
      const saved = await signUpWithN(page, `wt2k-cls-${w}-${n}-${url.length}-${Date.now()}@example.com`, n);
      await installCls(page);
      await page.goto(url, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { level: 1, name: "All markets" })).toBeVisible();
      await page.waitForTimeout(2_500);
      const v = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      console.log(`CLS ${url} at ${w}px with ${saved} saved topics: ${v.toFixed(4)}`);
      if (v > 0.02) console.log(await page.evaluate(() => (window as unknown as { __src: string[] }).__src.join("\n")));
      expect(v).toBeLessThanOrEqual(0.02);
    });
  }
}
