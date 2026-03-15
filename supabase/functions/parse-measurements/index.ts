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
    const { text, language } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const today = new Date().toISOString().split("T")[0];
    const lang = language === "el" ? "Greek" : "English";

    const systemPrompt = `You are a measurement data extractor. The user will provide body measurements as free text in ${lang}. Extract all measurements and return structured data using the provided tool. 

Rules:
- Parse dates in any format (DD/MM, DD/MM/YYYY, DD-MM, etc.). If no year, assume current year (${new Date().getFullYear()}).
- If no date is mentioned at all, use today: ${today}.
- Group measurements by date. Each date becomes one entry.
- Only include fields explicitly mentioned in the text.
- Weight is in kg, circumferences in cm, fat/muscle in kg.
- Wellness scores (energy, digestion, skin_health, mood, stress, cravings, breathing_health, mental_health, pain) are 0-10 integers.
- Common ${lang} terms: βάρος=weight, μέση=waist, γοφοί=hip, λίπος=fat, μυϊκή=muscle, ύψος=height, μπράτσο δεξί=right_arm, μπράτσο αριστερό=left_arm, μηρός δεξί=right_leg, μηρός αριστερό=left_leg.`;

    const model = getOpenAIModel("OPENAI_MODEL_STANDARD", "gpt-4.1-mini");
    const aiResult = await createOpenAIChatCompletion({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_measurements",
            description: "Save parsed measurement entries grouped by date.",
            parameters: {
              type: "object",
              properties: {
                entries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string", description: "ISO date YYYY-MM-DD" },
                      weight_kg: { type: "number" },
                      height_cm: { type: "number" },
                      fat_kg: { type: "number" },
                      muscle_kg: { type: "number" },
                      waist_cm: { type: "number" },
                      hip_cm: { type: "number" },
                      right_arm_cm: { type: "number" },
                      left_arm_cm: { type: "number" },
                      right_leg_cm: { type: "number" },
                      left_leg_cm: { type: "number" },
                      energy: { type: "integer" },
                      digestion: { type: "integer" },
                      skin_health: { type: "integer" },
                      mood: { type: "integer" },
                      stress: { type: "integer" },
                      cravings: { type: "integer" },
                      breathing_health: { type: "integer" },
                      mental_health: { type: "integer" },
                      pain: { type: "integer" },
                    },
                    required: ["date"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["entries"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_measurements" } },
    });
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    // Log API usage
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await serviceClient.rpc("log_api_usage", {
      _user_id: userId,
      _function_name: "parse-measurements",
      _service: "openai",
      _model: model,
      _estimated_cost: 0.001,
    });

    return new Response(JSON.stringify({ entries: parsed.entries || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "AI measurement parsing failed",
    });
    if (openAIError) return openAIError;
    console.error("parse-measurements error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
