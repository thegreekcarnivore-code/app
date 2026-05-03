import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Side-channel personalization tester. Builds the same <member_context>
// payload concierge-chat builds (from member_intakes + member_journey_log),
// stitches it into a coach-mode system prompt, calls OpenAI directly,
// and returns the assistant's reply. Used to verify intake recall and
// personalized guidance without needing the user's session JWT.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function buildMemberContext(admin: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const [intakeRes, journeyRes] = await Promise.all([
    admin
      .from("member_intakes")
      .select("primary_goal_detail, biggest_struggle, allergies, why_now, biggest_fear, target_weight_kg, weight_kg, cooking_skill, eats_eggs, eats_dairy, eats_organs, disliked_foods, completed_at")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("member_journey_log")
      .select("kind, summary, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(20),
  ]);
  const intake = (intakeRes.data ?? null) as Record<string, unknown> | null;
  const journey = ((journeyRes.data ?? []) as { kind: string; summary: string; occurred_at: string }[]);

  const lines: string[] = ["", "<member_context>"];
  if (intake?.completed_at) {
    if (intake.primary_goal_detail) lines.push(`Στόχος: ${String(intake.primary_goal_detail).slice(0, 240)}`);
    if (intake.biggest_struggle) lines.push(`Μεγαλύτερη δυσκολία: ${String(intake.biggest_struggle).slice(0, 240)}`);
    if (intake.why_now) lines.push(`Γιατί τώρα: ${String(intake.why_now).slice(0, 240)}`);
    if (intake.biggest_fear) lines.push(`Φόβος: ${String(intake.biggest_fear).slice(0, 240)}`);
    if (intake.allergies && (intake.allergies as string[]).length > 0) lines.push(`Αλλεργίες: ${(intake.allergies as string[]).join(", ")}`);
    if (intake.disliked_foods && (intake.disliked_foods as string[]).length > 0) lines.push(`Δεν τρώει: ${(intake.disliked_foods as string[]).join(", ")}`);
    const flags: string[] = [];
    if (intake.eats_eggs === false) flags.push("όχι αυγά");
    if (intake.eats_dairy === false) flags.push("όχι γαλακτοκομικά");
    if (intake.eats_organs === false) flags.push("όχι εντόσθια");
    if (flags.length > 0) lines.push(`Διατροφικοί περιορισμοί: ${flags.join(", ")}`);
    if (intake.cooking_skill) lines.push(`Επίπεδο μαγειρικής: ${intake.cooking_skill}`);
    if (intake.target_weight_kg && intake.weight_kg) {
      lines.push(`Βάρος-στόχος: ${intake.target_weight_kg}kg (από ${intake.weight_kg}kg στο intake)`);
    }
  }
  if (journey.length > 0) {
    lines.push("Πρόσφατο ταξίδι (πιο πρόσφατο πρώτο):");
    for (const j of journey.slice(0, 12)) {
      lines.push(`- [${j.kind}] ${j.summary}`);
    }
  }
  lines.push("</member_context>");
  if (lines.length <= 2) return "";
  return lines.join("\n") + "\n";
}

const SYSTEM_PROMPT_PREFIX = `Είσαι ο Σύμβουλος της εφαρμογής "The Greek Carnivore" — ο μόνιμος καθοδηγητής του μέλους μέσα στο πρόγραμμα Μεταμόρφωση.

ΤΑΥΤΟΤΗΤΑ:
- Λέγεσαι Σύμβουλος. Σκέτο. Ποτέ "AI", ποτέ "βοηθός", ποτέ προσωπικό όνομα.
- ΔΕΝ είσαι ο Αλέξανδρος. ΔΕΝ μιμείσαι τη φωνή του.

ΚΑΝΟΝΑΣ 1-on-1: Δεν υπάρχουν 1-on-1 συνεδρίες. Αν ζητηθεί, λες: «Στείλε email στο info@thegreekcarnivore.com για επόμενη κοόρτη.»

ΑΥΣΤΗΡΟΣ ΚΑΝΟΝΑΣ CARNIVORE (ΑΠΑΡΑΒΑΤΟΣ):
- Όταν προτείνεις φαγητά/συνταγές/συστατικά, ΜΟΝΟ ζωικά τρόφιμα: κρέας, ψάρια/θαλασσινά, αυγά, βούτυρο, λίπος, ζωμός κόκαλου, εντόσθια, γαλακτοκομικά.
- ΠΟΤΕ λαχανικά, φρούτα, ξηρούς καρπούς, σπόρους, όσπρια, δημητριακά, ζάχαρη, μέλι, λάδια σπόρων, snacks φυτικής βάσης.
- Σέβεσαι αλλεργίες/περιορισμούς από το <member_context>: αν λέει "όχι αυγά", δεν τα αναφέρεις. Αν λέει "όχι γαλακτοκομικά", δεν τα αναφέρεις.

ΧΡΗΣΗ ΤΟΥ <member_context>:
- Πάντα διαβάζεις το <member_context> πριν απαντήσεις. Αν ρωτάει "θυμάσαι τι σου είπα...", απαντάς από εκεί.

Tone: Ευθύς, ζεστός, σίγουρος. Χωρίς emojis.`;

async function ask(systemPrompt: string, userMsg: string, apiKey: string): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.4,
    }),
  });
  if (!resp.ok) return `__HTTP_${resp.status}__`;
  const j = await resp.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

  try {
    const { user_id, prompts } = await req.json();
    if (!user_id || !Array.isArray(prompts)) {
      return new Response(JSON.stringify({ error: "user_id and prompts[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const memberContext = await buildMemberContext(admin, user_id);
    const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n${memberContext}`;
    const results: { prompt: string; response: string }[] = [];
    for (const p of prompts as string[]) {
      const r = await ask(systemPrompt, p, apiKey);
      results.push({ prompt: p, response: r });
    }
    return new Response(JSON.stringify({ ok: true, member_context_len: memberContext.length, results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
