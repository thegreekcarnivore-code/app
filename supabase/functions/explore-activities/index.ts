import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildActivityPriceTierInstruction(priceTier?: string): string {
  const FALLBACK = " If fewer than 3 places strictly match this price tier near an activity, include the closest alternatives by budget and proximity.";
  switch (priceTier) {
    case "cheapest":
    case "good_deal":
    case "affordable":
    case "value":
      return "The user selected AFFORDABLE — they want CHEAP food. Recommend ONLY the CHEAPEST nearby restaurants. Street food, hole-in-the-wall locals, no-frills family spots, tavernas, souvlaki shops. Google price_level 0-1 ONLY. Skip anything upscale or mid-range." + FALLBACK;
    case "fine_dining":
    case "high_end":
      return "Recommend UPSCALE, PREMIUM nearby restaurants. Google price_level 2-3. Chef-driven, refined ambiance, well-known establishments. Skip budget spots and ultra-luxury." + FALLBACK;
    case "exclusive":
    case "most_exclusive":
      return "Recommend ONLY the most PRESTIGIOUS, EXCLUSIVE, and EXPENSIVE nearby restaurants. Google price_level 3-4 ONLY. Michelin-starred, legendary, VIP-level. Skip anything not famous or expensive." + FALLBACK;
    default: return "Recommend a good balance of quality and price for nearby restaurants.";
  }
}

interface GooglePlace {
  name: string;
  vicinity: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  place_id: string;
  types?: string[];
  photos?: { photo_reference: string; height: number; width: number }[];
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function estimateDrivingTime(meters: number): string {
  const minutes = Math.max(1, Math.ceil(meters / 500));
  return `${minutes} min drive`;
}

// --- Place Details & AI Verification (same as recommend-restaurants) ---

interface PlaceDetails {
  weekday_text?: string[];
  open_now?: boolean;
  website?: string;
  business_status?: string;
}

// Age-related keywords for filtering venue website text (kid-friendly verification)
const AGE_KEYWORDS = new Set([
  "age","ages","years old","year old","ans","année","años","anni","jahre","ετών","ηλικία",
  "children","child","kids","kid","enfant","enfants","niños","bambini","kinder","παιδιά","παιδί",
  "minimum","min age","minimum age","âge minimum","edad mínima","età minima","mindestalter","ελάχιστη ηλικία",
  "height","taille","altura","altezza","größe","höhe","ύψος",
  "restriction","restrictions","restricted","interdit","prohibido","vietato","verboten","απαγορεύεται",
  "family","families","famille","familia","famiglia","familien","οικογένεια","οικογένειες",
  "toddler","toddlers","infant","infants","baby","babies","bébé","bebé","neonato","säugling","μωρό","βρέφος",
  "stroller","poussette","cochecito","passeggino","kinderwagen","καρότσι",
  "suitable","not suitable","unsuitable","appropriate","not appropriate","recommended for",
  "under 3","under 4","under 5","under 6","under 7","under 8","under 10","under 12",
  "years and older","years and above","from 3","from 4","from 5","from 6","from 8","from 10","from 12",
  "accompanied","accompagné","acompañado","accompagnato","begleitet","συνοδεία",
]);

/**
 * Extract only age-relevant sections from venue website text.
 * Returns filtered text with only sections mentioning age/children/restrictions.
 */
function extractAgeRelevantSections(text: string): string {
  if (text.length < 200) return text;
  
  // Split by paragraphs/sections
  const sections = text.split(/\n\n+|\.\s+(?=[A-Z\u0370-\u03FF])/);
  const relevant: string[] = [];
  
  for (const section of sections) {
    if (!section.trim()) continue;
    const lower = section.toLowerCase();
    for (const kw of AGE_KEYWORDS) {
      if (lower.includes(kw)) {
        relevant.push(section.trim());
        break;
      }
    }
  }
  
  const filtered = relevant.join("\n\n").trim();
  return filtered.length > 50 ? filtered : text.slice(0, 1500); // Fallback to truncated original
}

async function fetchWebsiteText(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MenuBot/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return "";
    const html = await res.text();

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    return text;
  } catch {
    return "";
  }
}

async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetails | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=opening_hours,website,business_status&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK") return null;
    return {
      weekday_text: data.result?.opening_hours?.weekday_text,
      open_now: data.result?.opening_hours?.open_now,
      website: data.result?.website,
      business_status: data.result?.business_status,
    };
  } catch {
    return null;
  }
}

