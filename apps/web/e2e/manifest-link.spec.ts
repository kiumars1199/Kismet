// F10: exactly one <link rel="manifest"> in the served HTML (it was in <head> from the layout AND streamed again by Next's metadata file).
import { expect, test } from "@playwright/test";

for (const path of ["/", "/pricing", "/bets"]) {
  test(`${path} has exactly one rel=manifest link, in <head>`, async ({ request }) => {
    const html = await (await request.get(path)).text();
    expect(html.match(/<link[^>]+rel="manifest"[^>]*>/g) ?? []).toHaveLength(1);
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain('rel="manifest"');
  });
}

test("the manifest still serves", async ({ request }) => {
  const r = await request.get("/manifest.webmanifest");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("manifest+json");
  expect((await r.json()).name).toBe("Kismet");
});
