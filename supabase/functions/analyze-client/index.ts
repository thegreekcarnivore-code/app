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
    const { userId, feedback, previousReport, mode = "overall", customQuestion, lang = "en" } = await req.json();
    if (!userId) throw new Error("userId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw new Error("Admin access required");

    // Date filter for weekly mode
    const isWeekly = mode === "weekly";
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyDateStr = sevenDaysAgo.toISOString().split("T")[0];

    // Fetch all client data in parallel
    const [measurementsRes, recentMeasurementsRes, foodRes, photosRes, notesRes, globalInstructionsRes, clientInstructionsRes, profileRes, dietaryGuidelinesRes, journalRes] = await Promise.all([
      // Always fetch full history for context
      adminClient.from("measurements").select("*").eq("user_id", userId).order("measured_at", { ascending: true }),
      // Weekly: also fetch recent subset
      isWeekly
        ? adminClient.from("measurements").select("*").eq("user_id", userId).gte("measured_at", weeklyDateStr).order("measured_at", { ascending: true })
        : Promise.resolve({ data: null }),
      // Food journal: filter for weekly, full for others
      isWeekly
        ? adminClient.from("food_journal").select("*").eq("user_id", userId).gte("entry_date", weeklyDateStr).order("entry_date", { ascending: false }).limit(100)
        : adminClient.from("food_journal").select("*").eq("user_id", userId).order("entry_date", { ascending: false }).limit(100),
      adminClient.from("progress_photos").select("*").eq("user_id", userId).order("taken_at", { ascending: true }),
      adminClient.from("client_notes").select("*").eq("user_id", userId).eq("is_active", true).order("created_at", { ascending: false }),
      adminClient.from("report_instructions").select("instruction").eq("scope", "global"),
      adminClient.from("report_instructions").select("instruction").eq("scope", "client").eq("user_id", userId),
      adminClient.from("profiles").select("email, display_name, date_of_birth").eq("id", userId).maybeSingle(),
      adminClient.from("reference_documents").select("content").eq("key", "dietary_guidelines").maybeSingle(),
      // Wellness journal entries
      isWeekly
        ? adminClient.from("wellness_journal").select("id, content, created_at").eq("user_id", userId).gte("created_at", sevenDaysAgo.toISOString()).order("created_at", { ascending: false }).limit(50)
        : adminClient.from("wellness_journal").select("id, content, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);

    const allMeasurements = measurementsRes.data || [];
    const recentMeasurements = recentMeasurementsRes.data || [];
    const foodJournal = foodRes.data || [];
    const photos = photosRes.data || [];
    const notes = notesRes.data || [];
    const globalInstructions = globalInstructionsRes.data || [];
    const clientInstructions = clientInstructionsRes.data || [];
    const profile = profileRes.data;
    const dietaryGuidelines = dietaryGuidelinesRes.data?.content || "";
    const journalEntries = journalRes.data || [];

    // Build client profile from notes
    const allergies = notes.filter((n: any) => n.category === "allergy").map((n: any) => n.title);
    const restrictions = notes.filter((n: any) => n.category === "restriction").map((n: any) => n.title);
    const preferences = notes.filter((n: any) => n.category === "preference").map((n: any) => n.title);
    const goals = notes.filter((n: any) => n.category === "goal").map((n: any) => n.title);
    const meetingNotes = notes.filter((n: any) => n.category === "meeting_note");

    // Build learned preferences section
    let learnedPreferences = "";
    if (globalInstructions.length > 0 || clientInstructions.length > 0) {
      learnedPreferences = "\n\nLEARNED PREFERENCES (from your past feedback):\n";
      if (globalInstructions.length > 0) {
        learnedPreferences += "Global:\n" + globalInstructions.map((i: any) => `- ${i.instruction}`).join("\n") + "\n";
      }
      if (clientInstructions.length > 0) {
        learnedPreferences += "Client-specific:\n" + clientInstructions.map((i: any) => `- ${i.instruction}`).join("\n") + "\n";
      }
    }

    // Build measurement summary
    const buildMeasurementData = (measurements: any[], label: string) => {
      if (measurements.length === 0) return `No ${label} measurements recorded.\n`;
      const latest = measurements[measurements.length - 1];
      const earliest = measurements[0];
      const fields = ["weight_kg", "fat_kg", "muscle_kg", "waist_cm", "hip_cm", "arm_cm", "leg_cm", "height_cm"];
      const wellnessFields = ["energy", "mood", "digestion", "skin_health", "stress", "cravings", "breathing_health", "mental_health", "pain"];

      let data = `${label} measurements: ${measurements.length}\nDate range: ${earliest.measured_at} to ${latest.measured_at}\n\n`;
      data += "BODY COMPOSITION (earliest → latest):\n";
      for (const f of fields) {
        const ev = earliest[f];
        const lv = latest[f];
        if (ev != null || lv != null) data += `- ${f}: ${ev ?? "N/A"} → ${lv ?? "N/A"}\n`;
      }
      data += "\nWELLNESS MARKERS (latest):\n";
      for (const f of wellnessFields) {
        const lv = latest[f];
        if (lv != null) data += `- ${f}: ${lv}/10\n`;
      }
      data += `\nFULL ${label.toUpperCase()} MEASUREMENT HISTORY:\n`;
      data += "Date | Weight | Fat | Muscle | Waist | Hip | Energy | Mood | Stress\n";
      for (const m of measurements) {
        data += `${m.measured_at} | ${m.weight_kg ?? "-"} | ${m.fat_kg ?? "-"} | ${m.muscle_kg ?? "-"} | ${m.waist_cm ?? "-"} | ${m.hip_cm ?? "-"} | ${m.energy ?? "-"} | ${m.mood ?? "-"} | ${m.stress ?? "-"}\n`;
      }
      return data;
    };

    let measurementData: string;
    if (isWeekly) {
      measurementData = "=== THIS WEEK'S MEASUREMENTS ===\n" + buildMeasurementData(recentMeasurements, "This week's");
      measurementData += "\n=== ALL-TIME CONTEXT ===\n" + buildMeasurementData(allMeasurements, "All-time");
    } else {
      measurementData = allMeasurements.length > 0 ? buildMeasurementData(allMeasurements, "Total") : "No measurements recorded yet.";
    }

    // Build food journal summary
    let foodData = "No food journal entries yet.";
    if (foodJournal.length > 0) {
      foodData = `${isWeekly ? "This week's" : "Recent"} food journal (${foodJournal.length} entries):\n`;
      for (const entry of foodJournal.slice(0, 30)) {
        foodData += `- ${entry.entry_date} [${entry.meal_type}]: ${entry.description}${entry.notes ? ` (${entry.notes})` : ""}\n`;
      }
    }

    // Build photo info
    let photoData = "No progress photos yet.";
    if (photos.length > 0) {
      const angles = [...new Set(photos.map((p: any) => p.angle))];
      if (isWeekly) {
        const recentPhotos = photos.filter((p: any) => p.taken_at >= weeklyDateStr);
        photoData = `This week's photos: ${recentPhotos.length} | Total all-time: ${photos.length}\n`;
        for (const angle of angles) {
          const anglePhotos = photos.filter((p: any) => p.angle === angle);
          const weekPhotos = recentPhotos.filter((p: any) => p.angle === angle);
          photoData += `- ${angle}: ${weekPhotos.length} this week, ${anglePhotos.length} total (earliest: ${anglePhotos[0].taken_at}, latest: ${anglePhotos[anglePhotos.length - 1].taken_at})\n`;
        }
      } else {
        photoData = `Progress photos: ${photos.length} total across angles: ${angles.join(", ")}\n`;
        for (const angle of angles) {
          const anglePhotos = photos.filter((p: any) => p.angle === angle);
          photoData += `- ${angle}: earliest ${anglePhotos[0].taken_at}, latest ${anglePhotos[anglePhotos.length - 1].taken_at}\n`;
        }
      }
    }

    // Build notes context
    let notesContext = "";
    if (allergies.length > 0) notesContext += `ALLERGIES: ${allergies.join(", ")}\n`;
    if (restrictions.length > 0) notesContext += `RESTRICTIONS: ${restrictions.join(", ")}\n`;
    if (preferences.length > 0) notesContext += `PREFERENCES: ${preferences.join(", ")}\n`;
    if (goals.length > 0) notesContext += `GOALS: ${goals.join(", ")}\n`;
    if (meetingNotes.length > 0) {
      notesContext += "MEETING NOTES:\n";
      for (const n of meetingNotes.slice(0, 10)) {
        notesContext += `- [${n.created_at?.slice(0, 10)}] ${n.title}: ${n.content || ""}\n`;
      }
    }

    // Build system prompt based on mode
    let systemPrompt: string;
    const baseContext = `You are a senior health and nutrition analyst for "The Greek Carnivore", a premium wellness concierge platform focused on ancestral, animal-based nutrition (high-quality animal fats, organ meats, minimal plant toxins).

Your role is to generate client progress reports for the admin/nutritionist.

WRITING STYLE — CRITICAL:
- Be MAXIMALLY CONCISE. Write the shortest possible text that covers every important finding. No filler, no fluff, no repetition.
- Every sentence must carry information. If a sentence can be removed without losing insight, remove it.
- Use bullet points, tables, and numbers over prose. Data > words.
- Don't restate what's obvious from the data — interpret and analyze instead.
- Be direct: state findings, then implications. No preambles like "Let's look at..." or "It's worth noting that...".
- Combine related points into single dense sentences rather than separate paragraphs.
- Be honest and constructive. Highlight wins AND areas needing improvement.
- Use markdown formatting for readability.
${learnedPreferences}
${dietaryGuidelines ? `\nDIETARY FRAMEWORK REFERENCE (from "The Greek Carnivore Method" by Alexandros):
${dietaryGuidelines}

Use this framework when:
- Evaluating food journal entries (flag non-compliant items per the client's diet tier, suggest alternatives from the approved food lists)
- Making dietary recommendations aligned with the carnivore/keto approach
- Addressing client difficulties, plateaus, or cravings (reference the 4 Keys to Success, transitional phase guidance)
- Explaining why certain foods should be avoided (reference the science/myths section)
- Encouraging clients through the transitional phase (electrolytes, fat intake, timeline expectations)
- Recommending the appropriate diet tier based on the client's goals and health status
- Assessing compliance with the 6 basic rules
` : ''}`;

    if (mode === "weekly") {
      systemPrompt = `${baseContext}

This is a WEEKLY CHECK-IN. Focus on the PAST 7 DAYS with long-term goals as context.

REPORT STRUCTURE (use these exact headings):
## This Week's Highlights
Key wins and changes — 2-4 bullet points max.

## Body Composition
This week's numbers vs. previous. Use a comparison table if multiple metrics changed.

## Nutrition
Food journal assessment: consistency, alignment with goals, concerns. Be specific but brief.

## Wellness
Energy, mood, digestion, stress changes vs. prior week. Only mention metrics that moved.

## Next Week's Focus
2-3 specific, actionable priorities for the coming week.`;
    } else if (mode === "custom") {
      systemPrompt = `${baseContext}

The admin is asking a SPECIFIC QUESTION. Answer it directly and thoroughly using all available data. Be analytical and data-driven. Structure freely — no standard headings needed. Get straight to the answer.

ADMIN'S QUESTION: ${customQuestion}`;
    } else {
      systemPrompt = `${baseContext}

REPORT STRUCTURE (use these exact headings):
## Summary
2-3 sentences: current status, trajectory, key takeaway.

## Body Composition
Weight, body fat, muscle trends. Use comparison tables. Focus on deltas and rates of change.

## Wellness Markers
Energy, mood, digestion, stress trends. Only cover metrics with meaningful data.

## Nutrition Analysis
Food journal evaluation. Alignment with animal-based approach. Flag concerns concisely.

## Visual Progress
If photos exist, describe visible changes per angle. Skip if no photos.

## Recommendations
3-5 specific, prioritized action items for the next phase.`;
    }

    let userContent = `${mode === "weekly" ? "Generate a weekly check-in report" : mode === "custom" ? "Answer the following question about this client" : "Generate a comprehensive progress report"} for this client.

CLIENT INFO:
Name: ${profile?.display_name || "Not set"}
Email: ${profile?.email || "Unknown"}
Date of Birth: ${profile?.date_of_birth || "Not provided"}

${notesContext ? "CLIENT PROFILE:\n" + notesContext + "\n" : ""}
MEASUREMENTS DATA:
${measurementData}

FOOD JOURNAL:
${foodData}

PROGRESS PHOTOS:
${photoData}

WELLNESS JOURNAL (client's self-reported feelings, symptoms, reactions):
${journalEntries.length > 0
  ? journalEntries.map((j: any) => `- [${j.created_at?.slice(0, 16).replace("T", " ")}] ${j.content}`).join("\n")
  : "No wellness journal entries yet."}`;

    if (feedback && previousReport) {
      userContent += `\n\nPREVIOUS REPORT (admin requested changes):\n${previousReport}\n\nADMIN FEEDBACK - Please regenerate incorporating this:\n${feedback}`;
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    const reportModel = getOpenAIModel("OPENAI_MODEL_PREMIUM", "gpt-4.1");
    const aiData = await createOpenAIChatCompletion({
      model: reportModel,
      messages,
      max_tokens: 4000,
    });
    const report = aiData.choices?.[0]?.message?.content || "Report generation failed.";

    // Generate client message (conversational text for copy-paste to client)
    const clientName = profile?.display_name?.split(" ")[0] || "there";
    const clientMsgSystemPrompt = `You are a warm, supportive nutrition coach writing a direct message to your client "${clientName}". 
You work for "The Greek Carnivore", a premium wellness concierge.

CRITICAL RULES:
- Write as a SHORT personal chat message (like WhatsApp/Telegram), NOT an essay. Max 10-15 lines.
- Be warm, encouraging, and personal. Use their first name.
- Reference specific things from their week (foods they ate, measurements, wins).
- Mention what went well FIRST, then gently suggest 1-2 improvements.
- ALWAYS cross-reference the client notes below to stay consistent with past conversations, agreements, and goals. Rebound on things you've discussed before.
- Never contradict something previously agreed upon in notes/meetings.
- End with motivation or a specific action for the coming week.
- Do NOT use markdown formatting — write plain text suitable for a chat message.
- You MUST write ENTIRELY in ${lang === "el" ? "Greek (Ελληνικά)" : "English"}. Do NOT mix languages.

${learnedPreferences}

CLIENT NOTES & HISTORY (use these to maintain continuity):
${notesContext || "No notes yet."}`;

    let clientMessage = "";
    try {
      const msgData = await createOpenAIChatCompletion({
        model: getOpenAIModel("OPENAI_MODEL_STANDARD", "gpt-4.1-mini"),
        messages: [
          { role: "system", content: clientMsgSystemPrompt },
          { role: "user", content: `Based on this admin report, write a personal message to the client:\n\n${report}\n\nFood journal this week:\n${foodData}\n\nMeasurement data:\n${measurementData}` },
        ],
        max_tokens: 1000,
      });
      clientMessage = msgData.choices?.[0]?.message?.content || "";
    } catch (error) {
      console.error("Client message generation failed:", error);
    }

    try {
      await adminClient.rpc("log_api_usage", {
        _user_id: caller.id,
        _function_name: "analyze-client",
        _service: "openai",
        _model: reportModel,
        _estimated_cost: 0.005,
        _call_count: 1,
      });
    } catch (e) {
      console.error("Failed to log usage:", e);
    }

    return new Response(JSON.stringify({ report, clientMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "AI analysis failed",
      rateLimitMessage: "Rate limit exceeded. Please try again shortly.",
    });
    if (openAIError) return openAIError;
    console.error("analyze-client error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
