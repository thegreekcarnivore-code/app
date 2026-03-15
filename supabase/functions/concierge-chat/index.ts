import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type ContentPart = TextPart | ImagePart;
type MessageContent = string | ContentPart[];

interface ValidatedMessage {
  role: string;
  content: MessageContent;
}

function validateContentParts(parts: unknown[]): ContentPart[] {
  if (parts.length === 0 || parts.length > 10) throw new Error("Invalid content parts count");
  return parts.map((part: unknown) => {
    if (!part || typeof part !== "object") throw new Error("Invalid content part");
    const p = part as Record<string, unknown>;
    if (p.type === "text") {
      if (typeof p.text !== "string" || p.text.length > 5000) throw new Error("Invalid text part");
      return { type: "text" as const, text: p.text };
    }
    if (p.type === "image_url") {
      const imgUrl = p.image_url as Record<string, unknown> | undefined;
      if (!imgUrl || typeof imgUrl.url !== "string") throw new Error("Invalid image_url part");
      const url = imgUrl.url as string;
      if (!url.startsWith("data:image/")) throw new Error("Only base64 image data URLs are accepted");
      if (url.length > 6 * 1024 * 1024) throw new Error("Image too large");
      return { type: "image_url" as const, image_url: { url } };
    }
    throw new Error("Invalid content part type");
  });
}

function validateInput(body: unknown): { messages: ValidatedMessage[]; location?: { latitude: number; longitude: number }; lang: string; mode?: string } {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const { messages, location, lang, mode } = body as Record<string, unknown>;

  const validLang = (typeof lang === "string" && (lang === "en" || lang === "el")) ? lang : "en";

  let validatedMode: string | undefined;
  if (mode != null) {
    if (typeof mode !== "string" || !["delivery", "shopping", "general"].includes(mode)) validatedMode = undefined;
    else validatedMode = mode;
  }

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
    throw new Error("Invalid messages: must be a non-empty array with max 50 items");
  }

  const validRoles = new Set(["user", "assistant", "system"]);
  const validatedMessages: ValidatedMessage[] = messages.map((msg: unknown) => {
    if (!msg || typeof msg !== "object") throw new Error("Invalid message object");
    const { role, content } = msg as Record<string, unknown>;
    if (typeof role !== "string" || !validRoles.has(role)) throw new Error("Invalid message role");

    if (typeof content === "string") {
      if (content.length === 0 || content.length > 5000) {
        throw new Error("Invalid message content: must be 1-5000 characters");
      }
      return { role, content };
    }

    if (Array.isArray(content)) {
      const parts = validateContentParts(content);
      return { role, content: parts };
    }

    throw new Error("Invalid message content type");
  });

  let validatedLocation: { latitude: number; longitude: number } | undefined;
  if (location != null) {
    if (typeof location !== "object") throw new Error("Invalid location");
    const { latitude, longitude } = location as Record<string, unknown>;
    if (typeof latitude !== "number" || latitude < -90 || latitude > 90) throw new Error("Invalid latitude");
    if (typeof longitude !== "number" || longitude < -180 || longitude > 180) throw new Error("Invalid longitude");
    validatedLocation = { latitude, longitude };
  }

  return { messages: validatedMessages, location: validatedLocation, lang: validLang, mode: validatedMode };
}

async function authenticateRequest(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("UNAUTHORIZED");
  return data.claims.sub as string;
}

async function trackUserActivity(userId: string) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.rpc("increment_user_activity", { _user_id: userId });
  } catch (e) {
    console.error("Failed to track user activity:", e);
  }
}

async function logApiUsage(userId: string, functionName: string, service: string, model: string, cost: number, callCount: number = 1) {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await sb.rpc("log_api_usage", {
      _user_id: userId,
      _function_name: functionName,
      _service: service,
      _model: model,
      _estimated_cost: cost,
      _call_count: callCount,
    });
  } catch (e) { console.error("Failed to log API usage:", e); }
}

