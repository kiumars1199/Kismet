// WT1 official walk: TikTok first-time visitor. node walk.js <base> <outdir> <marketId>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.argv[2] || 'https://kismetodds.com';
const OUT = process.argv[3];
const MID = process.argv[4] || '6596313';
const TAG = process.argv[5] || 'prod';
fs.mkdirSync(OUT, { recursive: true });
const DISC = 'Market analytics, not financial advice. Based on past results. 18+.';
const log = [];
const P = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x, null, 1)).join(' '); log.push(s); console.log(s); };

const CLS_INIT = () => {
  window.__cls = 0; window.__shifts = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map((s) => { const n = s.node; return n ? (n.tagName + (n.id ? '#' + n.id : '') + '.' + String(n.className || '').slice(0, 60) + ' "' + (n.textContent || '').trim().slice(0, 40) + '"') : '?'; }) }); } } }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
};

async function audit(page, name) {
  await page.waitForTimeout(2500);
  // scroll to bottom and back to catch lazy shifts
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(800);
  const r = await page.evaluate((DISC) => {
    const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const txt = document.body.innerText;
    const cents = [];
    const re = /(\d+(?:\.\d+)?\s?¢|\bcents?\b|\$0\.\d{1,2}\b|\b0\.\d{2,}\b)/gi; let m;
    while ((m = re.exec(txt))) cents.push(txt.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\n/g, ' | '));
    const footer = document.querySelector('footer');
    const small = [];
    for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary, label:has(input[type=checkbox])')) {
      if (!vis(el)) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 44 || b.height < 44) small.push(`${el.tagName}:${(el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)} [${Math.round(b.width)}x${Math.round(b.height)}@${Math.round(b.top + scrollY)}]${el.hasAttribute('data-inline-link') ? ' (inline)' : ''}${el.closest('footer') ? ' (footer)' : ''}`);
    }
    const links = [...document.querySelectorAll('a[href]')].filter(vis).map((a) => ({ t: (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50), h: a.href, box: (() => { const b = a.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}@${Math.round(b.top + scrollY)}`; })() }));
    const over = [];
    for (const el of document.querySelectorAll('body *')) { const b = el.getBoundingClientRect(); if (b.right > innerWidth + 1 && vis(el)) over.push(el.tagName + '.' + String(el.className).slice(0, 50) + ' r=' + Math.round(b.right)); if (over.length > 8) break; }
    return {
      title: document.title, url: location.href,
      h1: [...document.querySelectorAll('h1')].map((h) => h.innerText),
      cls: +window.__cls.toFixed(4), shifts: window.__shifts,
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth, hscroll: document.documentElement.scrollWidth > innerWidth,
      overflowing: over,
      height: document.documentElement.scrollHeight,
      disclaimerInFooter: !!footer && footer.innerText.includes(DISC), disclaimerCount: txt.split(DISC).length - 1,
      cents, small, links,
      text: txt.replace(/\n+/g, ' | ').slice(0, 3000),
    };
  }, DISC);
  r.name = name;
  return r;
}

async function run(width, height, mobile, dsf, shots) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile,
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined,
    extraHTTPHeaders: {},
  });
  await ctx.addInitScript(CLS_INIT);
  const page = await ctx.newPage();
  const errors = [], cons = [], bad = [], blocked = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') cons.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.request().method() + ' ' + r.url()); });
  page.on('requestfailed', (r) => { const f = r.failure(); if (!/ERR_ABORTED/.test(f?.errorText || '') || !blocked.includes(r.url())) bad.push('FAILED ' + r.url() + ' ' + (f && f.errorText)); });
  // no writes to live analytics: abort every non-GET to the site except the cookie-only invite ref
  await page.route('**/*', (route) => {
    const req = route.request();
    if (req.method() !== 'GET' && req.method() !== 'HEAD' && req.url().startsWith(BASE) && !req.url().includes('/api/invite/ref')) { blocked.push(req.method() + ' ' + req.url()); return route.abort(); }
    return route.continue();
  });
  const res = [];
  const tag = `${width}`;
  const shot = async (n) => {
    if (!shots) return;
    await page.screenshot({ path: path.join(OUT, `${TAG}-${tag}-${n}-fold.png`) });
    await page.screenshot({ path: path.join(OUT, `${TAG}-${tag}-${n}-full.png`), fullPage: true });
  };
  const step = async (n, fn) => {
    const t0 = Date.now();
    let status = null;
    try { status = await fn(); } catch (e) { P(`!! step ${n} failed: ${e}`); }
    const ms = Date.now() - t0;
    const a = await audit(page, n);
    a.status = status; a.loadMs = ms;
    res.push(a);
    await shot(n);
  };

  // 1. TikTok tap: shared bet link with ref
  await step('1-m', async () => { const r = await page.goto(`${BASE}/m/${MID}?ref=abcd1234`, { referer: 'https://www.tiktok.com/', waitUntil: 'networkidle', timeout: 60000 }); return r && r.status(); });
  const cookies = await ctx.cookies();
  const inviteCookie = cookies.find((c) => c.name === 'me_invite');
  const teaser = await page.evaluate(() => ({
    closesIn: document.querySelector('[data-testid=teaser-closes-in]')?.parentElement?.innerText,
    price: document.querySelector('[data-testid=teaser-price]')?.innerText,
    verdict: document.querySelector('[data-testid=teaser-verdict]')?.innerText,
    sub: [...document.querySelectorAll('[data-testid=teaser] header p')].map((p) => p.innerText),
    body: document.querySelector('[data-testid=teaser] section')?.innerText,
    og: { t: document.querySelector('meta[property="og:title"]')?.content, d: document.querySelector('meta[property="og:description"]')?.content, i: document.querySelector('meta[property="og:image"]')?.content, tw: document.querySelector('meta[name="twitter:card"]')?.content },
    signupHref: [...document.querySelectorAll('[data-testid=teaser] a')].map((a) => a.innerText + ' -> ' + a.getAttribute('href')),
    ctaTop: (() => { const a = [...document.querySelectorAll('[data-testid=teaser] a')].find((x) => /Sign up free/.test(x.innerText)); if (!a) return null; const b = a.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width), inFold: b.bottom <= innerHeight }; })(),
  }));
  // 2. tap "Sign up free" in the teaser
  await step('2-signup-from-m', async () => {
    const a = page.locator('[data-testid=teaser] a', { hasText: 'Sign up free' });
    await Promise.all([page.waitForURL(/\/signup/, { timeout: 30000 }), a.click()]);
    await page.waitForLoadState('networkidle').catch(() => {});
    return 'nav';
  });
  const signup = await page.evaluate(() => ({
    url: location.href,
    lead: [...document.querySelectorAll('main p, main h1, main h2')].slice(0, 6).map((p) => p.innerText),
    nextField: [...document.querySelectorAll('input[name=next]')].map((i) => i.value),
    headerSignup: [...document.querySelectorAll('header a')].filter((a) => /sign up/i.test(a.innerText)).map((a) => { const b = a.getBoundingClientRect(); return a.innerText + ' ' + a.getAttribute('href') + ' vis=' + (b.width > 0); }),
    navSignup: [...document.querySelectorAll('nav a')].filter((a) => /sign up/i.test(a.innerText)).map((a) => { const b = a.getBoundingClientRect(); return a.innerText + ' ' + a.getAttribute('href') + ' vis=' + (b.width > 0 && getComputedStyle(a).display !== 'none') + ' cur=' + a.getAttribute('aria-current') + ' @' + Math.round(b.top); }),
    oauthNext: [...document.querySelectorAll('a[href*="oauth"], a[href*="google"], form[action]')].map((x) => x.getAttribute('href') || x.getAttribute('action')),
    mainBtn: (() => { const b = [...document.querySelectorAll('main button')].map((x) => { const r = x.getBoundingClientRect(); return x.innerText.trim() + ' @' + Math.round(r.top) + ' h' + Math.round(r.height) + ' inFold=' + (r.bottom <= innerHeight); }); return b; })(),
  }));
  // 3. pricing (via header/footer link click to also test nav)
  await step('3-pricing', async () => {
    const r = await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle', timeout: 60000 }); return r && r.status();
  });
  const pricing = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2, h3')].map((x) => { const b = x.getBoundingClientRect(); return x.innerText.replace(/\s+/g, ' ').slice(0, 50) + ' @' + Math.round(b.top + scrollY); });
    const hdr = document.querySelector('main header') || document.querySelector('article header');
    const hb = hdr ? hdr.getBoundingClientRect() : null;
    return { headings: h.slice(0, 15), header: hdr ? hdr.innerText : null, headerBox: hb ? `${Math.round(hb.height)}px tall, bottom @${Math.round(hb.bottom + scrollY)}` : null, innerH: innerHeight, freeRow: [...document.querySelectorAll('td, li, p')].map((x) => x.innerText).filter((t) => /picked at random|chosen at random/.test(t)).slice(0, 3) };
  });
  // 4. state availability (signed out) via /state
  await step('4-state', async () => { const r = await page.goto(`${BASE}/state?next=${encodeURIComponent('/m/' + MID)}`, { waitUntil: 'networkidle', timeout: 60000 }); return r && r.status(); });
  // 5. back on the bet, scroll to footer + help line
  await step('5-m-footer', async () => { const r = await page.goto(`${BASE}/m/${MID}`, { waitUntil: 'networkidle', timeout: 60000 }); await page.locator('footer').scrollIntoViewIfNeeded(); return r && r.status(); });
  const help = await page.evaluate(() => {
    const h = document.querySelector('[data-testid=helpline]');
    const bottomNav = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed');
    const nb = bottomNav ? bottomNav.getBoundingClientRect() : null;
    return { text: h?.innerText, links: h ? [...h.querySelectorAll('a')].map((a) => { const b = a.getBoundingClientRect(); return `${a.innerText} -> ${a.getAttribute('href')} [${Math.round(b.width)}x${Math.round(b.height)}]`; }) : null, bottomNavTop: nb && Math.round(nb.top), innerH: innerHeight };
  });
  if (shots) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${TAG}-${tag}-5b-footer-bottom.png`) });
  }
  // also home: where the visitor ends up from the header logo
  await step('6-home', async () => { const r = await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 }); return r && r.status(); });
  // /login from teaser (header Sign up visibility on /login)
  await step('7-login-from-m', async () => { const r = await page.goto(`${BASE}/login?next=${encodeURIComponent('/m/' + MID)}`, { waitUntil: 'networkidle', timeout: 60000 }); return r && r.status(); });
  const login = await page.evaluate(() => ({ headerSignup: [...document.querySelectorAll('header a')].filter((a) => /sign up/i.test(a.innerText)).map((a) => a.innerText + ' ' + a.getAttribute('href')), lead: [...document.querySelectorAll('main p, main h1')].slice(0, 4).map((p) => p.innerText) }));

  await browser.close();
  return { width, dsf, res, teaser, signup, pricing, help, login, inviteCookie: inviteCookie ? { name: inviteCookie.name, value: inviteCookie.value, httpOnly: inviteCookie.httpOnly } : null, errors, cons, bad, blocked };
}

