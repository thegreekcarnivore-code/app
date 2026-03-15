import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const ref = url.searchParams.get("ref");
    const maxwidth = url.searchParams.get("maxwidth") || "400";

    if (!ref || typeof ref !== "string" || ref.length > 2000) {
      return new Response("Invalid photo reference", { status: 400, headers: corsHeaders });
    }

    // Validate maxwidth is a reasonable number
    const maxwidthNum = parseInt(maxwidth, 10);
    if (isNaN(maxwidthNum) || maxwidthNum < 1 || maxwidthNum > 1600) {
      return new Response("Invalid maxwidth", { status: 400, headers: corsHeaders });
    }

    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response("API key not configured", { status: 500, headers: corsHeaders });
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidthNum}&photo_reference=${encodeURIComponent(ref)}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(photoUrl, { redirect: "follow" });
    if (!response.ok) {
      return new Response("Photo not found", { status: 404, headers: corsHeaders });
    }

    const imageData = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.error("place-photo error:", e);
    return new Response("Error fetching photo", { status: 500, headers: corsHeaders });
  }
});
