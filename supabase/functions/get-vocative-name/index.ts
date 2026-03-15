import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildOpenAIErrorResponse,
  createOpenAIChatCompletion,
  getOpenAIModel,
} from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name } = await req.json();
    if (!name) throw new Error("name is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use AI to get the Greek vocative form
    const prompt = `You are a Greek language expert. Given a person's first name (which may be in Latin or Greek letters), return ONLY the Greek vocative case (κλητική) form of that name in Greek letters. No explanation, no punctuation, just the vocative form.

Rules:
- Male names ending in -ος → vocative drops the -ς (e.g., Γιώργος → Γιώργο, Κυριάκος → Κυριάκο)
- Male names ending in -ης → vocative drops the -ς (e.g., Παναγιώτης → Παναγιώτη, Γιάννης → Γιάννη)
- Male names ending in -ας → vocative drops the -ς (e.g., Κώστας → Κώστα, Ηλίας → Ηλία)
- Female names typically stay the same (e.g., Μαρία → Μαρία, Ελένη → Ελένη)
- If the name is in Latin letters, first transliterate to Greek, then apply vocative rules
- Examples: Panagiotis → Παναγιώτη, Giorgos → Γιώργο, Kyriakos → Κυριάκο, Maria → Μαρία, John → Τζον

The name is: ${name}`;

    const aiData = await createOpenAIChatCompletion({
      model: getOpenAIModel("OPENAI_MODEL_SMALL", "gpt-4.1-mini"),
      messages: [{ role: "user", content: prompt }],
    });
    const vocative = (aiData.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ vocative }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const openAIError = buildOpenAIErrorResponse(error, corsHeaders, {
      defaultMessage: "AI generation failed",
    });
    if (openAIError) return openAIError;
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
