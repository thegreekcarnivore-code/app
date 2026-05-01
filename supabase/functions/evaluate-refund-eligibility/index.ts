import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_GUARANTEE_DAYS = 60;
const DEFAULT_COMPLIANCE_THRESHOLD = 0.80;
const DEFAULT_WEIGHT_LOSS_THRESHOLD_KG = 0;

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[EVALUATE-REFUND-ELIGIBILITY] ${step}${tail}`);
};

interface AuthResult {
  callerId: string;
  isAdmin: boolean;
}

async function authenticate(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("UNAUTHORIZED");
  const callerId = data.claims.sub as string;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  return { callerId, isAdmin: Boolean(roleRow) };
}

async function loadGuaranteeDays(admin: SupabaseClient): Promise<number> {
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "metamorphosis_guarantee_days")
    .maybeSingle();
  const v = data?.value;
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  if (v && typeof v === "object" && typeof (v as { value?: number }).value === "number") {
    return (v as { value: number }).value;
  }
  return DEFAULT_GUARANTEE_DAYS;
}

async function resolveMetamorphosisTemplateId(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "metamorphosis_program_template_id")
    .maybeSingle();
  const raw = data?.value;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && typeof (raw as { value?: string }).value === "string") {
    return (raw as { value: string }).value;
  }
  return null;
}

async function findEnrollment(admin: SupabaseClient, userId: string) {
  const templateId = await resolveMetamorphosisTemplateId(admin);
  let query = admin
    .from("client_program_enrollments")
    .select("id, start_date, status, program_template_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (templateId) query = query.eq("program_template_id", templateId);
  const { data } = await query.limit(1).maybeSingle();
  return data;
}

interface ComplianceResult {
  daily_checkin_rate: number;
  weighed_in_count: number;
  meal_plan_engaged: boolean;
  book_chapters_read: number;
  meals_logged_total: number;
  weight_loss_kg: number | null;
  start_weight_kg: number | null;
  latest_weight_kg: number | null;
  compliance_score: number;
  reasons_against: string[];
}

async function computeCompliance(
  admin: SupabaseClient,
  userId: string,
  startDate: string,
  windowDays: number,
): Promise<ComplianceResult> {
  const start = new Date(startDate + "T00:00:00Z");
  const startIso = start.toISOString();
  const today = new Date();
  const elapsedDays = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (24 * 3600 * 1000)));
  const considerDays = Math.min(elapsedDays, windowDays);

  const [journalRes, measurementsRes, mealPlansRes, bookProgressRes] = await Promise.all([
    admin
      .from("food_journal")
      .select("entry_date")
      .eq("user_id", userId)
      .gte("entry_date", startDate),
    admin
      .from("measurements")
      .select("weight_kg, measured_at")
      .eq("user_id", userId)
      .gte("measured_at", startIso)
      .order("measured_at", { ascending: true }),
    admin
      .from("meal_plans")
      .select("id, week_start, generated_at")
      .eq("user_id", userId)
      .gte("week_start", startDate),
    admin
      .from("book_progress")
      .select("chapter_id, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);

  const journalEntries = journalRes.data ?? [];
  const distinctDays = new Set<string>();
  for (const row of journalEntries) {
    if ((row as { entry_date: string }).entry_date) distinctDays.add((row as { entry_date: string }).entry_date);
  }
  const daily_checkin_rate = considerDays === 0 ? 0 : Number((distinctDays.size / considerDays).toFixed(2));

  const measurements = (measurementsRes.data ?? []).filter((r): r is { weight_kg: number; measured_at: string } => Boolean((r as { weight_kg?: number }).weight_kg));
  const weighed_in_count = measurements.length;
  let weight_loss_kg: number | null = null;
  let start_weight_kg: number | null = null;
  let latest_weight_kg: number | null = null;
  if (measurements.length >= 2) {
    start_weight_kg = measurements[0].weight_kg;
    latest_weight_kg = measurements[measurements.length - 1].weight_kg;
    weight_loss_kg = Number((start_weight_kg - latest_weight_kg).toFixed(2));
  } else if (measurements.length === 1) {
    start_weight_kg = measurements[0].weight_kg;
    latest_weight_kg = measurements[0].weight_kg;
    weight_loss_kg = 0;
  }

  const meal_plan_engaged = (mealPlansRes.data ?? []).length >= 2;
  const book_chapters_read = bookProgressRes.error ? 0 : (bookProgressRes.data ?? []).length;

  const reasons_against: string[] = [];
  if (daily_checkin_rate < DEFAULT_COMPLIANCE_THRESHOLD) {
    reasons_against.push(`Daily check-ins below threshold: ${(daily_checkin_rate * 100).toFixed(0)}% < ${(DEFAULT_COMPLIANCE_THRESHOLD * 100).toFixed(0)}%`);
  }
  if (weighed_in_count < Math.max(2, Math.floor(considerDays / 14))) {
    reasons_against.push(`Insufficient weigh-ins: ${weighed_in_count}`);
  }
  if (!meal_plan_engaged) reasons_against.push("No meal plan engagement");

  // Composite compliance score: 60% check-ins, 25% weigh-ins, 15% meal-plan engagement
  const weighInScore = Math.min(1, weighed_in_count / Math.max(1, Math.floor(considerDays / 7)));
  const compliance_score = Number(
    (0.6 * daily_checkin_rate + 0.25 * weighInScore + 0.15 * (meal_plan_engaged ? 1 : 0)).toFixed(2),
  );

  return {
    daily_checkin_rate,
    weighed_in_count,
    meal_plan_engaged,
    book_chapters_read,
    meals_logged_total: journalEntries.length,
    weight_loss_kg,
    start_weight_kg,
    latest_weight_kg,
    compliance_score,
    reasons_against,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let auth: AuthResult;
  try {
    auth = await authenticate(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unauthorized";
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetUserId = (body?.user_id as string) ?? auth.callerId;
    const persist = Boolean(body?.persist ?? auth.isAdmin);

    if (targetUserId !== auth.callerId && !auth.isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const guaranteeDays = await loadGuaranteeDays(admin);
    const enrollment = await findEnrollment(admin, targetUserId);

    if (!enrollment) {
      return new Response(
        JSON.stringify({
          ok: true,
          eligible: false,
          reasons: ["No active Metamorphosis enrollment found"],
          guarantee_days: guaranteeDays,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const startDate = (enrollment as { start_date: string }).start_date;
    const startMs = new Date(startDate + "T00:00:00Z").getTime();
    const days_since_start = Math.floor((Date.now() - startMs) / (24 * 3600 * 1000));

    const compliance = await computeCompliance(admin, targetUserId, startDate, guaranteeDays);

    const reasons: string[] = [];
    if (days_since_start < guaranteeDays) {
      reasons.push(`Guarantee window not yet elapsed (${days_since_start}/${guaranteeDays} days)`);
    }
    if (compliance.compliance_score < DEFAULT_COMPLIANCE_THRESHOLD) {
      reasons.push(`Compliance below threshold (${compliance.compliance_score} < ${DEFAULT_COMPLIANCE_THRESHOLD})`);
      reasons.push(...compliance.reasons_against);
    }
    const lostWeight = compliance.weight_loss_kg !== null && compliance.weight_loss_kg > DEFAULT_WEIGHT_LOSS_THRESHOLD_KG;
    if (lostWeight) {
      reasons.push(`Weight loss recorded (${compliance.weight_loss_kg} kg) — guarantee disqualifies`);
    }
    if (compliance.weight_loss_kg === null) {
      reasons.push("Insufficient weight data to evaluate result");
    }

    // Eligible iff: window elapsed AND compliance met AND no weight loss
    const eligible =
      days_since_start >= guaranteeDays &&
      compliance.compliance_score >= DEFAULT_COMPLIANCE_THRESHOLD &&
      compliance.weight_loss_kg !== null &&
      !lostWeight;

    let evaluationId: string | null = null;
    if (persist) {
      const { data: row, error: insertErr } = await admin
        .from("refund_eligibility_evaluations")
        .insert({
          user_id: targetUserId,
          enrollment_id: (enrollment as { id: string }).id,
          evaluated_by: auth.isAdmin ? auth.callerId : null,
          guarantee_window_days: guaranteeDays,
          enrollment_start_date: startDate,
          days_since_start,
          weight_loss_kg: compliance.weight_loss_kg,
          compliance_score: compliance.compliance_score,
          compliance_threshold: DEFAULT_COMPLIANCE_THRESHOLD,
          weight_loss_threshold_kg: DEFAULT_WEIGHT_LOSS_THRESHOLD_KG,
          eligible,
          reasons,
          signals: compliance,
          refund_status: eligible ? "approved" : "declined",
        })
        .select("id")
        .single();
      if (insertErr) {
        log("persist failed", { message: insertErr.message });
      } else {
        evaluationId = row?.id ?? null;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        eligible,
        evaluation_id: evaluationId,
        guarantee_days: guaranteeDays,
        days_since_start,
        weight_loss_kg: compliance.weight_loss_kg,
        compliance_score: compliance.compliance_score,
        compliance_threshold: DEFAULT_COMPLIANCE_THRESHOLD,
        signals: compliance,
        reasons,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    log("ERROR", { message: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "evaluation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
