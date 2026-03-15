import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildOpenAIErrorResponse,
  createOpenAIChatCompletion,
  getOpenAIModel,
} from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, category } = await req.json();
    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: "Content is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await createOpenAIChatCompletion({
      model: getOpenAIModel("OPENAI_MODEL_SMALL", "gpt-4.1-mini"),
      max_tokens: 30,
      messages: [
        {
          role: "system",
          content: "You generate short titles (3-8 words) for client notes. Return ONLY the title, no quotes, no punctuation at the end.",
        },
        {
          role: "user",
          content: `Generate a short title for this '${category}' note:\n${content.slice(0, 500)}`,
        },
      ],
    });
    const title = data.choices?.[0]?.message?.content?.trim() || "Untitled Note";

    return new Response(JSON.stringify({ title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "AI generation failed",
    });
    if (openAIError) return openAIError;
    console.error("generate-note-title error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
