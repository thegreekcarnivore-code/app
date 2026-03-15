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

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await sb.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { transcript, participants, callTitle, adminEmail, callId } = await req.json();
    if (!transcript || !participants || !Array.isArray(participants)) {
      return new Response(JSON.stringify({ error: "Missing transcript or participants" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch ALL client profiles for matching
    const { data: allProfilesData } = await adminSb
      .from("profiles")
      .select("id, display_name, email")
      .eq("approved", true);
    const allProfiles = allProfilesData || [];

    // Fetch profiles and notes for registered participants
    const userIds = participants.map((p: any) => p.user_id);
    const [profilesRes, notesRes] = await Promise.all([
      adminSb.from("profiles").select("id, display_name, email").in("id", userIds),
      adminSb.from("client_notes").select("user_id, category, title, content, created_at")
        .in("user_id", userIds).eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);

    const profiles = profilesRes.data || [];
    const notes = notesRes.data || [];

    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
    const notesByUser = new Map<string, any[]>();
    for (const n of notes) {
      if (!notesByUser.has(n.user_id)) notesByUser.set(n.user_id, []);
      notesByUser.get(n.user_id)!.push(n);
    }

    // Build participant context (known participants)
    let participantContext = "";
    for (const p of participants) {
      const profile = profileMap.get(p.user_id);
      const name = profile?.display_name || profile?.email || p.email || "Unknown";
      const isAdmin = profile?.email === adminEmail;
      participantContext += `\n- ${name} (${profile?.email || "no email"})${isAdmin ? " [ADMIN/COACH]" : " [CLIENT]"}`;
      
      const userNotes = notesByUser.get(p.user_id) || [];
      if (userNotes.length > 0) {
        const goals = userNotes.filter((n: any) => n.category === "goal").map((n: any) => n.title);
        const allergies = userNotes.filter((n: any) => n.category === "allergy").map((n: any) => n.title);
        const restrictions = userNotes.filter((n: any) => n.category === "restriction").map((n: any) => n.title);
        if (goals.length) participantContext += `\n  Goals: ${goals.join(", ")}`;
        if (allergies.length) participantContext += `\n  Allergies: ${allergies.join(", ")}`;
        if (restrictions.length) participantContext += `\n  Restrictions: ${restrictions.join(", ")}`;
      }
    }

    // Build full client list context for matching
    let clientListContext = "\n\nFULL CLIENT LIST (for matching discovered speakers):";
    for (const p of allProfiles) {
      clientListContext += `\n- ${p.display_name || "No name"} | ${p.email || "no email"} | id: ${p.id}`;
    }

    const prompt = `You are a nutrition coaching assistant analyzing a call transcript.

CALL: "${callTitle || "Coaching Session"}"

KNOWN PARTICIPANTS (registered for this call):${participantContext}
${clientListContext}

TRANSCRIPT:
${transcript}

---

TASK: Analyze this transcript and create a personalized summary for EACH person you can identify as a speaker/participant in the transcript.

IMPORTANT — PARTICIPANT DISCOVERY:
- Identify ALL distinct speakers/participants from the transcript, even if they are NOT in the known participants list above.
- For each person you identify, try to match them against the FULL CLIENT LIST by name.
- If you find a match, set "matched": true and use their user_id and email from the client list.
- If you cannot find a match (external person, guest, etc.), set "matched": false and use a placeholder user_id like "unknown-1", "unknown-2", etc.

For each CLIENT participant:
- Recap what they shared, their struggles, wins, and key discussion points about THEM
- Summarize the specific advice, action items, or things to try that were suggested FOR THEM
- IMPORTANT: If the client made any commitments, promises, or said they would do something (e.g. "I'll try cutting out sugar", "I'll walk 30 minutes daily", "I'll send my measurements"), add a clear and warm reminder at the end of their summary. Frame it encouragingly, e.g. "Don't forget — you mentioned you'd [X], I'll be checking in on that! 💪"
- Be encouraging, warm, and thank them for sharing/participating. Write as if YOU (the coach) are speaking directly to them in first person singular ("I", not "we"). You are the one recapping and caring for them.
- Keep it concise but personal (3-8 sentences)
- Reference specific details from the conversation (not generic advice)

For the ADMIN/COACH participant (${adminEmail}):
- Create a NUMBERED LIST of every promise or commitment YOU (the coach) made during the call. For each item, specify:
  • What was promised
  • Who it was for (specific client name, or "everyone/the group")
  • e.g. "1. Send meal plan to Maria", "2. Share supplement link with the group"
- If no promises were made, explicitly state "No specific promises identified."
- Summarize other action items the coach should follow up on
- Brief notes on each client's status/mood from the call

IMPORTANT: 
- Write each summary in the SAME LANGUAGE as the transcript (if the transcript is in Greek, write in Greek)
- Each summary should feel like a personal message, not a clinical report
- Use the participant's first name naturally in the message

CRITICAL — PROMISE TRACKING:
For EACH specific promise the coach made to a specific client, create an admin_task entry. Be thorough — include promises like "I'll send you X", "I'll check on Y", "I'll prepare Z for you", "I'll look into...", "I'll share...". Do NOT skip any promise.
Make the promises section VERY prominent in the admin summary. Start with a clear "--- ΥΠΟΣΧΕΣΕΙΣ / PROMISES ---" header before listing the numbered promises.

Also extract "admin_tasks": a list of specific action items the coach promised or needs to do. Each task should have:
- "title": short actionable title (in the transcript language)
- "description": brief details
- "client_email": the email of the client this task is for (or null if general)
- "priority": "urgent", "high", "medium", or "low"

Return ONLY a JSON object:
{"summaries": [{"user_id": "<participant user_id or unknown-N>", "name": "<display name>", "email": "<email or empty string>", "summary": "<personalized summary>", "is_admin": <true/false>, "note_title": "<short 3-5 word title for CRM note>", "matched": <true/false>}], "admin_tasks": [{"title": "...", "description": "...", "client_email": "..." or null, "priority": "..."}]}`;

    const model = getOpenAIModel("OPENAI_MODEL_STANDARD", "gpt-4.1-mini");
    const aiData = await createOpenAIChatCompletion({
      model,
      messages: [{ role: "user", content: prompt }],
    });
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Try to parse as object first (new format), fall back to array (old format)
    let summaries = [];
    let adminTasks = [];
    
    const objMatch = content.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        if (Array.isArray(parsed)) {
          summaries = parsed;
        } else {
          summaries = parsed.summaries || [];
          adminTasks = parsed.admin_tasks || [];
        }
      } catch {
        const arrMatch = content.match(/\[[\s\S]*\]/);
        if (arrMatch) summaries = JSON.parse(arrMatch[0]);
      }
    } else {
      const arrMatch = content.match(/\[[\s\S]*\]/);
      if (arrMatch) summaries = JSON.parse(arrMatch[0]);
    }

    // Ensure matched field defaults to false if missing
    summaries = summaries.map((s: any) => ({
      ...s,
      matched: s.matched ?? false,
    }));

    if (summaries.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auto-save admin tasks
    if (adminTasks.length > 0) {
      for (const task of adminTasks) {
        // Try to resolve client_id from email
        let clientId = null;
        if (task.client_email) {
          const { data: prof } = await adminSb.from("profiles").select("id").eq("email", task.client_email).maybeSingle();
          if (prof) clientId = prof.id;
        }
        await adminSb.from("admin_tasks").insert({
          admin_id: claims.claims.sub,
          title: task.title || "",
          description: task.description || "",
          priority: task.priority || "medium",
          client_id: clientId,
          source: "call_transcript",
          source_call_id: callId || null,
        });
      }
    }

    await adminSb.rpc("log_api_usage", {
      _user_id: claims.claims.sub,
      _function_name: "analyze-call-transcript",
      _service: "openai",
      _model: model,
      _estimated_cost: 0.015,
      _call_count: 1,
    });

    return new Response(JSON.stringify({ summaries, admin_tasks: adminTasks }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "AI analysis failed",
      rateLimitMessage: "Rate limited, please try again later",
    });
    if (openAIError) return openAIError;
    console.error("analyze-call-transcript error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
