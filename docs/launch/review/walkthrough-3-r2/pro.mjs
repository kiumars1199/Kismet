// WT3 r2: Pro walk on a production build. usage: WT=.. OUT=.. node pro.mjs <plan> <widths>
import { launch, base, out, L, init, signIn, facts, small, clsNow, delta, skipTour, rect } from "./lib.mjs";
const [plan = "pro", widthsArg = "390,1440"] = process.argv.slice(2);
const widths = widthsArg.split(",").map(Number);
const b = await launch();
const errs = [];
const ctx = await b.newContext({ viewport: { width: widths[0], height: widths[0] < 1024 ? 844 : 900 }, extraHTTPHeaders: { "x-e2e-device": `wt3r2-${plan}-${Date.now()}` } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
await ctx.addInitScript(init);
const p = await ctx.newPage();
p.setDefaultNavigationTimeout(90000); p.setDefaultTimeout(30000);
p.on("pageerror", (e) => errs.push(`pageerror@${p.url().replace(base, "")} ${e.message.slice(0, 160)}`));
p.on("console", (m) => { if (m.type() === "error") errs.push("console@" + p.url().replace(base, "") + " " + m.text().slice(0, 200)); });
p.on("response", (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url().replace(base, "")}`); if (/\/api\/check\/combo/.test(r.url())) L(`    < ${r.status()} /api/check/combo`); });
await signIn(p, plan, `wt3r2-${plan}-${Date.now()}@example.com`);
const C = (id) => p.locator(`[data-testid=combo-check] [data-testid=combo-${id}]`);
const res = async () => { const o = {}; for (const k of ["chance", "mult", "edge", "score", "drop", "same-event"]) o[k] = await C(k).first().innerText({ timeout: 500 }).catch(() => null); return o; };
const legNames = async () => (await p.getByTestId("combo-leg").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
const url = () => p.url().replace(base, "");

for (const w of widths) {
  await p.setViewportSize({ width: w, height: w < 1024 ? 844 : 900 });
  let i = 0; const shot = async (name, full = false) => { i++; await p.screenshot({ path: `${out}/${plan}-${w}-${String(i).padStart(2, "0")}-${name}.png`, fullPage: full }); };
  const log = async (step, extra = {}) => { const f = await facts(p); L(`${plan} ${w} [${step}] ${JSON.stringify({ ...f, ...extra })}`); return f; };
  await p.goto(base + "/check/combo"); await p.evaluate(() => { sessionStorage.clear(); localStorage.removeItem("me-combo-v1"); });
  L(`\n===== ${plan} @ ${w} =====`);

  // 1. Best bets (home) -> first card -> drawer -> Add to combo checker
  await p.goto(base + "/", { waitUntil: "load" }); await p.waitForTimeout(1500); await skipTour(p);
  await shot("home"); await log("home", { h1: await p.locator("h1").first().innerText().catch(() => null) });
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${plan}-${w}-header.png`, clip: { x: 0, y: 0, width: w, height: 140 } });
  L(`  header: ${JSON.stringify(await p.evaluate(() => { const h = document.querySelector("header"); const r = h.getBoundingClientRect(); return { h: Math.round(r.height), links: [...h.querySelectorAll("a,button")].filter((e) => e.offsetParent).map((e) => { const q = e.getBoundingClientRect(); return `${(e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 22)} ${Math.round(q.width)}x${Math.round(q.height)}@${Math.round(q.y)}`; }) }; }))}`);
  L(`  small on /: ${JSON.stringify(await small(p))}`);
  const card = p.locator("main [data-row] h3 a, main article h3 a").first();
  L(`  first best-bet card: "${(await card.innerText().catch(() => "?")).trim()}"`);
  await card.click();
  const dialog = p.getByRole("dialog").first();
  const link = dialog.getByRole("link", { name: "Add to combo checker" });
  const hasLink = await link.waitFor({ timeout: 20000 }).then(() => true, () => false);
  await p.waitForTimeout(800); await shot("drawer");
  L(`  drawer combo controls: ${JSON.stringify(await dialog.evaluate((d) => [...d.querySelectorAll("a,button")].filter((e) => /combo/i.test(e.innerText)).map((e) => { const r = e.getBoundingClientRect(); return `${e.innerText.trim().replace(/\s+/g, " ")} ${Math.round(r.width)}x${Math.round(r.height)} ${e.getAttribute("href") || ""}`; })).catch(() => []))}`);
  await log("drawer");
  if (hasLink) await delta(p, "leg 1 via Best bets drawer (nav)", async () => { for (let z = 0; z < 6 && !/check\/combo/.test(p.url()); z++) { await link.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(700); } await p.getByTestId("combo-leg").first().waitFor({ timeout: 30000 }); }, 2000);
  L(`  after leg 1: url ${url()} legs ${JSON.stringify(await legNames())}`);
  await shot("checker-1leg"); await log("checker-1leg");

  // 2. legs by search
  const addBy = async (q, re) => {
    await delta(p, `search "${q}"`, async () => { await p.locator("#combo-q").fill(q); await p.getByRole("button", { name: "Add", exact: true }).click(); await p.locator('[data-testid="combo-hits"] button').first().waitFor({ timeout: 20000 }).catch(() => {}); });
    const hits = p.locator('[data-testid="combo-hits"] button');
    const list = (await hits.allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
    const idx = list.findIndex((t) => re.test(t));
    if (idx < 0) { L(`  no hit ${re} in ${JSON.stringify(list)}`); await p.keyboard.press("Escape"); return; }
    await delta(p, `add hit ${re}`, async () => { await hits.nth(idx).click(); await p.waitForTimeout(2000); });
    L(`  added ${re}: legs ${await p.getByTestId("combo-leg").count()} note "${await p.getByTestId("combo-note").innerText()}" url ${url()}`);
  };
  await addBy("Colts", /Colts vs\. Texans/);
  await addBy("Denmark", /O\/U 2\.5/);
  await shot("checker-3legs");
  L(`  legs: ${JSON.stringify(await legNames())}`);
  L(`  small on checker: ${JSON.stringify((await small(p)).filter((s) => !/^(inline )?(header|footer)/.test(s)))}`);
  const btn = p.getByTestId("combo-check-btn");
  L(`  check btn ${JSON.stringify(await rect(btn))}; free-note "${await p.getByTestId("combo-free-note").innerText().catch(() => "(none)")}"`);

  // 3. Check this combo
  await delta(p, "Check this combo (3 legs)", async () => { await btn.click(); await C("mult").waitFor({ timeout: 30000 }).catch(() => {}); });
  const r3 = await res(); L(`  RESULT 3 legs: ${JSON.stringify(r3)} url ${url()}`);
  await shot("checker-scored");
  const why = p.getByTestId("combo-why");
  if (await why.count()) { await delta(p, "open Why", async () => { await why.locator("summary").click(); }); L(`  WHY: ${JSON.stringify((await why.innerText()).slice(0, 900))}`); await why.scrollIntoViewIfNeeded(); await shot("checker-why"); await why.locator("summary").click(); }
  await log("checker-scored");

  // 4. share
  const share = p.getByRole("button", { name: /^(Copy link|Share link)$/ });
  L(`  share button: ${await share.count()} ${JSON.stringify(await rect(share.first()))} label "${await share.first().innerText().catch(() => "")}"`);
  let shared = null;
  if (await share.count()) {
    await delta(p, "Copy link", async () => { await share.first().click(); });
    shared = await p.evaluate(() => navigator.clipboard.readText()).catch((e) => "clipboard err " + e.message);
    L(`  copied "${await p.getByTestId("combo-copied").innerText().catch(() => "")}" link ${shared}`);
  }
  // open the shared link: same Pro (new tab) and signed out (new context)
  if (shared && /^http/.test(shared)) {
    const p2 = await ctx.newPage(); await p2.goto(shared, { waitUntil: "load" }); await p2.waitForTimeout(4000);
    L(`  shared link as ${plan} (new tab): legs ${await p2.getByTestId("combo-leg").count()} mult ${await p2.locator("[data-testid=combo-check] [data-testid=combo-mult]").innerText().catch(() => null)} chance ${await p2.locator("[data-testid=combo-check] [data-testid=combo-chance]").innerText().catch(() => null)} cls ${JSON.stringify(await clsNow(p2))}`);
    await p2.close();
    const c3 = await b.newContext({ viewport: { width: w, height: w < 1024 ? 844 : 900 } }); await c3.addInitScript(init);
    const p3 = await c3.newPage(); await p3.goto(shared, { waitUntil: "load" }); await p3.waitForTimeout(4000);
    L(`  shared link signed out: legs ${await p3.getByTestId("combo-leg").count()} mult ${await p3.locator("[data-testid=combo-check] [data-testid=combo-mult]").innerText().catch(() => null)} button ${await p3.getByTestId("combo-check-btn").isVisible().catch(() => false)} cls ${JSON.stringify(await clsNow(p3))} main ${JSON.stringify((await p3.locator("main").innerText()).slice(0, 400))}`);
    await p3.screenshot({ path: `${out}/${plan}-${w}-shared-signedout.png` });
    await c3.close();
  }

  // 5. reload: result kept? no ?m=
  const before = await legNames(); const u0 = url();
  await p.reload({ waitUntil: "load" }); await p.waitForTimeout(3500);
  L(`  RELOAD ${u0}: legs ${before.length} -> ${(await legNames()).length}; note "${await p.getByTestId("combo-note").innerText()}"; result kept ${JSON.stringify(await res())}; url now ${url()}; cls ${JSON.stringify(await clsNow(p))}`);
  await shot("checker-reloaded");

  // 6. remove a leg (the first-added Best bets leg), reload -> stays removed
  const names0 = await legNames();
  await delta(p, "remove leg 1", async () => { await p.getByRole("button", { name: /^Remove / }).first().click(); });
  L(`  after remove: legs ${JSON.stringify((await legNames()).map((t) => t.slice(0, 40)))} url ${url()} result ${JSON.stringify(await res())}`);
  await p.reload({ waitUntil: "load" }); await p.waitForTimeout(3500);
  const names1 = await legNames();
  L(`  removed "${names0[0].slice(0, 40)}"; after reload legs ${names1.length}: back? ${names1.some((t) => t === names0[0])} url ${url()}`);
  await shot("checker-removed-reloaded");

  // 7. same-event pair (Denmark vs Norway BTTS with O/U 2.5) -> drop suggestion
  await addBy("Denmark", /Both Teams to Score(?! in)/);
  L(`  legs: ${JSON.stringify((await legNames()).map((t) => t.slice(0, 50)))}`);
  L(`  same-event note before check: ${JSON.stringify(await C("same-event").innerText().catch(() => null))}`);
  if ((await p.getByTestId("combo-leg").count()) < 3) await addBy("Miami", /Kent State/);
  await delta(p, "Check this combo (same-event pair)", async () => { await btn.click(); await C("mult").waitFor({ timeout: 30000 }).catch(() => {}); });
  const rs = await res(); L(`  RESULT same-event: ${JSON.stringify(rs)}`);
  await (C("drop").count().then((n) => n && C("drop").scrollIntoViewIfNeeded())); await shot("checker-same-event");
  if (rs.drop) { await delta(p, "Drop that leg", async () => { await p.getByRole("button", { name: "Drop that leg" }).click(); }); L(`  after drop: legs ${JSON.stringify((await legNames()).map((t) => t.slice(0, 40)))} result ${JSON.stringify(await res())}`); }
  await log("checker-end");
  L(`  small on checker end: ${JSON.stringify((await small(p)).filter((s) => !/^(inline )?(header|footer)/.test(s)))}`);
  for (const path of ["/combos", "/check"]) { await p.goto(base + path, { waitUntil: "load" }); await p.waitForTimeout(1200); await log(path); }
}
L(`ERRORS ${plan}: ${JSON.stringify(errs)}`);
await ctx.close(); await b.close();
