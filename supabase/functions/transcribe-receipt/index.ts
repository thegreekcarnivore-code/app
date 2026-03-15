import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Verify admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Forbidden: admin only");

    const { receipt_url } = await req.json();
    if (!receipt_url) throw new Error("receipt_url is required");

    // Generate signed URL for the receipt image
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: signedData, error: signErr } = await serviceClient.storage
      .from("finance-receipts")
      .createSignedUrl(receipt_url, 3600);
    if (signErr || !signedData?.signedUrl) throw new Error("Failed to get signed URL for receipt");

    // Fetch existing categories for context
    const { data: categories } = await supabase
      .from("finance_categories")
      .select("name, type");
    const categoryNames = (categories || []).map((c: any) => c.name);

    const aiResult = await createOpenAIChatCompletion({
      model: getOpenAIModel("OPENAI_MODEL_VISION", "gpt-4.1"),
      messages: [
        {
          role: "system",
          content: `You are a receipt/bill OCR assistant. Extract financial data from receipt images. Available expense categories: ${categoryNames.join(", ")}. If no category fits, suggest a new one.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the financial details from this receipt/bill image. Return the amount, date, vendor/description, and suggest a category." },
            { type: "image_url", image_url: { url: signedData.signedUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_receipt",
            description: "Extract structured data from a receipt or bill image",
            parameters: {
              type: "object",
              properties: {
                amount: { type: "number", description: "Total amount on the receipt" },
                currency: { type: "string", description: "Currency code, e.g. EUR, USD" },
                date: { type: "string", description: "Date on the receipt in YYYY-MM-DD format" },
                vendor: { type: "string", description: "Vendor/business name" },
                description: { type: "string", description: "Brief description of what was purchased" },
                suggested_category: { type: "string", description: "Suggested expense category" },
              },
              required: ["amount", "description", "suggested_category"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_receipt" } },
    });
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured data");

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "AI processing failed",
    });
    if (openAIError) return openAIError;
    console.error("transcribe-receipt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
