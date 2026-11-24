// WT2 round 2: new Free user. usage: node walk.js 390x844 <topicsMode: mixed|zero>
const L = require("./lib");
const fs = require("fs");
const STOP = process.env.STOP || "end";
(async () => {
  const [w, h] = (process.argv[2] || "390x844").split("x").map(Number);
  const mode = process.argv[3] || "mixed";
  const P = `${w}-${mode}`;
  const { browser, page, log, ctx } = await L.start(w, h, `wt2r2-${mode}`);
  const say = (s) => console.log(s);
  const step = async (name, full = false) => { const f = await L.shot(page, P, name, full); const a = await L.audit(page, name); say(`   shot ${f}`); return a; };
  try {
    // 1. Land
    await page.goto("/", { waitUntil: "networkidle" });
    await step("landing");
    await page.getByRole("link", { name: "Sign up free" }).first().click();
    await page.waitForURL(/\/signup/);
    await page.waitForLoadState("networkidle");
    await step("signup");
    // 2. Sign up with email + password
    const email = `wt2r2-${mode}-${w}-${Date.now()}@example.com`;
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 2");
    await page.getByRole("checkbox").check();
    await step("signup-filled");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
    await step("check-email");
    say(await L.text(page, 600));
    const link = await L.inbox(page, email);
    await page.goto(link);
    await page.waitForURL(/\/onboarding/, { timeout: 60000 });
    await page.waitForLoadState("networkidle");
    await step("onboarding-1");
    say("ONB1: " + (await L.text(page, 1800)).replace(/\n+/g, " | "));
    // topic tiles
    const tiles = await page.getByTestId("topics-picker").locator("button").evaluateAll((bs) => bs.map((b) => b.innerText.replace(/\n/g, " ") + (b.disabled ? "[dis]" : "")));
    say("TILES: " + tiles.join(" ; "));
    if (STOP === "onb") return;
    const pickers = page.getByTestId("topics-picker");
    const none = pickers.locator("button", { hasText: "none open" });
    const noneNames = await none.evaluateAll((bs) => bs.map((b) => b.innerText.replace(/\n/g, " ")));
    say("NONE-OPEN tiles: " + noneNames.join(", "));
    if (mode === "zero") {
      await none.first().click();
    } else {
      // a topic with bets + a topic with none open
      const withBets = pickers.locator("button:not(:has-text('none open'))");
      await withBets.first().click();
      if (await none.count()) await none.first().click();
    }
    await page.waitForTimeout(400);
    await step("onboarding-1-picked");
    const picked = await pickers.locator("button[aria-pressed=true]").evaluateAll((bs) => bs.map((b) => b.innerText.replace(/\n/g, " ")));
    say("PICKED: " + picked.join(", "));
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(400);
    await step("onboarding-2");
    say("ONB2: " + (await L.text(page, 1500)).replace(/\n+/g, " | "));
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(400);
    await step("onboarding-3");
    say("ONB3: " + (await L.text(page, 1500)).replace(/\n+/g, " | "));
    await page.getByRole("button", { name: "Show my best bets" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"), { timeout: 60000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await step("first-screen");
    say("FIRST: " + (await L.text(page, 2500)).replace(/\n+/g, " | "));
    // tour
    for (let i = 0; i < 6; i++) {
      const dlg = page.locator('[role="dialog"]').filter({ has: page.locator("#tour-h") });
      if (!(await dlg.count()) || !(await dlg.isVisible())) { say(`tour: no dialog at step ${i}`); break; }
      await page.waitForTimeout(700);
      say(`TOUR ${i}: ` + (await dlg.innerText()).replace(/\n+/g, " | "));
      const box = await dlg.boundingBox();
      const h1 = await page.locator("h1").first().boundingBox();
      say(`   tour box y=${box && Math.round(box.y)} h=${box && Math.round(box.height)} bottom=${box && Math.round(box.y + box.height)} ; h1 y=${h1 && Math.round(h1.y)}`);
      await step(`tour-${i}`);
      const btn = dlg.getByRole("button", { name: /^(Next|Done)$/ });
      const last = (await btn.innerText()) === "Done";
      await btn.click();
      if (last) break;
    }
    await page.waitForTimeout(800);
    await step("after-tour");
    await step("after-tour-full", true);
    fs.writeFileSync(`/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/wt2r2-scripts/state-${P}.json`, JSON.stringify(await ctx.storageState()));
    fs.writeFileSync(`/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/wt2r2-scripts/email-${P}.txt`, email);
  } catch (e) {
    say("ERROR " + e.message.split("\n")[0]);
    await L.shot(page, P, "error");
  } finally {
    say("--- LOG\n" + log.join("\n"));
    await browser.close();
  }
})();
