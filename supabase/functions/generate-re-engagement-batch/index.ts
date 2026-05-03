import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TIER_TEMPLATES, pickTier, fillDirective, type TierTemplate } from "../_shared/re-engagement-templates.ts";

// Daily cron: scans active members, identifies those in risk bands, generates
// a personalized re-engagement message per the locked tier templates, and
// inserts into re_engagement_messages with status='pending_approval'.
//
// Anti-spam locks enforced here:
//   - Skip if profile.re_engagement_paused = true
//   - Skip if message sent in last 7 days (cooldown)
//   - Skip if 4+ messages already sent in last 60 days (cap)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GENERATE-RE-ENGAGEMENT] ${step}${tail}`);
};

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: enrollments } = await admin
      .from("client_program_enrollments")
      .select("user_id, start_date, status")
      .eq("status", "active");
    const userIds = Array.from(new Set((enrollments ?? []).map((e: { user_id: string }) => e.user_id)));
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, generated: 0, skipped_paused: 0, skipped_cooldown: 0, skipped_cap: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [profilesRes, weightRes, foodRes, chatRes, loginRes, intakeRes, recentMsgRes] = await Promise.all([
      admin.from("profiles").select("id, email, display_name, subscription_status, re_engagement_paused").in("id", userIds),
      admin.from("measurements").select("user_id, weight_kg, measured_at").in("user_id", userIds).not("weight_kg", "is", null).order("measured_at", { ascending: false }),
      admin.from("food_journal").select("user_id, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
      admin.from("concierge_chat_history").select("user_id, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
      admin.from("user_activity_log").select("user_id, last_active_at").in("user_id", userIds).order("last_active_at", { ascending: false }),
      admin.from("member_intakes").select("user_id, primary_goal_detail, biggest_struggle, biggest_fear, why_now").in("user_id", userIds),
      admin.from("re_engagement_messages").select("user_id, status, sent_at, generated_at").in("user_id", userIds).gte("generated_at", new Date(Date.now() - 60 * 86400000).toISOString()),
    ]);

    type ProfileLite = { id: string; email: string | null; display_name: string | null; subscription_status: string | null; re_engagement_paused: boolean | null };
    type Intake = { user_id: string; primary_goal_detail: string | null; biggest_struggle: string | null; biggest_fear: string | null; why_now: string | null };

    const profileById = new Map<string, ProfileLite>();
    for (const p of (profilesRes.data ?? []) as ProfileLite[]) profileById.set(p.id, p);
    const intakeByUser = new Map<string, Intake>();
    for (const i of (intakeRes.data ?? []) as Intake[]) intakeByUser.set(i.user_id, i);

    const lastWeight = new Map<string, { weight: number; at: string }>();
    const earliestWeight = new Map<string, { weight: number; at: string }>();
    for (const r of (weightRes.data ?? []) as { user_id: string; weight_kg: number; measured_at: string }[]) {
      if (!lastWeight.has(r.user_id)) lastWeight.set(r.user_id, { weight: r.weight_kg, at: r.measured_at });
      earliestWeight.set(r.user_id, { weight: r.weight_kg, at: r.measured_at });
    }
    const lastFood = new Map<string, string>();
    for (const r of (foodRes.data ?? []) as { user_id: string; created_at: string }[]) {
      if (!lastFood.has(r.user_id)) lastFood.set(r.user_id, r.created_at);
    }
    const lastChat = new Map<string, string>();
    for (const r of (chatRes.data ?? []) as { user_id: string; created_at: string }[]) {
      if (!lastChat.has(r.user_id)) lastChat.set(r.user_id, r.created_at);
    }
    const lastLogin = new Map<string, string>();
    for (const r of (loginRes.data ?? []) as { user_id: string; last_active_at: string }[]) {
      if (!lastLogin.has(r.user_id)) lastLogin.set(r.user_id, r.last_active_at);
    }

    type Recent = { user_id: string; status: string; sent_at: string | null; generated_at: string };
    const recentMsgsByUser = new Map<string, Recent[]>();
    for (const r of (recentMsgRes.data ?? []) as Recent[]) {
      const arr = recentMsgsByUser.get(r.user_id) ?? [];
      arr.push(r);
      recentMsgsByUser.set(r.user_id, arr);
    }

    let generated = 0, skippedPaused = 0, skippedCooldown = 0, skippedCap = 0, skippedHealthy = 0;

    for (const userId of userIds) {
      const profile = profileById.get(userId);
      if (!profile) continue;
      if (profile.re_engagement_paused) { skippedPaused++; continue; }

      const recents = recentMsgsByUser.get(userId) ?? [];
      const sentRecents = recents.filter((r) => r.status === "approved_sent" || r.status === "edited_sent");
      const cap60 = sentRecents.length;
      if (cap60 >= 4) { skippedCap++; continue; }
      const lastSent = sentRecents.sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""))[0];
      const cooldownDays = lastSent && lastSent.sent_at ? daysSince(lastSent.sent_at) : 9999;
      if (cooldownDays < 7) { skippedCooldown++; continue; }

      // Also skip if there's a pending_approval message in last 7 days (don't double-queue)
      const pendingRecent = recents.find((r) => r.status === "pending_approval" && daysSince(r.generated_at) < 7);
      if (pendingRecent) { skippedCooldown++; continue; }

      const dsLogin = daysSince(lastLogin.get(userId));
      const dsWeight = daysSince(lastWeight.get(userId)?.at);
      const dsFood = daysSince(lastFood.get(userId));
      const dsChat = daysSince(lastChat.get(userId));
      const idle = Math.min(dsLogin, dsFood, dsChat);

      // Healthy → no message
      if (idle <= 3 && dsWeight <= 10) { skippedHealthy++; continue; }

      // Determine signal + days
      const weightDelta = (() => {
        const lw = lastWeight.get(userId);
        const ew = earliestWeight.get(userId);
        if (!lw || !ew) return null;
        return +(lw.weight - ew.weight).toFixed(2);
      })();

      let signal = "no_login";
      if (dsFood <= idle) signal = "no_food_log";
      if (weightDelta !== null && weightDelta >= 1 && dsWeight <= 14) signal = "weight_gained";
      if (idle >= 22) signal = "near_lost";
      else if (idle >= 15) signal = "deep_idle";

      const tier = pickTier(idle, signal, weightDelta);
      if (!tier) continue;

      const intake = intakeByUser.get(userId);
      const directive = fillDirective(tier.systemDirective, {
        DAYS_IDLE: idle,
        WEIGHT_GAINED: weightDelta ?? 0,
      });

      const memberContext = [
        intake?.primary_goal_detail ? `Στόχος (intake): ${intake.primary_goal_detail}` : "",
        intake?.biggest_struggle ? `Μεγαλύτερη δυσκολία (intake): ${intake.biggest_struggle}` : "",
        intake?.biggest_fear ? `Φόβος (intake): ${intake.biggest_fear}` : "",
        intake?.why_now ? `Γιατί τώρα (intake): ${intake.why_now}` : "",
      ].filter(Boolean).join("\n");

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: directive },
            { role: "user", content: `Member context:\n${memberContext}\n\nΤώρα γράψε το μήνυμα στα ελληνικά. Επιστρέφεις ΜΟΝΟ το κείμενο του μηνύματος, χωρίς εισαγωγή ή εξήγηση.` },
          ],
          temperature: 0.4,
          max_tokens: 400,
        }),
      });
      if (!aiResp.ok) {
        log("ai error", { userId, status: aiResp.status });
        continue;
      }
      const aiJson = await aiResp.json();
      const text: string = (aiJson?.choices?.[0]?.message?.content ?? "").trim();
      if (!text || text.length < 30) continue;

      await admin.from("re_engagement_messages").insert({
        user_id: userId,
        tier: tier.tier,
        trigger_signal: signal,
        days_idle: idle,
        generated_text: text,
        email_subject: tier.emailSubject,
        status: "pending_approval",
        metadata: { weight_delta_kg: weightDelta, days_since_login: dsLogin, days_since_weight: dsWeight, days_since_food: dsFood, days_since_chat: dsChat },
      });
      generated++;
    }

    return new Response(JSON.stringify({ ok: true, generated, skipped_paused: skippedPaused, skipped_cooldown: skippedCooldown, skipped_cap: skippedCap, skipped_healthy: skippedHealthy }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    log("ERROR", { message: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
