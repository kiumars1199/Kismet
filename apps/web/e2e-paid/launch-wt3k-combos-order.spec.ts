// T-wt3k (139 r2 review): the Premium /combos list is in the page's first HTML, before the footer, so it cannot arrive after the first paint and push the
// footer down (React outlines a big <Suspense> boundary into a <template id="B:0"> that streams in later). Two checks: the raw HTML order, and the page loaded through a proxy
// that holds back every chunk after the first by 400 ms, which is what a slow connection does to a streamed response: CLS <= 0.02 at 390 and 1440.
// Fixture data, paid mock build, Premium. Screenshots (deviceScaleFactor 1) go to docs/launch/review/wt3k/ when WT3K_SHOTS=1.
import { expect, test, type Page } from "./fixtures";
import http from "node:http";
import path from "node:path";

async function signIn(page: Page, email: string) {
  await page.goto("/login?next=/account");
  await expect(async () => {
    await page.getByRole("tab", { name: "Email link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await expect(async () => {
    if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}

async function setTier(page: Page, tier: "pro" | "premium") {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier },
  });
  expect(res.status()).toBeLessThan(300);
  expect((await (await page.request.get("/api/me")).json()).tier).toBe(tier);
}

const watchCls = () => {
  const w = window as unknown as { __cls: number; __shifts: string[] };
  w.__cls = 0; w.__shifts = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Element; previousRect: DOMRect; currentRect: DOMRect }[] }[]) {
      if (e.hadRecentInput) continue;
      w.__cls += e.value;
      w.__shifts.push(`${e.value.toFixed(4)} ${(e.sources ?? []).map((s) => `${s.node?.nodeName} y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`).join(",")}`);
    }
  }).observe({ type: "layout-shift", buffered: true });
};
const shot = async (page: Page, name: string) => { if (process.env.WT3K_SHOTS) await page.screenshot({ path: path.join(__dirname, "../../../docs/launch/review/wt3k", name) }); };

/** A proxy to `origin` that sends the first chunk of an HTML response at once and holds every later chunk back by `delayMs` (a slow streamed response). Cookies are per host, not per port,
 *  so the signed-in session of the test's page is the proxy's too. */
async function slowStreamProxy(origin: string, delayMs: number): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(async (req, res) => {
    try {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string" && !["host", "connection", "accept-encoding"].includes(k)) headers[k] = v;
      const up = await fetch(origin + req.url, { method: req.method, headers, redirect: "manual" });
      const out: Record<string, string> = {};
      up.headers.forEach((v, k) => { if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(k)) out[k] = v; });
      const cookies = up.headers.getSetCookie();
      res.writeHead(up.status, { ...out, ...(cookies.length ? { "set-cookie": cookies } : {}) });
      const slow = (up.headers.get("content-type") ?? "").includes("text/html");
      const reader = up.body?.getReader();
      let first = true;
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        if (slow && !first) await new Promise((ok) => setTimeout(ok, delayMs));
        first = false;
        res.write(value);
      }
      res.end();
    } catch { res.destroy(); }
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const port = (server.address() as { port: number }).port;
  return { url: `http://localhost:${port}`, close: () => new Promise((ok) => server.close(() => ok())) };
}

test("Premium /combos: the first combo card is in the raw HTML before the footer, and nothing is left to stream in", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, `wt3k-html-${Date.now()}@example.com`);
  await setTier(page, "premium");
  const html = await (await page.request.get("/combos")).text();
  const card = html.indexOf('data-testid="combo-card"');
  const footer = html.indexOf("<footer");
  expect(card, "a combo card is in the HTML").toBeGreaterThan(-1);
  expect(footer, "the footer is in the HTML").toBeGreaterThan(-1);
  expect(card, "the first card comes before the footer").toBeLessThan(footer);
  expect(html.slice(0, footer), "no outlined boundary waits for a later chunk").not.toMatch(/<template id="B:\d+"/);
});

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test(`Premium /combos with the list's chunk held back 400 ms at ${w}x${h}: CLS <= 0.02`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signIn(page, `wt3k-slow-${w}-${Date.now()}@example.com`);
    await setTier(page, "premium");
    const origin = new URL(page.url()).origin;
    const proxy = await slowStreamProxy(origin, 400);
    try {
      await page.addInitScript(watchCls);
      const worst: number[] = [];
      for (let i = 0; i < 3; i++) {
        await page.goto(`${proxy.url}/combos`);
        await expect(page.getByTestId("combo-card").first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(1_500);
        const [v, s] = await page.evaluate(() => { const x = window as unknown as { __cls: number; __shifts: string[] }; return [x.__cls, x.__shifts] as const; });
        worst.push(v);
        console.log(`T-wt3k held-chunk CLS at ${w} #${i}: ${v.toFixed(4)} ${JSON.stringify(s)}`);
        if (i === 0) await shot(page, `combos-held-${w}.png`);
      }
      expect(Math.max(...worst)).toBeLessThan(0.02);
    } finally { await proxy.close(); }
  });
}
