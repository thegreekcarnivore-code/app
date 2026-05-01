import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PUSH-TO-REELS] ${step}${tail}`);
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
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { candidate_id } = await req.json();
    if (!candidate_id) {
      return new Response(JSON.stringify({ error: "candidate_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: candidate } = await admin
      .from("testimonial_candidates")
      .select("*")
      .eq("id", candidate_id)
      .maybeSingle();
    if (!candidate) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // HARD GATE: never push without explicit consent.
    if (candidate.consent_status !== "granted" || !candidate.consent_granted_at) {
      return new Response(JSON.stringify({
        error: "Consent not granted — cannot push to reels app.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!candidate.screenshot_url) {
      return new Response(JSON.stringify({
        error: "No screenshot rendered yet — render card first.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ingestUrl = Deno.env.get("REELS_APP_INGEST_URL");
    const apiKey = Deno.env.get("REELS_APP_API_KEY");
    if (!ingestUrl || !apiKey) {
      return new Response(JSON.stringify({
        error: "REELS_APP_INGEST_URL or REELS_APP_API_KEY not configured",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = {
      brand: "the_greek_carnivore",
      kind: "testimonial",
      asset_url: candidate.screenshot_url,
      quote: candidate.quote,
      quantitative: candidate.quantitative,
      photo_before_url: candidate.photo_before_url,
      photo_after_url: candidate.photo_after_url,
      attribution_anonymous: !!candidate.consent_anonymous,
      source: candidate.source,
      detected_at: candidate.detected_at,
    };

    const resp = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const t = await resp.text();
      log("reels app rejected", { status: resp.status, body: t.slice(0, 300) });
      return new Response(JSON.stringify({ error: `Reels app: ${resp.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const json = await resp.json().catch(() => ({}));
    const reelsAssetId = json?.asset_id ?? json?.id ?? null;

    await admin
      .from("testimonial_candidates")
      .update({
        pushed_to_reels_app_at: new Date().toISOString(),
        reels_app_asset_id: reelsAssetId,
        admin_status: "shipped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidate.id);

    return new Response(JSON.stringify({ ok: true, reels_app_asset_id: reelsAssetId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "push failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
