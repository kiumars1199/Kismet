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
export { handle as GET, handle as HEAD, handle as POST, handle as PATCH, handle as DELETE };

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
  if (area === "rest") return p[1] === "rpc" ? rpc(req, p[2] ?? "") : rest(req, url, p[1]);   // rest/v1/<table> | rest/v1/rpc/<fn>
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
  if (route === "admin/generate_link") {   // admin "email a sign-in link": hashed token, then /auth/callback?token_hash=
    if (caller(req) !== "admin") return json({ msg: "forbidden" }, 403);
    const u = [...db().users.values()].find((x) => x.email === body.email);
    if (!u) return json({ code: 404, msg: "User not found" }, 404);
    const hashed_token = randomUUID();
    db().codes.set(`hash:${hashed_token}`, u.email);
    return json({ ...gotrueUser(u), action_link: `${url.origin}/verify`, email_otp: "000000", hashed_token, redirect_to: "", verification_type: "magiclink" });
  }
  if (route === "verify" && body.token_hash) {
    const email = db().codes.get(`hash:${body.token_hash}`);
    if (!email) return json({ code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" }, 403);
    db().codes.delete(`hash:${body.token_hash}`);
    return json(session(signUp(email)));
  }
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

  // HEAD with Prefer: count=exact is supabase-js `select(..., { count: "exact", head: true })` (the plan-quota fast path).
  if (req.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": `*/${rows.filter(match).length}` } });
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
    const patch = (await req.json().catch(() => null)) as Row | null;
    if (!patch) return json({ code: "PGRST102", message: "Empty or invalid json" }, 400);
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
  const body = (await req.json().catch(() => null)) as Row | Row[] | null;
  if (!body) return json({ code: "PGRST102", message: "Empty or invalid json" }, 400);
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

/** The admin SQL functions (supabase/migrations/20261118000000_admin.sql), service role only, over the mock tables. */
async function rpc(req: Request, fn: string) {
  if (caller(req) !== "admin") return json({ code: "42501", message: "permission denied" }, 403);
  const a = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const subs = table("subscriptions");
  const sub = (id: string): Row => subs.find((s) => s.user_id === id) ?? {};
  const users = [...db().users.values()].sort((x, y) => y.created_at.localeCompare(x.created_at));
  const tierOf = (s: Row) => (s.comp_tier && (!s.comp_expires_at || Date.parse(String(s.comp_expires_at)) > Date.now()) ? String(s.comp_tier) : String(s.tier ?? "free"));
  if (fn === "admin_overview") {
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const today = Date.now();
    const signups = Array.from({ length: 30 }, (_, i) => {
      const d = day(new Date(today - (29 - i) * 86_400_000));
      return { day: d, n: users.filter((u) => u.created_at.slice(0, 10) === d).length };
    });
    const count = (f: (s: Row) => boolean) => subs.filter(f).length;
    const paying = (t: string) => count((s) => s.tier === t && ["active", "past_due"].includes(String(s.status)) && !!s.stripe_subscription_id);
    const active = new Set(db().refresh.values()).size;
    return json({
      users_total: users.length,
      tiers: { free: count((s) => tierOf(s) === "free"), pro: count((s) => tierOf(s) === "pro"), premium: count((s) => tierOf(s) === "premium"),
        trialing: count((s) => s.status === "trialing"), comped: count((s) => !!s.comp_tier) },
      paying: { pro: paying("pro"), premium: paying("premium") },
      canceled_this_month: count((s) => s.status === "canceled"), trials_started: count((s) => !!s.trialed_at),
      trials_converted: count((s) => !!s.trialed_at && s.status === "active"),
      active_24h: active, active_7d: active, alerts_24h: table("alert_events").length, paper_orders: 0, signups,
    });
  }
  if (fn === "admin_users") {
    const q = String(a.q ?? "").toLowerCase();
    const hit = users.filter((u) => u.email.toLowerCase().includes(q));
    const off = Number(a.off ?? 0), lim = Number(a.lim ?? 50);
    return json(hit.slice(off, off + lim).map((u) => {
      const s = sub(u.id);
      return { id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.created_at, tier: s.tier ?? "free", status: s.status ?? null,
        comp_tier: s.comp_tier ?? null, comp_expires_at: s.comp_expires_at ?? null, total: hit.length };
    }));
  }
  if (fn === "admin_user_detail") {
    const u = db().users.get(String(a.uid));
    if (!u) return json(null);
    const p = table("profiles").find((r) => r.user_id === u.id) ?? {};
    const n = (t: string) => table(t).filter((r) => r.user_id === u.id).length;
    return json({ ...sub(u.id), id: u.id, email: u.email, email_confirmed_at: u.created_at, created_at: u.created_at, last_sign_in_at: u.created_at,
      last_seen_at: u.created_at, sessions: [...db().refresh.values()].filter((x) => x === u.id).length,
      onboarded_at: p.onboarded_at ?? null, accepted_terms_at: p.accepted_terms_at ?? null,
      counts: Object.fromEntries(["presets", "dashboards", "watchlist", "alert_rules", "alert_events", "journal"].map((t) => [t, n(t)])) });
  }
  if (fn === "admin_revoke_sessions") {
    let n = 0;
    for (const [t, id] of db().refresh) if (id === a.uid) { db().refresh.delete(t); n++; }
    return json(n);
  }
  return json({ message: `mock: rpc ${fn} not implemented` }, 404);
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
  if (route === "v1/subscriptions" && req.method === "GET") {   // subscriptions.list({ customer }) (T-247)
    const customer = url.searchParams.get("customer");
    return json({ object: "list", has_more: false, url: "/v1/subscriptions", data: [...s.subs.values()].filter((x) => x.customer === customer) });
  }
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

