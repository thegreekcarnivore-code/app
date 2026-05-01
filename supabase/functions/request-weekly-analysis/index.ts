import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[WEEKLY-ANALYSIS] ${step}${tail}`);
};

// Returns { iso_year, iso_week } for a given Date (Mon-Sun ISO weeks).
const isoWeek = (d: Date) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return { iso_year: date.getUTCFullYear(), iso_week: weekNo };
};

const nextMondayISO = (now: Date) => {
  const d = new Date(now);
  const dow = d.getUTCDay();
  const diff = (8 - dow) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const now = new Date();
    const { iso_year, iso_week } = isoWeek(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

    // Eligibility 1: not already generated this ISO week.
    const { data: existing } = await admin
      .from("weekly_reports")
      .select("id")
      .eq("user_id", user.id)
      .eq("iso_year", iso_year)
      .eq("iso_week", iso_week)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({
        ok: false,
        reason: "already_used_this_week",
        next_eligible_at: nextMondayISO(now),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Eligibility 2: at least one weight measurement in last 7 days.
    const { data: meas } = await admin
      .from("measurements")
      .select("id, weight_kg, measured_at, waist_cm, hip_cm")
      .eq("user_id", user.id)
      .gte("measured_at", sevenDaysAgo)
      .order("measured_at", { ascending: false });
    const hasWeight = (meas ?? []).some((m: { weight_kg: number | null }) => m.weight_kg != null);
    if (!hasWeight) {
      return new Response(JSON.stringify({
        ok: false,
        reason: "missing_measurements",
        next_eligible_at: nextMondayISO(now),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Eligibility 3: at least one progress photo in last 7 days.
    const { data: photos } = await admin
      .from("progress_photos")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo)
      .limit(1);
    if (!photos || photos.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        reason: "missing_photos",
        next_eligible_at: nextMondayISO(now),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pull supporting context.
    const [{ data: intake }, { data: journey }, { data: enrollment }] = await Promise.all([
      admin.from("member_intakes").select("*").eq("user_id", user.id).maybeSingle(),
      admin.from("member_journey_log").select("kind, summary, occurred_at").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(20),
      admin.from("client_program_enrollments").select("start_date").eq("user_id", user.id).order("start_date", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const baselineWeight = intake?.weight_kg ?? null;
    const latestWeight = (meas ?? [])[0]?.weight_kg ?? null;
    const weightDelta = baselineWeight != null && latestWeight != null
      ? Number((latestWeight - baselineWeight).toFixed(2))
      : null;

    const startDate = enrollment?.start_date ? new Date(enrollment.start_date) : null;
    const daysIn = startDate
      ? Math.floor((now.getTime() - startDate.getTime()) / 86400000)
      : null;

    const journeyLines = (journey ?? []).map((j: { kind: string; summary: string }) => `- (${j.kind}) ${j.summary}`).join("\n");

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Είσαι ο Σύμβουλος της Μεταμόρφωσης. Γράφεις σύντομη αλλά ουσιαστική εβδομαδιαία ανασκόπηση στα ελληνικά για τον/την χρήστη/τρια.

Δομή (Markdown):
## Νίκες της εβδομάδας
## Σήματα προσοχής
## Μία εστίαση για την επόμενη εβδομάδα
## Μία πρακτική σύσταση

Κανόνες:
- Συγκεκριμένος, με νούμερα όπου υπάρχουν.
- ΌΧΙ ιατρικές οδηγίες. ΌΧΙ φαρμακευτικές συστάσεις.
- ΌΧΙ προσωπική φωνή του Αλέξανδρου. Είσαι ο Σύμβουλος.
- 200-350 λέξεις σύνολο.`;

    const userPrompt = `Ημέρες στο πρόγραμμα: ${daysIn ?? "—"}
Βάρος εκκίνησης: ${baselineWeight ?? "—"} kg
Τρέχον βάρος: ${latestWeight ?? "—"} kg
Μεταβολή βάρους: ${weightDelta ?? "—"} kg
Στόχος: ${intake?.primary_goal_detail ?? intake?.primary_goal ?? "—"}
Βασική δυσκολία: ${intake?.biggest_struggle ?? "—"}
Μετρήσεις τελευταίων 7 ημερών: ${(meas ?? []).length}
Φωτογραφίες τελευταίων 7 ημερών: ${(photos ?? []).length}

Πρόσφατο ταξίδι (≤20 σημεία):
${journeyLines || "—"}

Γράψε την ανασκόπηση.`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      log("ai error", { status: aiResp.status, body: t.slice(0, 200) });
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiResp.json();
    const markdown: string = aiJson?.choices?.[0]?.message?.content ?? "";

    const summaryLine = markdown.split("\n").find((l) => l.trim().length > 30)?.trim().slice(0, 200) ?? null;

    const signals = {
      baseline_weight: baselineWeight,
      latest_weight: latestWeight,
      weight_delta_kg: weightDelta,
      measurements_count_7d: (meas ?? []).length,
      photos_count_7d: (photos ?? []).length,
      days_in_program: daysIn,
    };

    const { data: report, error: insertErr } = await admin
      .from("weekly_reports")
      .insert({
        user_id: user.id,
        iso_year, iso_week,
        markdown,
        summary_for_journey_log: summaryLine,
        signals,
      })
      .select("id, generated_at")
      .single();
    if (insertErr) {
      log("insert error", { msg: insertErr.message });
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("profiles")
      .update({ weekly_analysis_last_generated_at: new Date().toISOString() } as never)
      .eq("id", user.id);

    if (summaryLine) {
      await admin.from("member_journey_log").insert({
        user_id: user.id,
        kind: "observation",
        summary: summaryLine,
        source: "weekly_report",
        source_ref: report.id,
      });
    }

    return new Response(JSON.stringify({ ok: true, report_id: report.id, markdown, signals }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "weekly analysis failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
