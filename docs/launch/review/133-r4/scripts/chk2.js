const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const P = `${w}-chk2`;
async function open(page, href, label, wait = 3500) {
  await page.goto(href, { waitUntil: "load" }); await page.waitForTimeout(wait);
  const r = await page.evaluate(() => {
    const m = document.querySelector("main"); const t = m.innerText;
    const kind = document.querySelector('section[aria-label="Check result"]') ? "RESULT" : /tomorrow|free check|Upgrade|Pro/i.test(t) && !document.querySelector('[data-testid="check-skeleton"]') ? "LIMIT" : document.querySelector('[data-testid="check-skeleton"]') ? "SKELETON" : "OTHER";
    const f = document.querySelector("footer").getBoundingClientRect();
    return { kind, mainH: Math.round(m.getBoundingClientRect().height), footerTop: Math.round(f.top + scrollY) };
  });
  const c = await H.cls(page);
  console.log(`[${w} ${label}] ${href} => ${r.kind} mainH=${r.mainH} footerTop=${r.footerTop} CLS=${c.cls} ${JSON.stringify(c.sh)} cookies=${(await page.context().cookies()).map((x) => x.name).filter((n) => !/sb-|auth/.test(n)).join(",")}`);
  return r;
}
async function login(page, email) {
  await page.goto("/login", { waitUntil: "load" }); await page.waitForTimeout(1500);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 132");
  if (await page.getByRole("checkbox").count()) await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }); await page.waitForTimeout(1500);
}
(async () => {
  let s = await L.start(w, h, "c2-free"); let { browser, page, ctx } = s;
  const acct = await H.signup(page, `c2free-${w}`);
  await page.goto("/bets?fav=0", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  const hrefs = await page.locator('a[href^="/check?"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))].slice(0, 6));
  console.log("hrefs " + JSON.stringify(hrefs));
  // peek never consumes: block the API, visit 4 different markets, then let one through
  await page.route("**/api/check", (r) => r.request().method() === "POST" ? r.abort() : r.continue());
  for (const x of hrefs.slice(1, 5)) await open(page, x, "API blocked (peek only)", 1500);
  await page.unroute("**/api/check");
  await open(page, hrefs[0], "free first real check after 4 peeks");
  await open(page, hrefs[1], "free second (server knows)"); await L.shot(page, P, "free-second"); await L.audit(page, "free-second");
  await open(page, hrefs[0], "free re-open first");
  await open(page, hrefs[1], "free second again");
  await browser.close();
  // second browser, same account
  s = await L.start(w, h, "c2-dev2"); ({ browser, page } = s);
  await login(page, acct.email);
  await open(page, hrefs[2], "second browser, same Free account"); await L.shot(page, P, "second-browser");
  await open(page, hrefs[0], "second browser re-open used market");
  await browser.close();
  // first discovery: server peek says ok, API says limit (another tab uses the check while this one's API call is held)
  s = await L.start(w, h, "c2-race"); ({ browser, page, ctx } = s);
  await H.signup(page, `c2race-${w}`);
  let release; const held = new Promise((r) => (release = r));
  await page.route("**/api/check", async (r) => { if (r.request().method() === "POST") { await held; } r.continue(); });
  await page.goto(hrefs[3], { waitUntil: "load" }); await page.waitForTimeout(800);
  const p2 = await ctx.newPage(); await p2.goto(hrefs[4], { waitUntil: "load" }); await p2.waitForTimeout(3000);
  console.log(`[${w}] race: other tab result=${await p2.locator('section[aria-label="Check result"]').count()}`); await p2.close();
  release(); await page.waitForTimeout(2500);
  const rr = await page.evaluate(() => { const m = document.querySelector("main"); const f = document.querySelector("footer").getBoundingClientRect(); return { result: !!document.querySelector('section[aria-label="Check result"]'), text: m.innerText.replace(/\n+/g, " | ").slice(-200), mainH: Math.round(m.getBoundingClientRect().height), footerTop: Math.round(f.top + scrollY), ih: innerHeight }; });
  const c = await H.cls(page); console.log(`[${w} first-discovery] ${JSON.stringify(rr)} CLS=${c.cls} ${JSON.stringify(c.sh)}`);
  await L.shot(page, P, "first-discovery"); await L.shot(page, P, "first-discovery-full", true);
  await browser.close();
  // signed out -> signup
  s = await L.start(w, h, "c2-anon"); ({ browser, page } = s);
  await page.route("**/api/check", (r) => r.request().method() === "POST" ? r.abort() : r.continue());
  for (const x of hrefs.slice(1, 4)) await open(page, x, "anon API blocked (peek only)", 1200);
  await page.unroute("**/api/check");
  await open(page, hrefs[0], "anon first real check after peeks");
  await open(page, hrefs[1], "anon second (server knows)");
  await H.signup(page, `c2anon2free-${w}`);
  await open(page, hrefs[2], "new Free after anon"); await L.shot(page, P, "anon-then-free");
  await open(page, hrefs[3], "new Free second (server knows)");
  await browser.close();
  // pro
  s = await L.start(w, h, "c2-pro"); ({ browser, page } = s);
  console.log("tier " + (await H.signup(page, `c2pro-${w}`, { tier: "pro" })).tier);
  for (const x of hrefs.slice(0, 4)) await open(page, x, "pro");
  await browser.close();
})();
