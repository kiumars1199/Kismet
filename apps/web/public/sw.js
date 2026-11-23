// Kismet service worker (F10). Does two things only: shows a web push, and opens the right page when it is tapped.
// It caches nothing and never intercepts a request, so pages and data are always the live ones.
// The push body is { title, body, url } from lib/alerts-server.ts: plain text, no prices in cents.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* not JSON: show the generic text below */ }
  const title = typeof data.title === "string" && data.title ? data.title : "Kismet alert";
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/alerts?tab=inbox";
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/alerts?tab=inbox";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if ("focus" in w) { await w.focus(); if ("navigate" in w) await w.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
