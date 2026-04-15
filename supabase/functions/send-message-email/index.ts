import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAppUrl, getEmailLogoUrl } from "../_shared/app-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = getEmailLogoUrl();
const FROM_EMAIL = "The Greek Carnivore <noreply@thegreekcarnivore.com>";

function buildCoachNotificationEmail(clientName: string): { subject: string; html: string } {
  const subject = `Νέο μήνυμα από ${clientName} — The Greek Carnivore`;
  const heading = `Νέο μήνυμα από πελάτη 💬`;

  return {
    subject,
    html: `<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">${heading}</h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 12px;">Ο/Η <strong>${clientName}</strong> σου έστειλε ένα μήνυμα.</p>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 24px;">Άνοιξε τον πίνακα διαχείρισης για να απαντήσεις.</p>
    <a href="${buildAppUrl("/admin")}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">Δες το Μήνυμα</a>
    <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">The Greek Carnivore</p>
  </div>
</body>
</html>`,
  };
}

function buildPersonalEmail(firstName: string, lang: string): { subject: string; html: string } {
  const isEl = lang === "el";

  const subject = isEl
    ? "Έχεις μήνυμα από τον Αλέξανδρο — The Greek Carnivore"
    : "You have a message from Alexandros — The Greek Carnivore";

  const heading = isEl
    ? "Έχεις μήνυμα από τον Αλέξανδρο 💬"
    : "You have a message from Alexandros 💬";

  const greeting = isEl ? `Γεια σου <strong>${firstName}</strong>,` : `Hello <strong>${firstName}</strong>,`;

  const bodyText = isEl
    ? "Ο Αλέξανδρος σου έστειλε ένα προσωπικό μήνυμα. Άνοιξε την εφαρμογή για να το διαβάσεις."
    : "Alexandros sent you a personal message. Open the app to read it.";

  const ctaText = isEl ? "Δες το Μήνυμα" : "View Message";

  return {
    subject,
    html: `<!DOCTYPE html>
<html lang="${isEl ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">${heading}</h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 12px;">${greeting}</p>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 24px;">${bodyText}</p>
    <a href="${buildAppUrl("/home")}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">${ctaText}</a>
    <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">The Greek Carnivore</p>
  </div>
</body>
</html>`,
  };
}

function buildAutomatedEmail(firstName: string, lang: string): { subject: string; html: string } {
  const isEl = lang === "el";

  const subject = isEl
    ? "Νέα ενημέρωση — The Greek Carnivore"
    : "New Update — The Greek Carnivore";

  const heading = isEl ? "Νέα Ενημέρωση 📋" : "New Update 📋";

  const greeting = isEl ? `Γεια σου <strong>${firstName}</strong>,` : `Hello <strong>${firstName}</strong>,`;

  const bodyText = isEl
    ? "Έχεις μια νέα ενημέρωση στην εφαρμογή σου. Μπορεί να αφορά μια εργασία, υπενθύμιση ή πληροφορία σχετικά με το πρόγραμμά σου. Άνοιξε την εφαρμογή για περισσότερες λεπτομέρειες."
    : "You have a new update in your app. It may be about a task, a reminder, or information related to your program. Open the app for more details.";

  const ctaText = isEl ? "Άνοιξε την Εφαρμογή" : "Open App";

  return {
    subject,
    html: `<!DOCTYPE html>
<html lang="${isEl ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">${heading}</h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 12px;">${greeting}</p>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 24px;">${bodyText}</p>
    <a href="${buildAppUrl("/home")}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">${ctaText}</a>
    <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">The Greek Carnivore</p>
  </div>
</body>
</html>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { receiver_id, sender_id, is_automated } = await req.json();

    if (!receiver_id || !sender_id) {
      return new Response(JSON.stringify({ error: "receiver_id and sender_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine direction: is the sender the admin (coach)?
    const { data: adminCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sender_id)
      .eq("role", "admin")
      .limit(1);

    const senderIsAdmin = adminCheck && adminCheck.length > 0;

    // Get receiver profile
    const { data: receiverProfile } = await supabase
      .from("profiles")
      .select("email, display_name, language")
      .eq("id", receiver_id)
      .single();

    if (!receiverProfile?.email) {
      return new Response(JSON.stringify({ skipped: "no email for receiver" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject: string;
    let html: string;

    if (senderIsAdmin) {
      // Admin → Client: notify the client
      const firstName = receiverProfile.display_name?.split(" ")[0] || receiverProfile.email.split("@")[0] || "there";
      const lang = receiverProfile.language || "el";
      ({ subject, html } = is_automated
        ? buildAutomatedEmail(firstName, lang)
        : buildPersonalEmail(firstName, lang));
    } else {
      // Client → Admin (coach): notify Alexandros
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", sender_id)
        .single();
      const clientName = senderProfile?.display_name || senderProfile?.email?.split("@")[0] || "Πελάτης";
      ({ subject, html } = buildCoachNotificationEmail(clientName));
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [receiverProfile.email],
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error(`Email to ${receiverProfile.email} failed:`, errText);
      return new Response(JSON.stringify({ error: "Email delivery failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ sent: true, email: receiverProfile.email, type: senderIsAdmin ? (is_automated ? "automated" : "personal") : "coach-notification" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-message-email error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
