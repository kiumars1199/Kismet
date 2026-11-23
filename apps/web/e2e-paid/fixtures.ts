// Every e2e-paid spec imports { test, expect } from here instead of "@playwright/test".
//
// Why: page.request / request calls to the next dev server sometimes died with "socket hang up" / "read ECONNRESET", on a
// different paid test each CI run (paywall-pages.spec.ts:105, password.spec.ts:10, ...), right after an auth step. The
// request context pools keep-alive sockets; if the server closes one (Node's default keepAliveTimeout is 5 s, and `next
// dev` has no flag to change it) as the client reuses it, the request fails before any response. The response was never
// produced, so sending it again on a fresh socket is safe. Playwright already supports exactly this per call:
// `maxRetries` "retries network errors, currently only ECONNRESET" (never HTTP status codes, never assertions). This
// fixture makes it the default for every APIRequestContext (page.request, context.request, the `request` fixture, and
// contexts from browser.newContext) so no test has to remember it. An explicit maxRetries on a call still wins.
import { request, test as base } from "@playwright/test";

export * from "@playwright/test";

export const RETRIES_ON_DROPPED_SOCKET = 1;
let patched = false;

export const test = base.extend<object, { retryDroppedSockets: void }>({
  retryDroppedSockets: [async ({}, use) => {
    if (!patched) {
      const probe = await request.newContext();
      const proto = Object.getPrototypeOf(probe) as { fetch: (this: unknown, url: unknown, options?: Record<string, unknown>) => Promise<unknown> };
      await probe.dispose();
      const original = proto.fetch;
      proto.fetch = function (this: unknown, urlOrRequest: unknown, options: Record<string, unknown> = {}) {
        return original.call(this, urlOrRequest, { maxRetries: RETRIES_ON_DROPPED_SOCKET, ...options });
      };
      patched = true;
    }
    await use();
  }, { scope: "worker", auto: true }],
});
