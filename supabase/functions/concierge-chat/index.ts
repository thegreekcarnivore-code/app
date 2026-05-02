import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOpenAIEmbeddings } from "../_shared/openai.ts";

const CRISIS_PATTERNS: { category: string; severity: "low" | "medium" | "high"; patterns: RegExp[] }[] = [
  {
    category: "self_harm",
    severity: "high",
    patterns: [
      /\b(αυτοκτον\w*|να σκοτωθ\w+|να πεθάν\w+|δεν θέλω να ζω|να τελειώσω τη ζωή\w*)\b/i,
      /\b(suicid\w*|kill myself|end my life|don'?t want to live|hurt myself)\b/i,
    ],
  },
  {
    category: "eating_disorder",
    severity: "high",
    patterns: [
      /\b(δεν τρώω καθόλου|κάνω εμετό|προκαλώ εμετό|μου προκαλεί εμετό|νηστεία \d+ ημερ\w*)\b/i,
      /\b(purg\w+|making myself vomit|stopped eating|haven'?t eaten in (days|weeks)|anorexi\w*|bulimi\w*)\b/i,
    ],
  },
  {
    category: "medical_emergency",
    severity: "high",
    patterns: [
      /\b(πόνος στο στήθος|χάνω τις αισθήσεις|αιμορραγ\w+ έντον\w+|δεν αναπνέ\w+)\b/i,
      /\b(chest pain|passing out|severe bleeding|can'?t breathe|seizure)\b/i,
    ],
  },
];

function detectCrisis(text: string): { category: string; severity: string; excerpt: string } | null {
  if (!text) return null;
  for (const group of CRISIS_PATTERNS) {
    for (const pattern of group.patterns) {
      const match = text.match(pattern);
      if (match) {
        const start = Math.max(0, (match.index ?? 0) - 60);
        const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 60);
        return { category: group.category, severity: group.severity, excerpt: text.slice(start, end) };
      }
    }
  }
  return null;
}

async function logCrisisFlag(userId: string, category: string, severity: string, excerpt: string) {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await sb.from("crisis_flags").insert({
      user_id: userId,
      source: "concierge_chat",
      severity,
      category,
      excerpt,
      detector_metadata: { detector: "regex_v1" },
    });
  } catch (e) {
    console.error("Failed to log crisis flag:", e);
  }
}

function buildCrisisResponse(lang: string): string {
  if (lang === "el") {
    return [
      "Ακούω αυτό που μου γράφεις και θέλω να το πάρω σοβαρά.",
      "Δεν είμαι ο σωστός χώρος για αυτό. Σε παρακαλώ μίλησε **τώρα** με κάποιον που μπορεί να βοηθήσει:",
      "",
      "• **Γραμμή Ζωής 1018** (24/7, δωρεάν) — Πρόληψη αυτοκτονίας",
      "• **Κέντρο Ημέρας ΚΛΙΜΑΚΑ 210 3417 162**",
      "• Σε άμεσο κίνδυνο: **112** (ΕΚΑΒ)",
      "",
      "Για ζητήματα διατροφικής διαταραχής: **Ανάσα 210 7257 217**.",
      "",
      "Αν είσαι ασφαλής αυτή τη στιγμή και θες να συνεχίσουμε για τη διατροφή σου αργότερα, θα είμαι εδώ. Πρώτα όμως, σε παρακαλώ κάλεσε.",
    ].join("\n");
  }
  return [
    "I hear what you're telling me and I want to take it seriously.",
    "I'm not the right place for this. Please reach out **now** to someone who can help:",
    "",
    "• **Suicide & Crisis Lifeline (US): 988** (24/7, free)",
    "• **International Association for Suicide Prevention**: https://www.iasp.info/resources/Crisis_Centres/",
    "• In immediate danger: call your local emergency number (**112** in EU, **911** in US)",
    "",
    "If you're safe right now and want to continue talking about your nutrition later, I'll be here. But please call first.",
  ].join("\n");
}

function extractLastUserText(messages: ValidatedMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    const text = m.content
      .filter((p): p is TextPart => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    if (text) return text;
  }
  return "";
}

async function fetchCoachContext(query: string, lang: string): Promise<string> {
  if (!query || query.length < 5) return "";
  try {
    const embeddings = await createOpenAIEmbeddings([query]);
    const queryEmbedding = embeddings[0];
    if (!queryEmbedding) return "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb.rpc("match_coach_knowledge", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 8,
      filter_language: lang === "el" ? "el" : null,
    });
    if (error || !Array.isArray(data) || data.length === 0) return "";
    const blocks = data.map((row: { source_type: string; source_title: string | null; chunk_text: string }, idx: number) => {
      const label = row.source_title ? `${row.source_type} — ${row.source_title}` : row.source_type;
      return `[${idx + 1}] (${label})\n${row.chunk_text}`;
    });
    return `\n\nKNOWLEDGE BASE — RETRIEVED COACHING CONTEXT:\nUse the passages below as factual grounding for your reply. They contain methodology, examples, and reasoning from the program's coaching corpus. Treat them as reference material, not as your own voice. Do not impersonate the original speaker. Do not cite indices to the user.\n\n${blocks.join("\n\n")}\n\n— END OF RETRIEVED CONTEXT —\n`;
  } catch (e) {
    console.error("fetchCoachContext failed:", e);
    return "";
  }
}

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
    if (typeof mode !== "string" || !["delivery", "shopping", "general", "coach"].includes(mode)) validatedMode = undefined;
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

