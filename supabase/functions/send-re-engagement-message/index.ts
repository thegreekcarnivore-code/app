import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Admin clicks "Send" on a pending_approval row → this function:
//   1. Inserts into public.messages so the member sees it in-app as a Σύμβουλος chat
//   2. Sends an email via Resend with the same body
//   3. Updates re_engagement_messages.status to 'approved_sent' (or 'edited_sent'
//      if the admin edited the body) and stamps sent_at = now()

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "The Greek Carnivore <noreply@thegreekcarnivore.com>";

function buildEmailHtml(subject: string, body: string, appUrl: string, firstName: string): string {
  const paragraphs = body.split(/\n\s*\n/).map((p) =>
    `<p style="font-size:15px;color:#444;line-height:1.75;margin:0 0 18px;white-space:pre-wrap;">${p.trim()}</p>`,
  ).join("\n");
  return `<!DOCTYPE html>
<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:40px 30px;">
  <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 22px;">${subject}</h1>
  <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 18px;">${firstName},</p>
  ${paragraphs}
  <a href="${appUrl}" target="_blank" style="display:inline-block;background:#b39a64;color:#141414;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;margin:8px 0 24px;">Άνοιξε την εφαρμογή</a>
  <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0 16px;" />
  <p style="font-size:11px;color:#aaa;line-height:1.6;margin:0;">— Σύμβουλος, Μεταμόρφωση</p>
</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Admin auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  const adminUserId = claims?.claims?.sub;
  if (!adminUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", adminUserId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { message_id, edited_text } = await req.json();
    if (!message_id) {
      return new Response(JSON.stringify({ error: "message_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: msgRow } = await admin
      .from("re_engagement_messages")
      .select("id, user_id, tier, generated_text, email_subject, status")
      .eq("id", message_id)
      .maybeSingle();
    if (!msgRow) {
      return new Response(JSON.stringify({ error: "message not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((msgRow as { status: string }).status !== "pending_approval") {
      return new Response(JSON.stringify({ error: "message not pending_approval" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberId = (msgRow as { user_id: string }).user_id;
    const finalText = (typeof edited_text === "string" && edited_text.trim().length >= 20)
      ? edited_text.trim()
      : (msgRow as { generated_text: string }).generated_text;
    const wasEdited = finalText !== (msgRow as { generated_text: string }).generated_text;

    // 1. In-app message via public.messages (admin → member)
    await admin.from("messages").insert({
      sender_id: adminUserId,
      receiver_id: memberId,
      content: finalText,
    });

    // 2. Email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailStatus: string = "skipped_no_resend_key";
    if (resendKey) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, display_name")
        .eq("id", memberId)
        .maybeSingle();
      const email = (profile as { email?: string } | null)?.email;
      const firstName = (profile as { display_name?: string } | null)?.display_name ?? "Γεια σου";
      if (email) {
        const appUrl = `${Deno.env.get("APP_BASE_URL") ?? "https://app.thegreekcarnivore.com"}/coach`;
        const html = buildEmailHtml((msgRow as { email_subject: string }).email_subject, finalText, appUrl, firstName);
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: (msgRow as { email_subject: string }).email_subject, html }),
        });
        emailStatus = r.ok ? "sent" : `error_${r.status}`;
      } else {
        emailStatus = "no_email_on_profile";
      }
    }

    // 3. Mark the row sent
    await admin
      .from("re_engagement_messages")
      .update({
        status: wasEdited ? "edited_sent" : "approved_sent",
        sent_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId,
        generated_text: wasEdited ? finalText : (msgRow as { generated_text: string }).generated_text,
        metadata: { email_status: emailStatus },
      })
      .eq("id", message_id);

    return new Response(JSON.stringify({ ok: true, email_status: emailStatus, edited: wasEdited }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
