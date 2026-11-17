// Delete account (docs/14 §1): confirm by typing the email → cancel Stripe subscription → delete the
// Supabase user (every row cascades) → sign out. Stripe first: a failed cancel must not leave a paying ghost.
import { z } from "zod";
import { supabaseAdmin } from "@/lib/auth/server";
import { stripeClient } from "@/lib/billing/stripe";
import { readBody, withUser } from "@/lib/repo/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().max(254) }).strict();

export const DELETE = (req: Request) =>
  withUser(req, async ({ db, userId }) => {
    const parsed = Body.safeParse(await readBody(req).catch(() => null));
    const { data: u } = await db.auth.getUser();
    const email = u.user?.email ?? "";
    if (!parsed.success || parsed.data.email.trim().toLowerCase() !== email.toLowerCase()) {
      return Response.json({ error: "Type your account email exactly to confirm." }, { status: 400 });
    }

    const { data: sub } = await db.from("subscriptions").select("stripe_subscription_id, status").eq("user_id", userId).maybeSingle();
    const stripe = stripeClient();
    if (sub?.stripe_subscription_id && sub.status !== "canceled") {
      if (!stripe) return Response.json({ error: "Cancel your plan from Manage billing first, then delete the account." }, { status: 409 });
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== "resource_missing") {
          console.error("[account] stripe cancel failed", e instanceof Error ? e.message : e);
          return Response.json({ error: "Couldn't cancel your subscription. Nothing was deleted. Try again." }, { status: 502 });
        }
      }
    }

    const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);
    if (error) {
      console.error("[account] delete failed", error.message);
      return Response.json({ error: "Couldn't delete the account. Try again." }, { status: 502 });
    }
    await db.auth.signOut({ scope: "local" }).catch(() => {});
    return Response.json({ deleted: true });
  });
