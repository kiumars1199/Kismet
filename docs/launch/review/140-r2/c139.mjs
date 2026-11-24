import { launch, base, out, L, init, signIn, facts, delta, small } from "./lib.mjs";
const svc = { authorization: "Bearer e2e-service", apikey: "e2e-anon", "content-type": "application/json" };
const mode = process.env.MODE || "cls";
const b = await launch();
const cardIds = (p) => p.evaluate(() => [...document.querySelectorAll("[data-testid=combo-card]")].map((c) => c.getAttribute("data-pays") + ":" + [...c.querySelectorAll("[data-testid=combo-leg] span.line-clamp-1")].map((s) => s.innerText).join("|")));
async function ctxFor(plan, w, h, tag) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, extraHTTPHeaders: { "x-e2e-device": `r140-${tag}-${w}-${Date.now()}` } });
  await ctx.addInitScript(init); const p = await ctx.newPage(); p.setDefaultTimeout(30000);
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  if (plan !== "out") await signIn(p, plan, `r140-${tag}-${w}-${Date.now()}@example.com`);
  return { ctx, p, errs };
}
if (mode === "cls") {
  for (const [w, h] of [[390, 844], [375, 667], [1440, 900]]) {
    const { ctx, p, errs } = await ctxFor("premium", w, h, "cls");
    for (const url of ["/combos", "RELOAD", "/combos?pays=3", "/combos?pays=2"]) {
      if (url === "RELOAD") await p.reload({ waitUntil: "load" }); else await p.goto(base + url, { waitUntil: "load" });
      await p.waitForTimeout(2500);
      const f = await facts(p);
      L(`${w} load ${url}: cls ${f.cls} ${JSON.stringify(f.shifts)} cards ${await p.locator("[data-testid=combo-card]").count()} empty ${await p.getByTestId("combos-empty").count()} disc ${f.disc} cents ${f.cents} hs ${f.hs}`);
      if (url === "/combos") await p.screenshot({ path: `${out}/premium-${w}-load.png` });
    }
    await p.goto(base + "/combos", { waitUntil: "load" }); await p.waitForTimeout(1500);
    for (const x of ["3", "5", "10", "2", "3", "2"]) { await delta(p, `${w} switch ${x}x+`, () => p.getByRole("button", { name: `Pays ${x}x+` }).click(), 2000); }
    // slow API: 900 ms per /api/combos
    await p.route("**/api/combos**", async (r) => { await new Promise((z) => setTimeout(z, 1200)); await r.continue(); });
    for (const x of ["3", "2"]) {
      const a = await p.evaluate(() => ({ cls: window.__cls, n: window.__s.length }));
      await p.getByRole("button", { name: `Pays ${x}x+` }).click();
      await p.waitForTimeout(150);
      const mid = await p.evaluate(() => { const busy = document.querySelector("[aria-busy=true]"); const vis = [...document.querySelectorAll("[data-testid=combo-card],[data-testid=combos-empty],[data-testid=combos-range]")].filter((e) => getComputedStyle(e).visibility !== "hidden").length; const card = document.querySelector("[data-testid=combo-card]"); let hit = null; if (card) { const r = card.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) { const el = document.elementFromPoint(r.left + r.width / 2, Math.max(r.top + 5, 5)); hit = el ? (el.closest("[data-testid=combo-card]") ? "CARD" : el.tagName) : null; } } const btn = document.querySelector("[data-testid=combo-card] button"); return { busy: !!busy, visibleListEls: vis, docH: document.documentElement.scrollHeight, hitOnHiddenCard: hit, focusableHiddenBtn: btn ? getComputedStyle(btn).visibility : null }; });
      const snap = await p.locator("main").ariaSnapshot().catch((e) => "ERR " + e.message);
      const a11yHasCards = snap.includes("Build this combo") ? "YES" : snap.includes("No combo pays") ? "empty-msg" : "no";
      await p.waitForTimeout(2000);
      const z = await p.evaluate(() => ({ cls: window.__cls, s: window.__s }));
      L(`  ${w} SLOW switch ${x}x+: mid ${JSON.stringify(mid)} a11y-sees-held-cards ${a11yHasCards}; non-input CLS after ${+(z.cls - a.cls).toFixed(4)} ${JSON.stringify(z.s.slice(a.n))}`);
      // Tab during held state? measure after: whether a hidden button could be focused is covered by visibility:hidden
    }
    await p.unroute("**/api/combos**");
    L(`  errors ${JSON.stringify(errs)}`);
    await ctx.close();
  }
}
if (mode === "parity") {
  const { ctx, p, errs } = await ctxFor("premium", 1440, 900, "par");
  for (const x of [2, 3, 5, 10]) {
    await p.goto(`${base}/combos?pays=${x}`, { waitUntil: "load" }); await p.waitForTimeout(1500);
    const dom = await cardIds(p);
    const api = await (await p.request.get(`${base}/api/combos?pays=${x}`)).json();
    const apiIds = (api.groups || []).flatMap((g) => g.combos.map((c) => c.pays.toFixed(3) + ":" + c.items.map((l) => l.question).join("|")));
    const same = JSON.stringify(dom) === JSON.stringify(apiIds);
    // was it server-rendered? count cards in raw HTML
    const html = await (await p.request.get(`${base}/combos?pays=${x}`)).text();
    const ssrCards = (html.match(/data-testid="combo-card"/g) || []).length;
    L(`pays ${x}: dom ${dom.length} api ${apiIds.length} identical ${same} ssrCards ${ssrCards} range "${await p.getByTestId("combos-range").innerText().catch(() => "-")}" empty ${await p.getByTestId("combos-empty").innerText().catch(() => "-")}`);
    if (!same) L(`  dom ${JSON.stringify(dom.slice(0, 3))}\n  api ${JSON.stringify(apiIds.slice(0, 3))}`);
  }
  // build this combo -> tray -> check this combo
  await p.goto(`${base}/combos`, { waitUntil: "load" }); await p.waitForTimeout(1500);
  const first = await cardIds(p);
  await p.locator("[data-testid=combo-card] button").first().click(); await p.waitForTimeout(1200);
  const tray = await p.getByTestId("combo-tray").innerText().catch(() => "NO TRAY");
  L(`build first card (${first[0]}): tray "${tray.replace(/\s+/g, " ").slice(0, 300)}"`);
  const chk = p.getByTestId("combo-tray").getByRole("link", { name: /Check this combo/ }).or(p.getByTestId("combo-tray").getByRole("button", { name: /Check this combo/ }));
  L(`  check control count ${await chk.count()}`);
  if (await chk.count()) { await chk.first().click(); await p.waitForURL(/check\/combo/, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(3000); L(`  -> ${p.url().replace(base, "")} chance ${await p.getByTestId("combo-chance").innerText().catch(() => "?")} mult ${await p.getByTestId("combo-mult").innerText().catch(() => "?")} legs ${await p.locator("[data-testid=combo-leg-row], main li").count()}`); const f = await facts(p); L(`  facts ${JSON.stringify(f)}`); await p.screenshot({ path: `${out}/check-this-combo.png` }); }
  L(`errors ${JSON.stringify(errs)}`);
  await ctx.close();
}
if (mode === "leak") {
  // premium list fingerprints
  const pr = await ctxFor("premium", 390, 844, "lk");
  const api = await (await pr.p.request.get(`${base}/api/combos?pays=2`)).json();
  const qs = [...new Set((api.groups || []).flatMap((g) => g.combos.flatMap((c) => c.items.map((l) => l.question))))];
  const ids = [...new Set((api.groups || []).flatMap((g) => g.combos.flatMap((c) => c.items.map((l) => String(l.market_id)))))];
  L(`premium api: ${qs.length} questions, ${ids.length} ids; sample ${JSON.stringify(ids.slice(0, 4))}`);
  const premHtml = await (await pr.p.request.get(`${base}/combos`)).text();
  L(`premium raw html: has-cards ${(premHtml.match(/data-testid="combo-card"/g) || []).length} q-hits ${qs.filter((q) => premHtml.includes(q.replace(/&/g, "&amp;").replace(/"/g, "&quot;")) || premHtml.includes(JSON.stringify(q).slice(1, -1))).length}`);
  await pr.ctx.close();
  const esc = (s) => [s, s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;"), JSON.stringify(s).slice(1, -1)];
  const scan = (t) => ({ q: qs.filter((q) => esc(q).some((v) => t.includes(v))).length, ids: ids.filter((i) => new RegExp(`market_id\\\\?"\\s*:\\s*\\\\?"?${i}\\b`).test(t)).length, cardsMarkup: (t.match(/combo-card/g) || []).length, groups: /\\?"groups\\?"/.test(t) });
  for (const plan of ["out", "free", "pro", "paused"]) {
    const { ctx, p, errs } = await ctxFor(plan === "paused" ? "premium" : plan, 390, 844, "lk" + plan);
    if (plan === "paused") {
      const me = await (await p.request.get(base + "/api/me")).json();
      const subs = await (await fetch(`${base}/e2e-mock/supabase/rest/v1/profiles`, { headers: svc })).json();
      const uid = me.user_id || me.id || (me.user && me.user.id);
      const mine = subs.filter((r) => !uid || r.user_id === uid).slice(-1)[0];
      const until = new Date(Date.now() + 86400e3).toISOString();
      const r = await fetch(`${base}/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${mine.user_id}`, { method: "PATCH", headers: svc, body: JSON.stringify({ paused_until: until }) });
      L(`paused patch ${r.status} uid ${mine.user_id} (me keys ${Object.keys(me).join(",")})`);
    }
    const html = await (await p.request.get(`${base}/combos`)).text();
    const rsc = await (await p.request.get(`${base}/combos`, { headers: { RSC: "1" } })).text();
    const rsc3 = await (await p.request.get(`${base}/combos?pays=2&_rsc=x`, { headers: { RSC: "1", "Next-Router-State-Tree": encodeURIComponent(JSON.stringify(["", { children: ["combos", { children: ["__PAGE__", {}] }] }, null, null, true])) } })).text();
    const apiR = await p.request.get(`${base}/api/combos?pays=2`);
    L(`${plan}: html ${JSON.stringify(scan(html))} rsc ${JSON.stringify(scan(rsc))} rscNav ${JSON.stringify(scan(rsc3))} api ${apiR.status()} len html ${html.length} rsc ${rsc.length}`);
    await p.goto(`${base}/combos`, { waitUntil: "load" }); await p.waitForTimeout(2500);
    const f = await facts(p);
    const main = (await p.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 260);
    L(`  page: cls ${f.cls} ${JSON.stringify(f.shifts)} disc ${f.disc} cents ${f.cents} hs ${f.hs} cards ${await p.locator("[data-testid=combo-card]").count()} main "${main}"`);
    await p.screenshot({ path: `${out}/${plan}-390-combos.png` });
    L(`  errors ${JSON.stringify(errs)}`);
    await ctx.close();
  }
}
await b.close();
