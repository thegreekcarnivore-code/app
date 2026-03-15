import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getRequestOriginOrAppBaseUrl } from "../_shared/app-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Verify admin caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabaseClient.auth.getUser(token);
    if (claimsErr || !claims.user) throw new Error("Unauthorized");

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Admin access required");
    logStep("Admin verified", { adminId: claims.user.id });

    const { client_user_id, client_email, program_id, program_name, amount_cents, currency, mode, success_url, cancel_url, program_template_id, start_date } = await req.json();
    if (!client_email || !amount_cents || !program_id) {
      throw new Error("Missing required fields: client_email, amount_cents, program_id");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: client_email, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      const customer = await stripe.customers.create({ email: client_email });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    }

    // Save stripe_customer_id to profile if we have a user_id
    if (client_user_id) {
      await supabaseClient
        .from("profiles")
        .update({ stripe_customer_id: customerId } as any)
        .eq("id", client_user_id);
    }

    const paymentMode = mode === "subscription" ? "subscription" : "payment";
    const origin = getRequestOriginOrAppBaseUrl(req);

    // Build line items using price_data for dynamic amounts
    const lineItems: any[] = [{
      price_data: {
        currency: currency || "eur",
        product_data: { name: program_name || "Coaching Program" },
        unit_amount: amount_cents,
        ...(paymentMode === "subscription" ? { recurring: { interval: "month" as const } } : {}),
      },
      quantity: 1,
    }];

    const metadata: Record<string, string> = {
      program_id,
      client_user_id: client_user_id || "",
      client_email: client_email || "",
      program_name: program_name || "",
      program_template_id: program_template_id || "",
      start_date: start_date || "",
    };

    const sessionParams: any = {
      customer: customerId,
      line_items: lineItems,
      mode: paymentMode,
      success_url: success_url || `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${origin}/payment-canceled`,
      metadata,
    };

    if (paymentMode === "subscription") {
      sessionParams.subscription_data = { metadata };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Update client_programs with checkout session ID
    if (program_id) {
      await supabaseClient
        .from("client_programs")
        .update({ stripe_checkout_session_id: session.id } as any)
        .eq("id", program_id);
    }

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
