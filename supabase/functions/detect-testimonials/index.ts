import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[DETECT-TESTIMONIALS] ${step}${tail}`);
};

const SUCCESS_PHRASES = [
  "έχασα", "νιώθω καλύτερα", "πρώτη φορά μετά από", "δεν περίμενα ότι",
  "μου άλλαξε", "ευχαριστώ", "καλύτερα από ποτέ", "δεν έχω", "ξεκίνησα",
  "πετυχαίνω", "νικάω", "σημείωμα", "σταμάτησα", "ενέργεια",
];

const looksLikeWin = (text: string) => {
  const t = (text || "").toLowerCase();
  return SUCCESS_PHRASES.some((p) => t.includes(p));
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const inserted: Array<{ user_id: string; source: string }> = [];

    const upsertCandidate = async (row: {
      user_id: string;
      source: string;
      source_ref?: string | null;
      quote?: string | null;
      quantitative?: Record<string, unknown> | null;
      photo_before_url?: string | null;
      photo_after_url?: string | null;
    }) => {
      // Dedupe on (user_id, source, source_ref).
      if (row.source_ref) {
        const { data: dup } = await admin
          .from("testimonial_candidates")
          .select("id")
          .eq("user_id", row.user_id)
          .eq("source", row.source)
          .eq("source_ref", row.source_ref)
          .maybeSingle();
        if (dup) return;
      }
      const { error } = await admin.from("testimonial_candidates").insert(row);
      if (!error) inserted.push({ user_id: row.user_id, source: row.source });
    };

    // 1) Praise feedback in last 7d.
    const { data: praise } = await admin
      .from("member_feedback")
      .select("id, user_id, message, created_at")
      .eq("category", "praise")
      .gte("created_at", sevenDaysAgo);
    for (const r of praise ?? []) {
      await upsertCandidate({
        user_id: r.user_id,
        source: "feedback",
        source_ref: r.id,
        quote: r.message,
      });
    }

    // 2) Daily wins (table may or may not exist; ignore if missing).
    try {
      const { data: wins } = await admin
        .from("daily_wins")
        .select("id, user_id, message, created_at")
        .gte("created_at", sevenDaysAgo);
      for (const r of wins ?? []) {
        await upsertCandidate({
          user_id: r.user_id,
          source: "daily_win",
          source_ref: r.id,
          quote: r.message,
        });
      }
    } catch (_) { /* table may not exist */ }

    // 3) Weight wins: ≥1.5kg lost over last 7 days.
    const { data: latest } = await admin
      .from("measurements")
      .select("user_id, weight_kg, measured_at")
      .gte("measured_at", sevenDaysAgo)
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false });
    const byUser = new Map<string, Array<{ weight_kg: number; measured_at: string }>>();
    for (const m of latest ?? []) {
      if (m.weight_kg == null) continue;
      const arr = byUser.get(m.user_id) ?? [];
      arr.push({ weight_kg: Number(m.weight_kg), measured_at: m.measured_at });
      byUser.set(m.user_id, arr);
    }
    for (const [user_id, rows] of byUser) {
      if (rows.length < 2) continue;
      const newest = rows[0].weight_kg;
      const oldest = rows[rows.length - 1].weight_kg;
      const delta = oldest - newest;
      if (delta >= 1.5) {
        await upsertCandidate({
          user_id,
          source: "measurement",
          source_ref: null,
          quote: null,
          quantitative: { weight_lost_kg: Number(delta.toFixed(2)), span_days: 7 },
        });
      }
    }

    // 4) Concierge chat wins.
    try {
      const { data: chats } = await admin
        .from("concierge_chat_history")
        .select("id, user_id, content, role, created_at")
        .eq("role", "user")
        .gte("created_at", sevenDaysAgo);
      for (const c of chats ?? []) {
        if (looksLikeWin(c.content ?? "")) {
          await upsertCandidate({
            user_id: c.user_id,
            source: "chat",
            source_ref: c.id,
            quote: (c.content as string).slice(0, 500),
          });
        }
      }
    } catch (_) { /* table name may differ */ }

    log("done", { inserted: inserted.length });
    return new Response(JSON.stringify({ ok: true, inserted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "detection failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
