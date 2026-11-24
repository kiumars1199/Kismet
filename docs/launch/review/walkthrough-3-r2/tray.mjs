// Premium: drawer path to the tray, tray vs checker numbers, same-event pointer, Check button vs tray. WT=.. OUT=.. node tray.mjs <widths>
import { launch, base, out, L, init, signIn, facts, small, delta, skipTour, rect } from "./lib.mjs";
const [widthsArg = "390,1440"] = process.argv.slice(2);
const b = await launch(); const errs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-e2e-device": `wt3r2-tray-${Date.now()}` } });
await ctx.addInitScript(init);
const p = await ctx.newPage(); p.setDefaultTimeout(30000); p.setDefaultNavigationTimeout(90000);
p.on("pageerror", (e) => errs.push(`pageerror@${p.url().replace(base, "")} ${e.message.slice(0, 160)}`));
p.on("console", (m) => { if (m.type() === "error") errs.push("console@" + p.url().replace(base, "") + " " + m.text().slice(0, 200)); });
p.on("response", (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url().replace(base, "")}`); });
await signIn(p, "premium", `wt3r2-premium-${Date.now()}@example.com`);
const tray = p.getByTestId("combo-tray");
const T = (id) => tray.locator(`[data-testid=combo-${id}]`);
const K = (id) => p.locator(`[data-testid=combo-check] [data-testid=combo-${id}]`);
for (const w of widthsArg.split(",").map(Number)) {
  await p.setViewportSize({ width: w, height: w < 1024 ? 844 : 900 });
  await p.goto(base + "/check/combo"); await p.evaluate(() => { sessionStorage.clear(); localStorage.removeItem("me-combo-v1"); });
  L(`\n===== premium tray @ ${w} =====`);
  // A. drawer path: /bets -> first 3 rows' drawers -> Add to combo tray
  await p.goto(base + "/bets", { waitUntil: "load" }); await p.waitForTimeout(1500); await skipTour(p);
  const rows = p.locator("main [data-row] h3 a");
  L(`  /bets rows ${await rows.count()}`);
  const hrefs = [];
  for (let k = 0, added = 0; k < 8 && added < 3; k++) {
    await rows.nth(k).click();
    const dlg = p.getByRole("dialog").first();
    const tb = dlg.getByRole("button", { name: /^Add to combo tray/ });
    if (!(await tb.waitFor({ timeout: 15000 }).then(() => true, () => false))) { L(`  row ${k}: no tray button`); await p.keyboard.press("Escape"); continue; }
    await p.waitForTimeout(600);
    const title = (await dlg.locator("h2").first().innerText().catch(() => "?")).trim().replace(/\s+/g, " ");
    const ck = dlg.getByRole("link", { name: "Add to combo checker" });
    const href = await ck.getAttribute("href").catch(() => null);
    L(`  row ${k} "${title.slice(0, 60)}" tray btn ${JSON.stringify(await rect(tb))} checker ${href}`);
    const d = await delta(p, `drawer Add to combo tray (row ${k})`, async () => { await tb.click(); });
    const alerts = await dlg.locator("[role=alert]").allInnerTexts();
    L(`   -> btn "${(await dlg.getByRole("button", { name: /In combo|Add to combo tray|Switch combo side/ }).first().innerText().catch(() => "?")).trim()}" summary "${await T("summary").innerText().catch(() => null)}" alerts ${JSON.stringify(alerts)}`);
    if (!alerts.length) { added++; hrefs.push(href); }
    if (added === 1 && k < 3) await p.screenshot({ path: `${out}/premium-${w}-01-drawer-added.png` });
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  }
  // B. same-event: Denmark vs Norway O/U 2.5 + BTTS via /m (tray refuses; should point to the checker)
  for (const id of ["6674485", "6674492"]) {
    await p.goto(`${base}/m/${id}`, { waitUntil: "load" }); await p.waitForTimeout(2000);
    const tb = p.getByRole("button", { name: /^Add to combo tray/ }).first();
    if (await tb.count()) { await tb.click(); await p.waitForTimeout(1200); }
    const al = p.locator("main [role=alert]");
    const txt = await al.allInnerTexts();
    const link = al.getByRole("link");
    L(`  /m/${id}: alerts ${JSON.stringify(txt)} link ${await link.count() ? `${await link.first().innerText()} -> ${await link.first().getAttribute("href")} ${JSON.stringify(await rect(link.first()))}` : "none"}`);
    if (txt.length) {
      await p.screenshot({ path: `${out}/premium-${w}-02-same-event.png` });
      if (await link.count()) { await link.first().click(); await p.waitForURL(/check\/combo/).catch(() => {}); await p.waitForTimeout(3000); L(`   pointer -> ${p.url().replace(base, "")} legs ${JSON.stringify((await p.getByTestId("combo-leg").allInnerTexts()).map((t) => t.split("\n")[0]))} same-event note ${JSON.stringify(await K("same-event").innerText().catch(() => null))}`); await p.screenshot({ path: `${out}/premium-${w}-03-pointer-checker.png` }); }
    }
  }
  // C. tray expanded
  await p.goto(base + "/bets", { waitUntil: "load" }); await p.waitForTimeout(2000); await skipTour(p);
  L(`  tray ${JSON.stringify(await rect(tray))} summary "${await T("summary").innerText().catch(() => null)}"`);
  await p.getByRole("button", { name: "Expand combo" }).click(); await p.waitForTimeout(1500);
  const tt = await tray.innerText();
  L(`  TRAY: ${JSON.stringify(tt)}`);
  const trayNums = { chance: await T("chance").innerText().catch(() => null), pays: await T("pays").innerText().catch(() => null), ret: await T("return").innerText().catch(() => null) };
  L(`  tray nums ${JSON.stringify(trayNums)}; tray links ${JSON.stringify(await tray.evaluate((t) => [...t.querySelectorAll("a")].map((a) => `${a.innerText.trim()}->${a.getAttribute("href")}`)))}`);
  L(`  tray small ${JSON.stringify(await tray.evaluate((t) => [...t.querySelectorAll("a,button")].map((e) => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44 ? `${(e.innerText || e.getAttribute("aria-label")).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}` : null; }).filter(Boolean)))}`);
  await p.screenshot({ path: `${out}/premium-${w}-04-tray-expanded.png` });
  L(`  facts ${JSON.stringify(await facts(p))}`);
  await p.getByRole("button", { name: "Collapse combo" }).click().catch(() => {}); await p.waitForTimeout(400);
  // D. checker with the same legs
  const legs = hrefs.map((h) => { const u = new URL(base + h); return `${u.searchParams.get("m")}:${u.searchParams.get("side") ?? 0}`; }).join(",");
  await p.goto(`${base}/check/combo?legs=${encodeURIComponent(legs)}`, { waitUntil: "load" }); await p.waitForTimeout(2500);
  const btn = p.getByTestId("combo-check-btn");
  const occ = async () => btn.evaluate((el) => { const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, Math.min(r.y + r.height / 2, innerHeight - 1)); return el.contains(e) || e === el; }).catch(() => "?");
  L(`  checker ${legs}: tray ${JSON.stringify(await rect(tray))} btn ${JSON.stringify(await rect(btn))} vh ${w < 1024 ? 844 : 900} btn topmost ${await occ()}`);
  await btn.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  L(`  after scrollIntoView: tray ${JSON.stringify(await rect(tray))} btn ${JSON.stringify(await rect(btn))} btn topmost ${await occ()}`);
  await p.screenshot({ path: `${out}/premium-${w}-05-checker-with-tray.png` });
  // scroll to bottom: is the button ever under the tray? check every 100 px
  const under = await p.evaluate(async () => { const el = document.querySelector("[data-testid=combo-check-btn]"); const tr = document.querySelector("[data-testid=combo-tray]"); const res = []; for (let y = 0; y <= document.documentElement.scrollHeight; y += 100) { scrollTo(0, y); await new Promise((r) => requestAnimationFrame(r)); const a = el.getBoundingClientRect(), t = tr.getBoundingClientRect(); if (a.bottom > 0 && a.top < innerHeight && a.bottom > t.top && a.top < t.bottom) res.push(y); } return res; });
  L(`  scroll positions where Check button overlaps the tray: ${JSON.stringify(under)}`);
  await btn.scrollIntoViewIfNeeded();
  await delta(p, "Check this combo (with tray)", async () => { await btn.click(); await K("mult").waitFor({ timeout: 30000 }); });
  const ck = { chance: await K("chance").innerText(), mult: await K("mult").innerText(), edge: await K("edge").innerText(), score: await K("score").innerText() };
  L(`  CHECKER same legs: ${JSON.stringify(ck)}  vs TRAY ${JSON.stringify(trayNums)}`);
  await p.screenshot({ path: `${out}/premium-${w}-06-checker-scored.png` });
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(600);
  const disc = p.locator("footer").getByText("Market analytics, not financial advice", { exact: false }).first();
  L(`  bottom: disclaimer ${JSON.stringify(await rect(disc))} tray ${JSON.stringify(await rect(tray))} disclaimer topmost ${await disc.evaluate((el) => { const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.x + 5, r.y + r.height / 2); return el.contains(e) || e === el; }).catch(() => "?")}`);
  await p.screenshot({ path: `${out}/premium-${w}-07-bottom.png` });
  L(`  facts ${JSON.stringify(await facts(p))}; small ${JSON.stringify((await small(p)).filter((s) => !/^(inline )?(header|footer)/.test(s)))}`);
}
L(`ERRORS premium: ${JSON.stringify(errs)}`);
await b.close();
