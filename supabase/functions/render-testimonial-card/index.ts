import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RENDER-TESTIMONIAL-CARD] ${step}${tail}`);
};

// Renders a 1080x1920 SVG testimonial card and uploads it to the
// `testimonial-cards` bucket. SVG is sufficient for v1 — the reels
// app can either consume SVG directly or rasterize on its side.
const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;")
   .replace(/'/g, "&apos;");

const wrapText = (text: string, maxChars = 28) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line ? line + " " : "") + w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 8);
};

const buildSvg = ({
  quote,
  statBadge,
  attribution,
}: {
  quote: string;
  statBadge?: string | null;
  attribution: string;
}) => {
  const lines = wrapText(quote, 26);
  const lineHeight = 88;
  const startY = 700;
  const tspans = lines
    .map((l, i) => `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(l)}</tspan>`)
    .join("");
  const stat = statBadge
    ? `<g>
         <rect x="290" y="1380" width="500" height="120" rx="60" fill="#D4AF37"/>
         <text x="540" y="1460" text-anchor="middle" font-family="Inter, sans-serif" font-size="56" font-weight="700" fill="#0a0a0a">${escapeXml(statBadge)}</text>
       </g>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#1a1410"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <text x="540" y="280" text-anchor="middle" font-family="Inter, sans-serif" font-size="38" font-weight="600" fill="#D4AF37" letter-spacing="6">ΜΕΤΑΜΟΡΦΩΣΗ</text>
  <text x="540" y="${startY}" text-anchor="middle" font-family="Inter, sans-serif" font-size="64" font-weight="500" fill="#f5f5f5">${tspans}</text>
  ${stat}
  <text x="540" y="1700" text-anchor="middle" font-family="Inter, sans-serif" font-size="36" fill="#999">— ${escapeXml(attribution)}</text>
  <text x="540" y="1820" text-anchor="middle" font-family="Inter, sans-serif" font-size="28" fill="#666">thegreekcarnivore.com</text>
</svg>`;
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
      .select("id, user_id, quote, quantitative, consent_anonymous")
      .eq("id", candidate_id)
      .maybeSingle();
    if (!candidate) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", candidate.user_id)
      .maybeSingle();

    const attribution = candidate.consent_anonymous
      ? "Μέλος της Μεταμόρφωσης"
      : (profile?.full_name?.split(" ")[0] ?? "Μέλος");

    const q = candidate.quantitative as Record<string, unknown> | null;
    const statBadge = q?.weight_lost_kg
      ? `−${q.weight_lost_kg}kg σε ${q.span_days ?? "?"} μέρες`
      : null;

    const svg = buildSvg({
      quote: candidate.quote ?? "Η Μεταμόρφωση μου άλλαξε τη ζωή.",
      statBadge,
      attribution,
    });
    const buf = new TextEncoder().encode(svg);
    const path = `${candidate.user_id}/${candidate.id}.svg`;

    const { error: uploadErr } = await admin.storage
      .from("testimonial-cards")
      .upload(path, buf, { contentType: "image/svg+xml", upsert: true });
    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = admin.storage.from("testimonial-cards").getPublicUrl(path);
    const url = pub.publicUrl;

    await admin
      .from("testimonial_candidates")
      .update({ screenshot_url: url, updated_at: new Date().toISOString() })
      .eq("id", candidate.id);

    return new Response(JSON.stringify({ ok: true, url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "render failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
