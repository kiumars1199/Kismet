// PR #126 review: tour per step (target in view, dialog clear of target and tab bar, CLS per step), onboarding bar, check-email.
// usage: node r126.js 390x844 <free-cards|free-fallback|premium-empty> [reduce]
const L = require("./lib");
(async () => {
  const [w, h] = process.argv[2].split("x").map(Number);
  const mode = process.argv[3]; const reduce = process.argv[4] === "reduce";
  const P = `${w}-${mode}${reduce ? "-rm" : ""}`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, baseURL: L.BASE, reducedMotion: reduce ? "reduce" : "no-preference", extraHTTPHeaders: { "x-e2e-device": `r126-${P}-${Date.now()}` } });
  await ctx.addInitScript(() => { window.__cls = 0; window.__sh = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__sh.push({ v: +e.value.toFixed(4), src: (e.sources || []).map((s) => (s.node && s.node.nodeName ? s.node.nodeName + "." + String(s.node.className || "").slice(0, 30) : "?") + ` y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`).slice(0, 3) }); } }).observe({ type: "layout-shift", buffered: true }); });
  const page = await ctx.newPage();
  const log = [];
  page.on("console", (m) => { if (m.type() === "error") log.push(`[console.error] ${page.url()} :: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => log.push(`[pageerror] ${page.url()} :: ${String(e).slice(0, 200)}`));
  const shot = (n) => page.screenshot({ path: `${process.env.OUT}/${P}-${n}.png` });
  const say = (s) => console.log(`[${P}] ${s}`);
  try {
    const email = `r126-${mode}-${w}-${Date.now()}@example.com`;
    await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(2500);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 2");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    const q = await page.getByText("Already have an account?").count();
    const loginHrefs = await page.locator('main a[href^="/login"]').evaluateAll((as) => as.map((a) => a.innerText + "->" + a.getAttribute("href")));
    say(`CHECK-EMAIL: "Already have an account?" x${q}; login links ${JSON.stringify(loginHrefs)}`);
    await shot("01-check-email");
    await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 }); await page.waitForLoadState("networkidle");
    if (mode === "premium-empty") {
      const me = await (await page.request.get("/api/me")).json();
      await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: "premium" } });
      say("tier " + (await (await page.request.get("/api/me")).json()).tier);
      await page.reload({ waitUntil: "networkidle" });
    }
    await page.waitForTimeout(1500);
    // onboarding bar
    const bar = async (tag) => page.evaluate(() => {
      const next = [...document.querySelectorAll("button")].find((b) => /^(Next|Show my best bets)$/.test(b.innerText.trim()));
      const nb = next?.getBoundingClientRect(); const tab = document.querySelector('nav.fixed[aria-label="Main"]')?.getBoundingClientRect();
      const sticky = next?.closest("div.sticky")?.getBoundingClientRect();
      // what is painted in the strip between the Next button and the tab bar
      const probeY = tab && nb ? Math.round((nb.bottom + tab.top) / 2) : null;
      const hit = probeY ? document.elementFromPoint(20, probeY) : null;
      const tiles = [...document.querySelectorAll('[data-testid="topics-picker"] button')]; const last = tiles[tiles.length - 1]?.getBoundingClientRect();
      return { next: nb && [Math.round(nb.top), Math.round(nb.bottom)], sticky: sticky && [Math.round(sticky.top), Math.round(sticky.bottom)], tabTop: tab && Math.round(tab.top), tabH: tab && Math.round(tab.height), probeY, probeHit: hit ? hit.tagName + "." + String(hit.className).slice(0, 50) : null, lastTile: last && [Math.round(last.top), Math.round(last.bottom)] };
    });
    say("ONB-BAR top: " + JSON.stringify(await bar()));
    await shot("02-onboarding-1");
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400);
    say("ONB-BAR scrolled to end: " + JSON.stringify(await bar()));
    await shot("03-onboarding-1-end");
    await page.evaluate(() => scrollTo(0, 0));
    const pick = page.getByTestId("topics-picker");
    if (mode === "free-cards") await pick.locator("button", { hasText: /^NFL/ }).first().click();
    else await pick.locator("button", { hasText: "none open" }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Next", exact: true }).click(); await page.waitForTimeout(400);
    say("ONB2 bar: " + JSON.stringify(await bar()));
    await page.getByRole("button", { name: "Next", exact: true }).click(); await page.waitForTimeout(400);
    say("ONB3 bar: " + JSON.stringify(await bar()));
    await shot("04-onboarding-3");
    await page.getByRole("button", { name: "Show my best bets" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"), { timeout: 60000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    const dlg = page.locator('[role="dialog"][aria-labelledby="tour-h"]');
    await dlg.waitFor({ timeout: 30000 });
    await page.waitForTimeout(1200);
    const startY = await page.evaluate(() => Math.round(scrollY));
    say("FIRST url " + page.url().replace(L.BASE, "") + " startY=" + startY + " landing CLS " + (await page.evaluate(() => window.__cls.toFixed(4))));
    for (let i = 0; i < 6; i++) {
      if (!(await dlg.count()) || !(await dlg.isVisible())) { say(`no dialog at step ${i}`); break; }
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)]; };
        const d = document.querySelector('[role="dialog"][aria-labelledby="tour-h"]'); const spot = document.querySelector('[data-testid="tour-spot"]');
        const tab = document.querySelector('nav.fixed[aria-label="Main"]'); const tabTop = tab && tab.getBoundingClientRect().height ? tab.getBoundingClientRect().top : innerHeight;
        const head = document.querySelector("header"); const hb = head && getComputedStyle(head).position === "sticky" ? head.getBoundingClientRect().bottom : 0;
        const h1 = document.querySelector("h1");
        const tr = (e) => e ? getComputedStyle(e).transitionDuration : null;
        let painted = null; if (spot) { const ov = d.parentElement; ov.style.visibility = "hidden"; const sr = spot.getBoundingClientRect(); const t = document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2); ov.style.visibility = ""; painted = t ? (t.closest("a,button")?.getAttribute("aria-label") || t.closest("a,button")?.innerText?.slice(0, 25) || t.tagName + "." + String(t.className).slice(0, 25)) : null; }
        return { painted, title: d.querySelector("#tour-h").innerText, body: d.querySelector("#tour-b")?.innerText, dlg: R(d), spot: R(spot), tabTop: Math.round(tabTop), headBottom: Math.round(hb), h1: R(h1), scrollY: Math.round(scrollY), trSpot: tr(spot), trDlg: tr(d), smooth: getComputedStyle(document.documentElement).scrollBehavior };
      });
      const s = m.spot, d = m.dlg;
      const spotVisible = s ? (s[0] + 6 >= m.headBottom && s[0] + 40 <= m.tabTop) : null;   // at least the top 34 px of the target is in the band
      const spotFully = s ? (s[0] >= m.headBottom - 8 && s[1] <= m.tabTop + 8) : null;
      const overlap = s ? Math.max(0, Math.min(s[1], d[1]) - Math.max(s[0], d[0])) * (Math.min(s[3], d[3]) > Math.max(s[2], d[2]) ? 1 : 0) : 0;
      const dlgClear = d[1] <= m.tabTop && d[0] >= 0;
      const h1Vis = m.h1 ? m.h1[1] > m.headBottom && m.h1[0] < m.tabTop : null;
      const cls = await page.evaluate(() => { const c = window.__cls; window.__cls = 0; const sh = window.__sh; window.__sh = []; return { c: +c.toFixed(4), sh }; });
      say(`STEP ${i + 1} "${m.title}" spot=${JSON.stringify(s)} dlg=${JSON.stringify(d)} tabTop=${m.tabTop} head=${m.headBottom} scrollY=${m.scrollY} | spotTopInBand=${spotVisible} spotFully=${spotFully} overlapPx=${overlap} dlgClearOfTabBar=${dlgClear} h1Visible=${h1Vis} painted="${m.painted}" | CLS(step)=${cls.c}${cls.sh.length ? " " + JSON.stringify(cls.sh) : ""} | transition spot=${m.trSpot} dlg=${m.trDlg} scroll-behavior=${m.smooth}`);
      if (i === 0) say(`   body: ${m.body}`);
      if (i === 3) say("   SAVE PROBE: " + JSON.stringify(await page.evaluate(() => {
        const b = document.querySelector('article[data-row] button[aria-label="Save"]'); if (!b) return "none";
        const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const art = b.closest("article"); const ar = art.getBoundingClientRect();
        return { rect: [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)], opacity: cs.opacity, vis: cs.visibility, svg: !!b.querySelector("svg"), svgOpacity: b.querySelector("svg") && getComputedStyle(b.querySelector("svg")).opacity, html: b.outerHTML.slice(0, 300), hit: hit && (hit.tagName + "." + String(hit.className).slice(0, 60)), article: [Math.round(ar.top), Math.round(ar.bottom)], articleIdx: [...document.querySelectorAll("article[data-row]")].indexOf(art), articleTitle: art.innerText.split("\n")[0], parentClass: String(b.parentElement.className).slice(0, 120),
          chain: (() => { const out = []; let e = b.parentElement; while (e && e !== art.parentElement) { const q = e.getBoundingClientRect(); const c = getComputedStyle(e); out.push(`${e.tagName}${e.getAttribute("data-testid") ? "#" + e.getAttribute("data-testid") : ""}.${String(e.className).slice(0, 50)} [${Math.round(q.top)},${Math.round(q.height)}] ov=${c.overflow} pos=${c.position} disp=${c.display}${c.clipPath !== "none" ? " clip=" + c.clipPath : ""}`); e = e.parentElement; } return out; })(),
          paint: (() => { const tour = document.querySelector('[aria-labelledby="tour-h"]').parentElement; tour.style.visibility = "hidden"; const r2 = b.getBoundingClientRect(); const h2 = document.elementFromPoint(r2.left + 22, r2.top + 22); tour.style.visibility = ""; return h2 && (h2.tagName + "." + String(h2.className).slice(0, 60) + " inBtn=" + b.contains(h2)); })() };
      })));
      await shot(`1${i}-tour-${i + 1}`);
      const btn = dlg.getByRole("button", { name: /^(Next|Done)$/ }); const last = (await btn.innerText()) === "Done"; await btn.click(); if (last) break;
    }
    await page.waitForTimeout(900);
    const cls = await page.evaluate(() => window.__cls.toFixed(4));
    say("after Done CLS " + cls + " scrollY=" + (await page.evaluate(() => Math.round(scrollY))) + " (tour started at " + startY + ")");
    await shot("20-after-tour");
  } catch (e) { say("ERROR " + e.message.split("\n")[0]); await shot("error"); }
  say("--- LOG " + (log.length ? "\n" + log.join("\n") : "(none)"));
  await browser.close();
})();