const VALID_JOURNEY_KINDS = ["milestone", "struggle", "preference", "decision", "observation"];

async function summarizeAndAppendJourneyLog(
  userId: string,
  userMessage: string,
  assistantText: string,
): Promise<void> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return;
  if (assistantText.length < 20 || userMessage.length < 5) return;

  const prompt = `Διάβασε την ανταλλαγή μεταξύ ενός μέλους carnivore και του Συμβούλου.
Έχει η συνομιλία ένα από τα εξής διαρκή σημεία (όχι απλή ερωταπάντηση): milestone (επίτευγμα/ορόσημο), struggle (δυσκολία που μοιράστηκε), preference (νέα προτίμηση/απέχθεια), decision (απόφαση που πήρε), observation (αξιόλογη παρατήρηση για το ταξίδι του);
Αν ΝΑΙ, επέστρεψε JSON: {"kind":"<one>","summary":"≤180 χαρ. στα ελληνικά, στρογγυλευμένη παρατήρηση"}.
Αν ΟΧΙ, επέστρεψε: {"kind":"none"}. Επιστρέφεις ΜΟΝΟ JSON.

Μήνυμα μέλους: ${userMessage.slice(0, 800)}
Απάντηση Συμβούλου: ${assistantText.slice(0, 1200)}`;

  try {
    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 160,
        response_format: { type: "json_object" },
      }),
    });
    if (!aiResp.ok) return;
    const aiJson = await aiResp.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { kind?: string; summary?: string };
    try { parsed = JSON.parse(raw); } catch { return; }

    if (!parsed.kind || parsed.kind === "none" || !VALID_JOURNEY_KINDS.includes(parsed.kind)) return;
    if (!parsed.summary || parsed.summary.length < 10) return;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await sb.from("member_journey_log").insert({
      user_id: userId,
      kind: parsed.kind,
      summary: parsed.summary.slice(0, 200),
      source: "concierge_chat",
      raw_excerpt: assistantText.slice(0, 400),
      metadata: { user_message_excerpt: userMessage.slice(0, 200) },
    });
  } catch (e) {
    console.error("[concierge-chat] summarize-and-append failed:", e);
  }
}

function teeStreamAndCaptureAssistantText(
  body: ReadableStream<Uint8Array>,
  userId: string,
  userMessage: string,
): ReadableStream<Uint8Array> {
  const [forClient, forCapture] = body.tee();

  const captureWork = (async () => {
    try {
      const reader = forCapture.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            const delta = obj?.choices?.[0]?.delta?.content;
            if (typeof delta === "string") assistantText += delta;
          } catch { /* ignore malformed chunk */ }
        }
      }

      await summarizeAndAppendJourneyLog(userId, userMessage, assistantText);
    } catch (e) {
      console.error("[concierge-chat] capture failed:", e);
    }
  })();

  // Keep async work alive after the response returns (Supabase Edge Runtime).
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  runtime?.waitUntil?.(captureWork);

  return forClient;
}

