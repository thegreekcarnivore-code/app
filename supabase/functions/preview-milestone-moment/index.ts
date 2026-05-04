import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// One-shot preview: takes an email, generates the Day-21 anniversary milestone
// using the SAME generation logic as the cron, and delivers it for real
// (in-app + email). Bypasses the date check + dedup so the message fires
// regardless of when the member actually enrolled.
//
// Use to preview the experience for a real member without waiting until
// their actual Day 21. Keeps the row in milestone_moments with a metadata
// flag so it's distinguishable from production milestones.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "The Greek Carnivore <noreply@thegreekcarnivore.com>";

function buildEmailHtml(subject: string, body: string, appUrl: string): string {
  const paragraphs = body.split(/\n\s*\n/).map((p) => `<p style="font-size:15px;color:#444;line-height:1.75;margin:0 0 18px;white-space:pre-wrap;">${p.trim()}</p>`).join("\n");
  return `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fff;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:40px 30px;">
  <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:600;color:#1a1a1a;margin:0 0 22px;letter-spacing:0.01em;line-height:1.2;">${subject}</h1>
  ${paragraphs}
  <a href="${appUrl}" target="_blank" style="display:inline-block;background:#b39a64;color:#141414;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;margin:8px 0 24px;">Άνοιξε την εφαρμογή</a>
  <p style="font-size:11px;color:#aaa;line-height:1.6;margin:24px 0 0;">— Σύμβουλος, Μεταμόρφωση</p>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY");

  try {
    const body = await req.json().catch(() => ({}));
    const email = (body?.email ?? "").trim().toLowerCase();
    const milestoneDay: number = Number(body?.milestone_day ?? 21);
    const forceQualified = body?.force_qualified !== false; // default true so the preview shows the celebration version

    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, display_name")
      .eq("email", email)
      .maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: `no profile for ${email}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = (profile as { id: string }).id;
    const firstName = (profile as { display_name?: string; email?: string }).display_name
      ?? (profile as { email?: string }).email?.split("@")[0] ?? "";

    // Pull intake + journey for the personalization payload
    const [intakeRes, journeyRes, weightRes, foodRes, chatRes, loginRes, baselineRes] = await Promise.all([
      admin.from("member_intakes").select("primary_goal_detail, weight_kg").eq("user_id", userId).maybeSingle(),
      admin.from("member_journey_log").select("kind, summary").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(8),
      admin.from("measurements").select("weight_kg, measured_at").eq("user_id", userId).not("weight_kg", "is", null).order("measured_at", { ascending: false }),
      admin.from("food_journal").select("created_at").eq("user_id", userId),
      admin.from("concierge_chat_history").select("created_at").eq("user_id", userId),
      admin.from("user_activity_log").select("last_active_at").eq("user_id", userId),
      admin.from("measurements").select("weight_kg").eq("user_id", userId).not("weight_kg", "is", null).order("measured_at", { ascending: true }).limit(1).maybeSingle(),
    ]);
    const intake = intakeRes.data as { primary_goal_detail?: string | null; weight_kg?: number | null } | null;
    const journey = ((journeyRes.data ?? []) as { kind: string; summary: string }[])
      .map((j) => `- [${j.kind}] ${j.summary}`).join("\n");

    // For qualified preview, fabricate plausible stats. For non-qualified preview, use real counts.
    const realWeightCount = (weightRes.data ?? []).length;
    const realFoodCount = (foodRes.data ?? []).length;
    const realChatCount = (chatRes.data ?? []).length;
    const realDaysActive = new Set(((loginRes.data ?? []) as { last_active_at: string }[]).map((r) => r.last_active_at.slice(0, 10))).size;
    const lastWeight = (weightRes.data ?? [])[0] as { weight_kg: number } | undefined;
    const baseline = (baselineRes.data as { weight_kg: number } | null)?.weight_kg ?? intake?.weight_kg ?? null;

    const weightCount = forceQualified ? Math.max(realWeightCount, 5) : realWeightCount;
    const foodCount = forceQualified ? Math.max(realFoodCount, 14) : realFoodCount;
    const chatCount = forceQualified ? Math.max(realChatCount, 6) : realChatCount;
    const daysActive = forceQualified ? Math.max(realDaysActive, 18) : realDaysActive;
    // Synthetic weight delta for qualified preview (a believable -2.4kg in 21 days)
    const weightDelta = forceQualified
      ? -2.4
      : (lastWeight?.weight_kg && baseline) ? +(lastWeight.weight_kg - baseline).toFixed(1) : null;

    const LABEL_MAP: Record<number, { headline: string; period: string }> = {
      21:  { headline: "Πρώτο ορόσημο",   period: "1 μήνας" },
      81:  { headline: "3 μήνες",         period: "3 μήνες" },
      141: { headline: "5 μήνες",         period: "5 μήνες" },
      201: { headline: "7 μήνες",         period: "7 μήνες" },
      261: { headline: "9 μήνες",         period: "9 μήνες" },
      321: { headline: "11 μήνες",        period: "11 μήνες" },
      351: { headline: "1 χρόνος Master", period: "1 χρόνος" },
    };
    const labels = LABEL_MAP[milestoneDay] ?? { headline: `${milestoneDay} ημέρες`, period: `${milestoneDay} ημέρες` };

    const directive = forceQualified
      ? `Είσαι ο Σύμβουλος. Πελάτης carnivore έφτασε στο ορόσημο ${labels.period} και πληροί τα κριτήρια συνέπειας. Γράψε ΣΥΝΤΟΜΟ μήνυμα 4 παραγράφων:

1. Headline: «${labels.headline}.»
2. Παρατήρηση συγκεκριμένη — μέτρα: ${weightCount} ζυγαριές · ${foodCount} γεύματα · ${chatCount} chats · ${daysActive} ενεργές μέρες${weightDelta !== null ? ` · ${weightDelta >= 0 ? "+" : ""}${weightDelta}kg` : ""}.
3. Αναφορά στο ταξίδι του (αν υπάρχουν σήματα παρακάτω, χρησιμοποίησέ τα — αλλιώς πες κάτι ζεστό για συνέπεια carnivore):
${journey || "(δεν υπάρχουν σήματα — πες κάτι γενικό για συνέπεια carnivore)"}
4. Κλείσιμο: invitational πρόταση να συνεχίσει — όχι σε επόμενο ορόσημο, αλλά στην επόμενη ζυγαριά / στο επόμενο γεύμα.

ΑΠΑΓΟΡΕΥΕΤΑΙ: αναφορά σε εγγύηση, ακύρωση, "AI", emojis. Τόνος: ζεστός + αναγνώριση + ήρεμος.`
      : `Είσαι ο Σύμβουλος. Πελάτης πλησιάζει το ορόσημο ${labels.period} αλλά δεν έχει αρκετά δεδομένα (${weightCount} ζυγαριές, ${foodCount} γεύματα, ${chatCount} chats, ${daysActive} ενεργές μέρες). Γράψε ΣΥΝΤΟΜΟ μήνυμα 3 παραγράφων:

1. Headline: «Πλησιάζει το ορόσημο σου.»
2. Εξήγηση: για να γυρίσουμε την ιστορία σου χρειαζόμαστε λίγα δεδομένα ακόμα. Συγκεκριμένα: 1 ζυγαριά + 2 γεύματα + 1 chat μέσα στις επόμενες μέρες.
3. Κλείσιμο: «Από εκεί φτιάχνεται.» Σαν invitation, όχι κριτική.

ΑΠΑΓΟΡΕΥΕΤΑΙ: αναφορά σε εγγύηση, ακύρωση, "AI", emojis, ντροπή.`;

    let messageText = "";
    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: directive },
          { role: "user", content: `Member: ${firstName}\n\nGoal from intake: ${intake?.primary_goal_detail ?? "(δεν δηλώθηκε)"}\n\nΓράψε το μήνυμα στα ελληνικά. Επιστρέφεις ΜΟΝΟ το κείμενο.` },
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });
    if (aiResp.ok) {
      const j = await aiResp.json();
      messageText = (j?.choices?.[0]?.message?.content ?? "").trim();
    }
    if (!messageText || messageText.length < 30) {
      messageText = forceQualified
        ? `${labels.headline}.\n\n${labels.period} μέσα στο πρόγραμμα. ${weightCount} ζυγαριές, ${foodCount} γεύματα, ${chatCount} chats, ${weightDelta !== null ? `${weightDelta >= 0 ? "+" : ""}${weightDelta}kg.` : ""} Αυτή είναι η ιστορία σου μέχρι σήμερα.\n\nΣυνεχίζουμε. Επόμενη ζυγαριά αύριο πρωί.`
        : `Πλησιάζει το ορόσημο σου.\n\nΓια να γυρίσουμε την ιστορία σου χρειαζόμαστε λίγα δεδομένα ακόμα: 1 ζυγαριά + 2 γεύματα + 1 chat στις επόμενες μέρες.\n\nΑπό εκεί φτιάχνεται.`;
    }

    const subject = forceQualified ? `${labels.headline} · η ιστορία σου` : "Πλησιάζει το ορόσημο σου";

    // Insert into milestone_moments with a preview marker. Use a unique
    // milestone_day (negative offset) so we don't conflict with the real
    // future milestone.
    const previewDay = -milestoneDay; // negative → preview, won't collide with real day
    await admin.from("milestone_moments").upsert({
      user_id: userId,
      milestone_day: previewDay,
      qualified: forceQualified,
      signals: {
        weight_count: weightCount,
        food_count: foodCount,
        chat_count: chatCount,
        days_active: daysActive,
        weight_delta_kg: weightDelta,
        synthetic_for_preview: forceQualified,
      },
      message_text: messageText,
      email_subject: subject,
      status: "sent",
      sent_at: new Date().toISOString(),
      metadata: { source: "preview", real_milestone_day: milestoneDay },
    }, { onConflict: "user_id,milestone_day" });

    // In-app delivery via public.messages (admin → member)
    const { data: adminRow } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
    const senderId = (adminRow as { user_id?: string } | null)?.user_id ?? null;
    if (senderId) {
      await admin.from("messages").insert({ sender_id: senderId, receiver_id: userId, content: messageText });
    }

    // Email delivery
    let emailStatus = "skipped_no_resend_key";
    if (resendKey) {
      const appUrl = `${Deno.env.get("APP_BASE_URL") ?? "https://app.thegreekcarnivore.com"}/home`;
      const html = buildEmailHtml(subject, messageText, appUrl);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject, html }),
      });
      emailStatus = r.ok ? "sent" : `error_${r.status}`;
    }

    return new Response(JSON.stringify({
      ok: true,
      preview_for: email,
      milestone_day: milestoneDay,
      forced_qualified: forceQualified,
      stats: { weight_count: weightCount, food_count: foodCount, chat_count: chatCount, days_active: daysActive, weight_delta_kg: weightDelta },
      subject,
      message_text: messageText,
      email_status: emailStatus,
      delivered: { in_app: senderId ? true : false, email: emailStatus === "sent" },
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
