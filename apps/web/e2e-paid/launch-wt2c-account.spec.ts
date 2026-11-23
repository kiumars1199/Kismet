// T-wt2c (walk-through 2): /account names how you signed in (email link and email + password), shows one help line (the pause card's;
// the footer keeps the disclaimer), the pause Cancel is a 44 px target 12 px from the pause button, the small tap targets at 390 are
// 44 px, and the drawer has "Check this bet" for a Free account. Supabase is the in-app mock.
import { expect, test, type Page } from "./fixtures";

const DISCLAIMER = "Market analytics, not financial advice. Based on past results. 18+.";

async function openAccountPage(page: Page) {
  await page.goto("/account");
  await expect(page.getByTestId("pause-card")).toBeVisible({ timeout: 60_000 });
}

async function linkSignIn(page: Page, email: string, skipOnboarding = true) {
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
  if (!skipOnboarding) { await expect(page).toHaveURL(/\/onboarding/, { timeout: 60_000 }); return; }
  await expect(async () => {
    if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}

const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;

test("Free, signed in by email link: /account names the method, one help line, pause Cancel is a safe target, small links are 44 px", async ({ page }) => {
  test.setTimeout(400_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2c-${Date.now()}` });
  await linkSignIn(page, `wt2c-${Date.now()}@example.com`);

  // 3: the method, not "Google or an email link"
  await expect(page.locator("#acct-h + p")).toContainText("with an email link");
  await expect(page.locator("#acct-h + p")).not.toContainText("Google");
  // 4: one help line on /account (the pause card's); the footer still shows the disclaimer
  await expect(page.getByTestId("helpline")).toHaveCount(1);
  await expect(page.getByTestId("pause-card").getByTestId("helpline")).toBeVisible();
  await expect(page.locator("footer")).toContainText(DISCLAIMER);

  // 1: Cancel is at least 44 px and 12 px (>= 8) from the pause button, at 390 and 1440
  for (const [w, h] of [[390, 844], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await openAccountPage(page);
    await page.getByTestId("pause-24h").click();
    const [ok, cancel] = [await box(page, '[data-testid="pause-confirm"]'), await box(page, '[data-testid="pause-cancel"]')];
    expect(cancel.height, `Cancel height at ${w}`).toBeGreaterThanOrEqual(44);
    expect(cancel.width, `Cancel width at ${w}`).toBeGreaterThanOrEqual(44);
    const sameRow = Math.abs(ok.y - cancel.y) < 20;
    const gap = sameRow ? cancel.x - (ok.x + ok.width) : cancel.y - (ok.y + ok.height);
    console.log(`pause buttons at ${w}: Cancel ${Math.round(cancel.width)}x${Math.round(cancel.height)}, gap ${Math.round(gap)} px`);
    expect(gap).toBeGreaterThanOrEqual(8);
    await page.getByTestId("pause-cancel").click();
    await expect(page.getByTestId("pause-confirm")).toHaveCount(0);   // cancel really cancels; nothing was paused
  }

  // the Free upsell link on the Best bets list
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bets");
  const up = page.getByTestId("log-bet-upgrade").getByRole("link");
  await expect(up).toBeVisible({ timeout: 60_000 });
  const u = (await up.boundingBox())!;
  expect(u.height).toBeGreaterThanOrEqual(44);
  expect(u.width).toBeGreaterThanOrEqual(44);

  // 5 + drawer links for a Free account
  const id = ((await (await page.request.get("/api/markets?limit=5")).json()) as { rows: { market: { id: string } }[] }).rows[0]!.market.id;
  await page.goto(`/markets?m=${id}&side=0`);
  const dlg = page.getByRole("dialog", { name: "Market details" });
  await expect(dlg).toBeVisible({ timeout: 60_000 });
  await expect(dlg.getByTestId("check-this-bet")).toBeVisible({ timeout: 60_000 });   // the drawer fills in after its data loads
  await expect(dlg.getByTestId("check-this-bet")).toHaveAttribute("href", `/check?m=${id}&side=0`);
  for (const name of ["See plans", "Why two numbers?", "Settings"]) {
    const l = dlg.getByRole("link", { name, exact: true });
    if (!(await l.count())) continue;
    await l.first().scrollIntoViewIfNeeded();
    const r = (await l.first().boundingBox())!;
    expect(r.height, `${name} height`).toBeGreaterThanOrEqual(44);
    expect(r.width, `${name} width`).toBeGreaterThanOrEqual(44);
  }
});

test("a new account's onboarding Back is a 44 px target at 390", async ({ page }) => {
  test.setTimeout(240_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2c-ob-${Date.now()}` });
  await page.setViewportSize({ width: 390, height: 844 });
  await linkSignIn(page, `wt2c-ob-${Date.now()}@example.com`, false);
  await page.getByRole("button", { name: "Next" }).click();
  const back = page.getByRole("button", { name: "Back", exact: true });
  await expect(back).toBeVisible();
  const b = (await back.boundingBox())!;
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(b.width).toBeGreaterThanOrEqual(44);
});

test("email + password account: /account says 'with your email and password'", async ({ page }) => {
  test.setTimeout(300_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2c-pw-${Date.now()}` });
  const email = `wt2c-pw-${Date.now()}@example.com`;
  const PASS = "first password 1";
  const open = async (path: string) => { await page.goto(path); await page.waitForLoadState("networkidle"); await expect(page.getByRole("tab", { name: "Password" })).toHaveAttribute("aria-selected", "true"); };
  const fill = async () => {
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill(PASS);
    await page.getByRole("checkbox").check();
  };
  await open("/signup?next=/account");
  await fill();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await expect(async () => {
    if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
  await expect(page.locator("#acct-h + p")).toContainText("with an email link");   // the confirmation link started this session
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect.poll(async () => ((await (await page.request.get("/api/me")).json()) as { user: unknown }).user).toBeNull();

  await open("/login?next=/account");
  await fill();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 60_000 });
  await expect(page.locator("#acct-h + p")).toContainText("with your email and password");
  await expect(page.locator("#acct-h + p")).not.toContainText("email link");
});
