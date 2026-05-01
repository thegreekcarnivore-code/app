import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[NOTIFY-FEEDBACK] ${step}${tail}`);
};

const CATEGORY_EMOJI: Record<string, string> = {
  idea: "💡",
  bug: "🐞",
  content_request: "📝",
  praise: "❤️",
  complaint: "⚠️",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const category = String(body?.category ?? "idea");
    const preview = String(body?.preview ?? "").slice(0, 400);
    const emoji = CATEGORY_EMOJI[category] ?? "📥";
    const text = `${emoji} New feedback (${category})\n\n${preview}`;

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
          body: JSON.stringify({ chat_id: telegramChat, text, disable_web_page_preview: true }),
        }).catch((e) => log("telegram error", { msg: e?.message })),
      );
    }

    if (discordWebhook) {
      tasks.push(
        fetch(discordWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        }).catch((e) => log("discord error", { msg: e?.message })),
      );
    }

    if (openclawWebhook) {
      tasks.push(
        fetch(openclawWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "member_feedback",
            category,
            preview,
            ts: new Date().toISOString(),
          }),
        }).catch((e) => log("openclaw error", { msg: e?.message })),
      );
    }

    if (tasks.length === 0) {
      log("no notifier configured", {});
      return new Response(JSON.stringify({ ok: false, reason: "no_notifier_configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await Promise.allSettled(tasks);

    return new Response(JSON.stringify({ ok: true, dispatched: tasks.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "notify failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
