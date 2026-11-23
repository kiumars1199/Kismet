import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cronAuthorized } from "@/lib/cron";
import { GET as alertsGet, POST as alertsPost } from "@/app/api/alerts/run/route";
import { GET as settleGet } from "@/app/api/settle/run/route";
import { GET as lifecycleGet } from "@/app/api/lifecycle/run/route";

const req = (auth?: string) => new Request("http://test/api/alerts/run", { headers: auth ? { authorization: auth } : {} });

afterEach(() => vi.unstubAllEnvs());

describe("cron auth", () => {
  it("accepts only the exact bearer secret", () => {
    expect(cronAuthorized(req("Bearer s3cret"), "s3cret")).toBe(true);
    expect(cronAuthorized(req("Bearer s3cre"), "s3cret")).toBe(false);
    expect(cronAuthorized(req("s3cret"), "s3cret")).toBe(false);
    expect(cronAuthorized(req(), "s3cret")).toBe(false);
  });

  it("refuses everything when CRON_SECRET is unset", () => {
    expect(cronAuthorized(req("Bearer "), "")).toBe(false);
    expect(cronAuthorized(req("Bearer undefined"), undefined)).toBe(false);
  });

  it("cron routes answer 401 without the secret and 200 with it", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    for (const h of [alertsGet, alertsPost, settleGet, lifecycleGet]) {
      expect((await h(req())).status).toBe(401);
      expect((await h(req("Bearer nope"))).status).toBe(401);
      expect((await h(req("Bearer s3cret"))).status).toBe(200);
    }
  });

  it("vercel.json schedules every cron route", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(v.crons.map((c: { path: string }) => c.path).sort()).toEqual(["/api/alerts/run", "/api/lifecycle/run", "/api/settle/run"]);
    expect(v.crons.find((c: { path: string }) => c.path === "/api/alerts/run").schedule).toBe("0 13 * * *");   // daily on Vercel Hobby (T-265); */5 again on Pro;
  });
});

describe("F16: big-trade alerts run after every scan (refresh.yml)", () => {
  const yml = readFileSync("../../.github/workflows/refresh.yml", "utf8");
  const step = yml.slice(yml.indexOf("- name: Run big-trade alerts"));
  it("POSTs /api/alerts/run?kind=bigtrade with the cron secret after the upload, and never fails the refresh", () => {
    expect(yml.indexOf("- name: Run big-trade alerts")).toBeGreaterThan(yml.indexOf("- name: Upload outputs to the Supabase bucket"));
    const body = step.slice(0, step.indexOf("\n      - name:", 10) > 0 ? step.indexOf("\n      - name:", 10) : undefined);
    expect(body).toMatch(/continue-on-error: true/);
    expect(body).toMatch(/secrets\.CRON_SECRET/);
    expect(body).toMatch(/-X POST/);
    expect(body).toMatch(/Authorization: Bearer \$CRON_SECRET/);
    expect(body).toMatch(/\/api\/alerts\/run\?kind=bigtrade/);
  });
  it("an unknown kind is a 400, not a full run", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const r = await alertsPost(new Request("http://test/api/alerts/run?kind=nope", { method: "POST", headers: { authorization: "Bearer s3cret" } }));
    expect(r.status).toBe(400);
  });
});
