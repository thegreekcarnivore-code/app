import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildOpenAIErrorResponse,
  createOpenAIChatCompletion,
  getOpenAIModel,
} from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await sb.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { messages, durationWeeks, language, existingMessages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0 || !durationWeeks) {
      return new Response(JSON.stringify({ error: "Missing messages or durationWeeks" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const totalDays = durationWeeks * 7;
    const langInstruction = language === "el"
      ? "Respond ENTIRELY in Greek. Output JSON only."
      : "Respond in English. Output JSON only.";

    const existingContext = existingMessages && existingMessages.length > 0
      ? `\nExisting scheduled messages (avoid these days if possible):\n${existingMessages.map((m: any) => `Day ${m.day_offset}: "${m.message_content?.slice(0, 50)}"`).join("\n")}`
      : "";

    const prompt = `You are scheduling messages for a ${durationWeeks}-week nutrition coaching program (${totalDays} days total).

I have ${messages.length} messages to distribute across the program. Analyze each message's content and intent to decide the OPTIMAL day to send it.

Rules:
- CRITICAL: Assign EXACTLY ONE message per day. NEVER put 2 messages on the same day.
- Spread messages evenly but intelligently — welcome/intro messages early, milestone messages at key points, motivational messages throughout
- Every message MUST have a unique day_offset. No duplicates allowed.
- Consider the message tone and content to pick the right timing
- Day offsets are 0-indexed (Day 0 = first day)
${existingContext}

Messages to distribute:
${messages.map((m: string, i: number) => `${i + 1}. "${m}"`).join("\n")}

Return ONLY a JSON array where each element has: {"index": <0-based index>, "day_offset": <number>, "message_content": "<the original message text>"}
${langInstruction}`;

    const model = getOpenAIModel("OPENAI_MODEL_STANDARD", "gpt-4.1-mini");
    const aiData = await createOpenAIChatCompletion({
      model,
      messages: [{ role: "user", content: prompt }],
    });
    const content = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const distributed = JSON.parse(jsonMatch[0]);

    // Log usage
    const adminSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await adminSb.rpc("log_api_usage", {
      _user_id: claims.claims.sub,
      _function_name: "distribute-messages",
      _service: "openai",
      _model: model,
      _estimated_cost: 0.005,
      _call_count: 1,
    });

    return new Response(JSON.stringify({ distributed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "AI scheduling failed",
      rateLimitMessage: "Rate limited, try again later.",
    });
    if (openAIError) return openAIError;
    console.error("distribute-messages error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
