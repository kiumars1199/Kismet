// F10: install files are served, the "Turn on phone alerts" button subscribes this device (browser push stubbed: no real
// push service, no real notification), and iPhone Safari outside the Home Screen is told to install first.
import { expect, test } from "@playwright/test";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/e2e-device";

test("manifest, icons and the service worker are served", async ({ request }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.status()).toBe(200);
  const j = await m.json();
  expect(j).toMatchObject({ name: "Kismet", display: "standalone", start_url: "/" });
  for (const i of j.icons as { src: string }[]) expect((await request.get(i.src)).status()).toBe(200);
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toMatch(/javascript/);
  expect(await sw.text()).toContain("notificationclick");
});

test("turn on phone alerts: asks permission, subscribes, saves once; turn off removes it", async ({ page }) => {
  const calls: { method: string; body: unknown }[] = [];
  await page.route("**/api/push/subscribe", async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ json: { publicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" } });
    calls.push({ method: req.method(), body: req.postDataJSON() });
    return route.fulfill({ json: { ok: true } });
  });
  await page.addInitScript((endpoint) => {
    let current: unknown = null;
    const sub = { endpoint, toJSON: () => ({ endpoint, keys: { p256dh: "p256dh-test", auth: "auth-test" } }), unsubscribe: async () => { current = null; return true; } };
    const reg = { pushManager: { getSubscription: async () => current, subscribe: async () => (current = sub) } };
    Object.defineProperty(navigator, "serviceWorker", { value: { register: async () => reg, ready: Promise.resolve(reg), getRegistration: async () => reg }, configurable: true });
    let perm: NotificationPermission = "default";
    Object.defineProperty(Notification, "permission", { get: () => perm, configurable: true });
    Notification.requestPermission = async () => (perm = "granted");
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  }, ENDPOINT);

  await page.goto("/alerts");
  const card = page.getByTestId("push-toggle");
  await expect(card.getByRole("button", { name: "Turn on phone alerts" })).toBeVisible();
  await card.getByRole("button", { name: "Turn on phone alerts" }).click();
  await expect(card.getByRole("button", { name: "Turn off" })).toBeVisible();
  expect(calls).toEqual([{ method: "POST", body: { endpoint: ENDPOINT, keys: { p256dh: "p256dh-test", auth: "auth-test" } } }]);
  await card.getByRole("button", { name: "Turn off" }).click();
  await expect(card.getByRole("button", { name: "Turn on phone alerts" })).toBeVisible();
  expect(calls[1]).toEqual({ method: "DELETE", body: { endpoint: ENDPOINT } });
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
  await expect(page.getByText("Market analytics, not financial advice. Based on past results. 18+.").first()).toBeVisible();
});

test.describe("iPhone Safari, not installed", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  test("is told to add Kismet to the Home Screen", async ({ page }) => {
    await page.addInitScript(() => { delete (window as unknown as { PushManager?: unknown }).PushManager; });
    await page.goto("/alerts");
    await expect(page.getByTestId("push-toggle")).toContainText("Add to Home Screen");
    await expect(page.getByTestId("push-toggle")).toContainText("iOS 16.4");
    await expect(page.getByRole("button", { name: "Turn on phone alerts" })).toHaveCount(0);
  });
});
