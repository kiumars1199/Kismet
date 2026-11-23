const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.route('**/api/funnel', (r) => r.abort());
  p.on('response', async (r) => { if (r.url().includes('/api/check/leg')) console.log(r.status(), await r.text().catch(() => '?')); });
  await p.goto('https://kismetodds.com/check/combo?m=6596313', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(8000);
  await b.close();
})();
