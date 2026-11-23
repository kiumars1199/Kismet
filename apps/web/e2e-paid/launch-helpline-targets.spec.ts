// Help line hit areas (#85 review): every link in every help line is really tappable. Two actions are their own row of
// buttons (>= 44 x 44, no overlapping boxes); "source" is a plain inline link in the sentence (WCAG 2.5.8 inline
// exception, centre point only). For each link, elementFromPoint at the centre and 2 px inside each corner of its box
// must return the link or a descendant. Footer (/pricing, signed out) and /account (pause card), at 390 and 1440.
import { expect, test, type Page } from "./fixtures";

async function signIn(page: Page, email: string) {
  await page.goto("/login?next=/account");
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
  await expect(async () => {
    if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}

async function checkHelpLines(page: Page) {
  const helps = page.getByTestId("helpline");
  const n = await helps.count();
  expect(n).toBeGreaterThan(0);
  for (let h = 0; h < n; h++) {
    const links = helps.nth(h).getByRole("link");
    expect(await links.count(), "call, chat, source").toBe(3);
    for (const l of await links.all()) {
      await l.evaluate((el) => el.scrollIntoView({ block: "center" }));
      const info = await l.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const inline = el.hasAttribute("data-inline-link");
        const pts = inline ? [[r.x + r.width / 2, r.y + r.height / 2]] : [
          [r.x + r.width / 2, r.y + r.height / 2], [r.x + 2, r.y + 2], [r.right - 2, r.y + 2], [r.x + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]];
        const misses = pts.filter(([x, y]) => { const t = document.elementFromPoint(x!, y!); return !t || !el.contains(t); }).length;
        return { inline, w: r.width, h: r.height, misses, name: (el.textContent ?? "").trim() };
      });
      expect(info.misses, `${info.name}: points that hit something else`).toBe(0);
      if (!info.inline) {
        expect(info.w, `${info.name} width`).toBeGreaterThanOrEqual(44);
        expect(info.h, `${info.name} height`).toBeGreaterThanOrEqual(44);
      } else expect(info.name).toBe("source");
    }
  }
}

for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`help line links hit-test as 44 x 44 buttons (source: inline) at ${size.width}: footer and /account`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(size);
    await page.goto("/pricing");
    await checkHelpLines(page);
    await signIn(page, `helpline-${size.width}-${Date.now()}@example.com`);
    await expect(page.getByTestId("pause-card").getByTestId("helpline")).toBeVisible();
    await checkHelpLines(page);
  });
}
