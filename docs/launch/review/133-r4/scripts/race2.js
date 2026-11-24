const L = require("./lib");
const [w, h] = process.argv[2].split("x").map(Number); const gap = +(process.argv[3] || 0);
(async () => {
  const { browser, page } = await L.start(w, h, "race2");
  const email = `p132-race2-${w}-${gap}-${Date.now()}@example.com`;
  await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(1500);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 132");
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 });
  const me = await (await page.request.get("/api/me")).json();
  const server = async () => (await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}&select=favorite_topics`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service" } })).json())[0].favorite_topics;
  const picker = page.getByTestId("topics-picker");
  const tile = (n) => picker.getByRole("button", { name: new RegExp("^" + n + "\\b") }).first();
  const clickAll = async (names) => { for (const n of names) { await tile(n).click({ timeout: 5000 }); if (gap) await page.waitForTimeout(gap); } };
  await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor(); await page.waitForTimeout(1500);   // fully settled
  await clickAll(["NFL", "Soccer", "College basketball"]); await page.waitForTimeout(2500);
  console.log(`[${w} gap=${gap}ms] onboarding (settled) clicked NFL,Soccer,College basketball -> server ${JSON.stringify(await server())}`);
  await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForTimeout(2500);
  await page.goto("/settings", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  if (!(await tile("NHL").isVisible())) { await page.getByText("Topics", { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(500); }
  await tile("NHL").scrollIntoViewIfNeeded();
  await clickAll(["MLB", "NHL", "NFL"]); await page.waitForTimeout(2500);
  console.log(`[${w} gap=${gap}ms] settings +MLB +NHL -NFL -> server ${JSON.stringify(await server())} (expected soccer, ncaab, mlb, nhl)`);
  await L.shot(page, `${w}-race-gap${gap}`, "settings");
  await browser.close();
})().catch((e) => console.log("ERR " + e.message.split("\n")[0]));
