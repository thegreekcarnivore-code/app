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
    const { imageUrl, language = "en" } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langInstruction = language === "el"
      ? "Respond entirely in Greek."
      : "Respond entirely in English.";

    const model = getOpenAIModel("OPENAI_MODEL_VISION", "gpt-4.1");
    const data = await createOpenAIChatCompletion({
      model,
      messages: [
        {
          role: "system",
          content: `You are a food identification assistant. ${langInstruction} Your job is to document exactly what foods are visible in the photo. Go with the most probable identification. Do NOT comment on quality, healthiness, or give any nutritional advice.\n\nEstimation method:\n1. First, estimate the plate/bowl diameter using visible cues (a standard dinner plate is ~26cm, a side plate ~20cm, a bowl ~16cm). State your estimate.\n2. Use the plate as a scale reference for all portion sizes.\n3. Provide gram estimates as RANGES (e.g. "120-150g") to reflect uncertainty.\n\nWeight benchmarks for calibration:\n- A chicken breast is typically 150-200g\n- A deck-of-cards sized piece of meat is ~85-100g\n- A fist-sized portion of rice/pasta is ~150-180g cooked\n- A tablespoon of oil/sauce is ~15ml/14g\n- A thumb-sized piece of cheese is ~28g\n- A medium egg is ~50g\n- A slice of bread is ~30-40g\n- A cup of leafy greens is ~30-40g (low density)\n\nGuidelines:\n- Distinguish cooking methods: grilled, fried, steamed, raw, sautéed, baked, roasted, etc.\n- Identify sauces, dressings, and toppings as separate items\n- Be specific about cuts of meat (e.g. "grilled ribeye steak" not just "steak", "pan-seared salmon fillet" not just "salmon")\n- Estimate portions in both weight AND common units (e.g. "120-150g / about 1 fist-sized portion")\n- When multiple items are on the plate, list each separately even if they are similar\n- For mixed dishes (salads, stir-fries, stews), identify the main visible components individually\n- Consider food density: leafy greens are light for their volume, rice and meat are dense\n- CRITICAL: Only identify a food item by name if you are 95% or more confident in the identification. If your confidence is below 95%, label the item as 'unidentified food' (or 'μη αναγνωρισμένο τρόφιμο' if responding in Greek) but still estimate its portion size based on visual scale`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "What foods are in this photo? List each item with estimated quantity." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "food_analysis",
            description: "Return structured food identification results",
            parameters: {
              type: "object",
              properties: {
                foods: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Specific food item name" },
                      portion: { type: "string", description: "Estimated quantity or portion (e.g. '~150g', '2 slices', '1 cup')" },
                    },
                    required: ["name", "portion"],
                    additionalProperties: false,
                  },
                },
                summary: {
                  type: "string",
                  description: "Concise one-line list of all foods with portions, suitable for a food journal entry",
                },
              },
              required: ["foods", "summary"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "food_analysis" } },
    });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let result;
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: use the text content
      const content = data.choices?.[0]?.message?.content || "";
      result = { foods: [], summary: content.slice(0, 200) };
    }

    // Log usage
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) {
          await supabase.rpc("log_api_usage", {
            _user_id: user.id,
            _function_name: "analyze-food-photo",
            _service: "openai",
            _model: model,
            _estimated_cost: 0.04,
          });
        }
      }
    } catch (logErr) {
      console.error("Usage logging error:", logErr);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "AI analysis failed",
    });
    if (openAIError) return openAIError;
    console.error("analyze-food-photo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
