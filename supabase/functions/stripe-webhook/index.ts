import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getEmailLogoUrl } from "../_shared/app-config.ts";
import { ensureInvitedClientAccess, toFeatureAccessRecord } from "../_shared/invited-access.ts";
import { createAppAccessLink } from "../_shared/app-access-links.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
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

function buildWelcomeEmail(_programName: string, _durationWeeks: number, _startDate: string, firstName: string, loginUrl: string): string {
  return `<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 30px;">
    <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 28px;" />

    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:28px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.01em;line-height:1.2;">
      Είσαι μέσα — ξεκινάμε.
    </h1>

    <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 18px;">
      ${firstName},
    </p>

    <p style="font-size:15px;color:#444;line-height:1.75;margin:0 0 28px;">
      Πέρασες την πόρτα. Από εδώ και πέρα η Μεταμόρφωση τρέχει για σένα — ο <strong>Σύμβουλος</strong> σε ξέρει 24/7, οι μετρήσεις σου χτίζουν την προοπτική, και κάθε εβδομάδα η εφαρμογή σου δείχνει τι αλλάζει.
    </p>

    <p style="font-size:13px;color:#999;text-transform:uppercase;letter-spacing:0.12em;font-weight:600;margin:0 0 12px;">Πρώτη μέρα · 3 βήματα</p>

    <ol style="font-size:14.5px;color:#444;line-height:1.85;margin:0 0 30px;padding-left:22px;">
      <li><strong>Πρώτη είσοδος</strong> — μπες με ένα κλικ από κάτω.</li>
      <li><strong>Λίγες ερωτήσεις</strong> — ώστε ο Σύμβουλος να σου μιλάει στοχευμένα. 5 λεπτά.</li>
      <li><strong>Σημείο εκκίνησης</strong> — βάρος, μέτρα, 4 φωτογραφίες. Από εδώ μετράμε όλα τα επόμενα.</li>
    </ol>

    <a href="${loginUrl}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:15px;font-weight:600;border-radius:12px;padding:15px 32px;text-decoration:none;margin:0 0 30px;">
      Ξεκίνα τώρα →
    </a>

    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 28px;font-style:italic;">
      Αύριο το πρωί θα σε περιμένει η Ημέρα 2 — το πρώτο βίντεο της Φάσης 1 και ο οδηγός για τις πρώτες 72 ώρες.
    </p>

    <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0 16px;" />

    <p style="font-size:11px;color:#aaa;line-height:1.6;margin:0;">
      Lifestyle coaching carnivore — όχι ιατρική συμβουλή. Συμβουλέψου τον γιατρό σου πριν από σημαντικές αλλαγές στη διατροφή. Πλήρεις όροι: <a href="https://app.thegreekcarnivore.com/policy" style="color:#aaa;text-decoration:underline;">/policy</a>
    </p>
  </div>
</body>
</html>`;
}

async function fetchProgramFeatureAccess(
  supabase: any,
  programTemplateId: string | null,
) {
  if (!programTemplateId) {
    return null;
  }

  const { data: tpl } = await supabase
    .from("program_templates")
    .select("feature_access")
    .eq("id", programTemplateId)
    .single();
  return toFeatureAccessRecord(tpl?.feature_access);
}

async function sendWelcomeEmailForExistingUser(
  supabase: any,
  clientUserId: string,
  programName: string,
  programTemplateId: string | null,
  startDate: string,
  createdBy: string | null,
) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    logStep("RESEND_API_KEY not set, skipping welcome email");
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", clientUserId)
    .single();

  if (!profile?.email) {
    logStep("No profile email found, skipping welcome email");
    return;
  }

  let durationWeeks = 26;
  if (programTemplateId) {
    const { data: tpl } = await supabase
      .from("program_templates")
      .select("duration_weeks")
      .eq("id", programTemplateId)
      .single();
    if (tpl) durationWeeks = tpl.duration_weeks;
  }

  const firstName = profile.display_name || profile.email.split("@")[0] || "there";
  const shortLink = await createAppAccessLink({
    serviceClient: supabase,
    purpose: "magic_login",
    email: profile.email,
    userId: clientUserId,
    createdBy,
    language: "el",
    redirectPath: "/home",
  });

  const html = buildWelcomeEmail(programName, durationWeeks, startDate, firstName, shortLink.url);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [profile.email],
      subject: `Καλωσόρισες στο ${programName}! 🎉 — The Greek Carnivore`,
      html,
    }),
  });

  if (!res.ok) {
    logStep("Welcome email send failed", { error: await res.text() });
  } else {
    logStep("Welcome email sent", { to: profile.email });
  }
}

