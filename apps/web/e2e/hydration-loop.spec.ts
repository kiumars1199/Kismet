// T-hydr2: no hydration mismatch (React #418) at 390 with touch, on a production build. The mismatch was intermittent
// (~0.7% of loads), so each key page loads 20 times; it fails on any console "#418"/hydration message. The HTML check
// is the deterministic half: metadata is in <head> and no pending streamed boundary is left for a phone user agent.
import { devices, expect, test } from "@playwright/test";

const { defaultBrowserType: _webkit, ...PHONE } = devices["iPhone 15"];   // Chromium with the phone's viewport, UA and touch (WebKit is the iphone-* projects' job)
test.use({ ...PHONE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const PAGES = ["/", "/pricing", "/about", "/state?next=%2Fabout", "/track-record"];

test("the first HTML for a phone has its metadata in <head> and no pending streamed boundary", async ({ request }) => {
  for (const path of PAGES) {
    const res = await request.get(path, { headers: { "user-agent": PHONE.userAgent } });
    const html = await res.text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head, `${path}: <title> in head`).toContain("<title>");
    expect(html.slice(html.indexOf("</head>")), `${path}: no metadata streamed into the body`).not.toContain("<title>");
  }
});

for (const path of PAGES) {
  test(`${path} hydrates cleanly 20 times at 390 (touch)`, async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ ...PHONE, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const bad: string[] = [];
    page.on("pageerror", (e) => { if (/#4(18|23|25)|ydrat/.test(String(e))) bad.push(String(e).slice(0, 120)); });
    page.on("console", (m) => { if (/#4(18|23|25)|ydrat/.test(m.text())) bad.push(m.text().slice(0, 120)); });
    for (let i = 0; i < 20; i++) {
      await page.goto(path, { waitUntil: "load" });   // not networkidle: some pages poll
      await page.waitForTimeout(1_000);   // hydration (and any recoverable error) lands after load
    }
    expect(bad, `hydration errors on ${path}`).toEqual([]);
    await ctx.close();
  });
}