async function verifyUnknownPlacesWithAI(
  unverifiedPlaces: GooglePlace[],
  apiKey: string
): Promise<Set<string>> {
  const toExclude = new Set<string>();
  if (unverifiedPlaces.length === 0) return toExclude;

  console.log(`AI verification: checking ${unverifiedPlaces.length} unverified restaurant places`);

  const numberedList = unverifiedPlaces.map((p, i) =>
    `${i + 1}. "${p.name}" — ${p.vicinity}`
  ).join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Classify each restaurant's operational status. Use the provided tool." },
          { role: "user", content: `Status check:\n\n${numberedList}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "verify_restaurants",
            description: "Operational status of each restaurant",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number" },
                      status: { type: "string", enum: ["open", "temporarily_closed", "permanently_closed", "under_renovation", "unknown"] },
                      reason: { type: "string" },
                    },
                    required: ["index", "status", "reason"],
                  },
                },
              },
              required: ["results"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "verify_restaurants" } },
      }),
    });

    if (!response.ok) return toExclude;

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return toExclude;

    const parsed = JSON.parse(toolCall.function.arguments);
    if (parsed.results) {
      for (const r of parsed.results) {
        if (r.status !== "open" && r.status !== "unknown") {
          const place = unverifiedPlaces[r.index - 1];
          if (place) {
            console.log(`AI verification: excluding restaurant "${place.name}" — ${r.status}: ${r.reason}`);
            toExclude.add(place.place_id);
          }
        }
      }
    }
  } catch (e) {
    console.error("AI verification error:", e);
  }

  return toExclude;
}

async function verifyAndFilterRestaurants(
  restaurants: GooglePlace[],
  apiKey: string,
  openaiKey: string
): Promise<GooglePlace[]> {
  if (restaurants.length === 0) return [];

  // Fetch Place Details for top candidates
  const topRestaurants = restaurants.slice(0, 10);
  const detailsEntries = await Promise.all(
    topRestaurants.map(async (p) => {
      const details = await fetchPlaceDetails(p.place_id, apiKey);
      return [p.place_id, details] as const;
    })
  );
  const detailsMap = new Map<string, PlaceDetails>();
  for (const [id, details] of detailsEntries) {
    if (details) detailsMap.set(id, details);
  }

  // Filter out closed businesses
  let filtered = topRestaurants.filter((p) => {
    const details = detailsMap.get(p.place_id);
    if (details?.business_status === "CLOSED_TEMPORARILY" || details?.business_status === "CLOSED_PERMANENTLY") {
      console.log(`Explore: filtered restaurant "${p.name}": ${details.business_status}`);
      return false;
    }
    if (details?.open_now === false) {
      console.log(`Explore: filtered restaurant "${p.name}": currently closed`);
      return false;
    }
    return true;
  });

  // AI verification for unverified ones
  const unverified = filtered.filter(p => !detailsMap.has(p.place_id));
  if (unverified.length > 0) {
    const excludeIds = await verifyUnknownPlacesWithAI(unverified, openaiKey);
    if (excludeIds.size > 0) {
      filtered = filtered.filter(p => !excludeIds.has(p.place_id));
    }
  }

  return filtered;
}

// --- End Place Details & AI Verification ---

interface WeatherDay {
  date: string;
  tempMin: number;
  tempMax: number;
  weatherCode: number;
  precipitationSum: number;
  windSpeedMax: number;
}

const WMO_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Light freezing drizzle", 57: "Dense freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Light freezing rain", 67: "Heavy freezing rain",
  71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
  77: "Snow grains", 80: "Slight rain showers", 81: "Moderate rain showers",
  82: "Violent rain showers", 85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

async function fetchWeather(lat: number, lng: number, dateFrom: string, dateTo: string): Promise<{ days: WeatherDay[]; summary: string }> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const endDate = dateTo || dateFrom;
    const maxForecastDate = new Date();
    maxForecastDate.setDate(maxForecastDate.getDate() + 15);
    const maxForecast = maxForecastDate.toISOString().split("T")[0];
    const canForecast = dateFrom <= maxForecast;
    let days: WeatherDay[] = [];
    
    if (canForecast) {
      const forecastEnd = endDate <= maxForecast ? endDate : maxForecast;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&start_date=${dateFrom}&end_date=${forecastEnd}&timezone=auto`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const d = data.daily;
        if (d?.time) {
          days = d.time.map((t: string, i: number) => ({
            date: t, tempMin: d.temperature_2m_min[i], tempMax: d.temperature_2m_max[i],
            weatherCode: d.weather_code[i], precipitationSum: d.precipitation_sum[i], windSpeedMax: d.wind_speed_10m_max[i],
          }));
        }
      }
    }
    
    if (days.length === 0) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const c = data.current;
        if (c) {
          return { days: [], summary: `Weather data unavailable for selected dates. Current: ${WMO_CODES[c.weather_code] || "Unknown"}, ${c.temperature_2m}°C, wind ${c.wind_speed_10m} km/h. Recommend weather-safe activities.` };
        }
      }
      return { days: [], summary: "Weather data unavailable. Recommend weather-safe activities by default." };
    }
    
    const lines = days.map(d => `${d.date}: ${WMO_CODES[d.weatherCode] || "Unknown"}, ${d.tempMin}–${d.tempMax}°C, precip ${d.precipitationSum}mm, wind ${d.windSpeedMax} km/h`);
    const hasRain = days.some(d => d.precipitationSum > 2);
    const hasSnow = days.some(d => [71,73,75,77,85,86].includes(d.weatherCode));
    const hasStorm = days.some(d => [95,96,99].includes(d.weatherCode));
    const isHot = days.some(d => d.tempMax > 35);
    const isCold = days.some(d => d.tempMax < 5);
    const isWindy = days.some(d => d.windSpeedMax > 50);
    let advisory = "";
    if (hasStorm) advisory += " ⚠️ Thunderstorms — avoid exposed outdoor activities.";
    if (hasSnow) advisory += " ❄️ Snowfall — avoid beach/water activities.";
    if (hasRain) advisory += " 🌧️ Rain — prioritize indoor/covered activities on rainy days.";
    if (isHot) advisory += " 🔥 Extreme heat — avoid strenuous midday outdoor.";
    if (isCold) advisory += " 🥶 Very cold — prioritize indoor/warm activities.";
    if (isWindy) advisory += " 💨 Strong winds — avoid water sports/exposed heights.";
    return { days, summary: `WEATHER FORECAST:\n${lines.join("\n")}${advisory ? "\n\nWEATHER ADVISORY:" + advisory : ""}` };
  } catch (e) {
    console.error("Weather fetch error:", e);
    return { days: [], summary: "Weather data unavailable. Recommend weather-safe activities by default." };
  }
}

