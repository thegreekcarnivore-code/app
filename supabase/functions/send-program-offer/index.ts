import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getAppBaseUrl, getEmailLogoUrl } from "../_shared/app-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PROGRAM-OFFER] ${step}${detailsStr}`);
};

const FROM_EMAIL = "The Greek Carnivore <noreply@thegreekcarnivore.com>";
const LOGO_URL = getEmailLogoUrl();

function formatGreekDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
    return d.toLocaleDateString("el-GR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function buildOfferEmail(params: {
  programName: string;
  durationWeeks: number;
  amount: number;
  currency: string;
  startDate: string;
  installments: number;
  checkoutUrl: string;
}): string {
  const { programName, durationWeeks, amount, currency, startDate, installments, checkoutUrl } = params;
  const months = Math.round(durationWeeks / 4.33);
  const durationLabel = months >= 2 ? `${months} μήνες` : `${durationWeeks} εβδομάδες`;
  const formattedStart = formatGreekDate(startDate);
  const currencySymbol = currency === "eur" ? "€" : currency.toUpperCase();
  const priceLabel = installments > 1
    ? `${installments} × ${currencySymbol}${(amount / installments).toFixed(0)}`
    : `${currencySymbol}${amount}`;

  return `<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:600;color:#1a1a1a;margin:0 0 24px;letter-spacing:0.02em;">
      Η προσφορά σου από The Greek Carnivore 🔥
    </h1>
    <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">
      Γεια σου!
    </p>
    <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 24px;">
      Ετοίμασα για εσένα ένα εξατομικευμένο πρόγραμμα coaching. Δες τις λεπτομέρειες παρακάτω και κάνε την πληρωμή σου για να ξεκινήσουμε!
    </p>
    <div style="background:#faf8f4;border-radius:12px;padding:20px 24px;margin:0 0 28px;">
      <p style="margin:0 0 12px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Λεπτομέρειες Προγράμματος</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;width:120px;">Πρόγραμμα</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${programName}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Διάρκεια</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${durationLabel}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Ημ. Έναρξης</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${formattedStart}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Τιμή</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${priceLabel}</td></tr>
      </table>
    </div>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 8px;">📋 <strong>Τι περιλαμβάνει:</strong></p>
    <ul style="font-size:14px;color:#555;line-height:1.9;margin:0 0 28px;padding-left:18px;">
      <li>Εξατομικευμένο πρόγραμμα διατροφής</li>
      <li>Εβδομαδιαία παρακολούθηση & feedback</li>
      <li>Πρόσβαση σε εκπαιδευτικά βίντεο</li>
      <li>Απευθείας chat με τον coach σου</li>
      <li>Συνταγές & σχέδιο γευμάτων</li>
    </ul>
    <div style="text-align:center;margin:0 0 32px;">
      <a href="${checkoutUrl}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:15px;font-weight:600;border-radius:12px;padding:16px 36px;text-decoration:none;">
        Ολοκλήρωσε την Πληρωμή →
      </a>
    </div>
    <p style="font-size:12px;color:#aaa;line-height:1.6;margin:0 0 8px;">
      Ο σύνδεσμος πληρωμής είναι ασφαλής μέσω Stripe. Μετά την πληρωμή θα λάβεις αυτόματα πρόσβαση στην εφαρμογή.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0 20px;" />
    <p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 4px;">Ανυπομονώ να ξεκινήσουμε! 💪</p>
    <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">Αλέξανδρος — <strong>The Greek Carnivore</strong></p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
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
    const { data: claims, error: claimsErr } = await supabase.auth.getUser(token);
    if (claimsErr || !claims.user) throw new Error("Unauthorized");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Admin access required");
    logStep("Admin verified", { adminId: claims.user.id });

    const {
      client_user_id,
      client_email,
      program_id,
      program_name,
      amount_cents,
      currency = "eur",
      mode = "payment",
      program_template_id,
      start_date,
      installments_total = 1,
    } = await req.json();

    if (!client_email || !amount_cents || !program_id) {
      throw new Error("Missing required fields: client_email, amount_cents, program_id");
    }

    // --- 1. Create Stripe Checkout Session ---
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: client_email, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email: client_email });
      customerId = customer.id;
    }
    logStep("Stripe customer ready", { customerId });

    if (client_user_id) {
      await supabase.from("profiles").update({ stripe_customer_id: customerId } as any).eq("id", client_user_id);
    }

    const paymentMode = mode === "subscription" ? "subscription" : "payment";
    const origin = getAppBaseUrl();

    const lineItems: any[] = [{
      price_data: {
        currency,
        product_data: { name: program_name || "Coaching Program" },
        unit_amount: amount_cents,
        ...(paymentMode === "subscription" ? { recurring: { interval: "month" as const } } : {}),
      },
      quantity: 1,
    }];

    const metadata: Record<string, string> = {
      program_id,
      client_user_id: client_user_id || "",
      client_email,
      program_name: program_name || "",
      program_template_id: program_template_id || "",
      start_date: start_date || "",
    };

    const sessionParams: any = {
      customer: customerId,
      line_items: lineItems,
      mode: paymentMode,
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment-canceled`,
      metadata,
    };

    if (paymentMode === "subscription") {
      sessionParams.subscription_data = { metadata };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // --- 2. Get program template duration ---
    let durationWeeks = 26;
    if (program_template_id) {
      const { data: tpl } = await supabase
        .from("program_templates")
        .select("duration_weeks")
        .eq("id", program_template_id)
        .single();
      if (tpl) durationWeeks = tpl.duration_weeks;
    }

    // --- 3. Send branded email via Resend ---
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const amountEur = amount_cents / 100;
    const html = buildOfferEmail({
      programName: program_name || "Coaching Program",
      durationWeeks,
      amount: amountEur,
      currency,
      startDate: start_date || new Date().toISOString().split("T")[0],
      installments: installments_total,
      checkoutUrl: session.url!,
    });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [client_email],
        subject: `Η προσφορά σου — ${program_name || "Coaching Program"} 🔥`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      logStep("Email send failed", { error: errText });
      throw new Error(`Failed to send email: ${errText}`);
    }
    logStep("Offer email sent", { to: client_email });

    // --- 4. Update client_programs status to offer_sent ---
    await supabase
      .from("client_programs")
      .update({
        stripe_checkout_session_id: session.id,
        payment_status: "offer_sent",
      } as any)
      .eq("id", program_id);

    logStep("Updated program status to offer_sent", { programId: program_id });

    return new Response(JSON.stringify({ success: true, session_id: session.id }), {
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
