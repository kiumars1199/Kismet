// e2e only (S7, account delete): in-memory stand-ins for Supabase (GoTrue + the PostgREST calls this app makes)
// and Stripe (checkout, portal, subscriptions), so the paid flows run without keys. 404 unless E2E_MOCK=1 and
// NODE_ENV isn't production. Stripe's SDK reaches /v1/* here through the next.config rewrite.
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type User = { id: string; email: string; created_at: string };
const g = globalThis as unknown as { __e2eMock?: ReturnType<typeof fresh> };
const fresh = () => ({
  users: new Map<string, User>(),                 // id → user
  codes: new Map<string, string>(),               // auth code → email
  inbox: new Map<string, string>(),               // email → magic link
  refresh: new Map<string, string>(),             // refresh token → user id
  tables: new Map<string, Row[]>(),
  stripe: { sessions: new Map<string, Row>(), subs: new Map<string, Row>() },
});
const db = () => (g.__e2eMock ??= fresh());
const table = (t: string) => db().tables.get(t) ?? (db().tables.set(t, []), db().tables.get(t)!);

const enabled = () => process.env.E2E_MOCK === "1" && process.env.NODE_ENV !== "production";
const json = (body: unknown, status = 200) => Response.json(body, { status });
const b64u = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

type Ctx = { params: Promise<{ path: string[] }> };
const handle = async (req: Request, { params }: Ctx) => {
  if (!enabled()) return new Response("Not found", { status: 404 });
  const [svc, ...rest] = (await params).path;
  if (svc === "supabase") return supabase(req, rest);
  if (svc === "stripe") return stripe(req, rest);
  return json({ error: "unknown mock" }, 404);
};
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };

