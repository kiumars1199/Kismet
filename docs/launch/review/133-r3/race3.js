const L = require("./lib");
const [w, h] = process.argv[2].split("x").map(Number); const gap = +(process.argv[3] || 0);
(async () => {
  const { browser, page } = await L.start(w, h, "race3");
  try {
    const email = `p132-race3-${w}-${gap}-${Date.now()}@example.com`;
    await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(1500);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 132");
    await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
    await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 });
    const me = await (await page.request.get("/api/me")).json();
    const server = async () => (await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}&select=favorite_topics`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service" } })).json())[0].favorite_topics;
    const picker = page.getByTestId("topics-picker");
    const tiles = picker.locator("button");
    const clickIdx = async (idx) => { const boxes = []; for (const i of idx) { const t = tiles.nth(i); await t.scrollIntoViewIfNeeded(); boxes.push(await t.boundingBox()); } for (const b of boxes) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); if (gap) await page.waitForTimeout(gap); } };
    await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor(); await page.waitForTimeout(2000);
    const names = (await tiles.allInnerTexts()).map((x) => x.split("\n")[0]);
    await clickIdx([0, 1, 2]); await page.waitForTimeout(2500);
    console.log(`[${w} gap=${gap}ms] onboarding settled, clicked ${names.slice(0, 3).join(", ")} -> server ${JSON.stringify(await server())}`);
    await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForTimeout(2500);
    await page.goto("/settings", { waitUntil: "networkidle" }); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor(); await page.waitForTimeout(2000);
    const before = await server();
    await clickIdx([3, 4, 0]); await page.waitForTimeout(2500);
    console.log(`[${w} gap=${gap}ms] settings before=${JSON.stringify(before)}, clicked +${names[3]} +${names[4]} -${names[0]} -> server ${JSON.stringify(await server())}`);
  } catch (e) { console.log("ERR " + e.message.split("\n")[0]); }
  await browser.close();
})();
