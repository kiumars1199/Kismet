import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const [port, out] = process.argv.slice(2);
const base = `http://localhost:${port}`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const DISC = "Market analytics, not financial advice. Based on past results. 18+.";
const clsInit = () => { window.__cls = 0; window.__shifts = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push(+e.value.toFixed(4)); } }).observe({ type: "layout-shift", buffered: true }); };
const svc = { authorization: "Bearer e2e-service", apikey: "e2e-anon", "content-type": "application/json" };
async function subs() { return (await (await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions`, { headers: svc })).json()); }
async function signIn(page, email) {
  await page.goto(base + "/login?next=/account");
  for (let i = 0; i < 30; i++) { try { await page.getByRole("tab", { name: "Email link" }).click({ timeout: 2000 }); await page.getByRole("button", { name: "Email me a sign-in link" }).waitFor({ timeout: 2000 }); break; } catch {} }
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  const { url } = await (await fetch(`${base}/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  for (let i = 0; i < 60; i++) {
    const p = new URL(page.url()).pathname;
    if (p === "/onboarding") { try { await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 5000 }); } catch {} }
    if (p === "/account") break;
    await page.waitForTimeout(1000);
  }
}
const results = [];
for (const w of [390, 1440]) {
  for (const plan of ["out", "free", "pro", "premium"]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    if (plan !== "out") {
      const before = new Set((await subs()).map((r) => r.user_id));
      await signIn(page, `r63-${plan}-${w}@example.com`);
      const mine = (await subs()).find((r) => !before.has(r.user_id));
      if (plan !== "free") {
        if (!mine) { console.log("no sub row for", plan, w); }
        else await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${mine.user_id}`, { method: "PATCH", headers: svc, body: JSON.stringify({ comp_tier: plan, comp_expires_at: null }) });
      }
    }
    await ctx.addInitScript(clsInit);
    const tierSeen = plan === "out" ? "out" : await page.evaluate(async () => (await (await fetch("/api/me")).json()).tier ?? "?");
    await page.goto(base + "/", { waitUntil: "load", timeout: 120000 });
    const note = page.getByTestId("venue-availability").first();
    await note.waitFor({ timeout: 60000 });
    const t0 = (await note.innerText()).trim();
    let flow = "skipped (state already set)";
    if (t0 === "Check your state") {
      await note.getByRole("link").click();
      await page.waitForURL(/\/state\?next=/, { timeout: 60000 });
      const back = new URL(page.url()).search;
      await page.getByTestId("state-select").selectOption("NV");
      await page.waitForURL((u) => u.pathname === "/", { timeout: 60000 });
      flow = `state url ${back} -> back on ${new URL(page.url()).pathname}${new URL(page.url()).search}`;
    }
    await page.getByTestId("venue-availability").filter({ hasText: "Nevada" }).first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const d = await page.evaluate((DISC) => ({ cls: +window.__cls.toFixed(4), shifts: window.__shifts, notes: [...new Set([...document.querySelectorAll("[data-testid=venue-availability]")].map((n) => n.textContent.trim()))],
      hs: document.documentElement.scrollWidth > window.innerWidth, disc: document.body.innerText.includes(DISC), cents: /¢|\bcents?\b/i.test(document.body.innerText) }), DISC);
    await page.screenshot({ path: `${out}/${plan}-${w}-after-NV.png` });
    // cold reload of "/" with the cookie set
    await page.goto(base + "/", { waitUntil: "load" });
    await page.getByTestId("venue-availability").filter({ hasText: "Nevada" }).first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => ({ cls: +window.__cls.toFixed(4), shifts: window.__shifts, first: document.querySelector("[data-testid=venue-availability]")?.textContent.trim() }));
    const line = `${w} ${plan} tier=${tierSeen} first="${t0}" ${flow} | after: cls=${d.cls} shifts=${JSON.stringify(d.shifts)} notes=${JSON.stringify(d.notes)} hscroll=${d.hs} disclaimer=${d.disc} cents=${d.cents} | reload: cls=${r.cls} shifts=${JSON.stringify(r.shifts)} first="${r.first}"`;
    console.log(line); results.push(line);
    await ctx.close();
  }
}
// open-redirect payloads, signed out
const payloads = ["%2F%09%2Fevil.example", "%2F%0A%2Fevil.example", "%2F%0D%2Fevil.example", "%2F%0D%0A%2Fevil.example", "%09%2F%2Fevil.example", "%2F%2Fevil.example",
  "%2F%5Cevil.example", "%2F%5C%2Fevil.example", "%2F%09%5Cevil.example", "%2F.%2F%2Fevil.example", "%2F..%2F%2Fevil.example", "%2F%2E%2F%2Fevil.example",
  "https%3A%2F%2Fevil.example", "javascript%3Aalert(1)", "%2F%00evil", "%2Fok%7F", "%2F%1F%2Fevil.example", "%2F%E2%80%A8%2Fevil.example", "%20%2F%2Fevil.example",
  "%2F%2509%2Fevil.example", "%2Fbets%3Fx%3D1%23why", "%2Fstate"];
for (const p of payloads) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const offsite = [];
  await ctx.route((u) => !u.href.startsWith(base), (route) => { offsite.push(route.request().url()); route.abort(); });
  const page = await ctx.newPage();
  await page.goto(`${base}/state?next=${p}`, { waitUntil: "load" });
  const href = await page.getByRole("link", { name: "Back" }).getAttribute("href").catch(() => "(no Back)");
  await page.getByTestId("state-select").selectOption("TX");
  await page.waitForTimeout(3000);
  const line = `next=${p} -> Back href=${JSON.stringify(href)} final=${page.url().replace(base, "")} offsite=${JSON.stringify(offsite)}`;
  console.log(line);
  await ctx.close();
}
await browser.close();
