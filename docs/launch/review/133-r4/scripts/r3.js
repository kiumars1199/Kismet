// WT2 r3: full Free walk on final f2ef7a9. usage: BASE=... OUT=... node r3.js 390x844
const L = require("./lib");
const { chromium } = require("playwright");
(async () => {
  const [w, h] = process.argv[2].split("x").map(Number);
  const P = `${w}`;
  const b = await chromium.launch();
  const mk = async (tag) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, baseURL: L.BASE, extraHTTPHeaders: { "x-e2e-device": `r3-${tag}-${w}-${Date.now()}` } });
    await ctx.addInitScript(() => { window.__cls = 0; window.__sh = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__sh.push({ v: +e.value.toFixed(4), src: (e.sources || []).map((s) => (s.node && s.node.nodeName ? s.node.nodeName + "." + String(s.node.className || "").slice(0, 30) + " '" + String(s.node.textContent || "").slice(0, 25) + "'" : "?") + ` y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`).slice(0, 3) }); } }).observe({ type: "layout-shift", buffered: true }); } catch {} });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") log.push(`[console.error] ${page.url()} :: ${m.text().slice(0, 200)}`); });
    page.on("pageerror", (e) => log.push(`[pageerror] ${page.url()} :: ${String(e).slice(0, 200)}`));
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/_next/")) log.push(`[http ${r.status()}] ${r.request().method()} ${r.url()}`); });
    return { ctx, page };
  };
  const log = [];
  let n = 0;
  const say = (s) => console.log(`[${w}] ${s}`);
  const shot = async (page, name, full = false) => { n++; await page.screenshot({ path: `${process.env.OUT}/${P}-${String(n).padStart(2, "0")}-${name}.png`, fullPage: full }); };
  const audit = async (page, label) => {
    await page.waitForTimeout(300);
    const r = await page.evaluate((DISC) => {
      const t = document.body.innerText;
      const cents = (t.match(/[^\n]{0,25}(\d+\s?¢|\bcents?\b|\$0\.\d\d|\b0\.\d\d\b|\b\d+c\b)[^\n]{0,25}/gi) || []).slice(0, 4);
      const small = [];
      for (const el of document.querySelectorAll('a[href], button, [role="button"], select, summary, input[type=checkbox]')) {
        const q = el.getBoundingClientRect(); if (!q.width || !q.height || q.top > innerHeight || q.bottom < 0) continue;
        if (getComputedStyle(el).visibility === "hidden" || el.closest("footer") || el.closest('[aria-labelledby="tour-h"]')) continue;
        if ((el.textContent || "").trim() === "Skip to content") continue;
        const p = el.parentElement; const inline = getComputedStyle(el).display === "inline" && p && (p.textContent || "").trim().length > (el.textContent || "").trim().length + 3;
        if ((q.width < 44 || q.height < 44) && !inline && !(innerWidth >= 1024 && el.closest("header"))) small.push(`${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 28)} ${Math.round(q.width)}x${Math.round(q.height)}`);
      }
      const c = window.__cls; window.__cls = 0; const sh = window.__sh; window.__sh = [];
      return { url: location.pathname + location.search, h1: [...document.querySelectorAll("h1")].map((x) => x.innerText.replace(/\n/g, " ")).join(" / "), disc: t.includes(DISC), hs: document.documentElement.scrollWidth > innerWidth + 1, cls: +c.toFixed(4), sh: sh.filter((s) => s.v >= 0.001).slice(0, 4), cents, small: small.slice(0, 8) };
    }, L.DISC);
    say(`[audit ${label}] ${r.url} h1="${r.h1}" disc=${r.disc} hscroll=${r.hs} cls=${r.cls}${r.cls > 0.02 ? " OVER-BUDGET " + JSON.stringify(r.sh) : ""}${r.cents.length ? " CENTS=" + JSON.stringify(r.cents) : ""}${r.small.length ? " SMALL=" + JSON.stringify(r.small) : ""}`);
    return r;
  };
  const go = async (page, url, label, wait = 1500) => { try { await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }); } catch { say(`(networkidle timeout on ${url})`); } await page.waitForTimeout(wait); return audit(page, label || url); };
  const text = async (page, max = 1500) => (await page.locator("main").innerText().catch(() => "")).replace(/\n+/g, " | ").slice(0, max);
  const bar = (page) => page.evaluate(() => { const s = document.querySelector('[data-testid="bar-sport"]'); const sel = s && (s.tagName === "SELECT" ? s : s.querySelector("select")); const pill = document.querySelector('a[aria-label="Remove filter: Your topics"]'); const top = [...document.querySelectorAll("h2,h3")].map((x) => x.innerText).filter((x) => /top|More bets/i.test(x)); const showing = (document.body.innerText.match(/Showing [^\n]*|\d+ bets?\b[^\n]{0,20}/) || [""])[0]; return { sport: sel ? sel.selectedOptions[0]?.textContent : null, pill: !!pill, headings: top, showing }; });
  const tour = async (page, tag) => {
    const dlg = page.locator('[role="dialog"][aria-labelledby="tour-h"]');
    await dlg.waitFor({ timeout: 30000 }).catch(() => {});
    for (let i = 0; i < 6; i++) {
      if (!(await dlg.count()) || !(await dlg.isVisible())) { say(`${tag}: no tour dialog at step ${i + 1}`); break; }
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)]; };
        const d = document.querySelector('[role="dialog"][aria-labelledby="tour-h"]'); const spot = document.querySelector('[data-testid="tour-spot"]');
        const tab = document.querySelector('nav.fixed[aria-label="Main"]'); const tabTop = tab && tab.getBoundingClientRect().height ? tab.getBoundingClientRect().top : innerHeight;
        let painted = null; if (spot) { const ov = d.parentElement; const old = ov.style.visibility; ov.style.visibility = "hidden"; const sr = spot.getBoundingClientRect(); const t = document.elementFromPoint(Math.max(1, sr.left + sr.width / 2), Math.min(innerHeight - 1, Math.max(1, sr.top + Math.min(sr.height / 2, 30)))); ov.style.visibility = old; painted = t ? (t.closest("a,button")?.getAttribute("aria-label") || t.closest("a,button")?.innerText?.slice(0, 25) || t.closest("article")?.innerText?.slice(0, 25) || t.tagName + "." + String(t.className).slice(0, 25)) : null; }
        const c = window.__cls; window.__cls = 0;
        return { title: d.querySelector("#tour-h").innerText, body: d.querySelector("#tour-b")?.innerText, dlg: R(d), spot: R(spot), tabTop: Math.round(tabTop), scrollY: Math.round(scrollY), painted, cls: +c.toFixed(4), h1: R(document.querySelector("h1")) };
      });
      const s = m.spot, d = m.dlg;
      const overlap = s ? (Math.min(s[1] - 6, d[1]) - Math.max(s[0] + 6, d[0]) > 0 && Math.min(s[3] - 6, d[3]) - Math.max(s[2] + 6, d[2]) > 0) : false;
      say(`${tag} STEP ${i + 1} "${m.title}" spot=${JSON.stringify(s)} dlg=${JSON.stringify(d)} tabTop=${m.tabTop} scrollY=${m.scrollY} painted="${m.painted}" overlap=${overlap} dlgAboveTab=${d[1] <= m.tabTop} h1=${JSON.stringify(m.h1)} cls=${m.cls}${m.cls > 0.02 ? " OVER" : ""}`);
      if (i === 0) say(`   body: ${m.body}`);
      await shot(page, `${tag}-tour-${i + 1}`);
      const btn = dlg.getByRole("button", { name: /^(Next|Done)$/ }); const last = (await btn.innerText()) === "Done"; await btn.click(); if (last) break;
    }
    await page.waitForTimeout(800);
  };
  const email = `r3-${w}-${Date.now()}@example.com`;
  const { ctx, page } = await mk("a");
  try {
    // 1. signed out
    await go(page, "/", "landing"); await shot(page, "landing");
    await page.getByRole("link", { name: "Sign up free" }).first().click(); await page.waitForURL(/\/signup/); await page.waitForLoadState("networkidle"); await audit(page, "signup"); await shot(page, "signup");
    // 2. signup
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 3");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 }); await page.waitForTimeout(500);
    say(`CHECK-EMAIL "Already have an account?" x${await page.getByText("Already have an account?").count()}`);
    await audit(page, "check-email"); await shot(page, "check-email");
    // 3. onboarding
    await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 }); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
    await audit(page, "onboarding-1");
    const ob = async () => page.evaluate(() => { const next = [...document.querySelectorAll("button")].find((x) => /^(Next|Show my best bets)$/.test(x.innerText.trim())); const nb = next?.getBoundingClientRect(); const tab = document.querySelector('nav.fixed[aria-label="Main"]')?.getBoundingClientRect(); const y = tab && nb ? Math.round((nb.bottom + tab.top) / 2) : null; const hit = y ? document.elementFromPoint(20, y) : null; return { next: nb && [Math.round(nb.top), Math.round(nb.bottom)], tabTop: tab && Math.round(tab.top), gapHit: hit ? hit.tagName + "." + String(hit.className).slice(0, 40) : null }; });
    say("ONB bar: " + JSON.stringify(await ob())); await shot(page, "onboarding-1");
    const pick = page.getByTestId("topics-picker");
    say("TILES (first 8): " + (await pick.locator("button").evaluateAll((bs) => bs.slice(0, 8).map((x) => x.innerText.replace(/\n/g, " ")))).join("; "));
    await pick.locator("button", { hasText: /^NFL/ }).first().click();
    await pick.locator("button", { hasText: /^Soccer/ }).first().click();
    await pick.locator("button", { hasText: "none open" }).first().click();
    await page.waitForTimeout(400);
    say("PICKED: " + (await pick.locator("button[aria-pressed=true]").evaluateAll((bs) => bs.map((x) => x.innerText.replace(/\n/g, " ")))).join(", "));
    await page.getByRole("button", { name: "Next", exact: true }).click(); await page.waitForTimeout(400); await audit(page, "onboarding-2"); say("ONB2 bar: " + JSON.stringify(await ob())); await shot(page, "onboarding-2");
    await page.getByRole("button", { name: "Next", exact: true }).click(); await page.waitForTimeout(400); await audit(page, "onboarding-3"); await shot(page, "onboarding-3");
    await page.getByRole("button", { name: "Show my best bets" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"), { timeout: 60000 }); await page.waitForLoadState("networkidle").catch(() => {});
    say("FIRST url " + page.url().replace(L.BASE, ""));
    // 4. tour
    await tour(page, "first");
    say("after tour scrollY " + (await page.evaluate(() => scrollY)));
    await audit(page, "first-screen-after-tour"); await shot(page, "first-screen-after-tour");
    say("FIRST BAR: " + JSON.stringify(await bar(page)));
    say("FIRST TEXT: " + (await text(page, 700)));
    // 5. Best bets via tab/nav
    await go(page, "/settings", "settings");
    await page.getByRole("link", { name: "Best bets", exact: true }).first().click(); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1500);
    say("BEST BETS url " + page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(page))); await audit(page, "best-bets-tap"); await shot(page, "best-bets-tap");
    // Why this bet
    const why = page.getByText("Why this bet?", { exact: true }).first();
    if (await why.count()) { await why.scrollIntoViewIfNeeded(); await why.click(); await page.waitForTimeout(700); await audit(page, "why-open"); await shot(page, "why-open"); await page.getByText("Why this bet?", { exact: true }).first().click(); }
    // 6. Everything + reload
    const sportSel = page.locator('[data-testid="bar-sport"] select, select[data-testid="bar-sport"]').first();
    if (await sportSel.count()) {
      await page.evaluate(() => scrollTo(0, 0));
      await sportSel.selectOption(""); await page.getByRole("button", { name: "Apply" }).click(); await page.waitForTimeout(2000);
      say("EVERYTHING url " + page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(page))); await audit(page, "everything"); await shot(page, "everything");
      await page.reload({ waitUntil: "networkidle" }).catch(() => {}); await page.waitForTimeout(1500);
      say("RELOAD url " + page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(page))); await audit(page, "everything-reload"); await shot(page, "everything-reload");
      await go(page, "/bets", "bets-after-everything"); say("/bets after Everything -> " + page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(page)));
      // 7. filters
      await page.evaluate(() => scrollTo(0, 0));
      const s2 = page.locator('[data-testid="bar-sport"] select, select[data-testid="bar-sport"]').first();
      const opts = await s2.locator("option").evaluateAll((os) => os.map((o) => o.value + "=" + o.textContent).slice(0, 12));
      say("SPORT OPTIONS: " + opts.join(" ; "));
      const soccer = await s2.locator("option").evaluateAll((os) => (os.find((o) => /^Soccer/.test(o.textContent)) || {}).value);
      if (soccer) { await s2.selectOption(soccer); await page.getByRole("button", { name: "Apply" }).click(); await page.waitForTimeout(2000); say("FILTER Soccer url " + page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(page))); await audit(page, "filter-soccer"); await shot(page, "filter-soccer"); }
      const mult = page.locator('[data-testid="bar-mult"] select, select[data-testid="bar-mult"]').first();
      if (await mult.count()) { const v = await mult.locator("option").nth(2).getAttribute("value"); await mult.selectOption(v); await page.getByRole("button", { name: "Apply" }).click(); await page.waitForTimeout(2000); say("FILTER mult url " + page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(page)) + " :: " + (await text(page, 400))); await audit(page, "filter-mult"); await shot(page, "filter-mult"); }
      await go(page, "/?view=flags&t=sports.mlb", "filter-zero"); say("ZERO: " + (await text(page, 300))); await shot(page, "filter-zero");
    } else say("no bar-sport select found");
    // saved-topics view again (2 topics): label
    await go(page, "/?view=flags&fav=1", "fav1"); say("FAV=1 url " + page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(page))); await shot(page, "fav1");
    // 8. /check limit
    await go(page, "/?view=flags", "flags");
    const hrefs = await page.locator('article[data-row] a[href^="/check?"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))].slice(0, 2));
    say("check hrefs " + JSON.stringify(hrefs));
    if (hrefs[0]) { await go(page, hrefs[0], "check-1", 2500); await shot(page, "check-1"); }
    if (hrefs[1]) {
      await go(page, hrefs[1], "check-2", 2500);
      const lim = await page.evaluate(() => { const m = document.querySelector("main"); const cands = [...m.querySelectorAll("section,div")].filter((e) => /limit|tomorrow|Pro|free check/i.test(e.innerText || "") && e.innerText.length < 600); const e = cands.sort((a, b2) => a.innerText.length - b2.innerText.length)[0]; const box = e && e.getBoundingClientRect(); const ws = [...m.querySelectorAll("div")].map((d) => d.getBoundingClientRect()).filter((r) => r.height > 500).map((r) => Math.round(r.height)); return { text: e && e.innerText.replace(/\n+/g, " | ").slice(0, 300), h: box && Math.round(box.height), tallDivs: ws.slice(0, 5), mainH: Math.round(m.getBoundingClientRect().height) }; });
      say("CHECK-2 LIMIT: " + JSON.stringify(lim)); await shot(page, "check-2-limit"); await shot(page, "check-2-limit-full", true);
    }
    // 9. alerts, dashboards (fresh loads)
    for (const u of ["/alerts", "/dashboards", "/alerts", "/dashboards"]) { await go(page, u, u, 2000); }
    await shot(page, "dashboards");
    // settings
    await go(page, "/settings", "settings");
    const st = await page.evaluate(() => { const m = document.querySelector("main").innerText; const fav = (m.match(/Favorites[^\n]*|Your topics[^\n]*/g) || []).slice(0, 3); const raw = (m.match(/\b(sports|politics|crypto|weather|finance)\.[a-z]+/g) || []).slice(0, 5); const sels = [...document.querySelectorAll("main select")].map((s) => { const lab = s.closest("label,div")?.innerText.split("\n")[0]; const cs = getComputedStyle(s); return `${lab?.slice(0, 15)}:${cs.fontSize}/${Math.round(s.getBoundingClientRect().height)}`; }); return { fav, raw, sels }; });
    say("SETTINGS: " + JSON.stringify(st)); await shot(page, "settings"); await shot(page, "settings-full", true);
    // markets search tap targets
    await go(page, "/markets?q=texans", "markets-search"); await shot(page, "markets-search");
    // 10. pause
    await go(page, "/account", "account", 2000);
    say("CLAUSE: " + ((await page.locator("main").innerText()).match(/Signed in as[^\n]*/) || [""])[0]);
    const h24 = page.getByRole("button", { name: "24 hours" });
    if (await h24.count()) { await h24.click(); await page.waitForTimeout(800); const sec = page.locator("section", { hasText: "Take a break" }); await sec.scrollIntoViewIfNeeded(); say("PAUSE: " + (await sec.innerText()).replace(/\n+/g, " | ").slice(0, 400)); say("PAUSE buttons: " + JSON.stringify(await sec.locator("button").evaluateAll((bs) => bs.map((x) => { const r = x.getBoundingClientRect(); return [x.textContent.trim(), Math.round(r.width), Math.round(r.height)]; })))); await shot(page, "pause-picked"); const cancel = sec.getByRole("button", { name: "Cancel" }); if (await cancel.count()) { await cancel.click(); await page.waitForTimeout(500); say("after Cancel: " + (await sec.innerText()).replace(/\n+/g, " | ").slice(0, 200)); } }
    else say("no '24 hours' button");
    // 11. sign out, log in, topics
    await page.getByRole("button", { name: "Sign out", exact: true }).click(); await page.waitForTimeout(2500);
    say("after sign out " + page.url().replace(L.BASE, "")); await audit(page, "signed-out");
    await go(page, "/login", "login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 3");
    if (await page.getByRole("checkbox").count()) await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1500);
    say("AFTER LOGIN url " + page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(page))); await audit(page, "after-login"); await shot(page, "after-login");
    await page.getByRole("link", { name: "Best bets", exact: true }).first().click(); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1200);
    say("AFTER LOGIN tap Best bets " + page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(page))); await shot(page, "after-login-best-bets");
    // new device
    const nd = await mk("nd");
    await nd.page.goto("/login", { waitUntil: "networkidle" }); await nd.page.waitForTimeout(1000);
    await nd.page.getByLabel("Email", { exact: true }).fill(email);
    await nd.page.locator("input").and(nd.page.getByLabel("Password", { exact: true })).fill("walk password 3");
    if (await nd.page.getByRole("checkbox").count()) await nd.page.getByRole("checkbox").check();
    await nd.page.getByRole("button", { name: "Log in", exact: true }).click();
    await nd.page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }); await nd.page.waitForLoadState("networkidle").catch(() => {}); await nd.page.waitForTimeout(1500);
    say("NEW DEVICE landing " + nd.page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(nd.page))); await shot(nd.page, "new-device-landing");
    await nd.page.goto("/bets", { waitUntil: "networkidle" }); await nd.page.waitForTimeout(1000);
    say("NEW DEVICE /bets " + nd.page.url().replace(L.BASE, "") + " " + JSON.stringify(await bar(nd.page)));
  } catch (e) { say("ERROR " + e.message.split("\n")[0]); await shot(page, "error"); }
  say("--- LOG" + (log.length ? "\n" + log.join("\n") : " (none)"));
  await b.close();
})();
