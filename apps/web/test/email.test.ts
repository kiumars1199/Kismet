import { afterEach, describe, expect, it, vi } from "vitest";
import { getStore } from "@/lib/data/store";
import { sendEmail, unsubscribeToken, unsubscribeUrl, verifyUnsubscribe, type Email } from "@/lib/email";
import { alertEmail, DISCLAIMER } from "@/lib/email/templates";
import { GET as unsubGet, POST as unsubPost } from "@/app/api/unsubscribe/route";

const SECRET = "test-unsub-secret";
const BANNED = /guarantee|sure thing|can'?t lose|\block\b|\bpick\b|risk[- ]free|bet this/i;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Every template, rendered with fixture data. Add new templates here so the checks below cover them. */
async function renderAll(): Promise<Email[]> {
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://marketedge.test");
  const store = await getStore();
  const unsub = unsubscribeUrl("user-1", "rule-1");
  // Neutral question/outcome text so the wording check tests our template, not Polymarket's titles.
  return store.flags.slice(0, 20).map((m) =>
    alertEmail({ to: "a@b.test", ruleName: "NFL <favorites>", market: { ...m, question: "Test market" },
      side: { ...m.best!, outcome: "Yes" }, timeZone: "America/New_York", unsubscribeUrl: unsub }));
}

describe("email templates", () => {
  it("render with an unsubscribe link, the disclaimer and no banned wording", async () => {
    for (const e of await renderAll()) {
      expect(e.subject.length).toBeGreaterThan(0);
      for (const body of [e.html, e.text]) {
        expect(body).toContain("https://marketedge.test/api/unsubscribe?t=");
        expect(body).toContain(DISCLAIMER);
        expect(body).not.toMatch(BANNED);
      }
      expect(e.subject).not.toMatch(BANNED);
      expect(e.html).toContain("&lt;favorites&gt;"); // user text is escaped
      expect(e.html).not.toContain("<favorites>");
    }
  });

  it("sends one-click unsubscribe headers through Resend; disabled without a key", async () => {
    const [e] = await renderAll();
    expect(await sendEmail(e!)).toEqual({ sent: false });
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "MarketEdge <alerts@marketedge.test>");
    const fetchMock = vi.fn(async () => Response.json({ id: "em_1" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendEmail(e!)).toEqual({ sent: true, id: "em_1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body));
    expect(body.headers["List-Unsubscribe"]).toBe(`<${e!.unsubscribeUrl}>`);
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("unsubscribe token", () => {
  it("round-trips and rejects tampering, other secrets and expiry", () => {
    const t = unsubscribeToken("u1", "r1", SECRET, 0);
    expect(verifyUnsubscribe(t, SECRET, 1000)).toMatchObject({ u: "u1", r: "r1" });
    expect(verifyUnsubscribe(t, "other", 1000)).toBeNull();
    expect(verifyUnsubscribe(t + "x", SECRET, 1000)).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "u2", r: "r1", exp: 9e9 })).toString("base64url");
    expect(verifyUnsubscribe(`${forged}.${sig}`, SECRET, 1000)).toBeNull();
    expect(verifyUnsubscribe(`${body}.${sig}`, SECRET, 400 * 86400_000)).toBeNull(); // past 365 days
    expect(verifyUnsubscribe(t, undefined, 1000)).toBeNull();
  });
});

describe("/api/unsubscribe", () => {
  const url = (t: string) => `http://test/api/unsubscribe?t=${t}`;

  it("GET only confirms; POST removes the email channel from the rule", async () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
    const calls: [string, RequestInit | undefined][] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      calls.push([u, init]);
      return init?.method === "PATCH" ? new Response(null, { status: 204 }) : Response.json([{ id: "r1", channels: ["email", "push"] }]);
    }));
    const t = unsubscribeToken("u1", "r1");

    const g = await unsubGet(new Request(url(t)));
    expect(g.status).toBe(200);
    expect(await g.text()).toContain('<form method="post">');
    expect(calls).toHaveLength(0);

    const p = await unsubPost(new Request(url(t), { method: "POST", body: "List-Unsubscribe=One-Click" }));
    expect(p.status).toBe(200);
    expect(calls[0]![0]).toBe("https://abc.supabase.co/rest/v1/alert_rules?user_id=eq.u1&id=eq.r1&select=id,channels");
    expect(calls[1]![0]).toBe("https://abc.supabase.co/rest/v1/alert_rules?id=eq.r1");
    expect(JSON.parse(String(calls[1]![1]!.body))).toEqual({ channels: ["push"] });
  });

  it("rejects a bad token with 400 and touches nothing", async () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await unsubPost(new Request(url("bad.token"), { method: "POST" }))).status).toBe(400);
    expect((await unsubGet(new Request(url("")))).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
});
