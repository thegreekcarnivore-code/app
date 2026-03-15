import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildAppUrl, getAppBaseUrl } from "../_shared/app-config.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const FROM_EMAIL = "The Greek Carnivore <noreply@thegreekcarnivore.com>";
const LOGO_URL = "https://lglgmhzgxyvyftdhvdsy.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1";
const APP_URL = getAppBaseUrl();

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

function buildWelcomeEmail(programName: string, durationWeeks: number, startDate: string, firstName: string): string {
  const months = Math.round(durationWeeks / 4.33);
  const durationLabel = months >= 2 ? `${months} μήνες` : `${durationWeeks} εβδομάδες`;
  const formattedStart = formatGreekDate(startDate);

  return `<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:600;color:#1a1a1a;margin:0 0 24px;letter-spacing:0.02em;">
      Καλωσόρισες στο πρόγραμμά σου! 🎉
    </h1>
    <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">
      Αγαπητέ/ή ${firstName},
    </p>
    <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 24px;">
      Η πληρωμή σου ολοκληρώθηκε με επιτυχία! Είμαι πολύ χαρούμενος που ξεκινάμε μαζί αυτό το ταξίδι 
      για τους επόμενους <strong>${durationLabel}</strong>.
    </p>
    <div style="background:#faf8f4;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Το πρόγραμμά σου</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;width:120px;">Πρόγραμμα</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${programName}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Διάρκεια</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${durationLabel}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">Ημ. Έναρξης</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${formattedStart}</td></tr>
      </table>
    </div>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 8px;">📋 <strong>Τα επόμενα βήματα:</strong></p>
    <ol style="font-size:14px;color:#555;line-height:1.9;margin:0 0 28px;padding-left:18px;">
      <li>Συμπλήρωσε το προφίλ σου στην εφαρμογή</li>
      <li>Καταχώρησε τις αρχικές μετρήσεις σου</li>
      <li>Βγάλε τις πρώτες φωτογραφίες προόδου</li>
      <li>Εξερεύνησε τα εκπαιδευτικά βίντεο</li>
    </ol>
    <a href="${APP_URL}/profile" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;margin:0 0 12px;">
      Δες το Προφίλ σου
    </a>
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 20px;" />
    <p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 4px;">Σε περιμένει ένα υπέροχο ταξίδι μεταμόρφωσης! 💪</p>
    <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">Αλέξανδρος — <strong>The Greek Carnivore</strong></p>
  </div>
</body>
</html>`;
}

async function autoEnrollExistingUser(
  supabase: any,
  userId: string,
  programTemplateId: string | null,
  startDate: string,
  adminId: string,
) {
  if (!programTemplateId) {
    logStep("No program_template_id, skipping auto-enroll");
    return;
  }

  // Check if enrollment already exists
  const { data: existing } = await supabase
    .from("client_program_enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("program_template_id", programTemplateId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    logStep("Active enrollment already exists", { enrollmentId: existing.id });
    return;
  }

  // Get feature_access from program template
  let featureAccess = {};
  const { data: tpl } = await supabase
    .from("program_templates")
    .select("feature_access")
    .eq("id", programTemplateId)
    .single();
  if (tpl) featureAccess = tpl.feature_access;

  // Create enrollment
  const { error: enrollErr } = await supabase
    .from("client_program_enrollments")
    .insert({
      user_id: userId,
      program_template_id: programTemplateId,
      start_date: startDate || new Date().toISOString().split("T")[0],
      status: "active",
      feature_access_override: featureAccess,
      created_by: adminId,
    });

  if (enrollErr) {
    logStep("Failed to create enrollment", { error: enrollErr.message });
  } else {
    logStep("Auto-created enrollment", { userId, programTemplateId });
  }

  // Approve user and set feature_access
  await supabase
    .from("profiles")
    .update({ approved: true, feature_access: featureAccess })
    .eq("id", userId);

  logStep("Updated profile approved + feature_access", { userId });
}

async function sendWelcomeEmailForExistingUser(
  supabase: any,
  clientUserId: string,
  programName: string,
  programTemplateId: string | null,
  startDate: string,
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
  const html = buildWelcomeEmail(programName, durationWeeks, startDate, firstName);

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

async function createInvitationAndSendInvite(
  supabase: any,
  clientEmail: string,
  programName: string,
  programTemplateId: string | null,
  startDate: string,
  adminId: string,
) {
  // Check for existing pending invitation
  const { data: existing } = await supabase
    .from("email_invitations")
    .select("id")
    .eq("email", clientEmail)
    .eq("status", "pending")
    .maybeSingle();

  // Get feature_access from program template if available
  let featureAccess = {};
  if (programTemplateId) {
    const { data: tpl } = await supabase
      .from("program_templates")
      .select("feature_access")
      .eq("id", programTemplateId)
      .single();
    if (tpl) featureAccess = tpl.feature_access;
  }

  if (!existing) {
    // Create invitation row so handle_new_user trigger auto-enrolls on signup
    const { error: insertErr } = await supabase
      .from("email_invitations")
      .insert({
        email: clientEmail,
        language: "el",
        feature_access: featureAccess,
        program_template_id: programTemplateId || null,
        start_date: startDate || new Date().toISOString().split("T")[0],
        created_by: adminId,
      });
    if (insertErr) {
      logStep("Failed to create email_invitation", { error: insertErr.message });
    } else {
      logStep("Created email_invitation for prospect", { email: clientEmail });
    }
  } else {
    logStep("Pending invitation already exists", { email: clientEmail });
  }

  // Send auth invite so they can create an account
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const userMetadata: Record<string, string> = { language: "el" };
  if (programName) userMetadata.program_name = programName;
  if (startDate) userMetadata.start_date = startDate;

  const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(clientEmail, {
    redirectTo: buildAppUrl("/auth"),
    data: userMetadata,
  });

  if (inviteErr) {
    logStep("Failed to send auth invite", { error: inviteErr.message });
  } else {
    logStep("Auth invite sent to prospect", { email: clientEmail });
  }
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
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
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
        const clientUserId = session.metadata?.client_user_id;
        const clientEmail = session.metadata?.client_email;
        const programName = session.metadata?.program_name || "Coaching Program";
        const programTemplateId = session.metadata?.program_template_id || null;
        const startDate = session.metadata?.start_date || new Date().toISOString().split("T")[0];

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
          await autoEnrollExistingUser(supabase, clientUserId, programTemplateId, startDate, adminId);
          await sendWelcomeEmailForExistingUser(supabase, clientUserId, programName, programTemplateId, startDate);
          // Send day-1 welcome messages immediately
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-day-zero-messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ user_id: clientUserId }),
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
            await autoEnrollExistingUser(supabase, existingProfile.id, programTemplateId, startDate, adminId);
            await sendWelcomeEmailForExistingUser(supabase, existingProfile.id, programName, programTemplateId, startDate);
            // Send day-1 welcome messages immediately
            try {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-day-zero-messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                body: JSON.stringify({ user_id: existingProfile.id }),
              });
            } catch (e) { console.error("Day-0 messages error:", e); }
          } else {
            logStep("Prospect has no account, creating invitation + sending invite", { email: clientEmail });
            await createInvitationAndSendInvite(supabase, clientEmail, programName, programTemplateId, startDate, adminId);
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

        await supabase
          .from("client_programs")
          .update({ payment_status: "canceled" } as any)
          .eq("stripe_subscription_id" as any, subId);

        logStep("Subscription canceled", { subId });
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
