import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAppUrl } from "../_shared/app-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "The Greek Carnivore <noreply@thegreekcarnivore.com>";
const LOGO_URL = "https://lglgmhzgxyvyftdhvdsy.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1";

function buildMeasurementReminderEmail(firstName: string, lang: string): string {
  const isEl = lang === "el";
  const heading = isEl ? "Υπενθύμιση Μετρήσεων 📸" : "Measurement Reminder 📸";
  const greeting = isEl ? `Καλημέρα <strong>${firstName}</strong>,` : `Good morning <strong>${firstName}</strong>,`;
  const body = isEl
    ? "Σήμερα είναι η μέρα για τις εβδομαδιαίες μετρήσεις και φωτογραφίες προόδου σου! Αυτό βοηθά να βλέπουμε την πρόοδό σου και να προσαρμόζουμε το πρόγραμμά σου."
    : "Today is the day for your weekly measurements and progress photos! This helps us track your progress and adjust your program.";
  const needsLabel = isEl ? "Τι χρειάζεται" : "What's needed";
  const items = isEl
    ? ["📸 Φωτογραφίες προόδου (μπροστά, πλάι, πίσω)", "📏 Καταχώρηση μετρήσεων στην εφαρμογή"]
    : ["📸 Progress photos (front, side, back)", "📏 Log measurements in the app"];
  const ctaText = isEl ? "Καταχώρηση Μετρήσεων" : "Log Measurements";

  return `<!DOCTYPE html>
<html lang="${isEl ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">${heading}</h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px;">${greeting}</p>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 20px;">${body}</p>
    <div style="background:#faf8f4;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:0.05em;">${needsLabel}</p>
      <ul style="font-size:14px;color:#444;line-height:1.8;margin:0;padding-left:18px;">
        ${items.map(i => `<li>${i}</li>`).join("\n        ")}
      </ul>
    </div>
    <a href="${buildAppUrl("/measurements")}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">${ctaText}</a>
    <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">The Greek Carnivore</p>
  </div>
</body>
</html>`;
}

