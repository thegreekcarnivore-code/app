import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[FOOD-JOURNAL-WEEKLY] ${step}${tail}`);
};

type FoodEntry = {
  user_id: string;
  entry_date: string;
  meal_type: string;
  description: string | null;
  notes: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    // Pull only active Metamorphosis members (active subscription).
    const { data: enrollments } = await admin
      .from("client_program_enrollments")
      .select("user_id")
      .eq("status", "active");

    const userIds = Array.from(new Set((enrollments ?? []).map((e: { user_id: string }) => e.user_id)));
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, summarized: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let summarized = 0;
    let skipped = 0;

    for (const user_id of userIds) {
      const { data: entries } = await admin
        .from("food_journal")
        .select("user_id, entry_date, meal_type, description, notes")
        .eq("user_id", user_id)
        .gte("entry_date", sevenDaysAgo)
        .order("entry_date", { ascending: true });

      const list = (entries ?? []) as FoodEntry[];
      if (list.length < 3) {
        skipped++;
        continue;
      }

      // De-dupe: skip if we already wrote a food_journal observation in last 7 days.
      const { data: existing } = await admin
        .from("member_journey_log")
        .select("id")
        .eq("user_id", user_id)
        .eq("source", "food_journal")
        .gte("occurred_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(1);
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      const condensed = list
        .map((e) => `${e.entry_date} · ${e.meal_type}: ${(e.description ?? "").slice(0, 120)}`)
        .join("\n");

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content:
                "Είσαι ο Σύμβουλος. Διάβασε τις τελευταίες 7 μέρες καταγραφών φαγητού ενός μέλους carnivore και βγάλε ΜΙΑ μόνο πρόταση παρατήρησης στα ελληνικά (≤180 χαρακτήρες). Επικεντρώσου σε επαναλαμβανόμενα μοτίβα, κενά, ή θετικές συνήθειες. ΟΧΙ ιατρικές οδηγίες. ΟΧΙ συστάσεις φαρμάκων. Επέστρεψε μόνο την πρόταση, χωρίς εισαγωγή.",
            },
            { role: "user", content: condensed.slice(0, 4000) },
          ],
          temperature: 0.4,
          max_tokens: 120,
        }),
      });

      if (!aiResp.ok) {
        log("ai error", { user_id, status: aiResp.status });
        skipped++;
        continue;
      }

      const aiJson = await aiResp.json();
      const summary: string = (aiJson?.choices?.[0]?.message?.content ?? "").trim();
      if (!summary || summary.length < 10) {
        skipped++;
        continue;
      }

      const { error: insertErr } = await admin.from("member_journey_log").insert({
        user_id,
        kind: "observation",
        summary: summary.slice(0, 200),
        source: "food_journal",
        metadata: { entries_count: list.length, span_days: 7 },
      });

      if (insertErr) {
        log("insert error", { user_id, msg: insertErr.message });
        skipped++;
        continue;
      }

      summarized++;
    }

    return new Response(JSON.stringify({ ok: true, summarized, skipped }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "weekly summary failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