(async () => {
  const all = {};
  for (const [w, h, mob] of [[390, 844, true], [1440, 900, false]]) {
    P(`\n##### ${TAG} ${w}x${h} checks (DSF 1)`);
    const c = await run(w, h, mob, 1, false);
    all[`${w}-check`] = c;
    for (const r of c.res) {
      P(`\n=== ${w} ${r.name} status=${r.status} load=${r.loadMs}ms url=${r.url}`);
      P({ title: r.title, h1: r.h1, cls: r.cls, shifts: r.shifts, hscroll: r.hscroll, scrollW: r.scrollW, overflowing: r.overflowing, height: r.height, disclaimerInFooter: r.disclaimerInFooter, cents: r.cents, small: r.small });
      P('TEXT: ' + r.text);
    }
    P('\nTEASER', c.teaser); P('SIGNUP', c.signup); P('PRICING', c.pricing); P('HELP', c.help); P('LOGIN', c.login);
    P('INVITE COOKIE', c.inviteCookie); P('PAGE ERRORS', c.errors); P('CONSOLE', c.cons); P('HTTP>=400/FAILED', c.bad); P('BLOCKED (not sent)', c.blocked);
    P(`\n##### ${TAG} ${w}x${h} evidence screenshots (DSF 2)`);
    const s = await run(w, h, mob, 2, true);
    all[`${w}-shots`] = { cls: s.res.map((r) => [r.name, r.cls, r.loadMs]), errors: s.errors, bad: s.bad };
    P('DSF2 run CLS/load', all[`${w}-shots`].cls, 'errors', s.errors, 'bad', s.bad);
  }
  // collect links for broken-link check
  const links = new Set();
  for (const k of Object.keys(all)) if (all[k].res) for (const r of all[k].res) for (const l of r.links) links.add(l.h);
  fs.writeFileSync(path.join(OUT, `${TAG}-links.txt`), [...links].join('\n'));
  fs.writeFileSync(path.join(OUT, `${TAG}-walk.json`), JSON.stringify(all, null, 1));
  fs.writeFileSync(path.join(OUT, `${TAG}-walk.log`), log.join('\n'));
})();
