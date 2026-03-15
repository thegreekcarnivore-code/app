import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildEmailHtml(
  firstName: string,
  meetingUrl: string,
  lang: string,
  scheduledAt?: string,
  durationMinutes?: number,
) {
  const logoUrl = "https://lglgmhzgxyvyftdhvdsy.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1";
  const isEl = lang === "el";

  let dateBlock = "";
  if (scheduledAt) {
    try {
      const d = new Date(scheduledAt);
      const dateStr = d.toLocaleDateString(isEl ? "el-GR" : "en-US", {
        weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Athens",
      });
      const timeStr = d.toLocaleTimeString(isEl ? "el-GR" : "en-US", {
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens",
      });
      const tzLabel = isEl ? "ώρα Ελλάδας" : "Greece time";
      const minLabel = isEl ? "λεπτά" : "min";
      const dateTimeLabel = isEl ? "ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ" : "DATE & TIME";
      dateBlock = `
        <div style="background:#faf8f4;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
          <p style="margin:0 0 4px;font-size:13px;color:#999;">${dateTimeLabel}</p>
          <p style="margin:0;font-size:15px;color:#222;font-weight:600;">📅 ${dateStr}</p>
          <p style="margin:4px 0 0;font-size:15px;color:#222;font-weight:600;">🕐 ${timeStr} (${tzLabel})${durationMinutes ? ` · ⏱ ${durationMinutes} ${minLabel}` : ""}</p>
        </div>`;
    } catch { /* skip */ }
  }

  const heading = isEl ? "Ειδοποίηση Συνάντησης" : "Meeting Notification";
  const greeting = isEl ? `Καλησπέρα <strong>${firstName}</strong>,` : `Hello <strong>${firstName}</strong>,`;
  const instructionsLabel = isEl ? "📋 <strong>Οδηγίες:</strong>" : "📋 <strong>Instructions:</strong>";
  const instructions = isEl
    ? ["Βεβαιωθείτε ότι έχετε εγκαταστήσει το Zoom πριν την κλήση", "Δοκιμάστε κάμερα και μικρόφωνο εκ των προτέρων", "Συνδεθείτε 2-3 λεπτά νωρίτερα"]
    : ["Make sure you have Zoom installed before the call", "Test your camera and microphone beforehand", "Join 2-3 minutes early"];
  const ctaText = isEl ? "Σύνδεση στη Συνάντηση" : "Join Meeting";

  return `<!DOCTYPE html>
<html lang="${isEl ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${logoUrl}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">${heading}</h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px;">${greeting}</p>
    ${dateBlock}
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 8px;">${instructionsLabel}</p>
    <ul style="font-size:13px;color:#666;line-height:1.8;margin:0 0 24px;padding-left:18px;">
      ${instructions.map(i => `<li>${i}</li>`).join("\n      ")}
    </ul>
    <a href="${meetingUrl}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">${ctaText}</a>
    <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">The Greek Carnivore</p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await anonClient
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipients, message_template, meeting_url, scheduled_at, duration_minutes, video_call_id } = await req.json();
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "Recipients required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not configured on server" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const fromEmail = "The Greek Carnivore <noreply@thegreekcarnivore.com>";

    // Deduplication
    let alreadySentEmails = new Set<string>();
    if (video_call_id) {
      const { data: sentRows } = await serviceClient
        .from("call_notifications_sent").select("email").eq("video_call_id", video_call_id);
      if (sentRows) alreadySentEmails = new Set(sentRows.map((r: any) => r.email.toLowerCase()));
    }

    const newRecipients = recipients.filter((r: any) => !alreadySentEmails.has(r.email.toLowerCase()));
    const emailsSkipped = recipients.length - newRecipients.length;

    // Schedule reminders
    if (scheduled_at && video_call_id) {
      const callTime = new Date(scheduled_at).getTime();
      const reminderOffsets = [
        { type: "24h", ms: 24 * 60 * 60 * 1000 },
        { type: "1h", ms: 60 * 60 * 1000 },
        { type: "5min", ms: 5 * 60 * 1000 },
      ];
      const remindersToInsert = reminderOffsets
        .map(({ type, ms }) => ({ video_call_id, reminder_type: type, send_at: new Date(callTime - ms).toISOString() }))
        .filter(r => new Date(r.send_at) > new Date());
      if (remindersToInsert.length > 0) {
        await serviceClient.from("call_reminders").delete().eq("video_call_id", video_call_id).is("sent_at", null);
        await serviceClient.from("call_reminders").insert(remindersToInsert);
      }
    }

    // Lookup languages for all recipients
    const recipientEmails = newRecipients.map((r: any) => r.email.toLowerCase());
    const { data: profileRows } = await serviceClient
      .from("profiles").select("email, language").in("email", recipientEmails);
    const langMap = new Map<string, string>();
    for (const p of (profileRows || []) as any[]) {
      if (p.email) langMap.set(p.email.toLowerCase(), p.language || "el");
    }

    let emailsSent = 0;
    const errors: string[] = [];

    for (let i = 0; i < newRecipients.length; i++) {
      if (i > 0) await sleep(600);
      const recipient = newRecipients[i];
      const lang = langMap.get(recipient.email.toLowerCase()) || "el";
      const html = buildEmailHtml(recipient.first_name || "", meeting_url, lang, scheduled_at, duration_minutes);
      const subject = lang === "el"
        ? "Ειδοποίηση Συνάντησης — The Greek Carnivore"
        : "Meeting Notification — The Greek Carnivore";

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
          body: JSON.stringify({ from: fromEmail, to: [recipient.email], subject, html }),
        });
        if (res.ok) {
          emailsSent++;
          if (video_call_id) {
            await serviceClient.from("call_notifications_sent").upsert(
              { video_call_id, email: recipient.email.toLowerCase() },
              { onConflict: "video_call_id,email" }
            );
          }
        } else {
          const errText = await res.text();
          console.error(`Email to ${recipient.email} failed:`, errText);
          errors.push(`${recipient.email}: ${errText}`);
        }
      } catch (e) {
        console.error(`Email to ${recipient.email} error:`, e);
        errors.push(`${recipient.email}: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    return new Response(
      JSON.stringify({ success: emailsSent > 0 || emailsSkipped > 0, emails_sent: emailsSent, emails_skipped: emailsSkipped, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Notify error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
