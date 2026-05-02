import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getRequestOriginOrAppBaseUrl } from "../_shared/app-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const METAMORPHOSIS_MONTHLY_CENTS = 4700;
const METAMORPHOSIS_PRODUCT_NAME = "The Greek Carnivore — Μεταμόρφωση";

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-METAMORPHOSIS-CHECKOUT] ${step}${tail}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    // OPTIONAL auth — checkout works for both signed-in and anonymous visitors.
    // - Signed-in: we know the user, link Stripe customer to their profile, skip
    //   email entry on Stripe Checkout.
    // - Anonymous: Stripe Checkout collects the email natively; the webhook
    //   creates the Supabase user post-payment and emails them a magic link.
    let user: { id: string; email: string | null } | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await admin.auth.getUser(token);
      if (userData?.user) {
        user = { id: userData.user.id, email: userData.user.email ?? null };
      }
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let customerId: string | undefined;
    if (user?.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({ email: user.email });
        customerId = customer.id;
      }
      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId } as never)
        .eq("id", user.id);
    }

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

    // Field names below match what stripe-webhook expects so auto-enroll works without webhook changes.
    const metadata: Record<string, string> = {
      product: "metamorphosis",
      client_user_id: user?.id ?? "",
      client_email: user?.email ?? "",
      program_name: METAMORPHOSIS_PRODUCT_NAME,
      program_template_id: programTemplateId ?? "",
      start_date: new Date().toISOString().slice(0, 10),
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: METAMORPHOSIS_PRODUCT_NAME },
            unit_amount: METAMORPHOSIS_MONTHLY_CENTS,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      subscription_data: { metadata },
      metadata,
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/metamorphosis?canceled=1`,
    };

    if (customerId) {
      sessionParams.customer = customerId;
    }
    // For anonymous subscription checkout we omit `customer` entirely — Stripe
    // collects the email at checkout and creates the customer automatically.
    // (`customer_creation` is rejected by Stripe in subscription mode.)

    const session = await stripe.checkout.sessions.create(sessionParams);

    log("session created", { sessionId: session.id, userId: user?.id ?? "(anonymous)", anon: !user });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "checkout failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