async function fetchNearbyPlaces(
  lat: number, lng: number, radius: number, apiKey: string, type: string, keyword?: string
): Promise<GooglePlace[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("type", type);
  url.searchParams.set("key", apiKey);
  if (keyword) url.searchParams.set("keyword", keyword);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("Google Places API error");
  const data = await response.json();
  return (data.results || []) as GooglePlace[];
}

const CATEGORY_TO_SEARCH: Record<string, { type: string; keyword?: string }[]> = {
  sightseeing: [{ type: "tourist_attraction" }, { type: "point_of_interest", keyword: "landmark" }],
  kidFriendly: [{ type: "amusement_park" }, { type: "zoo" }, { type: "aquarium" }],
  relaxing: [{ type: "spa" }, { type: "park" }],
  museum: [{ type: "museum" }, { type: "art_gallery" }],
  forADate: [{ type: "bar", keyword: "romantic" }, { type: "night_club" }],
  science: [{ type: "museum", keyword: "science" }],
  adventure: [{ type: "tourist_attraction", keyword: "outdoor nature" }, { type: "park", keyword: "hiking trail" }, { type: "tourist_attraction", keyword: "cycling tour" }],
  extremeAdventure: [{ type: "tourist_attraction", keyword: "extreme adventure" }, { type: "stadium", keyword: "extreme sport" }, { type: "tourist_attraction", keyword: "skydiving paragliding" }],
  nightlife: [{ type: "night_club" }, { type: "bar" }],
  comedy: [{ type: "establishment", keyword: "comedy show" }],
  musicCategory: [{ type: "establishment", keyword: "concert live music" }],
  opera: [{ type: "establishment", keyword: "opera theater" }],
  businessEvents: [{ type: "establishment", keyword: "conference business event" }],
};

