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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, missingItems, clientName } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get admin ID
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();
    const adminId = adminRole?.user_id;

    // Fetch client context in parallel
    const [notesRes, messagesRes, transcriptsRes, prevMotivsRes] = await Promise.all([
      supabase.from("client_notes").select("title, content, category").eq("user_id", userId).eq("is_active", true).limit(20),
      adminId
        ? supabase.from("messages").select("content, created_at, sender_id").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order("created_at", { ascending: false }).limit(40)
        : Promise.resolve({ data: [] }),
      supabase.from("call_transcript_history").select("summaries").limit(5),
      // Fetch last 5 admin→client messages to detect previously sent motivational messages
      adminId
        ? supabase.from("messages").select("content, created_at").eq("sender_id", adminId).eq("receiver_id", userId).order("created_at", { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
    ]);

    const notes = (notesRes.data || []).map(n => `[${n.category}] ${n.title}: ${n.content || ""}`).join("\n");

    // Separate admin vs client messages for richer context
    const allMessages = messagesRes.data || [];
    const clientMessages = allMessages.filter((m: any) => m.sender_id === userId).slice(0, 15);
    const adminMessages = allMessages.filter((m: any) => m.sender_id !== userId).slice(0, 15);

    const clientMsgStr = clientMessages.map((m: any) => `[${new Date(m.created_at).toLocaleDateString()}] ${m.content}`).join("\n");
    const adminMsgStr = adminMessages.map((m: any) => `[${new Date(m.created_at).toLocaleDateString()}] ${m.content}`).join("\n");

    const prevMotivs = (prevMotivsRes.data || []).map((m: any) => m.content).filter(Boolean);
    const prevMotivsStr = prevMotivs.length > 0
      ? prevMotivs.map((m: string, i: number) => `${i + 1}. "${m.slice(0, 300)}"`).join("\n")
      : "None found.";

    const transcripts = (transcriptsRes.data || []).flatMap(t => {
      const summaries = t.summaries as any[];
      return summaries?.map((s: any) => s.summary || "") || [];
    }).join("\n");

    const missingStr = (missingItems as string[]).join(", ");

    const prompt = `You are a warm, caring coach named Alexandros (The Greek Carnivore). You need to write a personalized motivational message IN GREEK to a client named "${clientName}".

CONTEXT ABOUT THIS CLIENT:
--- Client Notes (pain points, goals, reasons for joining) ---
${notes || "No notes available."}

--- Recent messages FROM the client ---
${clientMsgStr || "No recent client messages."}

--- Recent messages FROM the coach (you) ---
${adminMsgStr || "No recent coach messages."}

--- Call Transcript Summaries ---
${transcripts || "No transcripts available."}

--- PREVIOUSLY SENT motivational/check-in messages (DO NOT REPEAT these) ---
${prevMotivsStr}

WHAT THEY'RE CURRENTLY MISSING THIS WEEK:
${missingStr || "Nothing — they're doing great!"}

INSTRUCTIONS:
- Write in Greek, warm and personal tone
- Reference their specific pain points and goals from the notes/calls
- Remind them WHY they started this program
- Address what they're currently missing
- Encourage without being preachy — like a coach who genuinely cares
- Keep it concise: 3-5 sentences
- Do NOT use formal Greek, use friendly/informal tone
- End with something motivational that connects to their personal goals
- CRITICAL: Do NOT repeat or paraphrase any of the previously sent messages listed above. Use a COMPLETELY DIFFERENT angle, tone, metaphor, or motivational approach each time.
- Consider what the client has been saying in their recent messages — acknowledge their current state, struggles, or wins
- If the client hasn't replied in a while, gently acknowledge that without guilt-tripping`;

    const aiData = await createOpenAIChatCompletion({
      model: getOpenAIModel("OPENAI_MODEL_STANDARD", "gpt-4.1-mini"),
      messages: [
        { role: "system", content: "You are a motivational coach. Always respond in Greek." },
        { role: "user", content: prompt },
      ],
    });
    const message = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const openAIError = buildOpenAIErrorResponse(error, corsHeaders, {
      defaultMessage: "AI generation failed",
      rateLimitMessage: "Rate limit exceeded, try again later.",
    });
    if (openAIError) return openAIError;
    console.error("generate-motivation error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
