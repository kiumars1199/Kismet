import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
export const { chromium } = require("@playwright/test");
export const port = process.env.PORT || "3741";
export const base = `http://localhost:${port}`;
export const out = process.env.OUT;
const svc = { authorization: "Bearer e2e-service", apikey: "e2e-anon", "content-type": "application/json" };
const subs = async () => (await (await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions`, { headers: svc })).json());
export const DISC = "Market analytics, not financial advice. Based on past results. 18+.";
export const L = (...a) => console.log(...a);
export const init = () => { window.__cls = 0; window.__s = []; window.__e = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) { const src = (e.sources || []).map((s) => (s.node?.getAttribute?.("data-testid") || s.node?.tagName) + ` y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`).join(","); window.__e.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, src }); if (!e.hadRecentInput) { window.__cls += e.value; window.__s.push(e.value.toFixed(4) + " " + src); } } }).observe({ type: "layout-shift", buffered: true }); };
export const launch = () => chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell", args: ["--disable-dev-shm-usage"] });
export async function signIn(page, plan, email) {
  const before = new Set((await subs()).map((r) => r.user_id));
  await page.goto(base + "/login");
  for (let i = 0; i < 30; i++) { try { await page.getByRole("tab", { name: "Email link" }).click({ timeout: 2000 }); await page.getByRole("button", { name: "Email me a sign-in link" }).waitFor({ timeout: 2000 }); break; } catch {} }
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  for (let k = 0; k < 6; k++) { await page.getByRole("button", { name: "Email me a sign-in link" }).click({ timeout: 5000 }).catch(() => {}); if (await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 10000 }).then(() => true, () => false)) break; }
  const { url } = await (await fetch(`${base}/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url).catch((e) => L("  (callback goto: " + e.message.split("\n")[0] + ")"));
  await page.waitForURL((u) => !/login|auth|callback/.test(u.pathname), { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const mine = (await subs()).find((r) => !before.has(r.user_id));
  if (plan !== "free") await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${mine.user_id}`, { method: "PATCH", headers: svc, body: JSON.stringify({ comp_tier: plan, comp_expires_at: null }) });
  for (let k = 0; k < 5 && /onboarding/.test(page.url()); k++) {
    await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 30000 }).catch(() => {});
    await page.waitForURL((u) => u.pathname !== "/onboarding", { timeout: 30000 }).catch(() => {});
  }
  const tier = (await (await page.request.get(base + "/api/me")).json()).tier;
  L(`signed in ${email} tier=${tier}`);
  if (tier !== plan) throw new Error(`tier ${tier} != ${plan}`);
}
export const facts = (p) => p.evaluate((DISC) => ({ url: location.pathname + location.search, cls: +(window.__cls || 0).toFixed(4), shifts: window.__s || [], disc: document.body.innerText.includes(DISC), cents: /¢|\bcents?\b/i.test(document.body.innerText), hs: document.documentElement.scrollWidth > innerWidth ? document.documentElement.scrollWidth : false }), DISC);
export const small = (p) => p.evaluate(() => {
  const r = [];
  for (const e of document.querySelectorAll("main a, main button, main summary, main input, main select, header a, header button, footer a, footer button, [data-testid=combo-tray] a, [data-testid=combo-tray] button, [role=dialog] a, [role=dialog] button")) {
    const b = e.getBoundingClientRect(); if (!b.width || !b.height || getComputedStyle(e).visibility === "hidden") continue;
    if (b.height < 44 || b.width < 44) { const inline = e.tagName === "A" && e.parentElement && /^(P|LI|SPAN)$/.test(e.parentElement.tagName) && e.parentElement.innerText.trim().length > e.innerText.trim().length + 10; r.push(`${inline ? "inline " : ""}${e.tagName.toLowerCase()}:"${(e.innerText || e.getAttribute("aria-label") || e.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40)}" ${Math.round(b.width)}x${Math.round(b.height)}`); }
  }
  return [...new Set(r)];
});
export const clsNow = (p) => p.evaluate(() => ({ cls: +(window.__cls || 0).toFixed(4), n: (window.__s || []).length, s: window.__s || [] }));
export async function delta(p, label, fn, wait = 1200) {
  const a = await clsNow(p).catch(() => ({ cls: 0, n: 0 }));
  await fn();
  await p.waitForTimeout(wait);
  const z = await clsNow(p);
  const sameDoc = z.cls >= a.cls && z.n >= a.n;
  const d = sameDoc ? +(z.cls - a.cls).toFixed(4) : z.cls;
  L(`  CLS[${label}] ${d}${sameDoc ? "" : " (new doc)"} ${JSON.stringify(sameDoc ? z.s.slice(a.n) : z.s)}`);
  return d;
}
export const skipTour = async (p) => { for (let k = 0; k < 6; k++) { const tour = p.locator("[aria-labelledby=tour-h]"); if (await tour.isVisible().catch(() => false)) { const sk = p.getByRole("button", { name: /Skip tour|^Skip$|Got it|Done/ }).first(); if (await sk.isVisible().catch(() => false)) await sk.click().catch(() => {}); else await p.keyboard.press("Escape"); await p.waitForTimeout(400); } else { await p.waitForTimeout(300); if (k > 2) break; } } };
export const rect = (loc) => loc.boundingBox().then((x) => x && { y: Math.round(x.y), h: Math.round(x.height), b: Math.round(x.y + x.height) }).catch(() => null);
