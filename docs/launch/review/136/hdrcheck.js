// Does document.querySelector("header") return the site header on /markets, per tier and width, with and without the market drawer open?
const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const tier = process.argv[3];
const probe = () => {
  const all = [...document.querySelectorAll("header")];
  const q = document.querySelector("header");
  const site = all.find((x) => x.className.includes("lg:sticky"));
  const hp = q ? getComputedStyle(q).position : "";
  const bar = q && (hp === "sticky" || hp === "fixed") ? Math.max(0, Math.round(q.getBoundingClientRect().bottom)) : 0;
  return { n: all.length, firstIsSite: q === site, list: all.map((x) => `${x === site ? "SITE" : (x.closest('[role="dialog"]') ? "dialog:" : "") + (x.innerText || "").slice(0, 30).replace(/\n/g, " ")}`), pos: hp, bar };
};
(async () => {
  const { browser, page } = await L.start(w, h, `hdr-${tier}`);
  let got = "anon";
  if (tier !== "anon") got = (await H.signup(page, `hdr-${tier}-${w}`, { topics: ["NFL", "Soccer"], tier: tier === "free" ? undefined : tier })).tier;
  await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const a = await page.evaluate(probe);
  const id = tier === "anon" ? process.env.MID : (await (await page.request.get("/api/markets?limit=5")).json()).rows[0].market.id;
  await page.goto(`/markets?m=${id}&side=0`, { waitUntil: "networkidle" });
  const dlg = page.getByRole("dialog", { name: "Market details" });
  await dlg.waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
  const b = await page.evaluate(probe);
  // scroll the page while the drawer is open
  await page.evaluate(() => scrollTo(0, 400)); await page.waitForTimeout(300);
  const c = await page.evaluate(probe);
  await L.shot(page, `${w}-hdr-${tier}`, "drawer-open");
  await page.keyboard.press("Escape"); await page.waitForTimeout(500);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
  let menu = "n/a";
  const btn = page.locator('button[title="Choose columns"]');
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(300); const m = page.locator('[data-testid="column-menu"]'); menu = (await m.count()) ? `open top=${Math.round((await m.boundingBox()).y)} btnBottom=${Math.round((await btn.boundingBox()).y + 44)}` : "DID NOT OPEN"; }
  const d = await page.evaluate(probe);
  console.log(`[${w} ${tier} -> tier=${got}] page: ${JSON.stringify(a)}\n   drawer open: ${JSON.stringify(b)}\n   drawer open+scroll: ${JSON.stringify(c)}\n   after close: ${JSON.stringify(d)} menu=${menu}`);
  await browser.close();
})().catch((e) => console.log("ERR " + tier + " " + w + " " + e.stack));