// ------------------------------------------------------------------ Supabase
function session(user: User) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${b64u({ alg: "none", typ: "JWT" })}.${b64u({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp })}.mock`;
  const refresh_token = randomUUID();
  db().refresh.set(refresh_token, user.id);
  return { access_token, refresh_token, token_type: "bearer", expires_in: 3600, expires_at: exp, user: gotrueUser(user) };
}
const gotrueUser = (u: User) => ({
  id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: u.created_at,
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: u.created_at, updated_at: u.created_at,
});
function signUp(email: string): User {
  const found = [...db().users.values()].find((u) => u.email === email);
  if (found) return found;
  const u = { id: randomUUID(), email, created_at: new Date().toISOString() };
  db().users.set(u.id, u);
  table("profiles").push({ user_id: u.id, accepted_terms_at: null, onboarded_at: null, created_at: u.created_at });   // handle_new_user()
  table("subscriptions").push({ user_id: u.id, tier: "free", stripe_customer_id: null, stripe_subscription_id: null, status: null, current_period_end: null, cancel_at_period_end: false, trialed_at: null });
  return u;
}
/** Bearer → "admin" (service role), a user id, or null (anon). */
function caller(req: Request): "admin" | string | null {
  const t = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (t && t === process.env.SUPABASE_SERVICE_ROLE_KEY) return "admin";
  try {
    const sub = JSON.parse(Buffer.from(t.split(".")[1] ?? "", "base64url").toString()).sub as string;
    return db().users.has(sub) ? sub : null;
  } catch { return null; }
}

async function supabase(req: Request, path: string[]) {
  const url = new URL(req.url);
  const [area, ...p] = path;
  if (area === "_inbox") return json({ url: db().inbox.get(url.searchParams.get("email") ?? "") ?? null });
  if (area === "_reset") { g.__e2eMock = fresh(); return json({}); }
  if (area === "auth") return gotrue(req, url, p.slice(1));   // auth/v1/...
  if (area === "rest") return rest(req, url, p[1]);             // rest/v1/<table>
  return json({ error: "unknown" }, 404);
}

async function gotrue(req: Request, url: URL, p: string[]) {
  const route = p.join("/");
  const body = req.method === "GET" || req.method === "DELETE" ? {} : await req.json().catch(() => ({}));
  if (route === "otp") {
    const code = randomUUID();
    db().codes.set(code, body.email);
    const to = new URL(url.searchParams.get("redirect_to") ?? `${url.origin}/auth/callback`);
    to.searchParams.set("code", code);
    db().inbox.set(body.email, to.toString());
    return json({});
  }
  if (route === "token") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "pkce") {
      const email = db().codes.get(body.auth_code);
      if (!email) return json({ code: 400, error_code: "flow_state_not_found", msg: "invalid code" }, 400);
      db().codes.delete(body.auth_code);
      return json(session(signUp(email)));
    }
    if (grant === "refresh_token") {
      const uid = db().refresh.get(body.refresh_token);
      const u = uid && db().users.get(uid);
      return u ? json(session(u)) : json({ code: 400, error_code: "refresh_token_not_found", msg: "invalid refresh token" }, 400);
    }
  }
  if (route === "user") {
    const who = caller(req);
    const u = who && who !== "admin" ? db().users.get(who) : undefined;
    return u ? json(gotrueUser(u)) : json({ code: 401, error_code: "bad_jwt", msg: "invalid JWT" }, 401);
  }
  if (route === "logout") return new Response(null, { status: 204 });
  if (p[0] === "admin" && p[1] === "users" && p[2]) {
    if (caller(req) !== "admin") return json({ msg: "forbidden" }, 403);
    const u = db().users.get(p[2]);
    if (!u) return json({ code: 404, msg: "User not found" }, 404);
    if (req.method === "DELETE") {
      db().users.delete(u.id);
      for (const [t, rows] of db().tables) db().tables.set(t, rows.filter((r) => r.user_id !== u.id));   // on delete cascade
      return json({});
    }
    return json(gotrueUser(u));
  }
  return json({ msg: `mock: ${req.method} ${route} not implemented` }, 404);
}

/** The PostgREST subset this app uses: eq / is.null filters, order, insert, update, upsert, delete, single. RLS = own rows. */
async function rest(req: Request, url: URL, name: string) {
  const who = caller(req);
  if (!who || (name === "stripe_events" && who !== "admin")) return json([], 200);
  const filters = [...url.searchParams].filter(([k]) => !["select", "order", "on_conflict", "limit", "columns"].includes(k));
  const match = (r: Row) =>
    (who === "admin" || r.user_id === who) &&
    filters.every(([k, v]) => (v === "is.null" ? r[k] == null : v.startsWith("eq.") ? String(r[k]) === v.slice(3) : true));
  const rows = table(name);
  const prefer = req.headers.get("prefer") ?? "";
  const single = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
  const reply = (out: Row[], status = 200) => {
    if (single) return out.length === 1 ? json(out[0], status) : json({ code: "PGRST116", message: "not one row" }, 406);
    return prefer.includes("return=representation") || req.method === "GET" ? json(out, status) : new Response(null, { status: status === 200 ? 204 : status });
  };

  if (req.method === "GET") {
    let out = rows.filter(match);
    const order = url.searchParams.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      out = [...out].sort((a, b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")) * (dir === "desc" ? -1 : 1));
    }
    return reply(out);
  }
  if (req.method === "PATCH") {
    const patch = (await req.json()) as Row;
    const hit = rows.filter(match);
    for (const r of hit) Object.assign(r, patch);
    return reply(hit);
  }
  if (req.method === "DELETE") {
    const hit = rows.filter(match);
    db().tables.set(name, rows.filter((r) => !hit.includes(r)));
    return reply(hit);
  }
  // POST: insert or upsert
  const body = (await req.json()) as Row | Row[];
  const conflict = url.searchParams.get("on_conflict")?.split(",");
  const out: Row[] = [];
  for (const raw of Array.isArray(body) ? body : [body]) {
    const row: Row = { ...raw };
    if (who !== "admin") {
      if (row.user_id && row.user_id !== who) return json({ code: "42501", message: "row-level security" }, 403);
      row.user_id = who;
    }
    const existing = conflict && rows.find((r) => conflict.every((c) => r[c] === row[c]));
    if (existing) {
      if (prefer.includes("ignore-duplicates")) continue;
      if (prefer.includes("merge-duplicates")) { Object.assign(existing, row); out.push(existing); continue; }
      return json({ code: "23505", message: "duplicate key" }, 409);
    }
    const r = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
    rows.push(r);
    out.push(r);
  }
  return reply(out, 201);
}

// ------------------------------------------------------------------ Stripe
const form = async (req: Request) => Object.fromEntries(new URLSearchParams(await req.text()));
const now = () => Math.floor(Date.now() / 1000);

async function stripe(req: Request, path: string[]) {
  const url = new URL(req.url);
  const s = db().stripe;
  const route = path.join("/");
  if (route === "v1/checkout/sessions" && req.method === "POST") {
    const f = await form(req);
    const id = `cs_test_${randomUUID().slice(0, 8)}`;
    const session = {
      id, object: "checkout.session", mode: "subscription", client_reference_id: f.client_reference_id,
      customer: f.customer ?? `cus_${randomUUID().slice(0, 8)}`, price: f["line_items[0][price]"],
      user_id: f["subscription_data[metadata][user_id]"], trial: !!f["subscription_data[trial_period_days]"],
      success_url: f.success_url, url: `${url.origin}/e2e-mock/stripe/pay/${id}`,
    };
    s.sessions.set(id, session);
    return json(session);
  }
  if (route === "v1/billing_portal/sessions" && req.method === "POST") return json({ id: "bps_test", object: "billing_portal.session", url: `${url.origin}/account` });
  if (path[0] === "v1" && path[1] === "subscriptions" && path[2]) {
    const sub = s.subs.get(path[2]);
    if (!sub) return json({ error: { type: "invalid_request_error", code: "resource_missing", message: "No such subscription" } }, 404);
    if (req.method === "DELETE") Object.assign(sub, { status: "canceled", canceled_at: now() });
    return json(sub);
  }
  // The hosted checkout page: "pays", sends the signed webhooks Stripe would, then returns to success_url.
  if (path[0] === "pay" && path[1]) {
    const cs = s.sessions.get(path[1]);
    if (!cs) return json({ error: "no session" }, 404);
    const sub = {
      id: `sub_${randomUUID().slice(0, 8)}`, object: "subscription", customer: cs.customer, status: cs.trial ? "trialing" : "active",
      metadata: { user_id: cs.user_id }, cancel_at_period_end: false, trial_start: cs.trial ? now() : null,
      items: { object: "list", data: [{ id: "si_test", object: "subscription_item", current_period_end: now() + 7 * 86400, price: { id: cs.price, object: "price", unit_amount: null, metadata: {} } }] },
    };
    s.subs.set(sub.id, sub);
    for (const [type, object] of [["checkout.session.completed", { ...cs, subscription: sub.id }], ["customer.subscription.created", sub]] as const) {
      const payload = JSON.stringify({ id: `evt_${randomUUID().slice(0, 8)}`, object: "event", type, created: now(), data: { object } });
      const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET ?? "" });
      const res = await fetch(`${url.origin}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
      if (!res.ok) return json({ error: `webhook ${type} → ${res.status}` }, 502);
    }
    return Response.redirect(String(cs.success_url), 303);
  }
  return json({ error: { type: "invalid_request_error", message: `mock: ${req.method} ${route} not implemented` } }, 404);
}

