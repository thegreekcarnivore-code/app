import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Daily cron: identifies members who hit a milestone day (21, 81, 171, 351
// after enrollment), runs the 3-of-4 eligibility check on the most recent
// 30 days, builds a personalized message (qualifying or "almost there"
// flavor), and sends it via in-app + email.
//
// Idempotency: UNIQUE (user_id, milestone_day) prevents the same milestone
// from firing twice for the same member.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "The Greek Carnivore <noreply@thegreekcarnivore.com>";

const MILESTONE_DAYS = [21, 81, 171, 351] as const;
type MilestoneDay = typeof MILESTONE_DAYS[number];

const MILESTONE_LABELS: Record<MilestoneDay, { headline: string; period: string }> = {
  21:  { headline: "Πρώτο ορόσημο",      period: "30 ημέρες" },
  81:  { headline: "3 μήνες",            period: "3 μήνες" },
  171: { headline: "Το μισό χρόνο",      period: "6 μήνες" },
  351: { headline: "1 χρόνος Master",    period: "1 χρόνος" },
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MILESTONE-MOMENTS] ${step}${tail}`);
};

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

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
    const { data: enrollments } = await admin
      .from("client_program_enrollments")
      .select("user_id, start_date, status, created_at")
      .eq("status", "active");
    const list = (enrollments ?? []) as { user_id: string; start_date: string; created_at: string }[];

    const { data: adminRow } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
    const senderId = (adminRow as { user_id?: string } | null)?.user_id ?? null;

    let qualifyingFired = 0;
    let almostFired = 0;
    let skippedDuplicate = 0;
    let skippedNoMilestone = 0;

    for (const enr of list) {
      const dsStart = daysSince(enr.start_date ?? enr.created_at);
      const milestoneDay = MILESTONE_DAYS.find((d) => d === dsStart);
      if (!milestoneDay) { skippedNoMilestone++; continue; }

      const userId = enr.user_id;

      // Idempotency check
      const { data: existing } = await admin
        .from("milestone_moments")
        .select("id")
        .eq("user_id", userId)
        .eq("milestone_day", milestoneDay)
        .maybeSingle();
      if (existing) { skippedDuplicate++; continue; }

      // Pull last 30 days of signals
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const [weightRes, foodRes, chatRes, loginRes, profileRes, intakeRes, journeyRes, baselineRes] = await Promise.all([
        admin.from("measurements").select("weight_kg, measured_at").eq("user_id", userId).not("weight_kg", "is", null).gte("measured_at", cutoff),
        admin.from("food_journal").select("created_at").eq("user_id", userId).gte("created_at", cutoff),
        admin.from("concierge_chat_history").select("created_at").eq("user_id", userId).gte("created_at", cutoff),
        admin.from("user_activity_log").select("last_active_at").eq("user_id", userId).gte("last_active_at", cutoff),
        admin.from("profiles").select("email, display_name").eq("id", userId).maybeSingle(),
        admin.from("member_intakes").select("primary_goal_detail, weight_kg as starting_weight").eq("user_id", userId).maybeSingle(),
        admin.from("member_journey_log").select("kind, summary").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(8),
        admin.from("measurements").select("weight_kg, measured_at").eq("user_id", userId).not("weight_kg", "is", null).order("measured_at", { ascending: true }).limit(1).maybeSingle(),
      ]);

      const weightCount = (weightRes.data ?? []).length;
      const foodCount = (foodRes.data ?? []).length;
      const chatCount = (chatRes.data ?? []).length;
      const loginRows = (loginRes.data ?? []) as { last_active_at: string }[];
      const daysActive = new Set(loginRows.map((r) => r.last_active_at.slice(0, 10))).size;

      const passes = [
        weightCount >= 4,
        foodCount >= 8,
        chatCount >= 3,
        daysActive >= 8,
      ];
      const passCount = passes.filter(Boolean).length;
      const qualified = passCount >= 3;

      const lw = (weightRes.data ?? [])[0] as { weight_kg: number } | undefined;
      const baseline = (baselineRes.data as { weight_kg: number } | null)?.weight_kg
        ?? (intakeRes.data as { starting_weight?: number } | null)?.starting_weight
        ?? null;
      const weightDelta = (lw?.weight_kg && baseline) ? +(lw.weight_kg - baseline).toFixed(1) : null;

      const profile = profileRes.data as { email?: string; display_name?: string } | null;
      const intake = intakeRes.data as { primary_goal_detail?: string | null } | null;
      const firstName = profile?.display_name ?? profile?.email?.split("@")[0] ?? "";

      const labels = MILESTONE_LABELS[milestoneDay];
      const journey = ((journeyRes.data ?? []) as { kind: string; summary: string }[])
        .map((j) => `- [${j.kind}] ${j.summary}`).join("\n");

      const directive = qualified
        ? `Είσαι ο Σύμβουλος. Ένας πελάτης carnivore έφτασε στο ορόσημο ${labels.period} και πληροί τα κριτήρια συνέπειας. Γράψε ένα ΣΥΝΤΟΜΟ μήνυμα 4 παραγράφων:

1. Headline: «${labels.headline}.»
2. Παρατήρηση συγκεκριμένη — μέτρα: ${weightCount} ζυγαριές · ${foodCount} γεύματα · ${chatCount} chats · ${daysActive} ενεργές μέρες${weightDelta !== null ? ` · ${weightDelta >= 0 ? "+" : ""}${weightDelta}kg` : ""}.
3. Αναφορά στο ταξίδι του (όχι generic — πάρε ένα από τα παρακάτω σήματα και πες κάτι ανθρώπινο):
${journey || "(δεν υπάρχουν σήματα — πες κάτι γενικό για carnivore συνέπεια)"}
4. Κλείσιμο: ένα invitational πρόταση να συνεχίσει — όχι σε επόμενο ορόσημο, αλλά στην επόμενη ζυγαριά / στο επόμενο γεύμα.

ΑΠΑΓΟΡΕΥΕΤΑΙ: αναφορά σε εγγύηση, ακύρωση, "AI", emojis. Τόνος ζεστός + αναγνώριση + ήρεμος.`
        : `Είσαι ο Σύμβουλος. Πελάτης carnivore πλησιάζει το ορόσημο ${labels.period} αλλά ΔΕΝ έχει αρκετά δεδομένα (${weightCount} ζυγαριές, ${foodCount} γεύματα, ${chatCount} chats, ${daysActive} ενεργές μέρες). Γράψε ΣΥΝΤΟΜΟ μήνυμα 3 παραγράφων:

1. Headline: «Πλησιάζει το ορόσημο σου.»
2. Εξήγηση: για να γυρίσουμε την ιστορία σου χρειαζόμαστε λίγα δεδομένα ακόμα. Συγκεκριμένα: 1 ζυγαριά + 2 γεύματα + 1 chat μέσα στις επόμενες μέρες.
3. Κλείσιμο: «Από εκεί φτιάχνεται.» Σαν invitation, όχι κριτική.

ΑΠΑΓΟΡΕΥΕΤΑΙ: αναφορά σε εγγύηση, ακύρωση, "AI", emojis, ντροπή/κριτική. Τόνος: ευγενικός, "your work matters" energy.`;

      let messageText = "";
      try {
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
      } catch (e) {
        log("ai error", { userId, e: String(e) });
      }

      if (!messageText || messageText.length < 30) {
        // Fallback static message
        messageText = qualified
          ? `${labels.headline}.\n\n${labels.period} μέσα στο πρόγραμμα. ${weightCount} ζυγαριές, ${foodCount} γεύματα, ${chatCount} chats${weightDelta !== null ? `, ${weightDelta >= 0 ? "+" : ""}${weightDelta}kg` : ""}. Αυτή είναι η ιστορία σου μέχρι σήμερα.\n\nΣυνεχίζουμε. Επόμενη ζυγαριά αύριο πρωί.`
          : `Πλησιάζει το ορόσημο σου.\n\nΓια να γυρίσουμε την ιστορία σου χρειαζόμαστε λίγα δεδομένα ακόμα: 1 ζυγαριά + 2 γεύματα + 1 chat μέσα στις επόμενες μέρες.\n\nΑπό εκεί φτιάχνεται.`;
      }

      const subject = qualified ? `${labels.headline} · η ιστορία σου` : "Πλησιάζει το ορόσημο σου";

      const { data: inserted } = await admin
        .from("milestone_moments")
        .insert({
          user_id: userId,
          milestone_day: milestoneDay,
          qualified,
          signals: { weight_count: weightCount, food_count: foodCount, chat_count: chatCount, days_active: daysActive, weight_delta_kg: weightDelta },
          message_text: messageText,
          email_subject: subject,
          status: "pending_send",
        })
        .select("id")
        .maybeSingle();

      const milestoneId = (inserted as { id?: string } | null)?.id;

      // In-app message
      if (senderId) {
        await admin.from("messages").insert({ sender_id: senderId, receiver_id: userId, content: messageText });
      }

      // Email
      let emailStatus = "skipped_no_resend_key";
      if (resendKey && profile?.email) {
        const appUrl = `${Deno.env.get("APP_BASE_URL") ?? "https://app.thegreekcarnivore.com"}/home`;
        const html = buildEmailHtml(subject, messageText, appUrl);
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({ from: FROM_EMAIL, to: [profile.email], subject, html }),
        });
        emailStatus = r.ok ? "sent" : `error_${r.status}`;
      }

      if (milestoneId) {
        await admin
          .from("milestone_moments")
          .update({ status: "sent", sent_at: new Date().toISOString(), metadata: { email_status: emailStatus } })
          .eq("id", milestoneId);
      }

      qualified ? qualifyingFired++ : almostFired++;
    }

    return new Response(JSON.stringify({
      ok: true,
      qualifying_fired: qualifyingFired,
      almost_fired: almostFired,
      skipped_duplicate: skippedDuplicate,
      skipped_no_milestone: skippedNoMilestone,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    log("ERROR", { message: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
