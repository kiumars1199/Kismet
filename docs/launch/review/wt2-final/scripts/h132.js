const L = require("./lib");
async function signup(page, tag, { topics = ["NFL"], tier } = {}) {
  const email = `p132-${tag}-${Date.now()}@example.com`;
  await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(2000);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 132");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 }); await page.waitForTimeout(1200);
  if (tier) {
    const me = await (await page.request.get("/api/me")).json();
    await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier } });
    await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1500);
  }
  for (const t of topics) await page.getByRole("button", { name: new RegExp("^" + t) }).first().click();
  await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForTimeout(3000);
  const tierNow = (await (await page.request.get("/api/me")).json()).tier;
  return { email, tier: tierNow };
}
const cls = (page) => page.evaluate(() => ({ cls: +window.__cls.toFixed(4), sh: window.__shifts.filter((s) => s.v > 0.0005).map((s) => ({ v: s.v, t: s.t, src: s.src.slice(0, 2) })) }));
module.exports = { signup, cls };
