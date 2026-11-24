// Premium (comp via mock DB) user picks only a "none open" topic: first screen + tour.
const L = require("./lib");
(async () => {
  const [w, h] = process.argv[2].split("x").map(Number);
  const P = `${w}-pro0`;
  const { browser, page, log } = await L.start(w, h, "wt2r2-pro0");
  const email = `wt2r2-pro0-${w}-${Date.now()}@example.com`;
  try {
    await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(3000);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 2");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
    await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 });
    const me = await (await page.request.get("/api/me")).json();
    const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: "premium" } });
    console.log("patch", res.status(), "tier", (await (await page.request.get("/api/me")).json()).tier);
    await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500);
    const none = page.getByTestId("topics-picker").locator("button", { hasText: "none open" }).first();
    console.log("none tile:", (await none.innerText()).replace(/\n/g, " "));
    await none.click(); await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Next", exact: true }).click(); await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Next", exact: true }).click(); await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Show my best bets" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"), { timeout: 60000 });
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
    console.log("FIRST url " + page.url());
    await L.shot(page, P, "first-screen"); await L.audit(page, "first");
    console.log("FIRST: " + (await L.text(page, 1500)).replace(/\n+/g, " | "));
    for (let i = 0; i < 6; i++) {
      const dlg = page.locator('[role="dialog"][aria-labelledby="tour-h"]');
      if (!(await dlg.count()) || !(await dlg.isVisible())) { console.log(`tour: no dialog at step ${i}`); break; }
      await page.waitForTimeout(700);
      const box = await dlg.boundingBox();
      console.log(`TOUR ${i}: ` + (await dlg.innerText()).replace(/\n+/g, " | ") + ` [y=${Math.round(box.y)}-${Math.round(box.y + box.height)} scrollY=${await page.evaluate(() => scrollY)}]`);
      await L.shot(page, P, `tour-${i}`);
      const btn = dlg.getByRole("button", { name: /^(Next|Done)$/ }); const last = (await btn.innerText()) === "Done"; await btn.click(); if (last) break;
    }
    await page.waitForTimeout(800); await L.shot(page, P, "after-tour"); await L.audit(page, "after-tour");
  } catch (e) { console.log("ERROR " + e.message.split("\n")[0]); await L.shot(page, P, "error"); }
  console.log("--- LOG\n" + log.join("\n")); await browser.close();
})();
