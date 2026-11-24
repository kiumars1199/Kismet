import { launch, base, out, L, init, signIn } from "./lib.mjs";
const b = await launch();
const st = (p) => p.evaluate(() => ({ url: location.pathname + location.search, pressed: document.querySelector("[aria-label=Payout] [aria-pressed=true]")?.innerText, cards: [...document.querySelectorAll("[data-testid=combo-card]")].filter((e) => getComputedStyle(e).visibility !== "hidden").length, empty: document.querySelector("[data-testid=combos-empty]")?.innerText.slice(0, 24) ?? null, busy: !!document.querySelector("[aria-busy=true]"), listVisible: [...document.querySelectorAll("[data-testid=combo-card],[data-testid=combos-empty]")].some((e) => getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().height > 0), cls: +window.__cls.toFixed(4), s: window.__s }));
const Q = ["", "?pays=2", "?pays=3", "?pays=5", "?pays=10", "?pays=abc", "?pays=5&pays=10", "?pays=10&pays=5", "?pays=4"];
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, extraHTTPHeaders: { "x-e2e-device": `r140r2-deep-${w}-${Date.now()}` } });
  await ctx.addInitScript(init); const p = await ctx.newPage(); p.setDefaultTimeout(30000);
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  let api = 0; p.on("request", (r) => { if (r.url().includes("/api/combos")) api++; });
  await signIn(p, "premium", `r140r2-deep-${w}-${Date.now()}@example.com`);
  // delay /api/combos 1.2 s for the whole run: any request would show up as count and as a blank
  await p.route("**/api/combos**", async (r) => { await new Promise((z) => setTimeout(z, 1200)); await r.continue(); });
  for (const q of Q) {
    if (w === 390) {
      const html = await (await p.request.get(base + "/combos" + q)).text();
      const footer = html.indexOf("<footer"), card = html.indexOf('data-testid="combo-card"'), empty = html.indexOf('data-testid="combos-empty"');
      const pressed = (html.match(/aria-pressed="true"[^>]*>([^<]*)</) || [])[1];
      const susp = [...html.matchAll(/<!--\$\?-->|<template id="B:\d+"|<div hidden id="S:\d+"/g)].map((m) => m[0] + "@" + m.index);
      L(`RAW /combos${q.padEnd(17)} len ${html.length} footer@${footer} firstCard@${card} empty@${empty} ssrPressed "${pressed}" listBeforeFooter ${Math.max(card, empty) >= 0 && Math.max(card, empty) < footer} suspenseMarkers ${JSON.stringify(susp)}`);
    }
    const a0 = api;
    await p.goto(base + "/combos" + q, { waitUntil: "load" }); await p.waitForTimeout(1600);
    const s = await st(p);
    L(`${w} load /combos${q}: ${JSON.stringify(s)} api ${api - a0}`);
  }
  // switching with the delayed API: sample 50ms and 300ms after each tap
  await p.goto(base + "/combos", { waitUntil: "load" }); await p.waitForTimeout(1500);
  const c0 = await p.evaluate(() => window.__cls), a0 = api;
  for (const x of ["3", "5", "10", "2", "5", "2"]) {
    await p.getByRole("button", { name: `Pays ${x}x+` }).click();
    const m50 = await st(p); await p.waitForTimeout(250); const m300 = await st(p); await p.waitForTimeout(1300); const end = await st(p);
    const blank = [m50, m300, end].some((m) => !m.listVisible || m.busy);
    L(`  ${w} tap ${x}x+: 50ms ${m50.pressed}/${m50.cards}/${m50.empty ?? "-"} busy ${m50.busy}  300ms ${m300.pressed}/${m300.cards} busy ${m300.busy}  end ${end.url} ${end.pressed}/${end.cards}/${end.empty ?? "-"} blank ${blank}`);
  }
  L(`  ${w} switching: api requests ${api - a0} nonInput CLS ${+((await p.evaluate(() => window.__cls)) - c0).toFixed(4)} errors ${JSON.stringify(errs)}`);
  await ctx.close();
}
await b.close();
