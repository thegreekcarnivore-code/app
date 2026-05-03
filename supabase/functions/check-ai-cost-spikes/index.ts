import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Daily cron: aggregate api_usage for the current ISO month, flag any member
// whose spend ≥ €5 (>10% margin loss on €47/mo). When the list is non-empty,
// post a single combined ping to whichever notifier env vars are configured —
// Telegram, Discord, OpenClaw (VPS) — so the admin sees it without opening
// the dashboard. Idempotent: never modifies any data.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_RED = 5.0;       // hard alert
const TIER_AMBER = 3.5;     // warning only

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-AI-COST-SPIKES] ${step}${tail}`);
};

type UsageRow = {
  user_id: string;
  function_name: string;
  estimated_cost: number;
  call_count: number;
};

type ProfileLite = {
  id: string;
  email: string | null;
  display_name: string | null;
};

const monthStartISO = (() => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
})();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const { data: rows } = await admin
      .from("api_usage")
      .select("user_id, function_name, estimated_cost, call_count")
      .gte("created_at", monthStartISO)
      .limit(50000);
    const usage = (rows ?? []) as UsageRow[];

    // Aggregate by user
    const perUser: Record<string, { totalCost: number; totalCalls: number; topFn: { name: string; cost: number } }> = {};
    for (const r of usage) {
      const cost = Number(r.estimated_cost ?? 0);
      const calls = Number(r.call_count ?? 1);
      if (!perUser[r.user_id]) {
        perUser[r.user_id] = { totalCost: 0, totalCalls: 0, topFn: { name: r.function_name, cost: 0 } };
      }
      perUser[r.user_id].totalCost += cost;
      perUser[r.user_id].totalCalls += calls;
      if (cost > perUser[r.user_id].topFn.cost) {
        perUser[r.user_id].topFn = { name: r.function_name, cost };
      }
    }

    const flagged = Object.entries(perUser)
      .map(([userId, agg]) => ({ userId, ...agg }))
      .filter((u) => u.totalCost >= TIER_AMBER)
      .sort((a, b) => b.totalCost - a.totalCost);

    if (flagged.length === 0) {
      log("no spikes");
      return new Response(JSON.stringify({ ok: true, flagged: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileIds = flagged.map((u) => u.userId);
    const { data: profs } = await admin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", profileIds);
    const profMap: Record<string, ProfileLite> = {};
    for (const p of (profs ?? []) as ProfileLite[]) profMap[p.id] = p;

    const lines = flagged.map((u) => {
      const p = profMap[u.userId];
      const label = p?.display_name ?? p?.email ?? u.userId.slice(0, 8);
      const tier = u.totalCost >= TIER_RED ? "🔴" : "🟠";
      return `${tier} ${label} — €${u.totalCost.toFixed(2)} (${u.totalCalls} calls, top: ${u.topFn.name})`;
    });

    const total = flagged.reduce((s, u) => s + u.totalCost, 0);
    const overRed = flagged.filter((u) => u.totalCost >= TIER_RED).length;

    const msg = [
      `🚨 *AI Cost spike report — Greek Carnivore Metamorphosis*`,
      ``,
      `Members ≥ €${TIER_AMBER}/μήνα: *${flagged.length}* (κόκκινα ≥ €${TIER_RED}: *${overRed}*)`,
      `Συνολικό κόστος αυτής της λίστας: *€${total.toFixed(2)}*`,
      ``,
      ...lines,
      ``,
      `Έλεγξε /admin → AI Costs για detail.`,
    ].join("\n");

    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChat = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
    const discordWebhook = Deno.env.get("DISCORD_FEEDBACK_WEBHOOK_URL");
    const openclawWebhook = Deno.env.get("OPENCLAW_NOTIFY_URL");

    const tasks: Promise<unknown>[] = [];
    if (telegramToken && telegramChat) {
      tasks.push(
        fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: telegramChat, text: msg, parse_mode: "Markdown" }),
        }),
      );
    }
    if (discordWebhook) {
      tasks.push(
        fetch(discordWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: msg }),
        }),
      );
    }
    if (openclawWebhook) {
      tasks.push(
        fetch(openclawWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "ai_cost_spike", message: msg, count: flagged.length, total_eur: total }),
        }),
      );
    }

    if (tasks.length === 0) {
      log("no notifier configured", { flagged: flagged.length });
      return new Response(JSON.stringify({ ok: false, reason: "no_notifier_configured", flagged: flagged.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await Promise.allSettled(tasks);
    log("notified", { flagged: flagged.length, overRed });

    return new Response(JSON.stringify({ ok: true, flagged: flagged.length, overRed, total }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "check failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