async function fetchClientProfile(userId: string): Promise<string> {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: notes } = await sb
      .from("client_notes")
      .select("category, title, content, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (!notes || notes.length === 0) return "";

    const allergies = notes.filter((n: any) => n.category === "allergy").map((n: any) => n.title);
    const restrictions = notes.filter((n: any) => n.category === "restriction").map((n: any) => n.title);
    const preferences = notes.filter((n: any) => n.category === "preference").map((n: any) => n.title);
    const goals = notes.filter((n: any) => n.category === "goal").map((n: any) => n.title);
    const meetingNotes = notes.filter((n: any) => n.category === "meeting_note");

    let profile = "\nCLIENT PROFILE (MUST be respected for all recommendations):\n";
    if (allergies.length > 0) profile += `- ALLERGIES (NEVER recommend dishes containing these): ${allergies.join(", ")}\n`;
    if (restrictions.length > 0) profile += `- RESTRICTIONS (NEVER recommend these): ${restrictions.join(", ")}\n`;
    if (preferences.length > 0) profile += `- Cuisine Preferences: ${preferences.join(", ")}\n`;
    if (goals.length > 0) profile += `- Goals: ${goals.join(", ")}\n`;
    if (meetingNotes.length > 0) {
      profile += "- Notes from meetings:\n";
      for (const n of meetingNotes.slice(0, 10)) {
        const date = new Date(n.created_at).toISOString().split("T")[0];
        profile += `  * [${date}] ${n.title}${n.content ? ": " + n.content.slice(0, 200) : ""}\n`;
      }
    }
    return profile;
  } catch (e) {
    console.error("Failed to fetch client profile:", e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let userId: string;
    try { userId = await authenticateRequest(req); } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json();
    const { messages, location, lang, mode } = validateInput(rawBody);

    // Track user activity and fetch client profile (non-blocking)
    trackUserActivity(userId);
    const clientProfile = await fetchClientProfile(userId);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const now = new Date();
    const locationContext = location
      ? `The user's current GPS: ${location.latitude}, ${location.longitude}.`
      : "The user has not shared their location.";

    const languageInstruction = lang === "el"
      ? `LANGUAGE RULES — CRITICAL:
- You MUST respond ENTIRELY in Greek (Ελληνικά). Every word of your response must be in Greek.
- The ONLY exception: when recommending a specific dish, include the dish name in English in parentheses after the Greek name. Example: "Ριμπάι στα κάρβουνα (Charcoal Ribeye)"
- All explanations, descriptions, "whyThisPlace", "orderingPhrase", and all other text fields in the restaurant JSON blocks MUST be in Greek.
- Restaurant names: keep in their ORIGINAL form as listed on Google Maps (Latin stays Latin, Greek stays Greek).
- Location/address names: keep original characters (do not transliterate).
- Do NOT mix English into your Greek responses except for dish name translations as described above.`
      : `LANGUAGE RULES:
- Respond in English.
- When recommending dishes, include the dish name in the original local language if different from English.`;

    const lowCarbTipInstruction = `LOW-CARB TIPS: When recommending dishes, include a short practical tip to make each dish low-carb (e.g. "Ask without the fries", "Skip the bread basket").`;

    const menuVerificationInstruction = `MENU VERIFICATION (CRITICAL): ONLY recommend dishes you can confirm exist on the restaurant's actual menu from scraped content or verified knowledge. If you cannot confirm ANY specific dishes:
- Do NOT invent dish names or present guesses as facts
- Leave mealOptions as an empty array []
- Use the "whatToOrder" field to write a 1-2 line description of the type of food available (no bullet points)
- Suggest checking their website or Google Maps photos for current dishes
NEVER present an unverified dish as a recommendation.

DISH PRICING: Include the exact dish price ONLY if you are confident it is accurate from the restaurant's current menu/website. If unsure, do NOT include a price. NEVER invent prices. Format: "EUR 28" or "CHF 32 (~EUR 29)".

DISH NAMING: For every dish, provide: (1) the exact name in the local language of the restaurant in the "dish" field, (2) an English translation in the "englishName" field. When the user has selected Greek language, add a Greek translation as well.`;

    const eurPriceNote = `For averagePrice, ALWAYS include EUR equivalent in parentheses if local currency is not EUR, e.g. "~CHF 45/person (~EUR42)". If already EUR, just "~EUR30/person".`;

    const deliverySystemPrompt = `${clientProfile}You are an elite private FOOD DELIVERY concierge. You ONLY help with food delivery.

${locationContext}
UTC: ${now.toISOString()}.

${languageInstruction}

DELIVERY RULES:
- Help users find food delivery options. Users can share GPS, addresses, or city names.
- Primary expertise: meat-based, high-protein delivery options.
- Follow a meat-based, high-protein, low-carb philosophy (never say "keto" or "carnivore").
- For vegan/high-carb requests: never refuse. Acknowledge warmly, gently suggest a high-protein alternative, help them if they insist.
- ${lowCarbTipInstruction}

REAL BUSINESSES ONLY: Every recommendation MUST be real and currently operational. Use EXACT business name from Google Maps. Only recommend 4.5+ rated with 20+ reviews. Never fabricate.
${menuVerificationInstruction}
- ONLY recommend places that ACTUALLY DELIVER (own delivery, Wolt, Uber Eats, Bolt Food, Glovo, etc.)
NO-GUESS RULE (ZERO TOLERANCE): NEVER recommend specific dishes unless you can confirm they exist on this exact restaurant's menu. Do NOT guess based on cuisine type. Do NOT assume a burger joint serves a specific burger name. If you cannot confirm actual menu items from this specific restaurant, leave mealOptions as an empty array [] and write a short 1-2 line description of the cuisine style in "whatToOrder" (e.g. "Burger and grill joint"). Do NOT list specific dish names even as examples. Recommend the user check the restaurant's website or Google Maps photos.
${eurPriceNote}

STRUCTURED FORMAT — when recommending, output each as a JSON block:

\`\`\`restaurant
{"name":"Restaurant Name","cuisine":"Cuisine Type","distance":"0.5 km","walkingTime":"7 min walk","drivingTime":"2 min drive","rating":4.9,"reviewCount":245,"averagePrice":"~EUR30/person","whyThisPlace":"One sentence why","mealOptions":[{"dish":"Dish","localName":"Local Name","englishName":"English if different","isRecommended":true,"lowCarbTip":"Tip","dishPrice":"EUR 28"}],"orderingPhrase":"How to order","kitchenHours":"Kitchen open until 23:00","address":"Full address","photoQuery":"Restaurant Name City food","verificationNote":"Verified on Google Maps, 4.9 stars, 245 reviews","googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Restaurant+Name+Address","appleMapsUrl":"https://maps.apple.com/?q=Restaurant+Name+Address","websiteUrl":"https://example.com","deliveryTime":"25-35 min","orderingMethod":"Available on Wolt and Uber Eats"}
\`\`\`

Tone: Direct, calm, confident, luxurious. No diet language. No calorie counts. No emojis.`;

    const generalSystemPrompt = `${clientProfile}You are an elite private food concierge for high-performing executives. Meat-based, high-protein, low-carb philosophy (never say "keto" or "carnivore").

${locationContext}
UTC: ${now.toISOString()}.

${languageInstruction}

${lowCarbTipInstruction}

REAL BUSINESSES ONLY: Every recommendation MUST be real and currently operational. Use EXACT business name from Google Maps. Only recommend 4.8+ rated with 20+ reviews. Never fabricate.
${menuVerificationInstruction}
- Only recommend 4.8+ rated with 20+ reviews.
NO-GUESS RULE (ZERO TOLERANCE): NEVER recommend specific dishes unless you can confirm they exist on this exact restaurant's menu. Do NOT guess based on cuisine type. Do NOT assume a steakhouse serves ribeye unless you have verified it. If you cannot confirm actual menu items from this specific restaurant, leave mealOptions as an empty array [] and write a short 1-2 line description of the cuisine style in "whatToOrder" (e.g. "Upscale steakhouse"). Do NOT list specific dish names even as examples. Recommend the user check the restaurant's website or Google Maps photos.
${eurPriceNote}

OPENING HOURS: Verify kitchen hours before recommending. Never recommend if kitchen closes within 30 min. Provide exact kitchen hours.

IMAGE ANALYSIS: For MENU photos — identify restaurant, research full menu, recommend best protein dishes. For STREET photos — use visual clues + GPS to identify area, recommend nearby restaurants. For FOOD photos — analyze dish, estimate protein, comment on alignment.

Expertise: restaurant recs (steakhouses, grills, fresh fish), airport/travel food, menu analysis, meal planning.

STRUCTURED FORMAT — when recommending, output each as a JSON block:

\`\`\`restaurant
{"name":"Restaurant Name","cuisine":"Cuisine Type","distance":"0.5 km","walkingTime":"7 min walk","drivingTime":"2 min drive","rating":4.9,"reviewCount":245,"averagePrice":"~EUR30/person","whyThisPlace":"One sentence why","mealOptions":[{"dish":"Dish","localName":"Local Name","englishName":"English if different","isRecommended":true,"lowCarbTip":"Tip","dishPrice":"EUR 28"}],"orderingPhrase":"How to order","kitchenHours":"Kitchen open until 23:00","address":"Full address","photoQuery":"Restaurant Name City food","verificationNote":"Verified on Google Maps, 4.9 stars, 245 reviews","googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Restaurant+Name+Address","appleMapsUrl":"https://maps.apple.com/?q=Restaurant+Name+Address","websiteUrl":"https://example.com"}
\`\`\`

Tone: Direct, calm, confident, luxurious. No diet language. No calorie counts. No emojis.`;

    const shoppingSystemPrompt = `${clientProfile}You are an elite private SHOPPING concierge for carnivore/meat-based/low-carb nutrition. Help users find supermarkets, butchers, and markets.

${locationContext}
UTC: ${now.toISOString()}.

${languageInstruction}

SHOPPING RULES:
- Help find supermarkets, butchers, meat markets, organic stores, local food markets.
- Recommend WHAT TO BUY — best cuts, quality brands, carnivore staples.
- Guide supermarket navigation (which aisles/sections).
- Focus on: quality meats, fresh fish, eggs, butter, cheese. Guide away from processed/sugary/carb-heavy items.
- ${lowCarbTipInstruction}

REAL BUSINESSES ONLY: Every recommendation MUST be real and currently operational. Use EXACT business name from Google Maps. Only recommend 4.5+ rated with 20+ reviews. Never fabricate.
${menuVerificationInstruction}
NO-GUESS RULE (ZERO TOLERANCE): NEVER recommend specific products or prices unless you can confirm they exist at this exact shop. Do NOT assume a butcher sells a specific cut or brand. If you cannot confirm actual products from this specific shop, leave mealOptions as an empty array [] and write a short 1-2 line description of the shop type in "whatToOrder" (e.g. "Local butcher shop"). Do NOT list specific product names even as examples. Recommend the user visit the shop's website or Google Maps.
${eurPriceNote}

STRUCTURED FORMAT — when recommending, output each as a JSON block:

\`\`\`restaurant
{"name":"Shop Name","cuisine":"Butcher","distance":"0.5 km","walkingTime":"7 min walk","drivingTime":"2 min drive","rating":4.9,"reviewCount":245,"averagePrice":"Mid-range","whyThisPlace":"One sentence why","mealOptions":[{"dish":"Grass-fed Ribeye","localName":"Local Name","englishName":"","isRecommended":true,"lowCarbTip":"Ask for thick-cut, 2 inches minimum","dishPrice":"EUR 35/kg"}],"orderingPhrase":"What to ask for","kitchenHours":"Mon-Sat 8:00-20:00","address":"Full address","photoQuery":"Shop Name City","verificationNote":"Verified on Google Maps","googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=Shop+Name+Address","appleMapsUrl":"https://maps.apple.com/?q=Shop+Name+Address","websiteUrl":"https://example.com"}
\`\`\`

Tone: Direct, calm, confident, knowledgeable.`;

    const systemPrompt = mode === "shopping" ? shoppingSystemPrompt : mode === "delivery" ? deliverySystemPrompt : generalSystemPrompt;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error("OpenAI API error:", status);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Service busy. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Service temporarily unavailable");
    }

    // Log API usage (non-blocking)
    logApiUsage(userId, "concierge-chat", "openai", "gpt-4o", 0.003);

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("concierge-chat error:", e);
    const isValidationError = e instanceof Error && (
      e.message.startsWith("Invalid") || e.message.includes("must be") || e.message.includes("too large") || e.message.includes("Only base64")
    );
    return new Response(
      JSON.stringify({ error: isValidationError ? e.message : "Service temporarily unavailable" }),
      { status: isValidationError ? 400 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
