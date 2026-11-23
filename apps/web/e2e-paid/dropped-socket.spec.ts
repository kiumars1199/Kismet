// The shared fixture (./fixtures.ts) retries an API call once when the socket drops (ECONNRESET / "socket hang up"),
// and only then: an HTTP error status or a failed assertion is never retried.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "./fixtures";

async function serve(handler: (n: number, res: http.ServerResponse, req: http.IncomingMessage) => void) {
  let hits = 0;
  const srv = http.createServer((req, res) => handler(++hits, res, req));
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, hits: () => hits, close: () => new Promise((r) => srv.close(r)) };
}

test("a request whose socket is dropped once succeeds on the retry (page.request, and a fresh browser context)", async ({ page, browser }) => {
  const s = await serve((n, res, req) => (n === 1 ? req.socket.destroy() : res.end("ok")));
  try {
    expect(await (await page.request.get(s.url)).text()).toBe("ok");
    expect(s.hits()).toBe(2);
  } finally { await s.close(); }
  const s2 = await serve((n, res, req) => (n === 1 ? req.socket.destroy() : res.end("ok")));
  const ctx = await browser.newContext();
  try {
    expect(await (await ctx.request.post(s2.url, { data: { a: 1 } })).text()).toBe("ok");
    expect(s2.hits()).toBe(2);
  } finally { await ctx.close(); await s2.close(); }
});

test("a server that always drops the socket still fails (one retry, not forever)", async ({ page }) => {
  const s = await serve((_n, _res, req) => req.socket.destroy());
  try {
    await expect(page.request.get(s.url)).rejects.toThrow(/ECONNRESET|socket hang up/);
    expect(s.hits()).toBe(2);
  } finally { await s.close(); }
});

test("an HTTP 500 is not retried", async ({ page }) => {
  const s = await serve((_n, res) => { res.statusCode = 500; res.end("no"); });
  try {
    expect((await page.request.get(s.url)).status()).toBe(500);
    expect(s.hits()).toBe(1);
  } finally { await s.close(); }
});