async function fetchMemberContext(userId: string): Promise<string> {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [intakeRes, journeyRes, streakRes, enrollmentRes, latestWeightRes, baselineWeightRes] = await Promise.all([
      sb.from("member_intakes")
        .select("primary_goal_detail, biggest_struggle, allergies, why_now, biggest_fear, target_weight_kg, weight_kg, cooking_skill, eats_eggs, eats_dairy, eats_organs, disliked_foods, completed_at")
        .eq("user_id", userId)
        .maybeSingle(),
      sb.from("member_journey_log")
        .select("kind, summary, occurred_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(20),
      sb.from("streak_state")
        .select("current_streak, longest_streak")
        .eq("user_id", userId)
        .maybeSingle(),
      sb.from("client_program_enrollments")
        .select("start_date, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from("measurements")
        .select("weight_kg, measured_at")
        .eq("user_id", userId)
        .not("weight_kg", "is", null)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from("measurements")
        .select("weight_kg, measured_at")
        .eq("user_id", userId)
        .not("weight_kg", "is", null)
        .order("measured_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const intake = intakeRes.data as Record<string, unknown> | null;
    const journey = (journeyRes.data ?? []) as { kind: string; summary: string; occurred_at: string }[];
    const streak = streakRes.data as { current_streak: number | null; longest_streak: number | null } | null;
    const enrollment = enrollmentRes.data as { start_date: string | null; status: string | null } | null;
    const latestW = latestWeightRes.data as { weight_kg: number | null; measured_at: string | null } | null;
    const baselineW = baselineWeightRes.data as { weight_kg: number | null; measured_at: string | null } | null;

    if (!intake && journey.length === 0 && !streak && !enrollment) return "";

    const lines: string[] = ["", "<member_context>"];

    if (intake?.completed_at) {
      if (intake.primary_goal_detail) lines.push(`Στόχος: ${String(intake.primary_goal_detail).slice(0, 240)}`);
      if (intake.biggest_struggle) lines.push(`Βασική δυσκολία: ${String(intake.biggest_struggle).slice(0, 240)}`);
      if (Array.isArray(intake.allergies) && (intake.allergies as unknown[]).length > 0) {
        lines.push(`Αλλεργίες (ΠΟΤΕ μην προτείνεις): ${(intake.allergies as string[]).join(", ")}`);
      }
      if (Array.isArray(intake.disliked_foods) && (intake.disliked_foods as unknown[]).length > 0) {
        lines.push(`Δεν τρώει: ${(intake.disliked_foods as string[]).join(", ")}`);
      }
      if (intake.why_now) lines.push(`Γιατί τώρα: ${String(intake.why_now).slice(0, 200)}`);
      if (intake.biggest_fear) lines.push(`Μεγαλύτερος φόβος: ${String(intake.biggest_fear).slice(0, 200)}`);
      const tw = intake.target_weight_kg as number | null;
      const sw = intake.weight_kg as number | null;
      if (sw && tw) lines.push(`Βάρος εκκίνησης: ${sw}kg → στόχος: ${tw}kg`);
      if (intake.cooking_skill) lines.push(`Επίπεδο μαγειρικής: ${String(intake.cooking_skill)}`);
      const dietFlags: string[] = [];
      if (intake.eats_eggs === false) dietFlags.push("όχι αυγά");
      if (intake.eats_dairy === false) dietFlags.push("όχι γαλακτοκομικά");
      if (intake.eats_organs === false) dietFlags.push("όχι εντόσθια");
      if (dietFlags.length) lines.push(`Διατροφικοί περιορισμοί: ${dietFlags.join(", ")}`);
    } else {
      lines.push("Σημείωση: η αναλυτική φόρμα εκκίνησης δεν έχει συμπληρωθεί ακόμα.");
    }

    if (enrollment?.start_date) {
      const days = Math.max(0, Math.floor((Date.now() - new Date(enrollment.start_date).getTime()) / 86_400_000));
      lines.push(`Ημέρες στο πρόγραμμα: ${days}`);
    }

    if (streak?.current_streak != null) {
      lines.push(`Streak: ${streak.current_streak} μέρες (μεγαλύτερο: ${streak.longest_streak ?? streak.current_streak})`);
    }

    if (baselineW?.weight_kg != null && latestW?.weight_kg != null && baselineW.measured_at !== latestW.measured_at) {
      const delta = (latestW.weight_kg - baselineW.weight_kg).toFixed(1);
      lines.push(`Μεταβολή βάρους από αρχή: ${delta}kg (τελευταία μέτρηση: ${latestW.weight_kg}kg)`);
    } else if (latestW?.weight_kg != null) {
      lines.push(`Τελευταίο βάρος: ${latestW.weight_kg}kg`);
    }

    if (journey.length > 0) {
      lines.push("");
      lines.push("Πρόσφατο ταξίδι του μέλους (νεότερα πρώτα):");
      for (const row of journey) {
        const date = row.occurred_at ? new Date(row.occurred_at).toISOString().slice(0, 10) : "";
        lines.push(`- [${date}] ${row.kind}: ${row.summary}`);
      }
    }

    lines.push("</member_context>");
    lines.push("");
    return lines.join("\n");
  } catch (e) {
    console.error("fetchMemberContext failed:", e);
    return "";
  }
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

    let systemPrompt: string;
    if (mode === "coach") {
      const lastUserText = extractLastUserText(messages);
      const crisis = detectCrisis(lastUserText);
      if (crisis) {
        await logCrisisFlag(userId, crisis.category, crisis.severity, crisis.excerpt);
        const safetyText = buildCrisisResponse(lang);
        const sseFrames = [
          `data: ${JSON.stringify({ choices: [{ delta: { role: "assistant", content: safetyText } }] })}\n\n`,
          "data: [DONE]\n\n",
        ].join("");
        return new Response(sseFrames, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      const ragContext = await fetchCoachContext(lastUserText, lang);
      const memberContext = await fetchMemberContext(userId);

      const coachSystemPrompt = `${clientProfile}${memberContext}Είσαι ο **Σύμβουλος** της εφαρμογής "The Greek Carnivore" — ο μόνιμος καθοδηγητής του μέλους μέσα στο πρόγραμμα Μεταμόρφωση (€47/μήνα).

${languageInstruction}

ΠΟΙΟΣ ΕΙΣΑΙ — ΑΥΣΤΗΡΟΙ ΚΑΝΟΝΕΣ ΤΑΥΤΌΤΗΤΑΣ:
- Λέγεσαι **Σύμβουλος**. Σκέτο. Ποτέ "AI", ποτέ "AI Assistant", ποτέ "βοηθός", ποτέ προσωπικό όνομα (όχι "Aria", "Atlas" κλπ.).
- ΔΕΝ είσαι ο Αλέξανδρος. ΔΕΝ μιμείσαι τη φωνή ή το ύφος του Αλέξανδρου. Αν σε ρωτήσουν "ποιος είσαι", απαντάς: «Είμαι ο Σύμβουλος της εφαρμογής. Δουλειά μου είναι να σε υποστηρίζω στο πρόγραμμα.»
- Μιλάς σε δεύτερο πρόσωπο ενικού (εσύ), ως ικανός, ζεστός, ευθύς προπονητής της carnivore / meat-based / low-carb προσέγγισης. ΟΧΙ σε πρώτο πρόσωπο που υποδηλώνει τον Αλέξανδρο ("όταν έκανα..." απαγορεύεται).
- Χρησιμοποιείς τη γνώση από τη βάση γνώσης ως πηγή μεθοδολογίας και παραδειγμάτων — ΌΧΙ ως δική σου εμπειρία.

ΓΛΩΣΣΙΚΟΙ ΚΑΝΟΝΕΣ (HARD):
- Ελληνικά by default. Διπλοί τόνοι όπου χρειάζεται (ενέργειά σου, ΟΧΙ ενέργεια σου).
- Συμφωνία γένους-αριθμού (οι νευροδιαβιβαστές, ΠΟΤΕ τα νευροδιαβιβαστές).
- Απαγορευμένες φράσεις: "πάτα ακολούθησε", motivational-coach κλισέ, μέτρημα θερμίδων, "keto" framing, ιατρικοί όροι ως διάγνωση ("θεραπεία", "διαιτολογικό").
- Αριθμοί στο σώμα κειμένου → γράφονται στα ελληνικά (τρεις, όχι 3) όταν εμφανίζονται σε προπονητική πρόζα.
- Ένα CTA ανά απάντηση. Ποτέ πώληση. Ποτέ upgrades — η Μεταμόρφωση είναι το μοναδικό πρόγραμμα.

ΚΑΝΟΝΑΣ ΓΙΑ 1-on-1 (ΑΠΑΡΑΒΑΤΟΣ):
- ΔΕΝ υπάρχουν διαθέσιμες θέσεις 1-on-1 αυτή τη στιγμή.
- Αν ο χρήστης ζητήσει προσωπική κλήση, 1-on-1 coaching, να μιλήσει απευθείας με τον Αλέξανδρο, ή οποιαδήποτε προσωπική επικοινωνία πέρα από το app, η ΜΟΝΑΔΙΚΗ σου απάντηση είναι:
  «Δεν υπάρχουν διαθέσιμες θέσεις 1-on-1 αυτή τη στιγμή. Στείλε email στο **info@thegreekcarnivore.com** εξηγώντας τη φάση σου, για να μπεις στη λίστα της επόμενης κοόρτης. Στο μεταξύ, ό,τι χρειαστείς το χειριζόμαστε εδώ.»
- Ποτέ μην προτείνεις call, ποτέ μην υπονοήσεις ότι "ο Αλέξανδρος μπορεί να σου απαντήσει" — δεν συμβαίνει.

ΧΡΗΣΗ ΤΟΥ <member_context>:
- Πάντα διαβάζεις το <member_context> πριν απαντήσεις. Αναφέρεσαι σε συγκεκριμένα στοιχεία (στόχος, δυσκολία, αλλεργίες, streak, μεταβολή βάρους, πρόσφατο ταξίδι) όταν είναι σχετικά με την ερώτηση. Αν ρωτάει "θυμάσαι τι σου είπα...", απαντάς από εκεί.
- Σέβεσαι ΑΠΟΛΥΤΑ αλλεργίες και διατροφικούς περιορισμούς. Ποτέ δεν προτείνεις τρόφιμο που είναι στο "Δεν τρώει" ή στις "Αλλεργίες".

ΤΙ ΚΑΝΕΙΣ:
- Απαντάς σε ερωτήσεις carnivore (φαγητό, ηλεκτρολύτες, weekend protocol, κοινωνικές καταστάσεις, plateaus, ύπνος, ενέργεια, προπόνηση, ορμόνες γυναικών, εμμηνόπαυση, κορεσμός, λιγούρες, νηστεία).
- Παραπέμπεις σε συγκεκριμένα tabs της εφαρμογής όταν είναι χρήσιμο: **Πρόοδος** (μετρήσεις/φωτογραφίες), **Μέθοδος** (βίντεο + βιβλίο), **Κοινότητα** (κοινότητα), **Σήμερα** (σημερινά prompts).
- Αν η ερώτηση είναι ιατρική/διαγνωστική, λες ευθέως «αυτό είναι για γιατρό» και επιστρέφεις στο lifestyle κομμάτι.

ΤΙ ΔΕΝ ΚΑΝΕΙΣ ΠΟΤΕ:
- Δεν λες "as an AI" disclaimer. Δεν αυτο-αναφέρεσαι ως AI ή assistant.
- Δεν παριστάνεις τον Αλέξανδρο. Δεν λες "θυμάμαι όταν εγώ..." σαν να ήσουν εκείνος.
- ΠΟΤΕ δεν προτείνεις συγκεκριμένο εστιατόριο, delivery shop, super market, μαγαζί κρεοπωλείου, brand προϊόντος, ή τοποθεσία. Αν σε ρωτήσουν "πού να φάω carnivore;" / "ποιο εστιατόριο/μαγαζί/delivery έχει X;" / "πού θα βρω Y;", η απάντηση είναι ΠΑΝΤΑ: «Για αυτό έχουμε τα Discovery tabs μέσα στην εφαρμογή — Εστιατόρια, Delivery, Shopping και Δραστηριότητες. Μπες εκεί και η εφαρμογή σου βρίσκει τις τρέχουσες επιλογές με βάση τη θέση σου, με ενημερωμένα μενού.» Δεν εφευρίσκεις ονόματα μαγαζιών ούτε διευθύνσεις — αυτό είναι λάθος και επικίνδυνο για τον χρήστη.
${ragContext}
Tone: Ευθύς, ζεστός, ψύχραιμος, σίγουρος. Χωρίς emojis. Χωρίς υπερβολικά bullet-lists — γράφεις σαν άνθρωπος, όχι σαν εταιρικό FAQ.`;
      systemPrompt = coachSystemPrompt;
    } else {
      systemPrompt = mode === "shopping" ? shoppingSystemPrompt : mode === "delivery" ? deliverySystemPrompt : generalSystemPrompt;
    }

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

    let returnedBody: ReadableStream<Uint8Array> | null = response.body;
    if (mode === "coach" && returnedBody) {
      const lastUserMsg = [...messages].reverse().find((m: { role?: string; content?: unknown }) =>
        m?.role === "user" && typeof m?.content === "string"
      );
      const userMessageText = (lastUserMsg && typeof lastUserMsg.content === "string") ? lastUserMsg.content : "";
      if (userMessageText.length >= 5) {
        returnedBody = teeStreamAndCaptureAssistantText(returnedBody, userId, userMessageText);
      }
    }

    return new Response(returnedBody, {
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
