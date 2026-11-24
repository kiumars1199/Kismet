import { launch, base, out, L, init, signIn } from "./lib.mjs";
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-e2e-device": `wt3r2-btn-${Date.now()}` } });
await ctx.addInitScript(init);
const p = await ctx.newPage(); p.setDefaultTimeout(30000);
await signIn(p, "premium", `wt3r2-btn-${Date.now()}@example.com`);
for (const id of ["7077574", "7078474", "6674485"]) { await p.goto(`${base}/m/${id}`); await p.waitForTimeout(1500); await p.getByRole("button", { name: /^Add to combo tray/ }).first().click(); await p.waitForTimeout(800); }
for (const set of ["7077574:0,7078474:1,6674485:0", "7077574:0,7078474:1,6674485:0,6654461:0"]) {
  await p.goto(`${base}/check/combo?legs=${encodeURIComponent(set)}`, { waitUntil: "load" }); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => { const el = document.querySelector("[data-testid=combo-check-btn]"); const tr = document.querySelector("[data-testid=combo-tray]"); const out = []; for (let y = 0; y <= document.documentElement.scrollHeight - innerHeight + 100; y += 50) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); const a = el.getBoundingClientRect(); if (a.bottom < 0 || a.top > innerHeight) continue; const e = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2); const top = el.contains(e) ? "btn" : (tr.contains(e) ? "TRAY" : (e?.closest("nav")?.getAttribute("aria-label") || e?.tagName)); out.push(`${scrollY}:${Math.round(a.top)}-${Math.round(a.bottom)}:${top}`); } return { tray: tr.getBoundingClientRect().top, max: document.documentElement.scrollHeight - innerHeight, out }; });
  L(set, JSON.stringify(r));
  await p.evaluate(() => { const el = document.querySelector("[data-testid=combo-check-btn]"); el.scrollIntoView({ block: "center" }); }); await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/premium-390-08-check-btn-centered-${set.split(",").length}legs.png` });
  // what Playwright does on a tap
  await p.evaluate(() => scrollTo(0, 0)); await p.getByTestId("combo-check-btn").click({ timeout: 5000 }).then(() => L("  playwright click ok"), (e) => L("  click fail " + e.message.split("\n")[0]));
}
await b.close();