async function grantPaidAccess(
  supabase: any,
  clientEmail: string,
  programTemplateId: string | null,
  startDate: string,
  adminId: string,
) {
  const featureAccess = await fetchProgramFeatureAccess(supabase, programTemplateId);
  return await ensureInvitedClientAccess({
    serviceClient: supabase,
    email: clientEmail,
    language: "el",
    featureAccess,
    programTemplateId,
    startDate,
    createdBy: adminId,
    redirectPath: "/home",
  });
}

async function flipSubscriptionStatusByCustomer(
  supabase: any,
  customerId: string,
  next: "active" | "past_due" | "canceled" | "trialing" | "unpaid",
) {
  await supabase
    .from("profiles")
    .update({
      subscription_status: next,
      subscription_status_updated_at: new Date().toISOString(),
    } as any)
    .eq("stripe_customer_id" as any, customerId);
}

async function flipEnrollmentStatusByCustomer(
  supabase: any,
  customerId: string,
  next: "active" | "past_due" | "canceled" | "unpaid",
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id" as any, customerId)
    .maybeSingle();
  if (!profile?.id) return;
  await supabase
    .from("client_program_enrollments")
    .update({ status: next } as any)
    .eq("user_id", profile.id);
}

async function sendDunningEmail(supabase: any, customerId: string, invoice: Stripe.Invoice) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("stripe_customer_id" as any, customerId)
    .maybeSingle();
  if (!profile?.email) return;
  const firstName = profile.display_name || profile.email.split("@")[0] || "";
  const portalUrl = invoice.hosted_invoice_url
    || `${Deno.env.get("APP_BASE_URL") ?? "https://app.thegreekcarnivore.com"}/billing`;
  const html = `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fff;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:40px 30px;">
  <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
  <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#1a1a1a;margin:0 0 20px;">Η πληρωμή δεν ολοκληρώθηκε</h1>
  <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">${firstName ? `Γεια σου ${firstName},` : "Γεια σου,"}</p>
  <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">
    Φαίνεται ότι η μηνιαία πληρωμή της Μεταμόρφωσης δεν προχώρησε — μάλλον ξέχασες να ενημερώσεις την κάρτα σου.
    Μέχρι να τακτοποιηθεί, η πρόσβαση στην εφαρμογή σταματά προσωρινά. Θα συνεχίσουμε από εκεί που μείναμε μόλις πληρώσεις.
  </p>
  <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#b39a64;color:#141414;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;margin:8px 0 24px;">
    Ενημέρωσε την κάρτα σου
  </a>
  <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">Αν χρειάζεσαι βοήθεια, στείλε email στο info@thegreekcarnivore.com.</p>
</div></body></html>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [profile.email],
      subject: "Η πληρωμή σου δεν ολοκληρώθηκε — The Greek Carnivore",
      html,
    }),
  }).catch(e => console.error("dunning email failed", e));
}

async function appendJourneyLog(
  supabase: any,
  userId: string,
  kind: "milestone" | "struggle" | "observation",
  summary: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("member_journey_log").insert({
      user_id: userId,
      kind,
      summary: summary.slice(0, 200),
      source: "billing",
      metadata,
    });
  } catch (e) {
    console.error("journey log append failed", e);
  }
}

async function logBillingLapseToJourney(supabase: any, customerId: string): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id" as any, customerId)
    .maybeSingle();
  const userId = (profile as any)?.id;
  if (!userId) return;
  await appendJourneyLog(
    supabase,
    userId,
    "struggle",
    "Η πληρωμή της Μεταμόρφωσης διακόπηκε και η πρόσβαση παύθηκε προσωρινά.",
    { event: "payment_failed" },
  );
}

async function logReactivationToJourney(supabase: any, userId: string, daysInactive: number | null): Promise<void> {
  const summary = daysInactive && daysInactive > 1
    ? `Η συνδρομή ενεργοποιήθηκε ξανά μετά από ${daysInactive} ημέρες διακοπής.`
    : "Η συνδρομή ενεργοποιήθηκε ξανά. Συνεχίζουμε από εκεί που μείναμε.";
  await appendJourneyLog(
    supabase,
    userId,
    "milestone",
    summary,
    { event: "reactivation", days_inactive: daysInactive },
  );
}

async function sendReactivationEmail(supabase: any, profile: { email: string | null; display_name: string | null }) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey || !profile?.email) return;
  const firstName = profile.display_name || profile.email.split("@")[0] || "";
  const appUrl = `${Deno.env.get("APP_BASE_URL") ?? "https://app.thegreekcarnivore.com"}/home`;
  const html = `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fff;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:40px 30px;">
  <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
  <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#1a1a1a;margin:0 0 20px;">Καλωσόρισες πίσω</h1>
  <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px;">${firstName ? `Γεια σου ${firstName},` : "Γεια σου,"}</p>
  <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">
    Η πληρωμή σου ολοκληρώθηκε. Συνεχίζουμε ακριβώς από εκεί που μείναμε.
  </p>
  <a href="${appUrl}" target="_blank" style="display:inline-block;background:#b39a64;color:#141414;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;margin:8px 0 24px;">Μπες στην εφαρμογή</a>