function buildGenericMessageEmail(firstName: string, messageContent: string, lang: string): string {
  const isEl = lang === "el";
  const heading = isEl ? "Νέο Μήνυμα 💬" : "New Message 💬";

  return `<!DOCTYPE html>
<html lang="${isEl ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">${heading}</h1>
    <div style="font-size:14px;color:#444;line-height:1.7;margin:0 0 24px;white-space:pre-wrap;">${messageContent}</div>
    <a href="${buildAppUrl("/home")}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">${isEl ? "Άνοιξε την Εφαρμογή" : "Open App"}</a>
    <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">The Greek Carnivore</p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const todayDow = today.getDay(); // 0=Sun, 1=Mon...
    const utcHour = today.getUTCHours();
    const utcMinute = today.getUTCMinutes();

    // Get all active enrollments
    const { data: enrollments, error: enrollErr } = await supabase
      .from("client_program_enrollments")
      .select("id, user_id, program_template_id, start_date, weekly_day, duration_weeks_override")
      .eq("status", "active");

    if (enrollErr) throw enrollErr;
    if (!enrollments || enrollments.length === 0) {
      return new Response(JSON.stringify({ message: "No active enrollments" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get admin user for sending messages
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();
    const adminId = adminRole?.user_id;

    let messagesSent = 0;
    let tasksCreated = 0;
    let emailsSent = 0;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    for (const enrollment of enrollments) {
      const startDate = new Date(enrollment.start_date);
      const dayOffset = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Get template duration, use override if set
      const { data: tmpl } = await supabase
        .from("program_templates")
        .select("duration_weeks")
        .eq("id", enrollment.program_template_id)
        .single();
      const totalDays = ((enrollment.duration_weeks_override ?? tmpl?.duration_weeks) || 26) * 7;

      if (dayOffset < 0 || dayOffset >= totalDays) continue; // Outside program window

      // Get client profile (name, email, timezone)
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email, timezone")
        .eq("id", enrollment.user_id)
        .single();
      const clientName = profile?.display_name || profile?.email?.split("@")[0] || "there";

      // Get client's local time (hour and minute)
      const clientTz = profile?.timezone || "Europe/Athens";
      let clientLocalHour: number;
      let clientLocalMinute: number;
      try {
        const hFmt = new Intl.DateTimeFormat("en-US", { timeZone: clientTz, hour: "numeric", hour12: false });
        clientLocalHour = parseInt(hFmt.format(today), 10);
        const mFmt = new Intl.DateTimeFormat("en-US", { timeZone: clientTz, minute: "numeric" });
        clientLocalMinute = parseInt(mFmt.format(today), 10);
      } catch {
        const hFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Athens", hour: "numeric", hour12: false });
        clientLocalHour = parseInt(hFmt.format(today), 10);
        const mFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Athens", minute: "numeric" });
        clientLocalMinute = parseInt(mFmt.format(today), 10);
      }
      const clientLang = profile?.language || "el";

      // --- MESSAGES ---
      const { data: messages } = await supabase
        .from("program_messages")
        .select("*")
        .eq("program_template_id", enrollment.program_template_id);

      if (messages && adminId) {
        for (const msg of messages) {
          // Check per-message send time: only send if client's local time matches
          const msgHour = msg.send_hour ?? 7;
          const msgMinute = msg.send_minute ?? 30;
          // Allow a 30-minute window for cron timing tolerance
          const msgTimeInMinutes = msgHour * 60 + msgMinute;
          const clientTimeInMinutes = clientLocalHour * 60 + clientLocalMinute;
          if (clientTimeInMinutes < msgTimeInMinutes || clientTimeInMinutes >= msgTimeInMinutes + 30) {
            continue;
          }

          let shouldSend = false;

          if (msg.day_offset === dayOffset && !msg.recurrence) {
            shouldSend = true;
          } else if (msg.recurrence === "daily") {
            const endDay = msg.recurrence_end_day ?? totalDays - 1;
            if (dayOffset >= msg.day_offset && dayOffset <= endDay) {
              shouldSend = true;
            }
          } else if (msg.recurrence === "weekly") {
            const endDay = msg.recurrence_end_day ?? totalDays - 1;
            if (dayOffset >= msg.day_offset && todayDow === enrollment.weekly_day && dayOffset <= endDay) {
              shouldSend = true;
            }
          }

          if (shouldSend) {
            // Duplicate check: don't send same message template on the same day
            const { data: existing } = await supabase
              .from("messages")
              .select("id")
              .eq("sender_id", adminId)
              .eq("receiver_id", enrollment.user_id)
              .gte("created_at", `${todayStr}T00:00:00`)
              .lte("created_at", `${todayStr}T23:59:59`)
              .ilike("content", msg.message_content.substring(0, 50) + "%")
              .limit(1);

            if (!existing || existing.length === 0) {
              const content = msg.message_content.replace(/\{client_name\}/g, clientName);
              await supabase.from("messages").insert({
                sender_id: adminId,
                receiver_id: enrollment.user_id,
                content,
                is_automated: true,
              });
              messagesSent++;

              // Send email if also_send_email is enabled OR for legacy weekly measurement reminders
              const shouldEmail = (msg.also_send_email === true) || (msg.recurrence === "weekly" && !msg.also_send_email && msg.also_send_email !== false);
              if (shouldEmail && resendApiKey && profile?.email) {
                try {
                  // Use measurement-specific email for weekly measurement reminders, generic for others
                  const isMeasurementReminder = msg.recurrence === "weekly" && msg.message_content.includes("μετρήσ");
                  const emailHtml = isMeasurementReminder
                    ? buildMeasurementReminderEmail(clientName, clientLang)
                    : buildGenericMessageEmail(clientName, content, clientLang);
                  const emailSubject = isMeasurementReminder
                    ? "Υπενθύμιση Μετρήσεων 📸 — The Greek Carnivore"
                    : `The Greek Carnivore — ${content.substring(0, 50)}`;

                  const emailRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify({
                      from: FROM_EMAIL,
                      to: [profile.email],
                      subject: emailSubject,
                      html: emailHtml,
                    }),
                  });
                  if (emailRes.ok) emailsSent++;
                  else console.error(`Email to ${profile.email} failed:`, await emailRes.text());
                } catch (e) {
                  console.error(`Email error for ${profile.email}:`, e);
                }
              }
            }
          }
        }
      }

      // --- TASKS ---
      const { data: taskTemplates } = await supabase
        .from("program_tasks")
        .select("*")
        .eq("program_template_id", enrollment.program_template_id);

      if (taskTemplates) {
        for (const task of taskTemplates) {
          let shouldCreate = false;

          if (task.day_offset === dayOffset && !task.recurrence) {
            shouldCreate = true;
          } else if (task.recurrence === "daily") {
            const endDay = task.recurrence_end_day ?? totalDays - 1;
            if (dayOffset >= task.day_offset && dayOffset <= endDay) {
              shouldCreate = true;
            }
          } else if (task.recurrence === "weekly") {
            const endDay = task.recurrence_end_day ?? totalDays - 1;
            if (dayOffset >= task.day_offset && todayDow === enrollment.weekly_day && dayOffset <= endDay) {
              shouldCreate = true;
            }
          }

          if (shouldCreate) {
            // Duplicate check
            const { data: existing } = await supabase
              .from("client_tasks")
              .select("id")
              .eq("user_id", enrollment.user_id)
              .eq("source_task_id", task.id)
              .eq("due_date", todayStr)
              .limit(1);

            if (!existing || existing.length === 0) {
              await supabase.from("client_tasks").insert({
                user_id: enrollment.user_id,
                enrollment_id: enrollment.id,
                source_task_id: task.id,
                title: task.title,
                description: task.description,
                task_type: task.task_type,
                due_date: todayStr,
                linked_content_id: task.linked_content_id,
              });
              tasksCreated++;

              // Create client notification for push
              const taskLink = task.task_type === "measurement"
                ? "/measurements?tab=body"
                : task.task_type === "photo"
                ? "/measurements?tab=photos"
                : task.task_type === "food"
                ? "/measurements?tab=food"
                : "/home";

              await supabase.from("client_notifications").insert({
                user_id: enrollment.user_id,
                type: "task_reminder",
                title: task.title || "New task",
                body: task.description || "You have a new task to complete",
                link: taskLink,
              });
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${enrollments.length} enrollments. Messages sent: ${messagesSent}, Tasks created: ${tasksCreated}, Emails sent: ${emailsSent}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Automation error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
