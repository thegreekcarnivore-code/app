import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildReminderEmailHtml(
  firstName: string,
  meetingUrl: string,
  reminderType: string,
  scheduledAt: string,
  durationMinutes: number,
  lang: string,
) {
  const logoUrl = "https://lglgmhzgxyvyftdhvdsy.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1";
  const isEl = lang === "el";

  const d = new Date(scheduledAt);
  const locale = isEl ? "el-GR" : "en-US";
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" });
  const date = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Athens" });
  const tzLabel = isEl ? "ώρα Ελλάδας" : "Greece time";

  let subjectLine = "";
  let bodyText = "";

  if (reminderType === "24h") {
    subjectLine = isEl ? "Υπενθύμιση Συνάντησης — Αύριο" : "Meeting Reminder — Tomorrow";
    bodyText = isEl
      ? `σας υπενθυμίζουμε ότι αύριο <strong>${date}</strong> στις <strong>${time}</strong> (${tzLabel}) έχουμε την συνάντησή μας.`
      : `this is a reminder that tomorrow <strong>${date}</strong> at <strong>${time}</strong> (${tzLabel}) we have our meeting.`;
  } else if (reminderType === "1h") {
    subjectLine = isEl ? "Η Συνάντησή σας ξεκινά σε 1 ώρα" : "Your Meeting Starts in 1 Hour";
    bodyText = isEl
      ? `σε <strong>1 ώρα</strong> ξεκινά η συνάντησή μας (${time} ${tzLabel})! Ετοιμαστείτε και βεβαιωθείτε ότι το Zoom λειτουργεί σωστά.`
      : `our meeting starts in <strong>1 hour</strong> (${time} ${tzLabel})! Get ready and make sure Zoom is working properly.`;
  } else if (reminderType === "5min") {
    subjectLine = isEl ? "Ο Αλέξανδρος θα είναι μαζί σας σε 5 λεπτά!" : "Alexandros will be with you in 5 minutes!";
    bodyText = isEl
      ? `ο Αλέξανδρος θα είναι μαζί σας σε <strong>5 λεπτά</strong>! Ετοιμαστείτε και μπείτε στην κλήση.`
      : `Alexandros will be with you in <strong>5 minutes</strong>! Get ready and join the call.`;
  }

  const greetingPrefix = isEl ? "Καλησπέρα" : "Hello";
  const ctaText = isEl ? "Σύνδεση στη Συνάντηση" : "Join Meeting";

  return {
    subject: `${subjectLine} — The Greek Carnivore`,
    html: `<!DOCTYPE html>
<html lang="${isEl ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${logoUrl}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">${subjectLine}</h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px;">${greetingPrefix} <strong>${firstName}</strong>, ${bodyText}</p>
    <a href="${meetingUrl}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">${ctaText}</a>
    <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">The Greek Carnivore</p>
  </div>
</body>
</html>`,
  };
}

function buildChatMessage(firstName: string, meetingUrl: string, reminderType: string, scheduledAt: string, lang: string) {
  const isEl = lang === "el";
  const d = new Date(scheduledAt);
  const locale = isEl ? "el-GR" : "en-US";
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" });
  const date = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Athens" });
  const tzLabel = isEl ? "ώρα Ελλάδας" : "Greece time";

  if (reminderType === "24h") {
    return isEl
      ? `Καλησπέρα ${firstName}! Σας υπενθυμίζουμε ότι αύριο ${date} στις ${time} ${tzLabel} έχουμε την συνάντησή μας.\nΟ σύνδεσμος: ${meetingUrl}`
      : `Hello ${firstName}! This is a reminder that tomorrow ${date} at ${time} ${tzLabel} we have our meeting.\nLink: ${meetingUrl}`;
  } else if (reminderType === "1h") {
    return isEl
      ? `Καλησπέρα ${firstName}! Σε 1 ώρα ξεκινά η συνάντησή μας (${time} ${tzLabel})! Ετοιμαστείτε.\nΟ σύνδεσμος: ${meetingUrl}`
      : `Hello ${firstName}! Our meeting starts in 1 hour (${time} ${tzLabel})! Get ready.\nLink: ${meetingUrl}`;
  } else {
    return isEl
      ? `${firstName}, ο Αλέξανδρος θα είναι μαζί σας σε 5 λεπτά! Ετοιμαστείτε και μπείτε στην κλήση: ${meetingUrl}`
      : `${firstName}, Alexandros will be with you in 5 minutes! Get ready and join the call: ${meetingUrl}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString();

    const { data: reminders, error: remErr } = await supabase
      .from("call_reminders").select("id, video_call_id, reminder_type, send_at")
      .is("sent_at", null).lte("send_at", now).order("send_at", { ascending: true }).limit(50);

    if (remErr) throw remErr;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ message: "No pending reminders" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRole } = await supabase
      .from("user_roles").select("user_id").eq("role", "admin").limit(1).single();
    const adminId = adminRole?.user_id;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = "The Greek Carnivore <noreply@thegreekcarnivore.com>";

    let messagesSent = 0;
    let emailsSent = 0;

    for (const reminder of reminders) {
      const { data: call } = await supabase
        .from("video_calls").select("id, title, meeting_url, scheduled_at, duration_minutes")
        .eq("id", reminder.video_call_id).single();

      if (!call) {
        await supabase.from("call_reminders").update({ sent_at: now }).eq("id", reminder.id);
        continue;
      }

      const callTime = new Date(call.scheduled_at).getTime();
      if (callTime < Date.now() - 30 * 60 * 1000) {
        await supabase.from("call_reminders").update({ sent_at: now }).eq("id", reminder.id);
        continue;
      }

      const { data: participants } = await supabase
        .from("video_call_participants").select("user_id").eq("video_call_id", call.id);
      if (!participants || participants.length === 0) {
        await supabase.from("call_reminders").update({ sent_at: now }).eq("id", reminder.id);
        continue;
      }

      const userIds = participants.map((p: any) => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles").select("id, display_name, email, language").in("id", userIds);

      for (const profile of (profiles || []) as any[]) {
        const firstName = profile.display_name?.split(" ")[0] || profile.email?.split("@")[0] || "there";
        const lang = profile.language || "el";

        if (adminId) {
          const chatMsg = buildChatMessage(firstName, call.meeting_url, reminder.reminder_type, call.scheduled_at, lang);
          await supabase.from("messages").insert({ sender_id: adminId, receiver_id: profile.id, content: chatMsg, is_automated: true });
          messagesSent++;
        }

        if (resendApiKey && profile.email) {
          const { subject, html } = buildReminderEmailHtml(firstName, call.meeting_url, reminder.reminder_type, call.scheduled_at, call.duration_minutes, lang);
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
              body: JSON.stringify({ from: fromEmail, to: [profile.email], subject, html }),
            });
            if (res.ok) emailsSent++;
            else console.error(`Email to ${profile.email} failed:`, await res.text());
          } catch (e) { console.error(`Email error for ${profile.email}:`, e); }
        }
      }

      await supabase.from("call_reminders").update({ sent_at: now }).eq("id", reminder.id);
    }

    return new Response(
      JSON.stringify({ message: `Processed ${reminders.length} reminders. Messages: ${messagesSent}, Emails: ${emailsSent}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reminder error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