</div></body></html>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [profile.email],
      subject: "Καλωσόρισες πίσω — The Greek Carnivore",
      html,
    }),
  }).catch(e => console.error("reactivation email failed", e));
}

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      // Deno's Edge Runtime exposes Web Crypto only async — Stripe's sync
      // constructEvent() throws "SubtleCryptoProvider cannot be used in a
      // synchronous context". Use the async variant instead.
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
      logStep("Webhook signature verified");
    } else {
      event = JSON.parse(body);
      logStep("Webhook parsed without signature verification");
    }

    logStep("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const programId = session.metadata?.program_id;
        const clientUserId = session.metadata?.client_user_id || "";
        // Email may come from metadata (signed-in flow) OR be collected by Stripe
        // Checkout for anonymous purchases. Fall back across all three sources.
        const clientEmail = (session.metadata?.client_email || "")
          || session.customer_email
          || session.customer_details?.email
          || "";
        const programName = session.metadata?.program_name || "Coaching Program";
        const programTemplateId = session.metadata?.program_template_id || null;
        const startDate = session.metadata?.start_date || new Date().toISOString().split("T")[0];

        // Annual upgrade: cancel any existing monthly subscription on this
        // customer so they aren't double-billed. The new annual sub stays.
        if (session.metadata?.product === "metamorphosis_annual") {
          const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
          const newSubId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (customerId) {
            try {
              const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 10 });
              for (const oldSub of subs.data) {
                if (oldSub.id === newSubId) continue;
                if (oldSub.metadata?.product === "metamorphosis_annual") continue;
                // Cancel at period end so they keep what they already paid for this month
                await stripe.subscriptions.update(oldSub.id, { cancel_at_period_end: true });
                logStep("Annual upgrade — old monthly cancel_at_period_end set", { oldSubId: oldSub.id });
              }
            } catch (e) {
              logStep("Annual upgrade — failed to cancel old subs", { msg: e instanceof Error ? e.message : String(e) });
            }
          }
        }

        logStep("Checkout completed", { programId, clientUserId, clientEmail, mode: session.mode });

        if (programId) {
          const updateData: any = {
            payment_status: "paid",
            stripe_checkout_session_id: session.id,
          };

          if (session.mode === "subscription" && session.subscription) {
            updateData.stripe_subscription_id = typeof session.subscription === "string" 
              ? session.subscription 
              : session.subscription.id;
          }

          await supabase
            .from("client_programs")
            .update(updateData)
            .eq("id", programId);

          logStep("Updated client_programs to paid", { programId });
        }

        // Update stripe_customer_id on profile
        if (clientUserId && session.customer) {
          const custId = typeof session.customer === "string" ? session.customer : session.customer.id;
          await supabase
            .from("profiles")
            .update({ stripe_customer_id: custId } as any)
            .eq("id", clientUserId);
        }

        // --- AUTO-SEND WELCOME OR INVITE ---
        // Find the first admin to use as created_by for invitation
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1)
          .single();
        const adminId = adminRole?.user_id || "";

        if (clientUserId) {
          // Existing user → auto-enroll + send welcome email
          logStep("Auto-enrolling and sending welcome email to existing user", { clientUserId });
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", clientUserId)
            .maybeSingle();

          const targetEmail = clientEmail || existingProfile?.email;
          if (!targetEmail) {
            throw new Error("Missing client email for paid access grant");
          }

          const accessResult = await grantPaidAccess(supabase, targetEmail, programTemplateId, startDate, adminId);
          await sendWelcomeEmailForExistingUser(supabase, accessResult.userId, programName, programTemplateId, startDate, adminId);
          // Send day-1 welcome messages immediately
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-day-zero-messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ user_id: accessResult.userId }),
            });
          } catch (e) { console.error("Day-0 messages error:", e); }
        } else if (clientEmail) {
          // Prospect → check if they have an account by email
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", clientEmail)
            .maybeSingle();

          if (existingProfile) {
            logStep("Found existing profile by email, auto-enrolling + sending welcome", { email: clientEmail });
            const accessResult = await grantPaidAccess(supabase, clientEmail, programTemplateId, startDate, adminId);
            await sendWelcomeEmailForExistingUser(supabase, accessResult.userId, programName, programTemplateId, startDate, adminId);
            // Send day-1 welcome messages immediately
            try {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-day-zero-messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                body: JSON.stringify({ user_id: accessResult.userId }),
              });
            } catch (e) { console.error("Day-0 messages error:", e); }
          } else {
            logStep("Prospect has no account, granting access + sending direct-entry welcome", { email: clientEmail });
            const accessResult = await grantPaidAccess(supabase, clientEmail, programTemplateId, startDate, adminId);
            await sendWelcomeEmailForExistingUser(supabase, accessResult.userId, programName, programTemplateId, startDate, adminId);
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        
        if (subId) {
          const { data: programs } = await supabase
            .from("client_programs")
            .select("id, installments_paid, installments_total")
            .eq("stripe_subscription_id" as any, subId);

          if (programs && programs.length > 0) {
            const prog = programs[0] as any;
            const newPaid = Math.min((prog.installments_paid || 0) + 1, prog.installments_total || 999);
            const newStatus = newPaid >= prog.installments_total ? "paid" : "partial";
            
            await supabase
              .from("client_programs")
              .update({ installments_paid: newPaid, payment_status: newStatus } as any)
              .eq("id", prog.id);

            logStep("Invoice paid - updated installments", { programId: prog.id, newPaid });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subId = subscription.id;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

        await supabase
          .from("client_programs")
          .update({ payment_status: "canceled" } as any)
          .eq("stripe_subscription_id" as any, subId);

        if (customerId) {
          await flipSubscriptionStatusByCustomer(supabase, customerId, "canceled");
          await flipEnrollmentStatusByCustomer(supabase, customerId, "canceled");
        }

        logStep("Subscription canceled", { subId, customerId });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) {
          logStep("payment_failed without customer id");
          break;
        }
        await flipSubscriptionStatusByCustomer(supabase, customerId, "past_due");
        await flipEnrollmentStatusByCustomer(supabase, customerId, "past_due");
        await sendDunningEmail(supabase, customerId, invoice);
        await logBillingLapseToJourney(supabase, customerId);
        logStep("Subscription past_due (payment failed)", { customerId, invoiceId: invoice.id });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
        if (!customerId) break;
        const stripeStatus = subscription.status;
        // Map Stripe statuses → our subscription_status values
        let next: "active" | "past_due" | "canceled" | "trialing" | "unpaid" | null = null;
        if (stripeStatus === "active") next = "active";
        else if (stripeStatus === "past_due") next = "past_due";
        else if (stripeStatus === "canceled") next = "canceled";
        else if (stripeStatus === "trialing") next = "trialing";
        else if (stripeStatus === "unpaid") next = "unpaid";
        if (next) {
          await flipSubscriptionStatusByCustomer(supabase, customerId, next);
          await flipEnrollmentStatusByCustomer(supabase, customerId, next === "active" ? "active" : next === "trialing" ? "active" : next);
          logStep("Subscription updated", { customerId, stripeStatus, mappedTo: next });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        // Read prior status to know if this is a reactivation
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email, subscription_status, subscription_status_updated_at, display_name")
          .eq("stripe_customer_id" as any, customerId)
          .maybeSingle();
        const wasInactive = profile && (profile as any).subscription_status !== "active";
        await flipSubscriptionStatusByCustomer(supabase, customerId, "active");
        await flipEnrollmentStatusByCustomer(supabase, customerId, "active");
        if (wasInactive && profile) {
          await sendReactivationEmail(supabase, profile as any);
          const userId = (profile as any).id as string;
          const lapsedAt = (profile as any).subscription_status_updated_at as string | null;
          const daysInactive = lapsedAt
            ? Math.max(1, Math.round((Date.now() - new Date(lapsedAt).getTime()) / 86400000))
            : null;
          await logReactivationToJourney(supabase, userId, daysInactive);
        }
        logStep("Invoice payment_succeeded → active", { customerId, reactivated: wasInactive });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
