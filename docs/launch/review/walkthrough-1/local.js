const { chromium } = require('playwright');
const OUT = process.argv[2]; const BASE = 'http://localhost:3711'; const MID = process.argv[3] || '6674492';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
(async () => {
  const b = await chromium.launch();
  // warm compile
  { const p = await b.newPage(); for (const u of [`/m/${MID}`, `/signup?next=%2Fm%2F${MID}`, '/pricing', '/state', '/', '/login', `/check/combo?m=${MID}`]) await p.goto(BASE + u, { waitUntil: 'networkidle', timeout: 180000 }).catch((e) => console.log('warm fail', u, String(e).slice(0, 100))); await p.close(); }
  for (const [w, h, mob] of [[390, 844, true], [1440, 900, false]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, userAgent: mob ? UA : undefined, timezoneId: 'America/New_York', deviceScaleFactor: 2 });
    const p = await c.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(p.url() + ' :: PAGEERROR ' + String(e).slice(0, 1500)));
    p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(p.url() + ' :: ' + m.text().slice(0, 2500)); });
    const cdp = await c.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    for (let i = 0; i < 2; i++) for (const u of [`/m/${MID}?ref=abcd1234`, `/signup?next=%2Fm%2F${MID}`, '/pricing', `/state?next=%2Fm%2F${MID}`, '/', `/login?next=%2Fm%2F${MID}`]) { await p.goto(BASE + u, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {}); await p.waitForTimeout(1000); }
    console.log('HYDRATION', w, JSON.stringify(errs, null, 1));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    // combo from teaser
    const bad = []; p.on('response', async (r) => { if (r.url().includes('/api/check')) bad.push(r.status() + ' ' + r.url() + ' ' + (await r.text().catch(() => '')).slice(0, 300)); });
    await p.goto(`${BASE}/m/${MID}`, { waitUntil: 'networkidle' });
    console.log('TEASER', w, (await p.locator('[data-testid=teaser]').innerText()).replace(/\n+/g, ' | '));
    await p.screenshot({ path: `${OUT}/local-${w}-1-m-fold.png` });
    await Promise.all([p.waitForURL(/check\/combo/, { timeout: 60000 }), p.locator('[data-testid=teaser] a', { hasText: 'Add to combo checker' }).click()]);
    await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(3000);
    await p.screenshot({ path: `${OUT}/local-${w}-9-combo-from-teaser-fold.png` });
    await p.screenshot({ path: `${OUT}/local-${w}-9-combo-from-teaser-full.png`, fullPage: true });
    const r = await p.evaluate(() => ({ text: (document.querySelector('main')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 1500), hs: document.documentElement.scrollWidth > innerWidth, disc: document.querySelector('footer')?.innerText.includes('Market analytics, not financial advice. Based on past results. 18+.'), cents: /¢|\bcents?\b/.test(document.body.innerText) }));
    console.log('COMBO', w, p.url(), JSON.stringify(r)); console.log('COMBO api', w, JSON.stringify(bad, null, 1));
    await c.close();
  }
  await b.close();
})();
