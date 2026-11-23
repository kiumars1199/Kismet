const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.route('**/api/funnel', (r) => r.abort());
  await p.goto('https://kismetodds.com/pricing', { waitUntil: 'networkidle' });
  console.log(await p.evaluate(() => [...document.querySelectorAll('a[href]')].filter((a) => !a.innerText.trim()).map((a) => { const b = a.getBoundingClientRect(); return a.outerHTML.slice(0, 300) + ' | label=' + a.getAttribute('aria-label') + ' [' + Math.round(b.width) + 'x' + Math.round(b.height) + '@' + Math.round(b.top + scrollY) + '] parent=' + a.parentElement.outerHTML.slice(0, 200); })));
  // pricing "How it did in testing" details
  console.log(await p.evaluate(() => [...document.querySelectorAll('details')].map((d) => { const s = d.querySelector('summary').getBoundingClientRect(); return d.querySelector('summary').innerText + ' open=' + d.open + ' [' + Math.round(s.width) + 'x' + Math.round(s.height) + '@' + Math.round(s.top + scrollY) + ']'; })));
  const d = p.locator('summary', { hasText: 'How it did in testing' }); await d.click(); await p.waitForTimeout(500);
  console.log('EXPANDED:', await p.evaluate(() => [...document.querySelectorAll('details')].find((d) => /How it did/.test(d.innerText))?.innerText));
  await p.screenshot({ path: process.argv[2] + '/prod-390-3b-pricing-testing-open.png' });
  await b.close();
})();
