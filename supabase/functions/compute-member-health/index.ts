import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Returns the at-risk member list for the /admin Health dashboard.
// Joins profiles with derived signals (last login, last weight, last food log,
// last chat, weight delta, streak) and computes a risk band per member.
// Read-only; admin-only via auth.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  subscription_status: string | null;
  re_engagement_paused: boolean | null;
};

type DaysAgo = number | null;

function daysSince(iso: string | null | undefined): DaysAgo {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
}

function pickRiskBand(d: {
  daysSinceLogin: DaysAgo;
  daysSinceWeight: DaysAgo;
  daysSinceFoodLog: DaysAgo;
  daysSinceChat: DaysAgo;
  weightDeltaKg: number | null;
}): "healthy" | "slipping" | "at_risk" | "lost" | "deep_lost" {
  const idle = Math.min(
    d.daysSinceLogin ?? 999,
    d.daysSinceFoodLog ?? 999,
    d.daysSinceChat ?? 999,
  );
  const noWeightLong = (d.daysSinceWeight ?? 999) >= 14;
  if (idle <= 3 && (d.daysSinceWeight ?? 999) <= 10) return "healthy";
  if (idle >= 22) return "deep_lost";
  if (idle >= 15) return "lost";
  if (idle >= 8 || noWeightLong || (d.weightDeltaKg !== null && d.weightDeltaKg >= 1)) return "at_risk";
  if (idle >= 4) return "slipping";
  return "healthy";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Admin auth check
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
  const userId = claims?.claims?.sub;
  if (!userId) {
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
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Active members only
    const { data: enrollments } = await admin
      .from("client_program_enrollments")
      .select("user_id, start_date")
      .eq("status", "active");
    const userIds = Array.from(new Set((enrollments ?? []).map((e: { user_id: string }) => e.user_id)));
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, members: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const startDateByUser = new Map<string, string>();
    for (const e of enrollments ?? []) startDateByUser.set((e as { user_id: string }).user_id, (e as { start_date: string }).start_date);

    const [profilesRes, weightRes, foodRes, chatRes, loginRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, email, display_name, subscription_status, re_engagement_paused")
        .in("id", userIds),
      admin
        .from("measurements")
        .select("user_id, weight_kg, measured_at")
        .in("user_id", userIds)
        .not("weight_kg", "is", null)
        .order("measured_at", { ascending: false }),
      admin
        .from("food_journal")
        .select("user_id, entry_date, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false }),
      admin
        .from("concierge_chat_history")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false }),
      admin
        .from("user_activity_log")
        .select("user_id, last_active_at")
        .in("user_id", userIds)
        .order("last_active_at", { ascending: false }),
    ]);

    const lastWeight = new Map<string, { weight: number; at: string }>();
    const earliestWeight = new Map<string, { weight: number; at: string }>();
    for (const r of (weightRes.data ?? []) as { user_id: string; weight_kg: number; measured_at: string }[]) {
      if (!lastWeight.has(r.user_id)) lastWeight.set(r.user_id, { weight: r.weight_kg, at: r.measured_at });
      // keep overwriting → ends up with earliest
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

    const members = ((profilesRes.data ?? []) as Profile[]).map((p) => {
      const lw = lastWeight.get(p.id);
      const ew = earliestWeight.get(p.id);
      const dsLogin = daysSince(lastLogin.get(p.id) ?? null);
      const dsWeight = daysSince(lw?.at ?? null);
      const dsFood = daysSince(lastFood.get(p.id) ?? null);
      const dsChat = daysSince(lastChat.get(p.id) ?? null);
      const weightDeltaKg = lw && ew ? +(lw.weight - ew.weight).toFixed(2) : null;
      const startDate = startDateByUser.get(p.id);
      const daysIn = startDate ? daysSince(startDate) : null;
      const band = pickRiskBand({ daysSinceLogin: dsLogin, daysSinceWeight: dsWeight, daysSinceFoodLog: dsFood, daysSinceChat: dsChat, weightDeltaKg });
      return {
        userId: p.id,
        name: p.display_name ?? p.email?.split("@")[0] ?? p.id.slice(0, 8),
        email: p.email,
        subscriptionStatus: p.subscription_status,
        paused: p.re_engagement_paused === true,
        daysIn,
        daysSinceLogin: dsLogin,
        daysSinceWeight: dsWeight,
        daysSinceFoodLog: dsFood,
        daysSinceChat: dsChat,
        weightDeltaKg,
        band,
      };
    }).sort((a, b) => {
      const order = { deep_lost: 0, lost: 1, at_risk: 2, slipping: 3, healthy: 4 } as Record<string, number>;
      return (order[a.band] ?? 99) - (order[b.band] ?? 99);
    });

    return new Response(JSON.stringify({ ok: true, members, ran_at: new Date().toISOString() }), {
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
