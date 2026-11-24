// T-wt2j: the topic picker keeps every quick tap. The browser's profile save (PATCH /api/data/profile) is held back 300 ms, as a
// real Supabase round trip would be. Three taps back to back must show chosen at once, and once the saves settle the server's
// profile (the mock database, read with the service role) and the me_topics cookie hold exactly the tapped set.
// Onboarding: NFL, College football, NBA. Settings: starting from [NBA], add College basketball, Soccer, NFL.
import path from "node:path";
import { expect, test, type Page } from "./fixtures";

const SHOTS = path.resolve(process.cwd(), "../../docs/launch/review/wt2j");   // repo-relative: <repo>/docs/launch/review/wt2j
const SIZES = [{ w: 390, h: 844 }, { w: 1440, h: 900 }];
const SERVICE = { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" };

async function signUp(page: Page, email: string) {
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
}

const userId = async (page: Page) => (await (await page.request.get("/api/me")).json()).user.id as string;
const serverTopics = async (page: Page, id: string) => {
  const rows = await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${id}&select=favorite_topics`, { headers: SERVICE })).json();
  return ((rows[0]?.favorite_topics ?? []) as string[]).slice().sort();
};
const cookieTopics = async (page: Page) => {
  const v = (await page.context().cookies()).find((c) => c.name === "me_topics")?.value ?? "";
  return decodeURIComponent(v).split(":")[1]?.split(",").filter(Boolean).sort() ?? [];
};

/** Hold every browser profile save for 300 ms; count them. */
async function slowSaves(page: Page) {
  const seen: string[][] = [];
  await page.route("**/api/data/profile", async (route) => {
    if (route.request().method() === "PATCH") {
      seen.push((route.request().postDataJSON() as { favorite_topics?: string[] }).favorite_topics ?? []);
      await new Promise((r) => setTimeout(r, 300));
    }
    await route.continue();
  });
  return seen;
}

/** Tap the tiles back to back in one task (no gap between taps), then read each tile before any save could have answered. */
async function tapQuickly(page: Page, names: string[]) {
  return page.evaluate(async (ns) => {
    const tiles = ns.map((n) => [...document.querySelectorAll<HTMLButtonElement>('[data-testid="topics-picker"] button')].find((b) => b.textContent?.startsWith(n))!);
    for (const t of tiles) t.click();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return tiles.map((t) => t.getAttribute("aria-pressed"));
  }, names);
}

async function settle(page: Page, expected: string[]) {
  await expect(async () => {
    const id = await userId(page);
    expect(await serverTopics(page, id)).toEqual(expected);
  }).toPass({ timeout: 20_000 });
}

for (const { w, h } of SIZES) {
  test(`onboarding at ${w}px: NFL, College football, NBA tapped back to back all save`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    const saves = await slowSaves(page);
    await signUp(page, `wt2j-onb-${w}-${Date.now()}@example.com`);
    await expect(page.getByRole("button", { name: "NFL", exact: true })).toContainText("open", { timeout: 60_000 });
    await expect(page.getByTestId("topics-picker")).toHaveAttribute("aria-busy", "false");
    await page.waitForTimeout(500);   // once the page has settled, as the reviewer's repro did
    expect(await tapQuickly(page, ["NFL", "College football", "NBA"])).toEqual(["true", "true", "true"]);   // shown chosen before the first save answers
    await page.screenshot({ path: `${SHOTS}/${w}-onboarding-tapped.png` });
    await settle(page, ["sports.cfb", "sports.nba", "sports.nfl"]);
    await expect.poll(() => cookieTopics(page), { timeout: 10_000 }).toEqual(["sports.cfb", "sports.nba", "sports.nfl"]);   // the cookie rides the last save's answer
    for (const n of ["NFL", "College football", "NBA"]) await expect(page.getByRole("button", { name: n, exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(saves.at(-1)!.slice().sort()).toEqual(["sports.cfb", "sports.nba", "sports.nfl"]);   // the last write carried the whole set
    await page.screenshot({ path: `${SHOTS}/${w}-onboarding-settled.png` });
  });

  test(`settings at ${w}px: from NBA, College basketball + Soccer + NFL tapped back to back all save`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt2j-set-${w}-${Date.now()}@example.com`);
    const id = await userId(page);
    await page.request.patch(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${id}`, { headers: SERVICE, data: { favorite_topics: ["sports.nba"] } });
    await page.goto("/settings");
    const nba = page.getByRole("button", { name: "NBA", exact: true });
    await expect(nba).toHaveAttribute("aria-pressed", "true", { timeout: 60_000 });
    await expect(page.getByTestId("topics-picker")).toHaveAttribute("aria-busy", "false");
    await page.getByRole("button", { name: "NFL", exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const saves = await slowSaves(page);
    expect(await tapQuickly(page, ["College basketball", "Soccer", "NFL"])).toEqual(["true", "true", "true"]);
    await expect(nba).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: `${SHOTS}/${w}-settings-tapped.png` });
    const want = ["sports.nba", "sports.ncaab", "sports.nfl", "sports.soccer"];
    await settle(page, want);
    await expect.poll(() => cookieTopics(page), { timeout: 10_000 }).toEqual(want);   // the cookie rides the last save's answer
    expect(saves.at(-1)!.slice().sort()).toEqual(want);
    await page.reload();
    for (const n of ["NBA", "College basketball", "Soccer", "NFL"]) await expect(page.getByRole("button", { name: n, exact: true })).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/${w}-settings-settled.png` });
  });
}
