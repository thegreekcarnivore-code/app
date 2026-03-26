import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function logApiUsage(userId: string, functionName: string, service: string, model: string, cost: number, callCount: number = 1) {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await sb.rpc("log_api_usage", {
      _user_id: userId,
      _function_name: functionName,
      _service: service,
      _model: model,
      _estimated_cost: cost,
      _call_count: callCount,
    });
  } catch (e) { console.error("Failed to log API usage:", e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { address } = await req.json();
    if (!address || typeof address !== "string" || address.length > 300) {
      return new Response(JSON.stringify({ error: "Invalid address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY not configured");

    const normalizedAddress = address.trim();
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(normalizedAddress)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(geocodeUrl);
    if (!response.ok) throw new Error("Geocoding API error");

    let result: any = null;
    let usedFallback = false;

    const data = await response.json();
    if (data.status === "OK" && data.results?.length) {
      result = data.results[0];
      logApiUsage(userId, "geocode", "google_maps", "geocoding", 0.0005);
    } else {
      // Fallback to Places Text Search because some Google API keys allow Places
      // while the Geocoding API itself is restricted or disabled.
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(normalizedAddress)}&key=${GOOGLE_MAPS_API_KEY}`;
      const placesResponse = await fetch(placesUrl);
      if (!placesResponse.ok) throw new Error("Places text search error");
      const placesData = await placesResponse.json();
      if (placesData.status === "OK" && placesData.results?.length) {
        const place = placesData.results[0];
        result = {
          geometry: place.geometry,
          formatted_address: place.formatted_address || place.name,
        };
        usedFallback = true;
        logApiUsage(userId, "geocode", "google_maps", "places_text_search", 0.0032);
      }
    }

    if (!result?.geometry?.location) {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(normalizedAddress)}`;
      const nominatimResponse = await fetch(nominatimUrl, {
        headers: {
          "User-Agent": "TheGreekCarnivore/1.0 (info@thegreekcarnivore.com)",
          "Accept-Language": "en",
        },
      });
      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json();
        if (Array.isArray(nominatimData) && nominatimData.length > 0) {
          const place = nominatimData[0];
          result = {
            geometry: {
              location: {
                lat: Number(place.lat),
                lng: Number(place.lon),
              },
            },
            formatted_address: place.display_name || normalizedAddress,
          };
          usedFallback = true;
          logApiUsage(userId, "geocode", "openstreetmap", "nominatim", 0);
        }
      }
    }

    if (!result?.geometry?.location) {
      return new Response(JSON.stringify({ error: "Location not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (usedFallback) {
      console.log("geocode: resolved via Places Text Search fallback");
    }

    return new Response(JSON.stringify({
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("geocode error:", e);
    return new Response(JSON.stringify({ error: "Geocoding failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
