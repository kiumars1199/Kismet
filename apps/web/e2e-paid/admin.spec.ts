// Admin dashboard (T-141/T-142): an ADMIN_EMAILS address sees /admin and flips the site-wide banner; a normal
// user and an anonymous visitor get a 404 on every admin page and API route. Supabase/Stripe are the in-app mock.
import { expect, test, type Page } from "@playwright/test";

const ADMIN = "admin-e2e@example.com";   // playwright.paid.config.ts ADMIN_EMAILS
const PAGES = ["/admin", "/admin/users", "/admin/settings", "/admin/health", "/admin/audit", "/admin/users/00000000-0000-0000-0000-000000000000"];

async function signIn(page: Page, email: string) {
  await page.goto("/login?next=/account");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await expect(async () => {
    await page.getByRole("button", { name: "Skip setup" }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

async function expectNoAdmin(page: Page) {
  for (const p of PAGES) expect((await page.goto(p))?.status(), p).toBe(404);
  const origin = new URL(page.url()).origin;
  const post = await page.request.post("/api/admin", { data: { action: "settings", patch: { banner_on: true } }, headers: { origin } });
  expect(post.status(), "POST /api/admin").toBe(404);
  expect((await page.request.get("/api/admin/export")).status(), "GET /api/admin/export").toBe(404);
  expect((await page.request.get("/api/me")).ok()).toBe(true);
  expect((await (await page.request.get("/api/me")).json()).admin).toBeFalsy();
}

test("admin: sees /admin with a user count, flips the banner and everyone sees it", async ({ page, browser }) => {
  await signIn(page, ADMIN);
  await expect(page.getByRole("link", { name: "Admin panel" })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
  await expect(page.getByTestId("admin-users-total")).toHaveText(/^[1-9][\d,]*$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("Market analytics, not financial advice. Based on past results. 18+.")).toBeVisible();

  const text = `Scheduled upgrade ${Date.now()}`;
  await page.goto("/admin/settings");
  await page.getByRole("switch", { name: "Show announcement banner" }).click();
  await page.getByLabel("Banner text").fill(text);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.goto("/pricing");
  await expect(page.getByTestId("site-banner")).toHaveText(text);
  const anon = await browser.newContext();
  const other = await anon.newPage();
  await other.goto("/");
  await expect(other.getByTestId("site-banner")).toHaveText(text);
  await anon.close();

  await page.goto("/admin/audit");
  await expect(page.getByTestId("audit-log")).toContainText("settings.update");

  // turn it off again so other specs see the default site
  await page.goto("/admin/settings");
  await page.getByRole("switch", { name: "Show announcement banner" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await page.goto("/pricing");
  await expect(page.getByTestId("site-banner")).toHaveCount(0);
});

test("normal user and anonymous visitor: 404 on every admin page and API route, no Admin link", async ({ page, browser }) => {
  await signIn(page, `user-${Date.now()}@example.com`);
  await expect(page.getByRole("link", { name: "Admin panel" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  await expectNoAdmin(page);

  const ctx = await browser.newContext();
  const anon = await ctx.newPage();
  await anon.goto("/");
  await expectNoAdmin(anon);
  await ctx.close();
});
