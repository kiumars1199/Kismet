// public/sw.js runs in the browser's service worker scope, so we load it into a vm context
// with a fake `self` and fire its listeners. A notification must only ever open a page on
// our own origin, whatever the push payload says.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SRC = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");
const ORIGIN = "https://kismetodds.com";

function load() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const showNotification = vi.fn(async (_t: string, _o: unknown) => undefined);
  const openWindow = vi.fn(async (_u: string) => null);
  const self = {
    location: { origin: ORIGIN, href: `${ORIGIN}/sw.js` },
    addEventListener: (type: string, fn: (e: unknown) => void) => { handlers[type] = fn; },
    skipWaiting: () => undefined,
    registration: { showNotification },
    clients: { claim: async () => undefined, matchAll: async () => [], openWindow },
  };
  vm.runInNewContext(SRC, { self, URL, console });
  return { handlers, showNotification, openWindow };
}

async function pushUrl(url: unknown): Promise<string> {
  const { handlers, showNotification } = load();
  let done: Promise<unknown> = Promise.resolve();
  handlers.push({ data: { json: () => ({ title: "t", body: "b", url }) }, waitUntil: (p: Promise<unknown>) => { done = p; } });
  await done;
  const opts = showNotification.mock.calls[0]![1] as unknown as { data: { url: string } };
  return opts.data.url;
}

async function clickUrl(url: unknown): Promise<string> {
  const { handlers, openWindow } = load();
  let done: Promise<unknown> = Promise.resolve();
  handlers.notificationclick({ notification: { close: () => undefined, data: { url } }, waitUntil: (p: Promise<unknown>) => { done = p; } });
  await done;
  return openWindow.mock.calls[0]![0] as unknown as string;
}

const EVIL = ["//evil.example", "/\t/evil.example", "https://evil.example", "/\\evil.example", "javascript:alert(1)"];

describe("sw.js only opens same-origin pages", () => {
  it.each(EVIL)("push payload url %j falls back to /", async (u) => {
    expect(await pushUrl(u)).toBe("/");
  });

  it.each(EVIL)("notificationclick with url %j opens /", async (u) => {
    expect(await clickUrl(u)).toBe("/");
  });

  it("keeps a same-origin path with its query and hash", async () => {
    expect(await pushUrl("/alerts?tab=inbox#x")).toBe("/alerts?tab=inbox#x");
    expect(await clickUrl("/m/abc?x=1")).toBe("/m/abc?x=1");
    expect(await pushUrl(`${ORIGIN}/alerts`)).toBe("/alerts");
  });

  it("uses the inbox when the payload has no url", async () => {
    expect(await pushUrl(undefined)).toBe("/alerts?tab=inbox");
  });
});
