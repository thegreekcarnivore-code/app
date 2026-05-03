import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getRequestOriginOrAppBaseUrl } from "../_shared/app-config.ts";

// Annual upgrade checkout: €399/year (effectively 2 months free vs €47×12=€564).
// Offered to members ≥60 days into the monthly plan.
//
// Flow:
//   1. User clicks "Switch to annual" banner on /home
//   2. This function creates an embedded Stripe Checkout session for the annual price
//   3. User pays €399 → checkout.session.completed fires with metadata.product=metamorphosis_annual
//   4. stripe-webhook (separate update) detects the annual sub creation and
//      cancels the user's existing monthly subscription so they're not double-billed

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANNUAL_CENTS = 39900;
const PRODUCT_NAME = "The Greek Carnivore — Μεταμόρφωση (Annual)";

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-METAMORPHOSIS-ANNUAL] ${step}${tail}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    // Annual upgrade requires authentication — must be an existing member
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user || !user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let requestBody: { mode?: string } = {};
    try { requestBody = await req.json(); } catch { /* empty body */ }
    const embedded = requestBody?.mode === "embedded";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const c = await stripe.customers.create({ email: user.email });
      customerId = c.id;
    }
    await admin.from("profiles").update({ stripe_customer_id: customerId } as never).eq("id", user.id);

    const { data: configRow } = await admin
      .from("app_config")
      .select("value")
      .eq("key", "metamorphosis_program_template_id")
      .maybeSingle();
    const rawValue = configRow?.value as unknown;
    const programTemplateId = typeof rawValue === "string"
      ? rawValue
      : (rawValue as { value?: string } | null)?.value ?? null;

    const origin = getRequestOriginOrAppBaseUrl(req);

    const metadata: Record<string, string> = {
      product: "metamorphosis_annual",
      client_user_id: user.id,
      client_email: user.email,
      program_name: PRODUCT_NAME,
      program_template_id: programTemplateId ?? "",
      start_date: new Date().toISOString().slice(0, 10),
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      ui_mode: embedded ? "embedded" : "hosted",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: PRODUCT_NAME, description: "12 μήνες · 2 μήνες δώρο vs μηνιαία" },
            unit_amount: ANNUAL_CENTS,
            recurring: { interval: "year" },
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      subscription_data: { metadata },
      metadata,
    };

    if (embedded) {
      sessionParams.return_url = `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&plan=annual`;
    } else {
      sessionParams.success_url = `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&plan=annual`;
      sessionParams.cancel_url = `${origin}/home?annual_canceled=1`;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    log("annual session created", { sessionId: session.id, userId: user.id, embedded });

    return new Response(
      JSON.stringify({ url: session.url, client_secret: session.client_secret, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "annual checkout failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
