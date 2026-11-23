const { chromium } = require('playwright');
const OUT = process.argv[2]; const BASE = 'https://kismetodds.com'; const MID = '6596313';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CLS_INIT = () => { window.__cls = 0; window.__lcp = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {} };
(async () => {
  const b = await chromium.launch();
  const mk = async (w, h, mob, dsf = 1) => { const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: mob, hasTouch: mob, userAgent: mob ? UA : undefined, timezoneId: 'America/New_York' }); await c.addInitScript(CLS_INIT); await c.route('**/api/funnel', (r) => r.abort()); return c; };
  // A. fold vs fixed tab bar at 390, /m and /signup (hard loads), plus per-page CLS for /signup hard load
  {
    const c = await mk(390, 844, true); const p = await c.newPage();
    for (const u of [`/m/${MID}?ref=abcd1234`, `/signup?next=%2Fm%2F${MID}`, '/pricing', '/']) {
      await p.goto(BASE + u, { waitUntil: 'networkidle', timeout: 60000 }); await p.waitForTimeout(3000);
      const r = await p.evaluate(() => {
        const nav = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().height > 0);
        const navTop = nav ? nav.getBoundingClientRect().top : innerHeight;
        const want = [...document.querySelectorAll('main a, main button')].filter((a) => /^(Sign up free|Create account|Continue with Google|Start free|Start trial)$/.test(a.innerText.trim()));
        const nt = performance.getEntriesByType('navigation')[0];
        return { navTop: Math.round(navTop), cls: +window.__cls.toFixed(4), lcp: Math.round(window.__lcp), ttfb: Math.round(nt.responseStart), dcl: Math.round(nt.domContentLoadedEventEnd), load: Math.round(nt.loadEventEnd),
          ctas: want.slice(0, 4).map((a) => { const bb = a.getBoundingClientRect(); return `${a.innerText.trim()} top=${Math.round(bb.top)} bottom=${Math.round(bb.bottom)} visibleAboveTabBar=${bb.bottom <= navTop} clearance=${Math.round(navTop - bb.bottom)}`; }) };
      });
      console.log('A390', u, JSON.stringify(r));
    }
    await c.close();
  }
  // B. state availability real path: home card "Check your state" -> pick restricted -> back -> note
  for (const [w, h, mob] of [[390, 844, true], [1440, 900, false]]) {
    const c = await mk(w, h, mob, 2); const p = await c.newPage();
    const bad = []; p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); }); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
    await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    const before = await p.evaluate(() => [...document.querySelectorAll('a, button')].filter((a) => /Check your state/.test(a.innerText)).slice(0, 1).map((a) => { const r = a.getBoundingClientRect(); return `${a.tagName} "${a.innerText}" [${Math.round(r.width)}x${Math.round(r.height)}]`; }));
    console.log('B', w, 'state link on home:', before);
    await p.locator('text=Check your state').first().scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/prod-${w}-8a-home-check-your-state.png` });
    await Promise.all([p.waitForURL(/\/state/), p.locator('text=Check your state').first().click()]);
    await p.waitForLoadState('networkidle'); await p.waitForTimeout(800);
    console.log('B', w, 'state page url', p.url());
    const opts = await p.evaluate(() => { const s = document.querySelector('select'); return s ? { name: s.name, n: s.options.length, box: (() => { const r = s.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; })(), labelFor: document.querySelector('label')?.innerText } : null; });
    console.log('B', w, 'select', JSON.stringify(opts));
    // pick Nevada (often restricted)
    await p.selectOption('select', { label: 'Nevada' }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/prod-${w}-8b-state-picked.png` });
    console.log('B', w, 'after pick url', p.url(), 'text:', (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').replace(/Alabama.*Wyoming/, '[states]').slice(0, 600));
    const btns = await p.evaluate(() => [...document.querySelectorAll('main button, main a')].filter((x) => /save|done|back|continue/i.test(x.innerText)).map((x) => x.tagName + ':' + x.innerText.trim() + '->' + (x.getAttribute('href') || '')));
    console.log('B', w, 'buttons', btns);
    const save = p.locator('main button', { hasText: /save|done|continue/i }).first();
    if (await save.count()) { await save.click(); await p.waitForTimeout(2000); }
    else { const back = p.locator('main a', { hasText: /back/i }).first(); if (await back.count()) { await back.click(); await p.waitForTimeout(2000); } }
    await p.waitForLoadState('networkidle').catch(() => {});
    console.log('B', w, 'after save url', p.url());
    const notes = await p.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && /available|Nevada|your state/i.test(e.textContent)).slice(0, 8).map((e) => e.textContent.trim().slice(0, 120)));
    console.log('B', w, 'notes', JSON.stringify(notes));
    const n = p.locator('text=/Nevada/').first(); if (await n.count()) await n.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/prod-${w}-8c-home-after-state.png` });
    console.log('B', w, 'bad', bad, 'errs', errs);
    await c.close();
  }
  // C. "Add to combo checker" from the teaser, signed out
  for (const [w, h, mob] of [[390, 844, true]]) {
    const c = await mk(w, h, mob, 2); const p = await c.newPage();
    const bad = []; p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.request().method() + ' ' + r.url() + ' srv=' + (r.headers()['server'] || '') + ' ' + (r.headers()['x-vercel-mitigated'] || '') ); });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
    await p.goto(`${BASE}/m/${MID}`, { waitUntil: 'networkidle' });
    await Promise.all([p.waitForURL(/check\/combo/, { timeout: 30000 }), p.locator('[data-testid=teaser] a', { hasText: 'Add to combo checker' }).click()]);
    await p.waitForLoadState('domcontentloaded'); await p.waitForTimeout(8000);
    await p.screenshot({ path: `${OUT}/prod-${w}-9-combo-from-teaser.png` });
    console.log('C', w, p.url(), (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 900));
    console.log('C bad', JSON.stringify(bad, null, 1), 'errs', errs);
    await c.close();
  }
  // D. hydration loop at 1440
  {
    const c = await mk(1440, 900, false); const p = await c.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(p.url() + ' :: ' + String(e).slice(0, 120)));
    let n = 0;
    for (let i = 0; i < 3; i++) for (const u of [`/m/${MID}?ref=abcd1234`, `/signup?next=%2Fm%2F${MID}`, '/pricing', `/state?next=%2Fm%2F${MID}`, '/', `/login?next=%2Fm%2F${MID}`]) { await p.goto(BASE + u, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}); await p.waitForTimeout(800); n++; }
    console.log('D 1440 loads', n, 'errors', JSON.stringify(errs, null, 1));
    await c.close();
  }
  await b.close();
})();
