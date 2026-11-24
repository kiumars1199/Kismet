import { launch, base, L, init, signIn } from "./lib.mjs";
const b = await launch();
const state = (p) => p.evaluate(() => ({ url: location.pathname + location.search, pressed: document.querySelector("[aria-label=Payout] [aria-pressed=true]")?.innerText, cards: [...document.querySelectorAll("[data-testid=combo-card]")].filter((e) => getComputedStyle(e).visibility !== "hidden").length, first: document.querySelector("[data-testid=combo-card]")?.innerText.replace(/\s+/g, " ").slice(0, 50) ?? null, empty: document.querySelector("[data-testid=combos-empty]")?.innerText.slice(0, 22) ?? null }));
let bad = 0, total = 0;
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, extraHTTPHeaders: { "x-e2e-device": `r140r2-bf-${w}-${Date.now()}` } });
  await ctx.addInitScript(init); const p = await ctx.newPage(); p.setDefaultTimeout(30000);
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  let api = 0; p.on("request", (r) => { if (r.url().includes("/api/combos")) api++; });
  await signIn(p, "premium", `r140r2-bf-${w}-${Date.now()}@example.com`);
  const exp = {};
  for (const k of ["2", "3", "5", "10"]) { await p.goto(base + "/combos?pays=" + k, { waitUntil: "load" }); await p.waitForTimeout(800); const s = await state(p); exp[k] = { cards: s.cards, first: s.first, empty: s.empty }; }
  L(`${w} expected per pays ${JSON.stringify(Object.fromEntries(Object.entries(exp).map(([k, v]) => [k, v.cards + (v.empty ? " empty" : "")])))}`);
  const check = (s) => { if (!s.url?.startsWith("/combos")) return "OK(away)"; const k = new URLSearchParams(s.url.split("?")[1] || "").get("pays") || "2"; const e = exp[k]; const ok = s.pressed === `Pays ${k}x+` && s.cards === e.cards && s.first === e.first && (s.empty === e.empty); total++; if (!ok) bad++; return ok ? "OK" : `MISMATCH expected pays ${k} ${JSON.stringify(e)}`; };
  const scen = [["/combos", "5", "How it works"], ["/combos?pays=5", "2", "Check a combo"], ["/combos", "10", "Pricing"], ["/combos?pays=3", "5", "How it works"]];
  for (let rep = 0; rep < 3; rep++) for (const [start, tap, linkName] of scen) {
    await p.goto(base + start, { waitUntil: "load" }); await p.waitForTimeout(1000);
    await p.getByRole("button", { name: `Pays ${tap}x+` }).click(); await p.waitForTimeout(400);
    const s0 = await state(p);
    L(`${w} r${rep} ${start} tap ${tap}: ${JSON.stringify(s0)} ${check(s0)}`);
    const link = linkName === "Check a combo" ? p.getByRole("link", { name: linkName, exact: true }).first() : p.locator("footer").getByRole("link", { name: linkName, exact: true }).first();
    await link.click(); await p.waitForURL((u) => !u.pathname.startsWith("/combos")); await p.waitForTimeout(900);
    const seq = [];
    for (const step of ["back", "forward", "back", "forward", "back"]) {
      if (step === "back") await p.goBack(); else await p.goForward();
      await p.waitForTimeout(1000);
      const s = await state(p).catch((e) => ({ err: e.message }));
      const c = check(s); seq.push(`${step}:${s.url}|${s.pressed ?? "-"}|${s.cards}${c.startsWith("OK") ? "" : " <-" + c}`);
    }
    L(`   via "${linkName}": ${seq.join("  ")}`);
  }
  L(`${w} errors ${JSON.stringify(errs)} apiRequests ${api}`);
  await ctx.close();
}
L(`TOTAL combos states checked ${total}, mismatches ${bad}`);
await b.close();
