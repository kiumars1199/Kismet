// chk_used hint cookie: real use, delete, forge, signed-out -> signup, Pro.
const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const P = `${w}-chk`;
async function open(page, href, label) {
  await page.goto(href, { waitUntil: "load" }); await page.waitForTimeout(3500);
  const r = await page.evaluate(() => {
    const m = document.querySelector("main"); const t = m.innerText;
    const kind = /Check result/.test([...m.querySelectorAll("section[aria-label]")].map((s) => s.getAttribute("aria-label")).join()) ? "RESULT" : /tomorrow|today's free check|free check/i.test(t) ? "LIMIT" : "OTHER";
    const f = document.querySelector("footer").getBoundingClientRect();
    return { kind, mainH: Math.round(m.getBoundingClientRect().height), footerTop: Math.round(f.top + scrollY), snippet: t.replace(/\n+/g, " | ").slice(0, 160) };
  });
  const c = await H.cls(page); const ck = (await page.context().cookies()).find((x) => x.name === "chk_used");
  console.log(`[${w} ${label}] ${href} => ${r.kind} mainH=${r.mainH} footerTop=${r.footerTop} CLS=${c.cls} ${JSON.stringify(c.sh)} cookie=${ck ? JSON.stringify({ v: decodeURIComponent(ck.value), httpOnly: ck.httpOnly, exp: Math.round((ck.expires - Date.now() / 1000) / 3600) + "h" }) : "none"}`);
  console.log(`   text: ${r.snippet}`);
  return r;
}
(async () => {
  // 1. Free real use
  let s = await L.start(w, h, "chk-free"); let { browser, page, ctx } = s;
  await H.signup(page, `free-${w}`);
  await page.goto("/bets?fav=0", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  const hrefs = await page.locator('a[href^="/check?"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))].slice(0, 4));
  console.log("hrefs " + JSON.stringify(hrefs));
  await open(page, hrefs[0], "free first");
  const r2 = await open(page, hrefs[1], "free second (hinted)"); await L.shot(page, P, "free-second"); await L.audit(page, "free-second");
  await open(page, hrefs[0], "free re-open first");
  const raw = await page.request.post("/api/check", { data: { m: new URLSearchParams(hrefs[2].split("?")[1]).get("m"), side: 0, stake: 100 }, headers: { origin: L.BASE } });
  console.log(`[${w}] direct API third market status ${raw.status()}`);
  // 2. Delete cookie -> still limited
  await ctx.clearCookies({ name: "chk_used" });
  await open(page, hrefs[2], "free cookie deleted"); await L.shot(page, P, "deleted");
  // 3. Forged cookie on a fresh Free account
  await browser.close();
  s = await L.start(w, h, "chk-forge"); ({ browser, page, ctx } = s);
  await H.signup(page, `forge-${w}`);
  const day = new Date().toISOString().slice(0, 10);
  await ctx.addCookies([{ name: "chk_used", value: encodeURIComponent(`${day}|forged:0`), url: L.BASE }]);
  await open(page, hrefs[1], "forged fresh Free"); await L.shot(page, P, "forged");
  await open(page, hrefs[2], "forged fresh Free, 2nd market (real limit now)");
  await ctx.addCookies([{ name: "chk_used", value: "garbage%7C%3Cscript%3E", url: L.BASE }]);
  await open(page, hrefs[3], "garbage cookie");
  await browser.close();
  // 4. Signed out uses check, then signs up as Free, opens another market
  s = await L.start(w, h, "chk-anon"); ({ browser, page, ctx } = s);
  await open(page, hrefs[0], "anon first");
  await open(page, hrefs[1], "anon second");
  await H.signup(page, `anon2free-${w}`);
  await open(page, hrefs[2], "new Free after anon (stale hint)"); await L.shot(page, P, "anon-then-free");
  await browser.close();
  // 5. Pro with forged cookie
  s = await L.start(w, h, "chk-pro"); ({ browser, page, ctx } = s);
  const pr = await H.signup(page, `pro-${w}`, { tier: "pro" }); console.log("tier " + pr.tier);
  await ctx.addCookies([{ name: "chk_used", value: encodeURIComponent(`${day}|forged:0`), url: L.BASE }]);
  for (const x of hrefs) await open(page, x, "pro forged");
  await browser.close();
  console.log("--- LOG\n" + s.log.join("\n"));
})();
