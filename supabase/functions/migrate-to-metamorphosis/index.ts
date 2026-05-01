import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// €47/mo is the Metamorphosis monthly price. Anything paid above this in the current
// billing period is pro-rated and refunded (one-time, on cutover from a legacy program).
const METAMORPHOSIS_MONTHLY_CENTS = 4700;

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MIGRATE-TO-METAMORPHOSIS] ${step}${tail}`);
};

interface MigrationReport {
  customer_id: string;
  email: string | null;
  invoice_id: string;
  invoice_amount_cents: number;
  pro_rated_refund_cents: number;
  refund_id: string | null;
  status: "refunded" | "no_refund_owed" | "skipped" | "error";
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Unauthorized");
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Admin access required");
    log("Admin verified", { adminId: userData.user.id });

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dry_run ?? true);
    const onlyEmails: string[] | null = Array.isArray(body?.emails) ? (body.emails as string[]) : null;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let profileQuery = admin
      .from("profiles")
      .select("id, email, stripe_customer_id")
      .not("stripe_customer_id", "is", null);
    if (onlyEmails && onlyEmails.length > 0) profileQuery = profileQuery.in("email", onlyEmails);
    const { data: profiles, error: profilesErr } = await profileQuery;
    if (profilesErr) throw profilesErr;
    log("Profiles loaded", { count: profiles?.length ?? 0, dryRun });

    const reports: MigrationReport[] = [];
    const nowSec = Math.floor(Date.now() / 1000);

    for (const profile of profiles ?? []) {
      const customerId = (profile as { stripe_customer_id: string }).stripe_customer_id;
      try {
        const invoices = await stripe.invoices.list({
          customer: customerId,
          status: "paid",
          limit: 5,
        });
        const latest = invoices.data
          .filter((inv) => inv.amount_paid > METAMORPHOSIS_MONTHLY_CENTS)
          .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0];

        if (!latest) {
          reports.push({
            customer_id: customerId,
            email: profile.email,
            invoice_id: "",
            invoice_amount_cents: 0,
            pro_rated_refund_cents: 0,
            refund_id: null,
            status: "no_refund_owed",
            reason: "no paid invoice above €47 in last 5",
          });
          continue;
        }

        const periodStart = latest.period_start ?? latest.created ?? nowSec;
        const periodEnd = latest.period_end ?? (periodStart + 30 * 24 * 3600);
        const periodLength = Math.max(1, periodEnd - periodStart);
        const remainingSec = Math.max(0, periodEnd - nowSec);
        const overpaidCents = Math.max(0, latest.amount_paid - METAMORPHOSIS_MONTHLY_CENTS);
        const proRated = Math.floor(overpaidCents * (remainingSec / periodLength));

        if (proRated <= 0) {
          reports.push({
            customer_id: customerId,
            email: profile.email,
            invoice_id: latest.id ?? "",
            invoice_amount_cents: latest.amount_paid,
            pro_rated_refund_cents: 0,
            refund_id: null,
            status: "no_refund_owed",
            reason: "billing period already elapsed",
          });
          continue;
        }

        if (dryRun) {
          reports.push({
            customer_id: customerId,
            email: profile.email,
            invoice_id: latest.id ?? "",
            invoice_amount_cents: latest.amount_paid,
            pro_rated_refund_cents: proRated,
            refund_id: null,
            status: "refunded",
            reason: "dry run — no refund issued",
          });
          continue;
        }

        const charge = typeof latest.charge === "string"
          ? latest.charge
          : (latest.charge as { id?: string } | null)?.id;
        if (!charge) {
          reports.push({
            customer_id: customerId,
            email: profile.email,
            invoice_id: latest.id ?? "",
            invoice_amount_cents: latest.amount_paid,
            pro_rated_refund_cents: proRated,
            refund_id: null,
            status: "skipped",
            reason: "invoice has no charge id",
          });
          continue;
        }

        const refund = await stripe.refunds.create({
          charge,
          amount: proRated,
          reason: "requested_by_customer",
          metadata: { migration: "metamorphosis_cutover_2026_04_30" },
        });

        reports.push({
          customer_id: customerId,
          email: profile.email,
          invoice_id: latest.id ?? "",
          invoice_amount_cents: latest.amount_paid,
          pro_rated_refund_cents: proRated,
          refund_id: refund.id,
          status: "refunded",
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log("Refund error", { customerId, message });
        reports.push({
          customer_id: customerId,
          email: profile.email,
          invoice_id: "",
          invoice_amount_cents: 0,
          pro_rated_refund_cents: 0,
          refund_id: null,
          status: "error",
          reason: message,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, dry_run: dryRun, reports }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "migration failed";
    log("Fatal error", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
