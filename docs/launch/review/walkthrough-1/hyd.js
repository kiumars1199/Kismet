const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2]; const BASE = 'https://kismetodds.com'; const MID = '6596313';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
(async () => {
  const b = await chromium.launch(); let hits = 0, loads = 0;
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA, timezoneId: 'America/New_York' });
  await c.route('**/api/funnel', (r) => r.abort());
  const p = await c.newPage();
  let err = null; p.on('pageerror', (e) => { err = String(e).slice(0, 200); });
  for (let i = 0; i < 6; i++) for (const u of [`/m/${MID}?ref=abcd1234`, `/signup?next=%2Fm%2F${MID}`, `/state?next=%2Fm%2F${MID}`, `/login?next=%2Fm%2F${MID}`]) {
    err = null; let html = '';
    const resp = await p.goto(BASE + u, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
    try { html = resp ? await resp.text() : ''; } catch {}
    await p.waitForTimeout(1200); loads++;
    if (err) {
      hits++;
      const dom = await p.evaluate(() => document.body.outerHTML);
      const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '\n').split('\n').map((x) => x.trim()).filter(Boolean);
      const a = strip(html.slice(html.indexOf('<body'))), d = strip(dom);
      const sa = new Set(a), sd = new Set(d);
      console.log('HIT', loads, u, err, '\n  only-in-SSR:', JSON.stringify(a.filter((x) => !sd.has(x)).slice(0, 15)), '\n  only-in-DOM:', JSON.stringify(d.filter((x) => !sa.has(x)).slice(0, 15)));
      fs.writeFileSync(`${OUT}/prod-hydration-hit${hits}-ssr.html`, html); fs.writeFileSync(`${OUT}/prod-hydration-hit${hits}-dom.html`, dom);
    }
  }
  console.log('loads', loads, 'hits', hits);
  await b.close();
})();