function getKidFriendlySearches(kidAges: string): { type: string; keyword?: string }[] {
  const ages = kidAges.split(/[,\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  if (ages.length === 0) return CATEGORY_TO_SEARCH.kidFriendly;

  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const searches: { type: string; keyword?: string }[] = [{ type: "zoo" }, { type: "aquarium" }];

  if (minAge <= 3) {
    searches.push({ type: "park", keyword: "playground" });
    // Skip amusement_park for toddlers (height limits)
  }
  if (minAge >= 4 && minAge <= 7 || (minAge <= 7 && maxAge >= 4)) {
    searches.push({ type: "park", keyword: "playground" });
    searches.push({ type: "amusement_park" });
  }
  if (maxAge >= 8 && maxAge <= 12 || (minAge <= 12 && maxAge >= 8)) {
    searches.push({ type: "bowling_alley" });
    searches.push({ type: "tourist_attraction", keyword: "adventure park" });
    if (minAge >= 8) searches.push({ type: "amusement_park" });
  }
  if (maxAge >= 13) {
    searches.push({ type: "tourist_attraction", keyword: "escape room" });
    searches.push({ type: "tourist_attraction", keyword: "go-kart" });
    searches.push({ type: "amusement_park" });
  }

  // Deduplicate
  const seen = new Set<string>();
  return searches.filter(s => {
    const key = `${s.type}|${s.keyword || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function trackUserActivity(userId: string) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.rpc("increment_user_activity", { _user_id: userId });
  } catch (e) {
    console.error("Failed to track user activity:", e);
  }
}

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
    // Auth
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
    // Track user activity (non-blocking)
    trackUserActivity(userId);

    const { latitude, longitude, categories, lang, dateFrom, dateTo, preferredLanguages, kidAges, priceTier, maxDistance, page = 1, previousNames = [] } = await req.json();
    const radiusMeters = Math.min(Math.max((maxDistance || 15) * 1000, 1000), 50000);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY not configured");

    // 1. Fetch places for all selected categories
    const searchPromises: Promise<GooglePlace[]>[] = [];
    for (const cat of (categories as string[])) {
      // Use age-adjusted searches for kidFriendly when kidAges is provided
      const searches = (cat === "kidFriendly" && kidAges)
        ? getKidFriendlySearches(kidAges)
        : (CATEGORY_TO_SEARCH[cat] || []);
      for (const s of searches) {
        searchPromises.push(fetchNearbyPlaces(latitude, longitude, radiusMeters, GOOGLE_MAPS_API_KEY, s.type, s.keyword));
      }
    }

    const allResults = await Promise.all(searchPromises);
    const seen = new Set<string>();
    const uniquePlaces: GooglePlace[] = [];
    for (const results of allResults) {
      for (const p of results) {
        if (!seen.has(p.place_id)) {
          seen.add(p.place_id);
          uniquePlaces.push(p);
        }
      }
    }

    uniquePlaces.sort((a, b) => {
      const scoreA = (a.rating ?? 0) * Math.log10(Math.max(a.user_ratings_total ?? 1, 1));
      const scoreB = (b.rating ?? 0) * Math.log10(Math.max(b.user_ratings_total ?? 1, 1));
      return scoreB - scoreA;
    });

    // Progressive fallback: ensure at least 3 activity candidates
    const MIN_ACTIVITY_CANDIDATES = 3;
    let topPlaces = uniquePlaces.filter(p => (p.rating ?? 0) >= 3.5 && (p.user_ratings_total ?? 0) >= 5).slice(0, 30);
    let activityRelaxLevel = 0;

    if (topPlaces.length < MIN_ACTIVITY_CANDIDATES) {
      activityRelaxLevel = 1;
      topPlaces = uniquePlaces.filter(p => (p.rating ?? 0) >= 3.0 && (p.user_ratings_total ?? 0) >= 3).slice(0, 30);
    }
    if (topPlaces.length < MIN_ACTIVITY_CANDIDATES) {
      activityRelaxLevel = 2;
      topPlaces = uniquePlaces.filter(p => (p.rating ?? 0) >= 2.5 && (p.user_ratings_total ?? 0) >= 1).slice(0, 30);
    }
    if (topPlaces.length < MIN_ACTIVITY_CANDIDATES) {
      activityRelaxLevel = 3;
      // Expand radius by 1.5x and re-fetch
      const expandedRadius = Math.min(radiusMeters * 1.5, 50000);
      console.log(`Activity fallback: expanding radius to ${expandedRadius}m`);
      const extraPromises: Promise<GooglePlace[]>[] = [];
      for (const cat of (categories as string[])) {
        const searches = (cat === "kidFriendly" && kidAges)
          ? getKidFriendlySearches(kidAges)
          : (CATEGORY_TO_SEARCH[cat] || []);
        for (const s of searches) {
          extraPromises.push(fetchNearbyPlaces(latitude, longitude, expandedRadius, GOOGLE_MAPS_API_KEY, s.type, s.keyword));
        }
      }
      const extraResults = await Promise.all(extraPromises);
      for (const results of extraResults) {
        for (const p of results) {
          if (!seen.has(p.place_id)) {
            seen.add(p.place_id);
            uniquePlaces.push(p);
          }
        }
      }
      uniquePlaces.sort((a, b) => {
        const scoreA = (a.rating ?? 0) * Math.log10(Math.max(a.user_ratings_total ?? 1, 1));
        const scoreB = (b.rating ?? 0) * Math.log10(Math.max(b.user_ratings_total ?? 1, 1));
        return scoreB - scoreA;
      });
      topPlaces = uniquePlaces.slice(0, 30);
    }
    if (topPlaces.length < MIN_ACTIVITY_CANDIDATES) {
      // Final fallback: take whatever we have
      topPlaces = uniquePlaces.slice(0, 30);
    }

    if (activityRelaxLevel > 0) {
      console.log(`Activity filter relaxation: level ${activityRelaxLevel}, ${topPlaces.length} candidates`);
    }
    console.log(`Found ${uniquePlaces.length} unique places, sending top ${topPlaces.length} to AI`);

    // Fetch weather data in parallel with restaurant lookups
    const weatherPromise = fetchWeather(latitude, longitude, dateFrom, dateTo);

    // 2. Fetch restaurants near the top activity locations (meat-focused + general)
    const activityLocations = topPlaces.slice(0, 10).map(p => p.geometry.location);
    const restaurantPromises = activityLocations.flatMap(loc => [
      fetchNearbyPlaces(loc.lat, loc.lng, 800, GOOGLE_MAPS_API_KEY, "restaurant", "steak grill meat"),
      fetchNearbyPlaces(loc.lat, loc.lng, 800, GOOGLE_MAPS_API_KEY, "restaurant"),
    ]);
    const rawRestaurantResults = await Promise.all(restaurantPromises);
    
    // Group into per-activity arrays and verify each group
    const nearbyRestaurantsPerActivity: GooglePlace[][] = [];
    for (let i = 0; i < activityLocations.length; i++) {
      const meatResults = rawRestaurantResults[i * 2];
      const generalResults = rawRestaurantResults[i * 2 + 1];
      const actSeen = new Set<string>();
      const merged: GooglePlace[] = [];
      for (const r of [...meatResults, ...generalResults]) {
        if (!actSeen.has(r.place_id)) {
          actSeen.add(r.place_id);
          merged.push(r);
        }
      }
      merged.sort((a, b) => {
        const sa = (a.rating ?? 0) * Math.log10(Math.max(a.user_ratings_total ?? 1, 1));
        const sb = (b.rating ?? 0) * Math.log10(Math.max(b.user_ratings_total ?? 1, 1));
        return sb - sa;
      });
      // Verify and filter restaurants (Place Details + AI verification)
      let verified = await verifyAndFilterRestaurants(merged, GOOGLE_MAPS_API_KEY, OPENAI_API_KEY);
      
      // Fallback: if too few restaurants survive verification, expand search radius
      if (verified.length < 2 && activityLocations[i]) {
        const loc = activityLocations[i];
        const [extraMeat, extraGeneral] = await Promise.all([
          fetchNearbyPlaces(loc.lat, loc.lng, 2000, GOOGLE_MAPS_API_KEY, "restaurant", "steak grill meat"),
          fetchNearbyPlaces(loc.lat, loc.lng, 2000, GOOGLE_MAPS_API_KEY, "restaurant"),
        ]);
        for (const r of [...extraMeat, ...extraGeneral]) {
          if (!actSeen.has(r.place_id)) {
            actSeen.add(r.place_id);
            merged.push(r);
          }
        }
        merged.sort((a, b) => {
          const sa = (a.rating ?? 0) * Math.log10(Math.max(a.user_ratings_total ?? 1, 1));
          const sb = (b.rating ?? 0) * Math.log10(Math.max(b.user_ratings_total ?? 1, 1));
          return sb - sa;
        });
        verified = await verifyAndFilterRestaurants(merged, GOOGLE_MAPS_API_KEY, OPENAI_API_KEY);
        if (verified.length > 0) console.log(`Restaurant fallback for activity ${i}: expanded to 2km, found ${verified.length}`);
      }
      nearbyRestaurantsPerActivity.push(verified);
    }

    const weather = await weatherPromise;

    // 3. Build prompt
    const placesText = topPlaces.map((p, i) => {
      const dist = haversineDistance(latitude, longitude, p.geometry.location.lat, p.geometry.location.lng);
      return `${i + 1}. "${p.name}" — ${p.vicinity} | Rating: ${p.rating ?? "N/A"}/5 (${p.user_ratings_total ?? 0} reviews) | Distance: ${formatDistance(dist)} | Place ID: ${p.place_id}`;
    }).join("\n");

    // Fetch website text for restaurant menu verification
    const restaurantDetailsMap = new Map<string, PlaceDetails>();
    const allVerifiedRestaurants: GooglePlace[] = [];
    for (const restaurants of nearbyRestaurantsPerActivity) {
      for (const r of restaurants) {
        if (!allVerifiedRestaurants.some(x => x.place_id === r.place_id)) {
          allVerifiedRestaurants.push(r);
        }
      }
    }
    // Fetch place details for restaurants to get website URLs
    const restDetailsEntries = await Promise.all(
      allVerifiedRestaurants.slice(0, 20).map(async (r) => {
        const details = await fetchPlaceDetails(r.place_id, GOOGLE_MAPS_API_KEY);
        return [r.place_id, details] as const;
      })
    );
    for (const [id, details] of restDetailsEntries) {
      if (details) restaurantDetailsMap.set(id, details);
    }
    
    // Scrape websites for menu content
    const restaurantWebsiteTexts = new Map<string, string>();
    await Promise.all(
      allVerifiedRestaurants.map(async (r) => {
        const details = restaurantDetailsMap.get(r.place_id);
        if (details?.website) {
          const text = await fetchWebsiteText(details.website);
          if (text.length > 100) restaurantWebsiteTexts.set(r.place_id, text);
        }
      })
    );
    console.log(`Website scraping: fetched content for ${restaurantWebsiteTexts.size} restaurants`);

    // Scrape venue websites for kid-friendly age verification
    const isKidFriendly = (categories as string[]).includes("kidFriendly");
    const activityWebsiteTexts = new Map<string, string>();
    if (isKidFriendly) {
      // Fetch place details for top activity venues to get website URLs
      const activityDetailsEntries = await Promise.all(
        topPlaces.slice(0, 15).map(async (p) => {
          const details = await fetchPlaceDetails(p.place_id, GOOGLE_MAPS_API_KEY);
          return [p.place_id, details] as const;
        })
      );
      // Scrape venue websites
      await Promise.all(
        activityDetailsEntries.map(async ([placeId, details]) => {
          if (details?.website) {
            const text = await fetchWebsiteText(details.website);
            if (text.length > 50) activityWebsiteTexts.set(placeId, text);
          }
        })
      );
      console.log(`Kid-friendly: scraped ${activityWebsiteTexts.size} activity venue websites for age verification`);
    }

    const restaurantsByActivity = nearbyRestaurantsPerActivity.map((restaurants, i) => {
      if (i >= topPlaces.length) return "";
      const activityLoc = topPlaces[i].geometry.location;
      return restaurants.slice(0, 5).map(r => {
        const dist = haversineDistance(activityLoc.lat, activityLoc.lng, r.geometry.location.lat, r.geometry.location.lng);
        const menuText = restaurantWebsiteTexts.get(r.place_id);
        const menuLine = menuText ? `\n   Menu/Website Content: ${menuText}` : "\n   Menu/Website Content: Not available";
        return `"${r.name}" — ${r.vicinity} | Rating: ${r.rating ?? "N/A"}/5 (${r.user_ratings_total ?? 0} reviews) | ${formatDistance(dist)} from activity${menuLine}`;
      }).join("\n");
    });

    const hasEvents = (categories as string[]).some(c => ["comedy", "musicCategory", "opera", "businessEvents"].includes(c));
    const eventNote = hasEvents
      ? `\nIMPORTANT: The user is also interested in LIVE EVENTS (${categories.filter((c: string) => ["comedy", "musicCategory", "opera", "businessEvents"].includes(c)).join(", ")}).
Search your knowledge for events happening in this city between ${dateFrom} and ${dateTo}.
${preferredLanguages ? `Preferred languages for shows: ${preferredLanguages}` : ""}
Mix live events with permanent attractions in your ranking. When an event's timing is uncertain, note it as "timing unconfirmed".`
      : "";

    const previousNote = previousNames.length > 0
      ? `\nDo NOT repeat these previously shown activities: ${previousNames.join(", ")}`
      : "";

    const langInstruction = lang === "el"
      ? `LANGUAGE RULES — CRITICAL:
- You MUST respond ENTIRELY in Greek (Ελληνικά). Every text field must be in Greek: shortDescription, fullStory, whyVisit, lowCarbTip, whyThisPlace, orderingPhrase, visitingHours descriptions.
- Activity/venue names: keep in their ORIGINAL form (Latin stays Latin, Greek stays Greek). Add the English name in parentheses if the original is Greek.
- Restaurant names: keep in original form as on Google Maps.
- Dish names: "dish"/"localName" = original menu language, "englishName" = English translation. In lowCarbTip, use the Greek translation of the dish.
- Location/address: keep original characters.
- Do NOT mix English into Greek text except for dish name translations in englishName.`
      : "Respond in English.";

    // Build kid-friendly age rules if applicable
    let kidAgePrompt = "";
    if (isKidFriendly && kidAges) {
      const venueWebsiteSection = topPlaces.slice(0, 15).map((p) => {
        const text = activityWebsiteTexts.get(p.place_id);
        if (!text) return null;
        const ageFiltered = extractAgeRelevantSections(text);
        return `"${p.name}":\n${ageFiltered.slice(0, 1500)}`;
      }).filter(Boolean).join("\n\n");

      kidAgePrompt = `
KID-FRIENDLY AGE RULES (CRITICAL):
The user has children aged: ${kidAges}.

VERIFICATION REQUIREMENTS:
- For EACH kid-friendly activity, you MUST check the venue's website content (provided below) and Google Places data for age restrictions, height requirements, and suitability.
- If the website mentions minimum age, height requirements, or "not suitable for children under X", RESPECT those limits.
- DO NOT recommend activities where ANY of the listed children would be excluded by age/height restrictions.

AGE-APPROPRIATE GUIDELINES:
- Toddlers (0-3): Stroller-accessible, gentle, short duration (under 2 hours). Good: playgrounds, petting zoos, aquariums, gentle boat rides, children's museums. Bad: roller coasters, long hikes, loud shows.
- Young kids (4-7): Interactive, hands-on, moderate duration. Good: zoos, water parks (with kids' areas), science museums, mini-golf. Bad: extreme rides, long cultural tours, late-night events.
- Older kids (8-12): More adventurous, educational. Good: adventure parks, escape rooms, kayaking, cycling tours, museums with interactive exhibits. Bad: activities with 12+ age minimums.
- Teens (13+): Engaging, not "babyish". Good: go-karts, surf lessons, climbing walls, escape rooms, VR experiences. Bad: toddler playgrounds, baby shows.

- If multiple ages listed, ONLY recommend activities suitable for ALL ages.
- In the shortDescription, mention the recommended age range.
- If an activity has a known minimum age/height, state it clearly.

VENUE WEBSITE CONTENT (for age verification):
${venueWebsiteSection || "No venue website content available — use your knowledge to assess age suitability."}
`;
    }

    const systemPrompt = `You are an expert city concierge and activities curator. You know everything about cities worldwide — landmarks, hidden gems, events, cultural happenings, and the best restaurants near them.

${langInstruction}

The user is located at GPS ${latitude}, ${longitude}, visiting from ${dateFrom} to ${dateTo}.
They are interested in: ${(categories as string[]).join(", ")}.
This is page ${page} of results.${previousNote}${eventNote}

${weather.summary}

WEATHER-AWARE ACTIVITY RULES:
- CRITICAL: You MUST check the weather forecast above before recommending ANY outdoor activity.
- If it's raining or storming on a specific day, do NOT recommend open-air activities for that day. Suggest indoor alternatives.
- If it's snowing, do NOT recommend swimming, water sports, or beach activities.
- If extreme heat (>35°C), avoid strenuous midday outdoor activities.
- If strong winds (>50 km/h), avoid water sports, sailing, paragliding.
- If clear and mild, prioritize outdoor activities.
- For each activity, briefly mention weather suitability.

CATEGORY DESCRIPTIONS:
- "adventure" = EASY/RELAXED activities: scenic hiking, nature walks, botanical gardens, cycling tours, calm kayaking, SUP, snorkeling, boat tours, walking tours, cooking classes, wine tastings.
- "extremeAdventure" = HIGH-ADRENALINE: skydiving, BASE jumping, paragliding, cliff jumping, mountaineering, ice climbing, big-wave surfing, Class V rafting, kitesurfing, cave diving, rally racing.
${kidAgePrompt}
VERIFIED PLACES FROM GOOGLE:
${placesText}

NEARBY RESTAURANTS FOR TOP ACTIVITIES (sorted by rating, VERIFIED — closed businesses filtered out):
${topPlaces.slice(0, 10).map((p, i) => `\nNear "${p.name}":\n${restaurantsByActivity[i] || "No restaurants found nearby"}`).join("\n")}

PRICE TIER FOR NEARBY RESTAURANTS: ${buildActivityPriceTierInstruction(priceTier)}
When recommending nearby restaurants for each activity, respect this price tier strictly. If no restaurants in this tier exist near an activity, pick the closest match by budget and distance, and note 'Closest match — [actual tier]' in the whyThisPlace field.

DIETARY PHILOSOPHY (for restaurant recs):
Meat-based, high-protein, low-carb lifestyle (don't say "keto"/"carnivore"). Prioritize steakhouses, grills, seafood, BBQ. Best dishes: grilled meats, steaks, lamb, whole fish, roasted chicken. Avoid recommending pasta, bread, rice, pizza, desserts. For every meal option, include a "lowCarbTip".
For averagePrice, ALWAYS include EUR equivalent in parentheses if not EUR, e.g. "~CHF 45/person (~EUR42)". averagePrice is REQUIRED for every nearby restaurant.

ACTIVITY ENTRY PRICE (CRITICAL): For every activity, include "entryPrice" — the ticket, entry fee, or price range in local currency with EUR equivalent if not EUR (e.g. "~EUR 15", "~CHF 20 (~EUR 18)", "Free", "~EUR 30-50"). Base this on your verified knowledge of the venue. If free, say "Free". If you don't know, omit the field. NEVER invent prices.

MENU VERIFICATION (CRITICAL — ZERO TOLERANCE): For each mealOption in nearby restaurants, the dish name MUST appear in the restaurant's Menu/Website Content provided above. If no menu content is available for a restaurant AND you cannot confirm specific dishes from your verified knowledge of THIS exact restaurant's actual menu:
- Leave mealOptions as an EMPTY array [].
- In the restaurant's "whyThisPlace", add: "Menu not verified — check their website or Google Maps for current dishes."
- Do NOT guess dishes based on cuisine type. Do NOT use "[Unverified]" prefixes. Do NOT invent dish names. A wrong dish is worse than no dish.

DISH PRICING (CRITICAL): Include exact price ONLY if found in Menu/Website Content. OMIT dishPrice if not found. NEVER invent prices.

DISH NAMING: "dish" = EXACT name from the menu in original language. "englishName" = English translation. "localName" = exact original name from menu.

DISH PAGE URL (CRITICAL): For each mealOption, you MUST include a "dishPageUrl" that links to the EXACT source where the dish information was found. Priority order:
1. The specific menu page URL on the restaurant website where this dish appears
2. The restaurant's main website URL
3. If neither is available, OMIT the field entirely
The user clicks this link to verify the dish exists. It must be a 100% reliable source. NEVER use Google search URLs or any invented URLs.

RESTAURANT SELECTION:
- Return exactly 10 activities for page ${page}.
- Rank by cultural significance, popularity, uniqueness.
- Pick restaurants CLOSEST to each activity, HIGH ratings (4.5+), MANY reviews.
- 2-3 nearby restaurants per activity from verified data.
- Include ordering phrase and dish recs aligned with dietary philosophy.
- Be enthusiastic but honest about uncertain event timings.`;

    const toolSchema = {
      type: "function",
      function: {
        name: "return_activities",
        description: "Return curated activities with nearby restaurants",
        parameters: {
          type: "object",
          properties: {
            activities: {
              type: "array",
              items: {
                type: "object",
                 properties: {
                   name: { type: "string" },
                   category: { type: "string" },
                   shortDescription: { type: "string", description: "1-2 sentence hype description" },
                   fullStory: { type: "string", description: "3-4 sentences about history and what makes it special" },
                   visitingHours: { type: "string" },
                   address: { type: "string" },
                   entryPrice: { type: "string", description: "Ticket/entry price or price range in local currency with EUR equivalent if not EUR (e.g. '~EUR 15' or '~CHF 20 (~EUR 18)' or 'Free'). Include for museums, attractions, events, tours. NEVER invent — use verified data or omit." },
                   nearbyRestaurants: {
                     type: "array",
                     items: {
                       type: "object",
                       properties: {
                         name: { type: "string" },
                         cuisine: { type: "string" },
                         distance: { type: "string" },
                         rating: { type: "number" },
                         reviewCount: { type: "number" },
                         averagePrice: { type: "string", description: "Price per person in local currency + EUR equivalent if not EUR, e.g. '~CHF 45/person (~EUR42)'. If EUR, just '~EUR30/person'." },
                         whyThisPlace: { type: "string" },
                         mealOptions: {
                           type: "array",
                           items: {
                             type: "object",
                             properties: {
                               dish: { type: "string", description: "Exact dish name as shown on the menu in the original local language" },
                               localName: { type: "string", description: "Exact dish name from the menu in original language" },
                               englishName: { type: "string", description: "English translation of the dish name" },
                               isRecommended: { type: "boolean" },
                               lowCarbTip: { type: "string" },
                               dishPrice: { type: "string", description: "Exact price from menu/website. ONLY include if found. NEVER invent." },
                               dishPageUrl: { type: "string", description: "Direct URL to the exact source page where this dish was found (menu page or restaurant website). MUST be a verified, real URL. NEVER invent." },
                             },
                             required: ["dish", "isRecommended", "lowCarbTip"],
                           },
                         },
                         orderingPhrase: { type: "string" },
                         address: { type: "string" },
                       },
                       required: ["name", "cuisine", "distance", "rating", "whyThisPlace", "orderingPhrase"],
                     },
                   },
                 },
                 required: ["name", "category", "shortDescription", "fullStory", "visitingHours", "address", "nearbyRestaurants"],
              },
            },
            hasMore: { type: "boolean", description: "Whether there are more activities to show" },
          },
          required: ["activities", "hasMore"],
        },
      },
    };

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Give me the top 10 activities and experiences for page ${page}. Include nearby restaurant recommendations for each.` },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "return_activities" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      throw new Error("AI service error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const result = JSON.parse(toolCall.function.arguments);

    // Attach photo references, compute distances, and build verified URLs
    const photoRefMap = new Map<string, string>();
    const placeGeoMap = new Map<string, { lat: number; lng: number }>();
    const placeDataMap = new Map<string, GooglePlace>();
    for (const p of uniquePlaces) {
      const key = p.name.toLowerCase();
      if (p.photos?.length) photoRefMap.set(key, p.photos[0].photo_reference);
      placeGeoMap.set(key, p.geometry.location);
      placeDataMap.set(key, p);
    }

    const restaurantDataMap = new Map<string, GooglePlace>();
    for (const restaurants of nearbyRestaurantsPerActivity) {
      for (const r of restaurants) {
        restaurantDataMap.set(r.name.toLowerCase(), r);
      }
    }

    if (result.activities) {
      for (const a of result.activities) {
        const activityPlace = placeDataMap.get(a.name.toLowerCase());
        a.photoReference = photoRefMap.get(a.name.toLowerCase()) || null;

        if (activityPlace) {
          const q = encodeURIComponent(`${activityPlace.name}, ${activityPlace.vicinity}`);
          a.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${activityPlace.place_id}`;
          a.appleMapsUrl = `https://maps.apple.com/?q=${q}&ll=${activityPlace.geometry.location.lat},${activityPlace.geometry.location.lng}`;
          a.address = activityPlace.vicinity;
          const dist = haversineDistance(latitude, longitude, activityPlace.geometry.location.lat, activityPlace.geometry.location.lng);
          a.distanceFromUser = formatDistance(dist);
          a.drivingTime = estimateDrivingTime(dist);
        } else {
          const q = encodeURIComponent(`${a.name}${a.address ? ', ' + a.address : ''}`);
          a.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${q}`;
          a.appleMapsUrl = `https://maps.apple.com/?q=${q}`;
        }

        if (a.nearbyRestaurants) {
          for (const r of a.nearbyRestaurants) {
            const match = restaurantDataMap.get(r.name.toLowerCase());
            if (match) {
              if (match.photos?.length) r.photoReference = match.photos[0].photo_reference;
              const rq = encodeURIComponent(`${match.name}, ${match.vicinity}`);
              r.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${rq}&query_place_id=${match.place_id}`;
              r.appleMapsUrl = `https://maps.apple.com/?q=${rq}&ll=${match.geometry.location.lat},${match.geometry.location.lng}`;
              r.address = match.vicinity;
              const rDist = haversineDistance(latitude, longitude, match.geometry.location.lat, match.geometry.location.lng);
              r.distanceFromUser = formatDistance(rDist);
              r.drivingTime = estimateDrivingTime(rDist);
            } else {
              const rq = encodeURIComponent(`${r.name}${r.address ? ', ' + r.address : ''}`);
              r.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${rq}`;
              r.appleMapsUrl = `https://maps.apple.com/?q=${rq}`;
            }
          }
        }
      }
    }

    console.log(`Page ${page}: returning ${result.activities?.length ?? 0} activities, hasMore: ${result.hasMore}`);

    // Log API usage (non-blocking)
    const nearbySearchCount = searchPromises.length;
    const restaurantSearchCount = restaurantPromises.length;
    const placeDetailsCount = nearbyRestaurantsPerActivity.reduce((sum, arr) => sum + arr.length, 0);
    logApiUsage(userId, "explore-activities", "google_maps", "nearby_search", 0.0032 * (nearbySearchCount + restaurantSearchCount), nearbySearchCount + restaurantSearchCount);
    // Place details fetched during restaurant verification
    if (placeDetailsCount > 0) logApiUsage(userId, "explore-activities", "google_maps", "place_details", 0.0017 * placeDetailsCount, placeDetailsCount);
    // AI verification calls (gpt-4o-mini per activity group)
    const verificationCount = nearbyRestaurantsPerActivity.filter(arr => arr.length > 0).length;
    if (verificationCount > 0) logApiUsage(userId, "explore-activities", "openai", "gpt-4o-mini", 0.0002 * verificationCount, verificationCount);
    // Main recommendation call
    logApiUsage(userId, "explore-activities", "openai", "gpt-4o", 0.003);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("explore-activities error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
