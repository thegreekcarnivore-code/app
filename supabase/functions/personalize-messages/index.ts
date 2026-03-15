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

    const { clientUserId, messages, language } = await req.json();
    if (!clientUserId || !messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing clientUserId or messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch ALL client data in parallel
    const [profileRes, notesRes, measurementsRes, foodRes, enrollmentRes, recentSentRes] = await Promise.all([
      adminSb.from("profiles").select("display_name, email, date_of_birth, sex, height_cm").eq("id", clientUserId).maybeSingle(),
      adminSb.from("client_notes").select("category, title, content, created_at").eq("user_id", clientUserId).eq("is_active", true).order("created_at", { ascending: false }),
      adminSb.from("measurements").select("*").eq("user_id", clientUserId).order("measured_at", { ascending: false }).limit(10),
      adminSb.from("food_journal").select("meal_type, description, entry_date").eq("user_id", clientUserId).order("entry_date", { ascending: false }).limit(20),
      adminSb.from("client_program_enrollments").select("start_date, program_template_id").eq("user_id", clientUserId).eq("status", "active").maybeSingle(),
      adminSb.from("messages").select("content, created_at, sender_id").or(`sender_id.eq.${clientUserId},receiver_id.eq.${clientUserId}`).order("created_at", { ascending: false }).limit(20),
    ]);

    const profile = profileRes.data;
    const notes = notesRes.data || [];
    const measurements = measurementsRes.data || [];
    const food = foodRes.data || [];
    const enrollment = enrollmentRes.data;
    const recentSent = recentSentRes.data || [];

    // Build comprehensive client context
    let clientContext = "CLIENT DATA FOR PERSONALIZATION:\n\n";

    if (profile) {
      clientContext += `PROFILE:\n- Name: ${profile.display_name || "Unknown"}\n- Email: ${profile.email}\n`;
      if (profile.date_of_birth) clientContext += `- DOB: ${profile.date_of_birth}\n`;
      if (profile.sex) clientContext += `- Sex: ${profile.sex}\n`;
      if (profile.height_cm) clientContext += `- Height: ${profile.height_cm}cm\n`;
    }

    if (enrollment) {
      const startDate = new Date(enrollment.start_date);
      const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / 86400000);
      clientContext += `\nPROGRAM: Started ${enrollment.start_date}, Day ${daysSinceStart} of program\n`;
    }

    const allergies = notes.filter((n: any) => n.category === "allergy").map((n: any) => n.title);
    const restrictions = notes.filter((n: any) => n.category === "restriction").map((n: any) => n.title);
    const goals = notes.filter((n: any) => n.category === "goal").map((n: any) => n.title);
    const meetingNotes = notes.filter((n: any) => n.category === "meeting_note");
    const general = notes.filter((n: any) => !["allergy", "restriction", "goal", "meeting_note"].includes(n.category));

    if (allergies.length) clientContext += `\nALLERGIES: ${allergies.join(", ")}\n`;
    if (restrictions.length) clientContext += `RESTRICTIONS: ${restrictions.join(", ")}\n`;
    if (goals.length) clientContext += `GOALS: ${goals.join(", ")}\n`;
    if (meetingNotes.length) {
      clientContext += `\nMEETING NOTES:\n`;
      meetingNotes.slice(0, 5).forEach((n: any) => {
        clientContext += `- [${new Date(n.created_at).toISOString().split("T")[0]}] ${n.title}${n.content ? ": " + n.content.slice(0, 300) : ""}\n`;
      });
    }
    if (general.length) {
      clientContext += `\nOTHER NOTES:\n`;
      general.slice(0, 5).forEach((n: any) => {
        clientContext += `- ${n.title}${n.content ? ": " + n.content.slice(0, 200) : ""}\n`;
      });
    }

    if (measurements.length) {
      const latest = measurements[0];
      clientContext += `\nLATEST MEASUREMENTS:\n`;
      if (latest.weight_kg) clientContext += `- Weight: ${latest.weight_kg}kg\n`;
      if (latest.fat_kg) clientContext += `- Fat: ${latest.fat_kg}kg\n`;
      if (latest.muscle_kg) clientContext += `- Muscle: ${latest.muscle_kg}kg\n`;
      if (latest.energy) clientContext += `- Energy: ${latest.energy}/10\n`;
      if (latest.mood) clientContext += `- Mood: ${latest.mood}/10\n`;
      if (latest.stress) clientContext += `- Stress: ${latest.stress}/10\n`;
      if (measurements.length >= 2) {
        const prev = measurements[measurements.length - 1];
        if (latest.weight_kg && prev.weight_kg) {
          const change = (latest.weight_kg - prev.weight_kg).toFixed(1);
          clientContext += `- Weight trend: ${Number(change) >= 0 ? "+" : ""}${change}kg over ${measurements.length} entries\n`;
        }
      }
    }

    if (food.length) {
      clientContext += `\nRECENT FOOD LOG (last entries):\n`;
      food.slice(0, 10).forEach((f: any) => {
        clientContext += `- [${f.entry_date}] ${f.meal_type}: ${f.description.slice(0, 100)}\n`;
      });
    }

    if (recentSent.length) {
      const coachMsgs = recentSent.filter((m: any) => m.sender_id !== clientUserId).slice(0, 8);
      const clientMsgs = recentSent.filter((m: any) => m.sender_id === clientUserId).slice(0, 8);
      if (coachMsgs.length) {
        clientContext += `\nRECENT MESSAGES FROM COACH (do NOT repeat similar phrasing):\n`;
        coachMsgs.forEach((m: any) => {
          clientContext += `- [${new Date(m.created_at).toISOString().split("T")[0]}] ${(m.content || "").slice(0, 200)}\n`;
        });
      }
      if (clientMsgs.length) {
        clientContext += `\nRECENT MESSAGES FROM CLIENT:\n`;
        clientMsgs.forEach((m: any) => {
          clientContext += `- [${new Date(m.created_at).toISOString().split("T")[0]}] ${(m.content || "").slice(0, 200)}\n`;
        });
      }
    }

    const langInstruction = language === "el"
      ? "Write ALL personalized messages ENTIRELY in Greek (Ελληνικά)."
      : "Write all personalized messages in English.";

    const prompt = `${clientContext}

---

You are personalizing automated coaching messages for this specific client. Use their data to make each message deeply personal and relevant.

Rules:
- Keep {client_name} as a placeholder (don't replace it)
- Reference their specific goals, progress, challenges, food patterns
- If they've been struggling (low energy/mood scores, missed food logs), be extra encouraging
- If they're doing great (consistent logging, weight trending toward goals), celebrate specifics
- Keep each message concise (2-4 sentences) but make it feel like it was written SPECIFICALLY for them
- Maintain the original intent/timing of each message
- CRITICAL: Look at the recent coach messages above. Do NOT repeat similar phrasing, angles, or metaphors. Use fresh, varied approaches each time.
- Consider what the client has been saying recently — acknowledge their current state
- ${langInstruction}

Messages to personalize (with their scheduled day):
${messages.map((m: any, i: number) => `${i + 1}. [Day ${m.day_offset}] "${m.message_content}"`).join("\n")}

Return ONLY a JSON array: [{"id": "<original message id>", "message_content": "<personalized message>"}]`;

    const model = getOpenAIModel("OPENAI_MODEL_STANDARD", "gpt-4.1-mini");
    const aiData = await createOpenAIChatCompletion({
      model,
      messages: [{ role: "user", content: prompt }],
    });
    const content = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Failed to parse", raw: content }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const personalized = JSON.parse(jsonMatch[0]);

    await adminSb.rpc("log_api_usage", {
      _user_id: claims.claims.sub,
      _function_name: "personalize-messages",
      _service: "openai",
      _model: model,
      _estimated_cost: 0.008,
      _call_count: 1,
    });

    return new Response(JSON.stringify({ personalized }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "AI personalization failed",
      rateLimitMessage: "Rate limited",
    });
    if (openAIError) return openAIError;
    console.error("personalize-messages error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
