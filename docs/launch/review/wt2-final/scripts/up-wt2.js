// WT2 final: Free -> limit -> See plans -> pricing -> checkout Pro (mock Stripe) -> account -> check unlimited -> bets. args <WxH> [pro|premium]
const L = require("./lib"); const H = require("./h132"); const [w, h] = process.argv[2].split("x").map(Number); const plan = process.argv[3] || "pro";
(async () => { const { browser, page, log } = await L.start(w, h, "up"); const P = `[${w} ${plan}]`; const say = (s) => console.log(`${P} ${s}`);
  try { await H.signup(page, `upwt2-${plan}`, { topics: ["NFL", "Soccer"] });
    await page.goto("/bets", { waitUntil: "load" }); await page.waitForTimeout(1500); await L.audit(page, `${w} free-bets`);
    const hrefs = await page.locator('a[href^="/check?m="]').evaluateAll((a) => a.slice(0, 3).map((x) => x.getAttribute("href")));
    await page.goto(hrefs[0], { waitUntil: "load" }); await page.waitForTimeout(2500); await L.audit(page, `${w} check-1`);
    await page.goto(hrefs[1], { waitUntil: "load" }); await page.waitForTimeout(2500); await L.audit(page, `${w} check-2-limit`);
    const lim = await page.getByText(/you've used it/).first().innerText().catch(() => "-"); say(`LIMIT: ${lim}`);
    await page.getByRole("link", { name: "See plans" }).first().click(); await page.waitForURL(/pricing/, { timeout: 15000 }); await page.waitForTimeout(1500);
    await L.audit(page, `${w} pricing`); await L.shot(page, `up-${w}-${plan}-pricing`, true);
    say(`PRICING text: ${(await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 700)}`);
    await page.getByTestId(`checkout-${plan}`).click(); await page.waitForURL(/\/account\?checkout=success|\/account$/, { timeout: 45000 }); say(`after checkout url ${page.url()}`);
    for (let i = 0; i < 40; i++) { const u = new URL(page.url()); if (u.pathname === "/account" && !u.search) break; if (await page.getByTestId("checkout-status").innerText().catch(() => "").then((t) => /confirmed/.test(t))) break; await page.waitForTimeout(1500); }
    await page.waitForTimeout(3000); await page.goto("/account", { waitUntil: "load" }); await page.waitForTimeout(1500); await L.audit(page, `${w} account-${plan}`); await L.shot(page, `up-${w}-${plan}-account`, true);
    say(`ACCOUNT: ${(await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 500)}`);
    const me = await (await page.request.get("/api/me")).json(); say(`me tier=${JSON.stringify(me.tier ?? me.plan ?? me.subscription ?? null).slice(0, 120)}`);
    await page.goto(hrefs[1], { waitUntil: "load" }); await page.waitForTimeout(2500); await L.audit(page, `${w} check-2-${plan}`);
    say(`CHECK-2 after upgrade limitShown=${await page.getByText(/you've used it/).count()}`);
    await page.goto(hrefs[2], { waitUntil: "load" }); await page.waitForTimeout(2500); say(`CHECK-3 limitShown=${await page.getByText(/you've used it/).count()}`);
    await page.goto("/bets", { waitUntil: "load" }); await page.waitForTimeout(1500); await L.audit(page, `${w} ${plan}-bets`);
    await page.goto("/markets", { waitUntil: "load" }); await page.waitForTimeout(1500); await L.audit(page, `${w} ${plan}-markets`);
  } catch (e) { say("ERR " + e.message.split("\n")[0]); await L.shot(page, `up-${w}-${plan}-err`, true).catch(() => {}); }
  console.log(log.filter((l) => !/\[http 429|preload/.test(l)).join("\n")); await browser.close(); })();
