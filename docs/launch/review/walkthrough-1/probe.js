const { chromium } = require('playwright');
const BASE = process.argv[2]; const MID = process.argv[3] || '6596313';
(async () => {
  const b = await chromium.launch();
  for (const tz of ['America/New_York', 'America/Los_Angeles']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: tz, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  await page.route('**/api/funnel', (r) => r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(page.url() + ' :: ' + String(e).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(page.url() + ' :: console ' + m.text().slice(0, 200)); });
  for (let i = 0; i < 3; i++) for (const u of [`/m/${MID}?ref=abcd1234`, '/signup?next=%2Fm%2F' + MID, '/pricing', `/state?next=%2Fm%2F${MID}`, '/', `/login?next=%2Fm%2F${MID}`, `/check/combo?m=${MID}`]) {
    const t0 = Date.now(); const r = await page.goto(BASE + u, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => null); await page.waitForTimeout(800);
    console.log(tz, i, u, r && r.status(), Date.now() - t0, 'ms');
  }
  console.log(tz, 'ERRORS', JSON.stringify(errs, null, 1));
  await ctx.close();
  }
  await b.close();
})();
