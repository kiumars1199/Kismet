// F8: pause the account for 24 h -> every app page shows only the pause screen, data routes answer 423, and the end
// time is shown in the user's time zone. Supabase is the in-app mock.
import { expect, test, type Page } from "./fixtures";

test.use({ timezoneId: "Asia/Tokyo" });

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

const norm = (s: string) => s.replace(/[\s\u202f\u00a0]+/g, " ").trim();
const fmt = (iso: string, timeZone: string) =>
  norm(new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }));

test("pause 24 h: pause screen on every app page, 423 on data routes, end time in the user's zone", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, `pause-${Date.now()}@example.com`);

  // not paused yet: data answers, and the help line is on /account
  expect((await page.request.get("/api/markets?limit=1")).status()).toBe(200);
  await expect(page.getByTestId("pause-card").getByTestId("helpline")).toContainText("1-800-MY-RESET");

  await page.getByTestId("pause-24h").click();
  await page.getByTestId("pause-confirm").click();
  await expect(page.getByTestId("pause-screen")).toBeVisible({ timeout: 30_000 });

  const until = ((await (await page.request.get("/api/me")).json()) as { paused_until: string }).paused_until;
  const ms = Date.parse(until) - Date.now();
  expect(ms).toBeGreaterThan(23 * 3_600_000);
  expect(ms).toBeLessThanOrEqual(24 * 3_600_000);

  for (const path of ["/", "/bets", "/markets", "/account", "/settings"]) {
    await page.goto(path);
    await expect(page.getByTestId("pause-screen"), path).toBeVisible();
    await expect(page.getByRole("link", { name: "Best bets" }), `${path}: no app nav`).toHaveCount(0);
  }

  // end time in the user's zone (Tokyo), not UTC
  await expect(page.getByTestId("pause-until")).toHaveText(new RegExp(fmt(until, "Asia/Tokyo").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s\\u202f\\u00a0]")));
  expect(fmt(until, "Asia/Tokyo")).not.toBe(fmt(until, "UTC"));

  // data routes: 423 with the end time
  for (const path of ["/api/markets?limit=1", "/api/flags", "/api/model/curve"]) {
    const res = await page.request.get(path);
    expect(res.status(), path).toBe(423);
    expect(await res.json()).toMatchObject({ code: "paused", until });
  }

  // a second, shorter request can't shorten it (no pause card to click: the API refuses to shorten)
  const again = await page.request.post("/api/account/pause", { data: { length: "24h" }, headers: { origin: new URL(page.url()).origin } });
  expect(again.ok()).toBe(true);
  expect(((await again.json()) as { paused_until: string }).paused_until >= until).toBe(true);

  // the pause can't be set to anything else
  const bad = await page.request.post("/api/account/pause", { data: { length: "1h" }, headers: { origin: new URL(page.url()).origin } });
  expect(bad.status()).toBe(400);
});
