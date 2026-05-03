import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// One-shot: takes an email, finds the profile, marks the user as having
// signed policy v3.0 and completed an intake form with realistic test data.
// Lets us bypass the policy + intake gates programmatically for smoke
// testing the personalization flow without a manual UI walkthrough.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POLICY_VERSION = "3.0";

const TEST_INTAKE = {
  weight_kg: 92.0,
  target_weight_kg: 84.0,
  activity_level: "moderate",
  primary_goal: "weight_loss",
  primary_goal_detail: "Θέλω να χάσω 8kg μέχρι τον Αύγουστο για τις διακοπές. Έχω δοκιμάσει πολλά πράγματα αλλά δεν μένω σταθερός πάνω από 3 εβδομάδες.",
  biggest_struggle: "Λιγουρεύομαι ζάχαρη και υδατάνθρακες κάθε βράδυ μετά τις 9. Τότε σπάνε όλες οι ημέρες προσπάθειας μου.",
  past_diet_attempts: "Keto 2 φορές, διαλειμματική νηστεία, μετρημένες θερμίδες. Τα δύο πρώτα δούλεψαν για λίγο.",
  favorite_meats: ["βοδινό", "αρνί", "κοτόπουλο"],
  disliked_foods: ["πατσά", "συκώτι"],
  eats_eggs: false,
  eats_dairy: true,
  eats_organs: false,
  cooking_skill: "basic",
  allergies: ["αυγά"],
  medical_conditions: "Καμία διαγνωσμένη.",
  medications: "Καμία.",
  pregnant_or_breastfeeding: false,
  typical_schedule: "Δουλειά 9-17, γυμναστήριο 3 φορές την εβδομάδα τα απογεύματα.",
  social_eating_situations: "Οικογενειακά γεύματα Κυριακή, σπίτι φίλων Σάββατο.",
  alcohol_frequency: "weekly",
  sleep_hours: 6.5,
  stress_level: 7,
  why_now: "Θέλω να φύγω από τον φαύλο κύκλο 'ξεκινάω-σταματάω' και αυτή τη φορά να μείνω σταθερός.",
  biggest_fear: "Φοβάμαι ότι σε γάμους και βαπτίσεις δεν θα μπορώ να κρατηθώ και θα τα χαλάσω όλα.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    let email = "";
    try {
      const body = await req.json();
      email = (body?.email ?? "").trim().toLowerCase();
    } catch { /* empty body */ }
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, display_name")
      .eq("email", email)
      .maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: `no profile for ${email}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = (profile as { id: string }).id;

    // Sign policy v3.0 (idempotent — skip if already signed at this version)
    const { data: existing } = await admin
      .from("policy_signatures")
      .select("id")
      .eq("user_id", userId)
      .eq("policy_version", POLICY_VERSION)
      .maybeSingle();
    let signedNow = false;
    if (!existing) {
      await admin.from("policy_signatures").insert({
        user_id: userId,
        policy_version: POLICY_VERSION,
        full_name: (profile as { display_name?: string }).display_name ?? "Test Adamantashop",
        signature_url: "test-seed/synthetic.png",
      });
      signedNow = true;
    }

    // Upsert intake with test data, completed_at = now
    await admin.from("member_intakes").upsert(
      {
        user_id: userId,
        completed_at: new Date().toISOString(),
        ...TEST_INTAKE,
        raw_payload: { source: "seed-test-member", note: "synthetic for smoke test" },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return new Response(JSON.stringify({
      ok: true,
      user_id: userId,
      email,
      policy_signed: { version: POLICY_VERSION, freshly_signed: signedNow },
      intake_seeded: true,
      next: "navigate to /home → Day 1 card visible, Σύμβουλος has full member_context",
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "seed failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
