import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_PRICE_TIERS = new Set(["cheapest", "value", "fine_dining", "exclusive", "good_deal", "high_end", "most_exclusive"]);
const VALID_SCOPES = new Set(["closest", "best_in_town"]);
const VALID_MODES = new Set(["dine_in", "delivery", "shopping"]);

const VALID_AIRPORT_SIDES = new Set(["before_security", "after_security"]);

function validateInput(body: unknown): {
  latitude: number;
  longitude: number;
  accuracy?: number;
  context?: string;
  mealTime?: string;
  priceTier?: string;
  scope?: string;
  mode?: string;
  checkAirportOnly?: boolean;
  airportSide?: string;
  maxDistance?: number;
  exclude?: string[];
  fallbackAttempted?: boolean;
  lang: string;
} {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const { latitude, longitude, accuracy, context, mealTime, priceTier, scope, mode, checkAirportOnly, airportSide, exclude, maxDistance, fallbackAttempted, lang } = body as Record<string, unknown>;

  if (typeof latitude !== "number" || latitude < -90 || latitude > 90) throw new Error("Invalid latitude");
  if (typeof longitude !== "number" || longitude < -180 || longitude > 180) throw new Error("Invalid longitude");

  let validatedAccuracy: number | undefined;
  if (accuracy != null) {
    if (typeof accuracy !== "number" || accuracy < 0) throw new Error("Invalid accuracy");
    validatedAccuracy = accuracy;
  }

  let validatedContext: string | undefined;
  if (context != null) {
    if (typeof context !== "string" || context.length > 500) throw new Error("Invalid context");
    validatedContext = context.trim() || undefined;
  }

  let validatedMealTime: string | undefined;
  if (mealTime != null) {
    if (typeof mealTime !== "string" || mealTime.length > 100) throw new Error("Invalid mealTime");
    validatedMealTime = mealTime.trim() || undefined;
  }

  let validatedPriceTier: string | undefined;
  if (priceTier != null) {
    if (typeof priceTier !== "string" || !VALID_PRICE_TIERS.has(priceTier)) throw new Error("Invalid priceTier");
    validatedPriceTier = priceTier;
  }

  let validatedScope: string | undefined;
  if (scope != null) {
    if (typeof scope !== "string" || !VALID_SCOPES.has(scope)) throw new Error("Invalid scope");
    validatedScope = scope;
  }

  let validatedMode: string | undefined;
  if (mode != null) {
    if (typeof mode !== "string" || !VALID_MODES.has(mode)) throw new Error("Invalid mode");
    validatedMode = mode;
  }

  let validatedAirportSide: string | undefined;
  if (airportSide != null) {
    if (typeof airportSide !== "string" || !VALID_AIRPORT_SIDES.has(airportSide)) throw new Error("Invalid airportSide");
    validatedAirportSide = airportSide;
  }

  let validatedExclude: string[] | undefined;
  if (exclude != null) {
    if (!Array.isArray(exclude) || exclude.length > 20) throw new Error("Invalid exclude");
    validatedExclude = [];
    for (const item of exclude) {
      if (typeof item !== "string" || item.length > 200) throw new Error("Invalid exclude item");
      validatedExclude.push(item.trim());
    }
  }

  let validatedMaxDistance: number | undefined;
  if (maxDistance != null) {
    if (typeof maxDistance !== "number" || maxDistance < 1 || maxDistance > 80) throw new Error("Invalid maxDistance");
    validatedMaxDistance = maxDistance;
  }

  let validatedLang = "en";
  if (lang != null) {
    if (typeof lang === "string" && (lang === "en" || lang === "el")) validatedLang = lang;
  }

  return {
    latitude, longitude,
    accuracy: validatedAccuracy,
    context: validatedContext,
    mealTime: validatedMealTime,
    priceTier: validatedPriceTier,
    scope: validatedScope,
    mode: validatedMode,
    checkAirportOnly: checkAirportOnly === true,
    airportSide: validatedAirportSide,
    exclude: validatedExclude,
    maxDistance: validatedMaxDistance,
    fallbackAttempted: fallbackAttempted === true,
    lang: validatedLang,
  };
}

async function authenticateRequest(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("UNAUTHORIZED");
  return data.claims.sub as string;
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

async function fetchClientProfile(userId: string): Promise<string> {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: notes } = await sb
      .from("client_notes")
      .select("category, title, content, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (!notes || notes.length === 0) return "";

    const allergies = notes.filter((n: any) => n.category === "allergy").map((n: any) => n.title);
    const restrictions = notes.filter((n: any) => n.category === "restriction").map((n: any) => n.title);
    const preferences = notes.filter((n: any) => n.category === "preference").map((n: any) => n.title);
    const goals = notes.filter((n: any) => n.category === "goal").map((n: any) => n.title);
    const meetingNotes = notes.filter((n: any) => n.category === "meeting_note");
    const generalNotes = notes.filter((n: any) => n.category === "general");

    let profile = "\nCLIENT PROFILE (MUST be respected for all recommendations):\n";
    if (allergies.length > 0) profile += `- ALLERGIES (NEVER recommend dishes containing these): ${allergies.join(", ")}\n`;
    if (restrictions.length > 0) profile += `- RESTRICTIONS (NEVER recommend these): ${restrictions.join(", ")}\n`;
    if (preferences.length > 0) profile += `- Cuisine Preferences: ${preferences.join(", ")}\n`;
    if (goals.length > 0) profile += `- Goals: ${goals.join(", ")}\n`;
    if (meetingNotes.length > 0) {
      profile += "- Notes from meetings:\n";
      for (const n of meetingNotes.slice(0, 10)) {
        const date = new Date(n.created_at).toISOString().split("T")[0];
        profile += `  * [${date}] ${n.title}${n.content ? ": " + n.content.slice(0, 200) : ""}\n`;
      }
    }
    if (generalNotes.length > 0) {
      for (const n of generalNotes.slice(0, 5)) {
        profile += `- ${n.title}${n.content ? ": " + n.content.slice(0, 200) : ""}\n`;
      }
    }
    return profile;
  } catch (e) {
    console.error("Failed to fetch client profile:", e);
    return "";
  }
}

interface GooglePlace {
  name: string;
  vicinity: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  place_id: string;
  price_level?: number;
  opening_hours?: { open_now?: boolean };
  types?: string[];
  photos?: { photo_reference: string; height: number; width: number }[];
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // meters
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

function estimateWalkingTime(meters: number): string {
  const minutes = Math.ceil(meters / 80); // ~80m/min walking
  return `${minutes} min walk`;
}

function estimateDrivingTime(meters: number): string {
  const minutes = Math.max(1, Math.ceil(meters / 500)); // ~30km/h city driving
  return `${minutes} min drive`;
}

async function fetchNearbyPlaces(
  lat: number, lng: number, radiusMeters: number, apiKey: string, type: string, keyword?: string
): Promise<GooglePlace[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("type", type);
  url.searchParams.set("key", apiKey);
  if (keyword) url.searchParams.set("keyword", keyword);

  console.log(`Fetching Google Places: type=${type}, radius=${radiusMeters}m, keyword=${keyword || "none"}`);
  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error("Google Places API error:", response.status);
    throw new Error("Failed to fetch nearby places from Google Places");
  }
  const data = await response.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Google Places API status:", data.status, data.error_message);
    throw new Error(`Google Places error: ${data.status}`);
  }
  return (data.results || []) as GooglePlace[];
}

async function fetchNearbyRestaurants(
  lat: number, lng: number, radiusMeters: number, apiKey: string, keyword?: string
): Promise<GooglePlace[]> {
  return fetchNearbyPlaces(lat, lng, radiusMeters, apiKey, "restaurant", keyword);
}

async function searchPlaceByText(
  query: string, lat: number, lng: number, apiKey: string
): Promise<GooglePlace | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "20000");
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] || null;
}

async function detectAirport(lat: number, lng: number, apiKey: string): Promise<boolean> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
  console.log("Airport detection: using reverse geocoding for precise building check");
  const response = await fetch(url);
  if (!response.ok) {
    console.error("Reverse geocoding API error:", response.status);
    return false;
  }
  const data = await response.json();
  if (data.status !== "OK" || !data.results?.length) {
    console.log("Reverse geocoding: no results");
    return false;
  }
  const isAirport = data.results.some((r: { types?: string[] }) => r.types?.includes("airport"));
  if (isAirport) {
    const airportResult = data.results.find((r: { types?: string[] }) => r.types?.includes("airport"));
    console.log("Airport detected via reverse geocoding:", airportResult?.formatted_address || "unknown");
  } else {
    console.log("Reverse geocoding: NOT inside an airport");
  }
  return isAirport;
}

function buildGoogleMapsUrl(place: GooglePlace): string {
  const q = encodeURIComponent(`${place.name}, ${place.vicinity}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${place.place_id}`;
}

function buildAppleMapsUrl(place: GooglePlace): string {
  const q = encodeURIComponent(`${place.name}, ${place.vicinity}`);
  return `https://maps.apple.com/?q=${q}&ll=${place.geometry.location.lat},${place.geometry.location.lng}`;
}

interface PlaceDetails {
  weekday_text?: string[];
  open_now?: boolean;
  website?: string;
  business_status?: string;
}

interface WebsiteScrapResult {
  menuText: string;
  generalText: string;
  menuPageUrl?: string;
}

// Expanded menu URL patterns (international + common structures)
const MENU_URL_PATTERN = /\/(menu|carte|karte|speisekarte|restaurant|dining|gastronomie|cuisine|ristorazione|ristorante|eat|food|bar|brasserie|trattoria|osteria|bistro|grill|steakhouse|plats|piatti|gerichte|our-food|dishes|prices|tarifs|la-carte|a-la-carte)/i;
const MENU_QUERY_PATTERN = /[?&#](page|section|tab)=menu/i;
const MENU_ANCHOR_PATTERN = /#(menu|our-menu|food-menu|carte|speisekarte)/i;
const MENU_LINK_TEXT_PATTERN = /\b(menu|carte|karte|speisekarte)\b/i;

// Menu section header keywords for structured extraction
const MENU_SECTION_KEYWORDS = /\b(grill|meat|fish|steak|eggs|omelette|seafood|rotisserie|charcoal|poultry|lamb|beef|antipasti|entrée|entrées|plat|plats|dessert|desserts|starter|starters|main|mains|appetizer|appetizers|soup|soups|salad|salads|sides|from the|our|specials|today|catch|market|butcher|prime|aged|wagyu|rib|chop|fillet|filet|côte|brochette|plancha|grillades|viandes|poissons|fruits de mer|contorni|primi|secondi|dolci|vorspeisen|hauptgerichte|beilagen|nachtisch)\b/i;

// Price pattern to detect menu-like content
const PRICE_PATTERN = /(?:EUR|CHF|€|\$|£|USD|GBP)\s*\d+|\d+[\.,]\d{2}\s*(?:EUR|CHF|€|\$|£)/i;

// ============= KEYWORD PRE-FILTERING =============
// Comprehensive multilingual keywords for extracting relevant menu sections
const RELEVANCE_KEYWORDS = new Set([
  // Proteins (EN)
  "meat","steak","ribeye","rib-eye","rib eye","filet","fillet","entrecôte","entrecote","côte de boeuf","cote de boeuf",
  "lamb","pork","duck","confit","beef","veal","chicken","turkey","poultry","fish","salmon","tuna","sea bass",
  "lobster","shrimp","prawn","oyster","crab","eggs","omelette","omelet","tartare","carpaccio","charcuterie",
  "foie gras","bone marrow","organ","liver","sweetbread","tripe","sausage","bacon","ham","bresaola","prosciutto",
  "wagyu","t-bone","tomahawk","sirloin","rump","flank","brisket","short rib","pork belly","chorizo",
  // Proteins (FR)
  "viande","viandes","boeuf","bœuf","agneau","porc","canard","poulet","veau","poisson","saumon","thon",
  "loup de mer","bar","homard","crevette","crevettes","huître","huîtres","crabe","oeuf","oeufs","œuf","œufs",
  "brochette","brochettes","côte","côtes","rôti","gigot","souris","magret","cuisse","suprême",
  // Proteins (DE)
  "fleisch","rindfleisch","schweinefleisch","lamm","kalb","ente","huhn","hähnchen","fisch","lachs","thunfisch",
  "hummer","garnele","garnelen","auster","austern","krabbe","krabben","eier","omelett","wurst","würstchen","schinken",
  // Proteins (IT)
  "carne","carni","manzo","maiale","agnello","vitello","anatra","pollo","pesce","salmone","tonno","branzino",
  "aragosta","gambero","gamberi","ostrica","ostriche","granchio","uova","frittata","bistecca","costata","tagliata",
  "ossobuco","cotoletta","saltimbocca","involtini","polpette","arrosticini",
  // Proteins (ES)
  "carne","carnes","cerdo","cordero","ternera","pato","pollo","pescado","salmón","atún","lubina",
  "langosta","gamba","gambas","ostra","ostras","cangrejo","huevos","tortilla","chuleta","chuletón","solomillo",
  // Proteins (EL/Greek)
  "κρέας","μπριζόλα","μοσχάρι","αρνί","χοιρινό","πάπια","κοτόπουλο","ψάρι","σολομός","τόνος","αστακός",
  "γαρίδα","γαρίδες","στρείδια","αυγά","ομελέτα","σουβλάκι","σουβλάκια","κεμπάπ","μπιφτέκι","μπιφτέκια",
  "παϊδάκια","παιδάκια","κοντοσούβλι","γύρος","λουκάνικο","χταπόδι","καλαμάρι","μύδια",
  // Cooking methods (multilingual)
  "grill","grilled","grillé","grillée","grilliert","grigliato","grigliata","alla griglia","a la brasa","σχάρα","ψητό","ψητά",
  "rotisserie","rôtisserie","charcoal","plancha","brochette","smoked","fumé","geräuchert","affumicato","ahumado","καπνιστό",
  "braised","braisé","geschmort","brasato","estofado","roasted","rôti","gebraten","arrosto","asado",
  "seared","pan-fried","poêlé","butter-basted","wood-fired","au feu de bois","forno a legna",
  // Fat-forward
  "butter","beurre","burro","mantequilla","βούτυρο","ghee","tallow","lard","cream","crème","panna","nata","κρέμα",
  "cheese","fromage","käse","formaggio","queso","τυρί","burrata","mozzarella","full-fat","marrow","moelle",
  "belly","fatty","dry-aged","dry aged","aged","matured","affiné",
  // Menu structure (multilingual)
  "starter","starters","main","mains","dessert","desserts","appetizer","appetizers","entrée","entrées",
  "plat","plats","antipasti","antipasto","primi","secondi","contorni","dolci",
  "vorspeise","vorspeisen","hauptgericht","hauptgerichte","beilage","beilagen","nachtisch","nachspeise",
  "entrante","entrantes","principal","principales","postre","postres",
  "ορεκτικά","ορεκτικό","κυρίως","κυρίως πιάτα","επιδόρπιο","σαλάτες","σαλάτα",
  "grill section","from the grill","from the sea","catch of the day","specials","today's special",
  "our selection","du jour","tagesempfehlung","piatto del giorno","plato del día","del día",
  "carte","menu","μενού","κατάλογος",
]);

// Price regex for section scoring
const PRICE_SECTION_REGEX = /(?:\d{1,3}[\.,]\d{2}|\d{2,3})\s*(?:€|EUR|CHF|\$|£|USD|GBP)|(?:€|EUR|CHF|\$|£|USD|GBP)\s*\d{1,3}(?:[\.,]\d{2})?/gi;

/**
 * Extract only relevant sections from scraped text using keyword matching.
 * Splits text by section headers (=== ... ===) and double newlines,
 * keeps sections that contain relevant keywords or price patterns.
 * Falls back to original text if filtering yields too little content.
 */
function extractRelevantSections(text: string, keywords: Set<string> = RELEVANCE_KEYWORDS, minChars: number = 200): string {
  if (text.length < 500) return text; // Already small enough
  
  // Split into sections by heading markers and double newlines
  const sections = text.split(/(?=\n===\s)|(?:\n\n(?=[A-Z\u0370-\u03FF]))/);
  
  const relevantSections: string[] = [];
  const lowerKeywords = [...keywords]; // already lowercase in the set
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    const sectionLower = section.toLowerCase();
    
    // Check if section header matches keywords
    const headerMatch = section.match(/^(?:\n)?===\s*(.*?)\s*===/);
    if (headerMatch) {
      const headerLower = headerMatch[1].toLowerCase();
      const headerHasKeyword = lowerKeywords.some(kw => headerLower.includes(kw));
      if (headerHasKeyword) {
        relevantSections.push(section);
        continue;
      }
    }
    
    // Count keyword matches in body
    let keywordMatches = 0;
    for (const kw of lowerKeywords) {
      if (sectionLower.includes(kw)) {
        keywordMatches++;
        if (keywordMatches >= 2) break; // Enough to keep
      }
    }
    
    // Check for price patterns
    const hasPrices = PRICE_SECTION_REGEX.test(section);
    PRICE_SECTION_REGEX.lastIndex = 0; // Reset regex state
    
    // Keep if: 2+ keyword matches, OR (1+ keyword AND has prices)
    if (keywordMatches >= 2 || (keywordMatches >= 1 && hasPrices)) {
      relevantSections.push(section);
    }
  }
  
  const filtered = relevantSections.join("\n\n").trim();
  
  // Safety fallback: if filtering removed too much, return original
  if (filtered.length < minChars) {
    return text;
  }
  
  return filtered;
}

/**
 * Calculate keyword density score for a text (0-1).
 * Used to decide whether depth-2 crawling is needed.
 */
function keywordDensityScore(text: string): number {
  if (text.length < 50) return 0;
  const textLower = text.toLowerCase();
  let matches = 0;
  for (const kw of RELEVANCE_KEYWORDS) {
    if (textLower.includes(kw)) matches++;
    if (matches >= 20) break; // Cap for performance
  }
  // Normalize: 10+ matches = high density (1.0)
  return Math.min(matches / 10, 1.0);
}

function stripNoiseFromHtml(html: string): string {
  // Remove nav, footer, header, cookie banners, social sections
  let cleaned = html
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<div[^>]*class="[^"]*(?:cookie|consent|gdpr|banner|newsletter|social|share|follow)[^"]*"[\s\S]*?<\/div>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  return cleaned;
}

function htmlToStructuredText(html: string): string {
  const cleaned = stripNoiseFromHtml(html);
  // Preserve headings as section markers
  let text = cleaned
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n=== $1 ===\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n• $1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<td[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&euro;/gi, "EUR ")
    .replace(/&#\d+;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text;
}

function isMenuUrl(urlStr: string): boolean {
  return MENU_URL_PATTERN.test(urlStr) || MENU_QUERY_PATTERN.test(urlStr) || MENU_ANCHOR_PATTERN.test(urlStr);
}

function isPdfUrl(urlStr: string): boolean {
  return /\.pdf(\?|$|#)/i.test(urlStr);
}

function extractLinksFromHtml(html: string, baseUrl: URL): { menuLinks: string[]; pdfLinks: string[]; allLinks: string[] } {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const menuLinks: string[] = [];
  const pdfLinks: string[] = [];
  const allLinks: string[] = [];
  const seen = new Set<string>();
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl).href;
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      allLinks.push(resolved);
      if (isPdfUrl(resolved) && (resolved.toLowerCase().includes("menu") || resolved.toLowerCase().includes("carte") || resolved.toLowerCase().includes("karte"))) {
        pdfLinks.push(resolved);
      } else if (isMenuUrl(resolved) || MENU_LINK_TEXT_PATTERN.test(match[1])) {
        menuLinks.push(resolved);
      }
    } catch { /* invalid URL */ }
  }
  return { menuLinks: menuLinks.slice(0, 5), pdfLinks: pdfLinks.slice(0, 1), allLinks };
}

async function fetchPage(url: string, timeoutMs: number = 5000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MenuBot/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("pdf")) return null; // handled separately
    return await res.text();
  } catch { return null; }
}

async function extractPdfMenuText(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MenuBot/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return "";
    
    // Check size — max 500KB
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 500000) {
      console.log(`PDF too large (${contentLength} bytes), skipping: ${url}`);
      return "";
    }
    
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 500000) return "";
    
    // Basic PDF text extraction — look for text between stream/endstream
    const bytes = new Uint8Array(buffer);
    const rawText = new TextDecoder("latin1").decode(bytes);
    
    // Extract text from PDF text objects (Tj, TJ, ' operators)
    const textChunks: string[] = [];
    // Match text in parentheses from Tj operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(rawText)) !== null) {
      const chunk = tjMatch[1].replace(/\\([nrt\\()])/g, (_, c) => {
        switch (c) { case 'n': return '\n'; case 'r': return '\r'; case 't': return '\t'; default: return c; }
      });
      if (chunk.trim()) textChunks.push(chunk.trim());
    }
    
    // Also try TJ arrays
    const tjArrayRegex = /\[((?:\([^)]*\)|[^[\]])*)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(rawText)) !== null) {
      const inner = tjArrMatch[1];
      const parts: string[] = [];
      const partRegex = /\(([^)]*)\)/g;
      let partMatch;
      while ((partMatch = partRegex.exec(inner)) !== null) {
        if (partMatch[1].trim()) parts.push(partMatch[1].trim());
      }
      if (parts.length > 0) textChunks.push(parts.join(""));
    }
    
    const extractedText = textChunks.join(" ").replace(/\s+/g, " ").trim();
    if (extractedText.length > 100) {
      console.log(`PDF extraction: got ${extractedText.length} chars from ${url}`);
      return `\n=== PDF MENU ===\n${extractedText}`;
    }
    
    console.log(`PDF extraction: only ${extractedText.length} chars from basic parsing of ${url}`);
    return "";
  } catch (e) {
    console.error(`PDF extraction error for ${url}:`, e);
    return "";
  }
}

async function fetchWebsiteAndMenuText(url: string): Promise<WebsiteScrapResult> {
  try {
    // Phase 1: Fetch homepage
    const homepageHtml = await fetchPage(url, 5000);
    if (!homepageHtml) return { menuText: "", generalText: "" };

    const baseUrl = new URL(url);
    const { menuLinks, pdfLinks } = extractLinksFromHtml(homepageHtml, baseUrl);
    
    // Check if homepage itself is a menu page
    const homepageIsMenu = isMenuUrl(url);
    const homepageStructured = htmlToStructuredText(homepageHtml);
    const homepageHasMenuContent = PRICE_PATTERN.test(homepageStructured) && MENU_SECTION_KEYWORDS.test(homepageStructured);
    
    let menuText = "";
    let generalText = "";
    let bestMenuUrl: string | undefined;
    
    // If homepage is a menu page or has menu content, add keyword-filtered version to menuText
    if (homepageIsMenu || homepageHasMenuContent) {
      menuText += extractRelevantSections(homepageStructured);
    } else {
      generalText = homepageStructured.slice(0, 6000);
    }
    
    // Phase 2: Fetch menu sub-pages (depth 1)
    const depth1Pages = await Promise.all(
      menuLinks.map(async (mUrl) => {
        const html = await fetchPage(mUrl, 5000);
        return { url: mUrl, html };
      })
    );
    
    // Collect depth-2 links from menu pages
    const depth2Links: string[] = [];
    let depth1KeywordDensity = 0;
    
    for (const page of depth1Pages) {
      if (!page.html) continue;
      bestMenuUrl = bestMenuUrl || page.url;
      const structured = htmlToStructuredText(page.html);
      const filtered = extractRelevantSections(structured);
      menuText += `\n\n=== MENU PAGE: ${page.url} ===\n${filtered}`;
      
      // Track keyword density for smart depth-2 skipping
      depth1KeywordDensity = Math.max(depth1KeywordDensity, keywordDensityScore(structured));
      
      // Depth 2: find sub-links in menu pages
      const subLinks = extractLinksFromHtml(page.html, new URL(page.url));
      for (const sl of subLinks.menuLinks) {
        if (!menuLinks.includes(sl) && !depth2Links.includes(sl)) {
          depth2Links.push(sl);
        }
      }
      // Also collect PDFs from menu pages
      for (const pl of subLinks.pdfLinks) {
        if (!pdfLinks.includes(pl)) pdfLinks.push(pl);
      }
    }
    
    // Smart depth-2 skipping: if depth-1 pages already have high keyword density, skip depth-2
    const totalMenuPages = depth1Pages.filter(p => p.html).length;
    const shouldSkipDepth2 = depth1KeywordDensity >= 0.6 && totalMenuPages >= 2;
    
    if (!shouldSkipDepth2) {
      // Fetch depth-2 pages (up to 3 total — reduced from 5)
      const depth2ToFetch = depth2Links.slice(0, Math.max(0, 3 - totalMenuPages));
      if (depth2ToFetch.length > 0) {
        const depth2Pages = await Promise.all(
          depth2ToFetch.map(async (mUrl) => {
            const html = await fetchPage(mUrl, 5000);
            return { url: mUrl, html };
          })
        );
        for (const page of depth2Pages) {
          if (!page.html) continue;
          const structured = htmlToStructuredText(page.html);
          const filtered = extractRelevantSections(structured);
          menuText += `\n\n=== MENU PAGE (depth 2): ${page.url} ===\n${filtered}`;
        }
      }
    } else {
      console.log(`Smart depth-2 skip: keyword density ${depth1KeywordDensity.toFixed(2)} from ${totalMenuPages} depth-1 pages — skipping depth-2 crawl for ${url}`);
    }
    
    // Phase 3: PDF menu extraction
    if (pdfLinks.length > 0) {
      const pdfText = await extractPdfMenuText(pdfLinks[0]);
      if (pdfText) menuText += pdfText;
    }
    
    // If no menu pages found but homepage had content, put it in general
    if (!menuText && homepageStructured) {
      generalText = homepageStructured.slice(0, 6000);
    }
    
    const totalMenuLinks = menuLinks.length + depth2Links.length;
    if (totalMenuLinks > 0 || pdfLinks.length > 0) {
      console.log(`Menu scraper: ${menuLinks.length} depth-1, depth-2 ${shouldSkipDepth2 ? "skipped" : depth2Links.slice(0, Math.max(0, 3 - totalMenuPages)).length}, ${pdfLinks.length} PDFs for ${url} → ${menuText.length} chars menu text`);
    }

    // Cap menu text to prevent CPU timeouts on massive sites
    const cappedMenu = menuText.length > 50000 ? menuText.slice(0, 50000) : menuText;
    return { menuText: cappedMenu.trim(), generalText: generalText.trim().slice(0, 10000), menuPageUrl: bestMenuUrl };
  } catch {
    return { menuText: "", generalText: "" };
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

async function cleanMenuWithAI(rawMenuText: string, restaurantName: string, apiKey: string): Promise<string> {
  // Pre-filter with keywords before sending to AI
  const preFiltered = extractRelevantSections(rawMenuText);
  
  // If pre-filtered text is small enough, skip the AI call entirely
  if (preFiltered.length < 500) return preFiltered;
  
  // Hard cap to prevent CPU timeout on huge menus
  const inputText = preFiltered.length > 30000 ? preFiltered.slice(0, 30000) : preFiltered;
  console.log(`cleanMenuWithAI "${restaurantName}": ${rawMenuText.length} → ${preFiltered.length} chars after keyword filter${inputText.length < preFiltered.length ? ` (capped to ${inputText.length})` : ""}`);
  
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
          {
            role: "system",
            content: `Extract ONLY food menu items from this restaurant website text for "${restaurantName}". For each item include: dish name (in original language), price (if shown), brief description (if shown). Group by section headers if visible (Grill, Fish, Starters, Meat, Seafood, etc). Ignore navigation, headers, footers, non-food content. Return as a clean structured list. Preserve all prices exactly as shown.`
          },
          { role: "user", content: inputText.slice(0, 30000) }
        ],
        max_tokens: 4000,
      }),
    });
    if (!response.ok) {
      console.error(`cleanMenuWithAI error for "${restaurantName}": ${response.status}`);
      return rawMenuText;
    }
    const data = await response.json();
    const cleaned = data.choices?.[0]?.message?.content?.trim();
    if (cleaned && cleaned.length > 100) {
      console.log(`Menu AI cleanup for "${restaurantName}": ${rawMenuText.length} -> ${cleaned.length} chars`);
      return cleaned;
    }
    return rawMenuText;
  } catch (e) {
    console.error(`cleanMenuWithAI error for "${restaurantName}":`, e);
    return rawMenuText;
  }
}

async function fetchMenuViaGPTKnowledge(restaurantName: string, city: string, apiKey: string): Promise<string> {
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
          {
            role: "system",
            content: "You are a restaurant menu verification assistant. ONLY list dishes you have DIRECT, CONFIRMED knowledge of from this specific restaurant's actual menu — for example from having seen their menu online, on delivery platforms, or from widely documented sources. Do NOT guess based on cuisine type. Do NOT list 'typical' dishes. If you are not 100% certain a specific dish exists at this exact restaurant, say 'No verified menu data available.' A wrong dish recommendation is worse than no recommendation."
          },
          {
            role: "user",
            content: `List ONLY the dishes you can CONFIRM exist on the current menu at "${restaurantName}" in ${city}. Do NOT guess based on cuisine type. If you're not sure about their specific menu, say 'No verified menu data available.'`
          }
        ],
        max_tokens: 2000,
      }),
    });
    if (!response.ok) return "";
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (content && content.length > 50 && !content.toLowerCase().includes("no verified menu")) {
      console.log(`GPT knowledge fallback for "${restaurantName}": got ${content.length} chars`);
      return `\n=== GPT KNOWLEDGE (${restaurantName}) ===\n${content}`;
    }
    return "";
  } catch (e) {
    console.error(`GPT knowledge fallback error for "${restaurantName}":`, e);
    return "";
  }
}

async function verifyUnknownPlacesWithAI(
  unverifiedPlaces: GooglePlace[],
  apiKey: string
): Promise<Set<string>> {
  const toExclude = new Set<string>();
  if (unverifiedPlaces.length === 0) return toExclude;

  console.log(`AI verification: checking ${unverifiedPlaces.length} unverified places`);

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

    if (!response.ok) {
      console.error("AI verification API error:", response.status);
      return toExclude;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return toExclude;

    const parsed = JSON.parse(toolCall.function.arguments);
    if (parsed.results) {
      for (const r of parsed.results) {
        if (r.status !== "open" && r.status !== "unknown") {
          const place = unverifiedPlaces[r.index - 1];
          if (place) {
            console.log(`AI verification: excluding "${place.name}" — status: ${r.status}, reason: ${r.reason}`);
            toExclude.add(place.place_id);
          }
        }
      }
    }
  } catch (e) {
    console.error("AI verification error:", e);
  }

  console.log(`AI verification: excluding ${toExclude.size} places`);
  return toExclude;
}

function priceLevelDescription(level: number | undefined): string {
  switch (level) {
    case 0: return "Free/very cheap";
    case 1: return "Budget/inexpensive for this area";
    case 2: return "Moderate for this area";
    case 3: return "Upscale/expensive for this area";
    case 4: return "Very expensive/fine dining";
    default: return "unknown";
  }
}

function getTodayHours(weekdayText: string[]): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const today = days[new Date().getDay()];
  const todayEntry = weekdayText.find(t => t.startsWith(today));
  return todayEntry || weekdayText[0] || "Hours unknown";
}

const HOTEL_KEYWORDS = /\b(hotel|resort|inn|lodge|palazzo|palace|motel|hostel|beau[- ]?rivage|four seasons|mandarin oriental|ritz|intercontinental|hilton|marriott|hyatt|kempinski|fairmont|sofitel|shangri[- ]?la|peninsula|waldorf|st\.?\s*regis|w hotel|park hyatt|aman|rosewood|belmond)\b/i;

function isHotelVenue(place: GooglePlace): boolean {
  if (HOTEL_KEYWORDS.test(place.name) || HOTEL_KEYWORDS.test(place.vicinity)) return true;
  if (place.types?.includes("lodging")) return true;
  return false;
}

function placesToPromptList(places: GooglePlace[], userLat: number, userLng: number, detailsMap: Map<string, PlaceDetails>, menuTexts?: Map<string, string>, generalTexts?: Map<string, string>, menuPageUrls?: Map<string, string>): string {
  return places.map((p, i) => {
    const dist = haversineDistance(userLat, userLng, p.geometry.location.lat, p.geometry.location.lng);
    const details = detailsMap.get(p.place_id);
    const isHotel = isHotelVenue(p);
    let hoursLine = details?.weekday_text
      ? `Opening hours today: ${getTodayHours(details.weekday_text)}`
      : `Open now: ${p.opening_hours?.open_now != null ? (p.opening_hours.open_now ? "Yes" : "No") : "unknown"}`;
    if (isHotel) {
      hoursLine += ` [HOTEL — NOT a restaurant. Identify the actual restaurant inside by name, verify it's open, provide its real kitchen hours. Skip if unverifiable.]`;
    }
    const websiteLine = details?.website ? `\n   Website: ${details.website}` : "";
    const menuPageUrl = menuPageUrls?.get(p.place_id);
    const restaurantPageLine = menuPageUrl ? `\n   Restaurant page: ${menuPageUrl}` : "";
    const statusLine = details?.business_status && details.business_status !== "OPERATIONAL"
      ? `\n   Business status: ${details.business_status}` : "";
    
    // Separate menu content (unlimited) from general website info (6k cap)
    const menuContent = menuTexts?.get(p.place_id);
    const generalContent = generalTexts?.get(p.place_id);
    const menuLine = menuContent 
      ? `\n   Menu Content (cleaned & structured):\n${menuContent}` 
      : "\n   Menu Content: Not available";
    const generalLine = generalContent 
      ? `\n   Website Info: ${generalContent.slice(0, 6000)}` 
      : "";
    
    return `${i + 1}. "${p.name}" — ${p.vicinity}
   Rating: ${p.rating ?? "N/A"}/5 (${p.user_ratings_total ?? 0} reviews)
   Distance: ${formatDistance(dist)}
   Walking: ~${estimateWalkingTime(dist)}
   Driving: ~${estimateDrivingTime(dist)}
   Price level: ${priceLevelDescription(p.price_level)}
   ${hoursLine}${statusLine}${websiteLine}${restaurantPageLine}${menuLine}${generalLine}
   Place ID: ${p.place_id}`;
  }).join("\n\n");
}

function buildPriceTierInstruction(priceTier?: string): string {
  const FALLBACK = "\nFALLBACK: If fewer than 3 places strictly match this price tier in the area, include the closest alternatives by budget — pick from the nearest adjacent tier, prioritizing proximity to the user. Clearly note these as 'Closest match — [actual tier]' in the whyThisPlace field.";
  switch (priceTier) {
    case "cheapest":
    case "good_deal":
    case "affordable":
    case "value":
      return "The user selected AFFORDABLE — they want CHEAP food. Recommend ONLY the CHEAPEST options available. Street food, hole-in-the-wall locals, no-frills family spots, market stalls, tavernas, souvlaki shops, gyro stands. Google price_level 0-1 ONLY. If a place looks upscale or charges premium prices, SKIP IT entirely. The user wants to spend as little as possible while eating well. Think plastic chairs, cash-only, locals-only, cheapest menu items. Average per-person cost must be the lowest available in the area. Do NOT recommend mid-range or fine dining under any circumstances." + FALLBACK;
    case "fine_dining":
    case "high_end":
      return "Recommend UPSCALE, PREMIUM restaurants. Google price_level 2-3. Chef-driven, refined ambiance, high-quality ingredients, possibly Bib Gourmand or recognized in local food guides. NOT the cheapest, NOT the most exclusive — the sophisticated middle ground. Well-known establishments with reputation, style, and quality. Skip budget spots and ultra-luxury." + FALLBACK;
    case "exclusive":
    case "most_exclusive":
      return "Recommend ONLY the most PRESTIGIOUS, EXCLUSIVE, and EXPENSIVE options available. Google price_level 3-4 ONLY. Michelin-starred restaurants, legendary establishments, celebrity chef venues, VIP-level experiences, private dining, places requiring reservations weeks in advance. If a place is not famous, not expensive, and not prestigious, SKIP IT. Cost is irrelevant — status and quality are everything." + FALLBACK;
    default: return "Recommend a good balance of quality and price.";
  }
}

function getPriceTierRange(priceTier?: string): [number, number] | null {
  switch (priceTier) {
    case "cheapest":
    case "good_deal":
    case "affordable":
    case "value":
      return [0, 1];
    case "fine_dining":
    case "high_end":
      return [2, 3];
    case "exclusive":
    case "most_exclusive":
      return [3, 4];
    default:
      return null;
  }
}

function sortByPriceTier(places: any[], priceTier?: string): any[] {
  const range = getPriceTierRange(priceTier);
  if (!range) return places;
  const [lo, hi] = range;
  return [...places].sort((a, b) => {
    const aLevel = a.price_level;
    const bLevel = b.price_level;
    // Places with no price_level go to the middle
    const aMatch = aLevel != null && aLevel >= lo && aLevel <= hi ? 0 : (aLevel != null ? 2 : 1);
    const bMatch = bLevel != null && bLevel >= lo && bLevel <= hi ? 0 : (bLevel != null ? 2 : 1);
    return aMatch - bMatch;
  });
}

function buildShoppingPrompt(): string {
  return `You are an elite shopping concierge specializing in high-saturated-fat, high-protein, low-carb nutrition. The user wants to find SHOPS to buy food — supermarkets, butchers, markets.

SHOPPING RULES:
- ONLY recommend places to BUY food: supermarkets, butchers, meat markets, organic stores, specialty food stores.
- Do NOT recommend restaurants.
- Focus on: quality meats rich in saturated fat (grass-fed beef, lamb, organ meats, bone marrow), fresh fish, eggs, butter, ghee, tallow, lard, full-fat cheese, heavy cream.
- Prioritize fatty cuts of meat over lean cuts.
- For supermarkets: guide to best sections (meat counter, deli, fresh fish, dairy — full-fat only).
- For butchers: highlight specialty cuts, aging programs, sourcing quality, and fat content.
- For markets: mention best days, seasonal highlights, vendor tips.

PRODUCT RECOMMENDATIONS (ZERO TOLERANCE): ONLY recommend specific products, cuts, or brands if you have verified knowledge that THIS specific shop actually sells them. Do NOT assume. If you cannot confirm what a shop sells:
- Leave mealOptions as an EMPTY array [].
- In "whatToOrder", describe the type of shop (e.g. "Traditional butcher with daily fresh cuts").
- NEVER list specific products as if they exist when you haven't verified them.

CURRENTLY CLOSED STORES: Include them anyway — the user is planning ahead. Always show opening hours prominently.

PRICE TIER BACKFILL: If fewer than 3 shops strictly match the selected price tier, backfill from the nearest adjacent tier to reach at least 3. Note backfilled items as 'Closest match — [actual tier]' in the whyThisPlace field.

PRODUCT TIPS: For verified items, include a "lowCarbTip" (e.g. "Skip marinated meats — they add sugar", "Get block cheese, not pre-shredded").

NEVER recommend bread, pasta, cereals, sugary snacks, seed oils, or processed carb-heavy products.
ONLY recommend from the VERIFIED LIST below.`;
}

function buildDeliveryPrompt(): string {
  return `You are an elite food delivery concierge. The user wants food DELIVERED.

DELIVERY RULES:
- ONLY recommend places that ACTUALLY DELIVER (own delivery, Wolt, Uber Eats, Bolt Food, Glovo, etc.). If unsure, exclude.
- For each, specify HOW to order (which app/platform, phone, or website).
- Estimate delivery time based on distance + ~15-20 min prep time. Be realistic.
- Focus on high-saturated-fat, high-protein, low-carb dishes: fatty steaks, lamb, bone marrow, grilled meats, butter-rich preparations, full-fat dairy. NEVER recommend pasta, pizza, bread-heavy dishes, or desserts.
- If a restaurant is primarily carb-heavy with NO suitable high-fat protein dishes, skip it.
- For every meal option, include a "lowCarbTip".

PRICE TIER BACKFILL: If fewer than 3 qualify, backfill from next lower tier. Label with "(High-End alternative)" or "(Good Deal alternative)" in whyThisPlace.

CRITICAL: ONLY recommend from the VERIFIED LIST below. If none deliver, say so and suggest checking Wolt/Uber Eats directly.`
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let userId: string;
    try { userId = await authenticateRequest(req); } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json();
    const { latitude, longitude, accuracy, context, mealTime, priceTier, scope, mode, checkAirportOnly, airportSide, exclude, maxDistance, fallbackAttempted, lang } = validateInput(rawBody);

    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

    // Lightweight airport pre-check mode
    if (checkAirportOnly) {
      const isAirport = await detectAirport(latitude, longitude, GOOGLE_MAPS_API_KEY);
      return new Response(JSON.stringify({ isAirport }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track user activity (non-blocking) and fetch client profile in parallel
    trackUserActivity(userId);
    const clientProfilePromise = fetchClientProfile(userId);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const isDelivery = mode === "delivery";
    const isShopping = mode === "shopping";
    const isBestInTown = scope === "best_in_town";
    
    // Use maxDistance if provided, otherwise use defaults
    let radius: number;
    if (maxDistance) {
      radius = maxDistance * 1000;
    } else if (isBestInTown) {
      radius = 20000;
    } else if (isDelivery) {
      radius = 5000;
    } else if (isShopping) {
      radius = 5000;
    } else {
      radius = 3000;
    }
    
    const userRequestedRadiusMeters = radius;
    const isAirportTier = priceTier === "fine_dining" || priceTier === "exclusive" || priceTier === "high_end" || priceTier === "most_exclusive";

    // Detect airport in parallel with other setup
    const isAtAirport = await detectAirport(latitude, longitude, GOOGLE_MAPS_API_KEY);
    if (isAtAirport) console.log("Airport detected — activating airport mode");

    let places: GooglePlace[] = [];
    let expandedRadius = false;
    let actualRadiusUsed = radius;

    if (isShopping) {
      // For shopping, search supermarkets, butchers, and markets
      const [supermarketResults, butcherResults, marketResults] = await Promise.all([
        fetchNearbyPlaces(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "supermarket"),
        fetchNearbyPlaces(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "store", "butcher meat"),
        fetchNearbyPlaces(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "grocery_or_supermarket", "organic market"),
      ]);
      const seen = new Set<string>();
      for (const p of [...butcherResults, ...supermarketResults, ...marketResults]) {
        if (!seen.has(p.place_id)) {
          seen.add(p.place_id);
          places.push(p);
        }
      }
      console.log(`Shopping search: ${supermarketResults.length} supermarkets, ${butcherResults.length} butchers, ${marketResults.length} markets → ${places.length} unique`);
    } else if (isDelivery) {
      // For delivery, run multiple searches to find delivery-capable businesses
      const [deliveryResults, mealPrepResults, cateringResults] = await Promise.all([
        fetchNearbyRestaurants(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "food delivery"),
        fetchNearbyRestaurants(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "meal prep delivery"),
        fetchNearbyRestaurants(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "catering delivery"),
      ]);

      const seen = new Set<string>();
      for (const p of [...deliveryResults, ...mealPrepResults, ...cateringResults]) {
        if (!seen.has(p.place_id)) {
          seen.add(p.place_id);
          places.push(p);
        }
      }
      console.log(`Delivery search: ${deliveryResults.length} delivery, ${mealPrepResults.length} meal prep, ${cateringResults.length} catering → ${places.length} unique`);
    } else if (isAtAirport && isAirportTier) {
      // Airport + premium tiers: comprehensive search for lounges AND restaurants
      const isExclusive = priceTier === "exclusive" || priceTier === "most_exclusive";
      const sideKeyword = airportSide === "before_security" ? "landside" : airportSide === "after_security" ? "airside gate area" : "";
      const [restaurantResults, loungeResults, barResults, vipResults, firstClassResults] = await Promise.all([
        fetchNearbyRestaurants(latitude, longitude, 3000, GOOGLE_MAPS_API_KEY, `airport restaurant fine dining ${sideKeyword}`.trim()),
        fetchNearbyPlaces(latitude, longitude, 3000, GOOGLE_MAPS_API_KEY, "establishment", `airport lounge VIP business class ${sideKeyword}`.trim()),
        fetchNearbyPlaces(latitude, longitude, 3000, GOOGLE_MAPS_API_KEY, "bar", `airport lounge premium ${sideKeyword}`.trim()),
        fetchNearbyPlaces(latitude, longitude, 3000, GOOGLE_MAPS_API_KEY, "establishment", `VIP lounge first class priority pass ${sideKeyword}`.trim()),
        isExclusive
          ? fetchNearbyPlaces(latitude, longitude, 3000, GOOGLE_MAPS_API_KEY, "establishment", `first class lounge exclusive private terminal ${sideKeyword}`.trim())
          : Promise.resolve([]),
      ]);

      const seen = new Set<string>();
      for (const p of [...vipResults, ...firstClassResults, ...loungeResults, ...restaurantResults, ...barResults]) {
        if (!seen.has(p.place_id)) {
          seen.add(p.place_id);
          places.push(p);
        }
      }
      console.log(`Airport mode: ${restaurantResults.length} restaurants, ${loungeResults.length} lounges, ${barResults.length} bars, ${vipResults.length} VIP, ${firstClassResults.length} first class → ${places.length} unique`);
    } else {
      // Define isCheapTier early so we can use it for search type and quality filtering
      const isCheapTierSearch = priceTier === "cheapest" || priceTier === "good_deal" || priceTier === "affordable" || priceTier === "value";

      if (isCheapTierSearch) {
        // For budget tiers, run 5 parallel searches to maximize cheap options (mirrors delivery tab approach)
        const [restaurantResults, takeawayResults, cafeResults, deliveryResults, keywordResults] = await Promise.all([
          fetchNearbyRestaurants(latitude, longitude, radius, GOOGLE_MAPS_API_KEY),
          fetchNearbyPlaces(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "meal_takeaway"),
          fetchNearbyPlaces(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "cafe"),
          fetchNearbyPlaces(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "meal_delivery"),
          fetchNearbyPlaces(latitude, longitude, radius, GOOGLE_MAPS_API_KEY, "restaurant", "fast food burger kebab pizza tacos"),
        ]);
        const seen = new Set<string>();
        for (const p of [...restaurantResults, ...takeawayResults, ...cafeResults, ...deliveryResults, ...keywordResults]) {
          if (!seen.has(p.place_id)) {
            seen.add(p.place_id);
            places.push(p);
          }
        }
        console.log(`Budget search: ${restaurantResults.length} restaurants + ${takeawayResults.length} takeaway + ${cafeResults.length} cafe + ${deliveryResults.length} delivery + ${keywordResults.length} keyword → ${places.length} unique`);
      } else {
        places = await fetchNearbyRestaurants(latitude, longitude, radius, GOOGLE_MAPS_API_KEY);
      }

      // Pre-filter: remove PURE lodging venues (lodging type WITHOUT restaurant type)
      // Hotel-restaurants (both lodging + restaurant) are kept here and handled by the 24h hotel filter later
      const beforeLodgingFilter = places.length;
      places = places.filter(p => {
        const hasLodging = p.types?.includes("lodging");
        const hasRestaurant = p.types?.includes("restaurant") || p.types?.includes("meal_takeaway");
        if (hasLodging && !hasRestaurant) {
          console.log(`Pre-filter: removing "${p.name}" (pure lodging, no restaurant/takeaway type)`);
          return false;
        }
        return true;
      });
      if (beforeLodgingFilter !== places.length) {
        console.log(`Lodging pre-filter: ${beforeLodgingFilter} -> ${places.length} (removed ${beforeLodgingFilter - places.length} pure lodging)`);
      }
      if (places.length < 5 && radius < 10000) {
        // Expand radius to find more results
        const expandedRadiusVal = Math.min(radius * 3, 20000);
        console.log(`Few results in ${radius}m, expanding to ${expandedRadiusVal}m`);
        if (isCheapTierSearch) {
          const [restaurantResults, takeawayResults, cafeResults, deliveryResults, keywordResults] = await Promise.all([
            fetchNearbyRestaurants(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY),
            fetchNearbyPlaces(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY, "meal_takeaway"),
            fetchNearbyPlaces(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY, "cafe"),
            fetchNearbyPlaces(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY, "meal_delivery"),
            fetchNearbyPlaces(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY, "restaurant", "fast food burger kebab pizza tacos"),
          ]);
          const seen = new Set<string>();
          places = [];
          for (const p of [...restaurantResults, ...takeawayResults, ...cafeResults, ...deliveryResults, ...keywordResults]) {
            if (!seen.has(p.place_id)) {
              seen.add(p.place_id);
              places.push(p);
            }
          }
        } else {
          places = await fetchNearbyRestaurants(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY);
        }
        // Also filter lodging from expanded results
        places = places.filter(p => !(p.types?.includes("lodging") && !p.types?.includes("restaurant") && !p.types?.includes("meal_takeaway")));
        if (places.length > 0) {
          expandedRadius = true;
          actualRadiusUsed = expandedRadiusVal;
        }
      }
    }

    // ============= PROGRESSIVE FILTER RELAXATION =============
    // Ensures at least MIN_CANDIDATES survive all filters by progressively lowering standards
    const MIN_CANDIDATES = 3;
    const isCheapTierQuality = priceTier === "cheapest" || priceTier === "good_deal" || priceTier === "affordable" || priceTier === "value";
    const isExpensiveTier = priceTier === "fine_dining" || priceTier === "high_end" || priceTier === "exclusive" || priceTier === "most_exclusive";
    const baseMinRating = isCheapTierQuality ? 3.5 : 4.0;
    const baseMinReviews = 5;

    let placesToSend: GooglePlace[] = [];
    let relaxLevel = 0;
    let filterRelaxationNote = "";

    while (placesToSend.length < MIN_CANDIDATES && relaxLevel <= 4) {
      // Determine thresholds based on relaxLevel and tier direction
      let currentMinRating = baseMinRating;
      let currentMinReviews = baseMinReviews;
      let allowAdjacentPrice = false;
      let needsRadiusExpansion = false;

      if (isCheapTierQuality) {
        // Budget tiers: rating down first, then price up, then radius
        if (relaxLevel >= 1) currentMinRating = baseMinRating - 0.5 * Math.min(relaxLevel, 2); // 3.5 → 3.0 → 2.5
        if (relaxLevel >= 2) { currentMinReviews = 2; allowAdjacentPrice = true; }
        if (relaxLevel >= 3) needsRadiusExpansion = true;
        if (relaxLevel >= 4) { currentMinRating = 2.5; currentMinReviews = 1; allowAdjacentPrice = true; }
      } else if (isExpensiveTier) {
        // Expensive tiers: price down first, then rating down, then radius
        if (relaxLevel >= 1) allowAdjacentPrice = true;
        if (relaxLevel >= 2) { currentMinRating = baseMinRating - 0.5; currentMinReviews = 3; }
        if (relaxLevel >= 3) needsRadiusExpansion = true;
        if (relaxLevel >= 4) { currentMinRating = 3.0; currentMinReviews = 2; allowAdjacentPrice = true; }
      } else {
        // Default tiers
        if (relaxLevel >= 1) currentMinRating = baseMinRating - 0.5;
        if (relaxLevel >= 2) { currentMinReviews = 2; allowAdjacentPrice = true; }
        if (relaxLevel >= 3) needsRadiusExpansion = true;
        if (relaxLevel >= 4) { currentMinRating = 2.5; currentMinReviews = 1; }
      }

      // Level 3+: expand radius and re-fetch if needed
      if (needsRadiusExpansion && !expandedRadius) {
        const expandedRadiusVal = Math.min(radius * 1.5, 40000);
        console.log(`Filter relaxation level ${relaxLevel}: expanding radius to ${expandedRadiusVal}m`);
        const isCheapTierSearch = isCheapTierQuality;
        if (isCheapTierSearch) {
          const [restaurantResults, takeawayResults, cafeResults, deliveryResults, keywordResults] = await Promise.all([
            fetchNearbyRestaurants(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY),
            fetchNearbyPlaces(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY, "meal_takeaway"),
            fetchNearbyPlaces(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY, "cafe"),
            fetchNearbyPlaces(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY, "meal_delivery"),
            fetchNearbyPlaces(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY, "restaurant", "fast food burger kebab pizza tacos"),
          ]);
          const seen = new Set<string>(places.map(p => p.place_id));
          for (const p of [...restaurantResults, ...takeawayResults, ...cafeResults, ...deliveryResults, ...keywordResults]) {
            if (!seen.has(p.place_id)) {
              seen.add(p.place_id);
              places.push(p);
            }
          }
        } else {
          const moreResults = await fetchNearbyRestaurants(latitude, longitude, expandedRadiusVal, GOOGLE_MAPS_API_KEY);
          const seen = new Set<string>(places.map(p => p.place_id));
          for (const p of moreResults) {
            if (!seen.has(p.place_id)) {
              seen.add(p.place_id);
              places.push(p);
            }
          }
        }
        // Filter lodging from new results
        places = places.filter(p => !(p.types?.includes("lodging") && !p.types?.includes("restaurant") && !p.types?.includes("meal_takeaway")));
        expandedRadius = true;
        actualRadiusUsed = Math.min(radius * 1.5, 40000);
      }

      // Apply quality filter
      const qualityPlaces = places
        .filter(p => (p.rating ?? 0) >= currentMinRating && (p.user_ratings_total ?? 0) >= currentMinReviews)
        .sort((a, b) => {
          const scoreA = (a.rating ?? 0) * Math.log10(Math.max(a.user_ratings_total ?? 1, 1));
          const scoreB = (b.rating ?? 0) * Math.log10(Math.max(b.user_ratings_total ?? 1, 1));
          return scoreB - scoreA;
        })
        .slice(0, 20);

      placesToSend = sortByPriceTier(
        qualityPlaces.length > 0 ? qualityPlaces : places.slice(0, 15),
        priceTier
      );

      // Price filter (relaxed if allowAdjacentPrice)
      const isCheapTierFilter = isCheapTierQuality;
      if (isCheapTierFilter) {
        placesToSend = placesToSend.filter(p => {
          if (p.price_level != null) {
            const maxPrice = allowAdjacentPrice ? 3 : 2;
            if (p.price_level >= maxPrice) return false;
          }
          return true;
        });
      }
      if (isExpensiveTier && !allowAdjacentPrice) {
        // Keep only higher-end places when strict
        placesToSend = placesToSend.filter(p => {
          if (p.price_level != null && p.price_level <= 0) return false;
          return true;
        });
      }

      // Closed filter
      // (Details will be fetched once after the loop to avoid redundant API calls)
      // For now, just track candidate count before details check

      // Hotel filter (simplified for loop)
      const isCheapTier = isCheapTierQuality;
      if (!isAtAirport) {
        placesToSend = placesToSend.filter(p => {
          if (!isHotelVenue(p)) return true;
          if (isCheapTier) return false;
          return true; // Detailed 24h check happens after the loop with Place Details
        });
      }

      // Exclude previously shown
      if (exclude && exclude.length > 0) {
        const excludeSet = new Set(exclude.map((n: string) => n.toLowerCase()));
        placesToSend = placesToSend.filter(p => !excludeSet.has(p.name.toLowerCase()));
      }

      if (placesToSend.length < MIN_CANDIDATES) {
        relaxLevel++;
        if (relaxLevel <= 4) {
          console.log(`Filter relaxation: level ${relaxLevel} (minRating=${currentMinRating}, minReviews=${currentMinReviews}, adjacentPrice=${allowAdjacentPrice}, radiusExpanded=${needsRadiusExpansion}) — only ${placesToSend.length} candidates, need ${MIN_CANDIDATES}`);
        }
      }
    }

    if (relaxLevel > 0) {
      filterRelaxationNote = `\nNOTE: Filters were relaxed (level ${relaxLevel}) to find enough options. Some results may be slightly outside the user's original preferences. Mention this naturally in the summary, e.g. "We expanded our search to find the best available options near you."`;
      console.log(`Filter relaxation complete: level ${relaxLevel}, ${placesToSend.length} candidates`);
    }

    console.log(`Google Places: ${places.length} total, ${placesToSend.length} candidates after progressive filtering`);

    if (placesToSend.length === 0) {
      console.log("No candidates found even after full relaxation, sending all results to AI");
      placesToSend = places.slice(0, 15);
    }

    // For delivery mode, run an AI pre-screening step to filter for actual delivery + meat-based options
    if (isDelivery && placesToSend.length > 0) {
      const prescreenList = placesToSend.map((p, i) => {
        return `${i + 1}. "${p.name}" — ${p.vicinity} (Rating: ${p.rating ?? "N/A"}, ${p.user_ratings_total ?? 0} reviews, Price: ${p.price_level != null ? "$".repeat(p.price_level) : "unknown"})`;
      }).join("\n");

      const prescreenResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Filter restaurants that BOTH deliver (own delivery or Wolt/Uber Eats/Bolt Food/Glovo) AND serve high-fat, high-protein food (fatty meats, steaks, grilled items, butter-rich dishes). Exclude if unsure about delivery. Use the provided tool." },
            { role: "user", content: `Near GPS ${latitude}, ${longitude}, which deliver AND serve meat/protein:\n\n${prescreenList}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "filter_restaurants",
              description: "Indices of restaurants that deliver AND serve meat-based food",
              parameters: {
                type: "object",
                properties: {
                  selected: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        deliveryMethod: { type: "string" },
                        meatScore: { type: "number" },
                        reason: { type: "string" },
                      },
                      required: ["index", "deliveryMethod", "meatScore", "reason"],
                    },
                  },
                },
                required: ["selected"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "filter_restaurants" } },
        }),
      });

      if (prescreenResponse.ok) {
        const prescreenData = await prescreenResponse.json();
        const prescreenTool = prescreenData.choices?.[0]?.message?.tool_calls?.[0];
        if (prescreenTool) {
          try {
            const filtered = JSON.parse(prescreenTool.function.arguments);
            if (filtered.selected && filtered.selected.length > 0) {
              const sorted = filtered.selected.sort((a: any, b: any) => (b.meatScore ?? 0) - (a.meatScore ?? 0));
              const filteredPlaces = sorted
                .map((s: any) => placesToSend[s.index - 1])
                .filter(Boolean);
              if (filteredPlaces.length > 0) {
                console.log(`AI pre-screen: ${placesToSend.length} → ${filteredPlaces.length} delivery+meat-based places`);
                placesToSend = filteredPlaces;
              }
            }
          } catch (e) {
            console.error("Pre-screen parse error:", e);
          }
        }
      } else {
        console.error("Pre-screen API error:", prescreenResponse.status);
      }
    }

    // Fetch real opening hours for all selected places in parallel (post-loop)
    const GOOGLE_MAPS_KEY = GOOGLE_MAPS_API_KEY; // alias for readability
    const detailsEntries = await Promise.all(
      placesToSend.map(async (p) => {
        const details = await fetchPlaceDetails(p.place_id, GOOGLE_MAPS_KEY);
        return [p.place_id, details] as const;
      })
    );
    const detailsMap = new Map<string, PlaceDetails>();
    for (const [id, details] of detailsEntries) {
      if (details) detailsMap.set(id, details);
    }
    console.log(`Place Details: fetched details for ${detailsMap.size}/${placesToSend.length} places`);

    // Filter out closed businesses
    const beforeFilterCount = placesToSend.length;
    placesToSend = placesToSend.filter((p) => {
      const details = detailsMap.get(p.place_id);
      if (details?.business_status === "CLOSED_TEMPORARILY" || details?.business_status === "CLOSED_PERMANENTLY") {
        console.log(`Filtered out "${p.name}": ${details.business_status}`);
        return false;
      }
      if (details?.open_now === false && !isShopping) {
        console.log(`Filtered out "${p.name}": currently closed (open_now=false)`);
        return false;
      }
      return true;
    });
    if (beforeFilterCount !== placesToSend.length) {
      console.log(`Closed filter: ${beforeFilterCount} → ${placesToSend.length} places`);
    }

    // Hotel 24h filter for expensive tiers (cheap tier hotels already removed in loop)
    if (!isAtAirport && isExpensiveTier) {
      const beforeHotelFilter = placesToSend.length;
      placesToSend = placesToSend.filter(p => {
        if (!isHotelVenue(p)) return true;
        const details = detailsMap.get(p.place_id);
        const hoursText = details?.weekday_text?.join(" ") || "";
        const is24h = hoursText.toLowerCase().includes("open 24 hours") || hoursText.toLowerCase().includes("24 hours");
        if (is24h) {
          console.log(`Hotel filter: removing "${p.name}" (24h hours = hotel reception, not kitchen)`);
          return false;
        }
        return true;
      });
      if (beforeHotelFilter !== placesToSend.length) {
        console.log(`Hotel filter: ${beforeHotelFilter} -> ${placesToSend.length}`);
      }
    }

    // AI verification for places where Google returned no details
    const unverifiedPlaces = placesToSend.filter(p => !detailsMap.has(p.place_id));
    if (unverifiedPlaces.length > 0) {
      const aiExcludeIds = await verifyUnknownPlacesWithAI(unverifiedPlaces, OPENAI_API_KEY);
      if (aiExcludeIds.size > 0) {
        const beforeAI = placesToSend.length;
        placesToSend = placesToSend.filter(p => !aiExcludeIds.has(p.place_id));
        console.log(`AI verification filter: ${beforeAI} → ${placesToSend.length} places`);
      }
    }

    // Fetch website text for menu verification (with improved menu discovery pipeline)
    const menuTexts = new Map<string, string>();
    const generalTexts = new Map<string, string>();
    const menuPageUrls = new Map<string, string>();
    
    // Phase 1: Scrape websites with separated menu/general content
    await Promise.all(
      placesToSend.map(async (p) => {
        const details = detailsMap.get(p.place_id);
        if (details?.website) {
          const result = await fetchWebsiteAndMenuText(details.website);
          if (result.menuText.length > 100) menuTexts.set(p.place_id, result.menuText);
          if (result.generalText.length > 50) generalTexts.set(p.place_id, result.generalText);
          if (result.menuPageUrl) menuPageUrls.set(p.place_id, result.menuPageUrl);
        }
      })
    );
    console.log(`Website scraping: ${menuTexts.size} menus, ${generalTexts.size} general, ${menuPageUrls.size} menu URLs from ${placesToSend.length} places`);
    
    // Phase 2: AI menu cleanup for restaurants with menu content
    const menuCleanupPromises: Promise<void>[] = [];
    for (const [placeId, rawMenu] of menuTexts) {
      if (rawMenu.length > 500) {
        const place = placesToSend.find(p => p.place_id === placeId);
        if (place) {
          menuCleanupPromises.push(
            cleanMenuWithAI(rawMenu, place.name, OPENAI_API_KEY).then(cleaned => {
              menuTexts.set(placeId, cleaned);
            })
          );
        }
      }
    }
    
    // Phase 3: GPT knowledge fallback for restaurants without menu content
    // Resolve city name from first place's vicinity
    const cityName = placesToSend[0]?.vicinity?.split(",").pop()?.trim() || "unknown city";
    for (const p of placesToSend) {
      if (!menuTexts.has(p.place_id) || (menuTexts.get(p.place_id)?.length ?? 0) < 200) {
        menuCleanupPromises.push(
          fetchMenuViaGPTKnowledge(p.name, cityName, OPENAI_API_KEY).then(fallbackMenu => {
            if (fallbackMenu) {
              const existing = menuTexts.get(p.place_id) || "";
              menuTexts.set(p.place_id, existing + fallbackMenu);
            }
          })
        );
      }
    }
    
    await Promise.all(menuCleanupPromises);
    console.log(`Menu pipeline complete: ${menuTexts.size} restaurants with menu data`);
    
    // Log AI menu processing costs
    const menuCleanupCount = [...menuTexts.values()].filter(t => t.length > 500).length;
    const fallbackCount = [...menuTexts.values()].filter(t => t.includes("GPT KNOWLEDGE")).length;
    if (menuCleanupCount > 0) logApiUsage(userId, "recommend-restaurants", "openai", "gpt-4o-mini", 0.0002 * menuCleanupCount, menuCleanupCount);
    if (fallbackCount > 0) logApiUsage(userId, "recommend-restaurants", "openai", "gpt-4o-mini", 0.0001 * fallbackCount, fallbackCount);

    const placesListText = placesToPromptList(placesToSend, latitude, longitude, detailsMap, menuTexts, generalTexts, menuPageUrls);

    const contextNote = context ? `Additional context: ${context}` : "";
    const now = new Date();
    const userLocalNote = `Current UTC time: ${now.toISOString()}.`;

    const mealTimeInstruction = mealTime
      ? `The user is looking for: ${mealTime}. Adjust recommendations accordingly.`
      : `The user wants to eat NOW. Only recommend restaurants whose kitchen is currently open.`;

    const isExclusiveAirport = isAtAirport && (priceTier === "exclusive" || priceTier === "most_exclusive");
    const airportSideNote = airportSide === "before_security"
      ? `\nSECURITY SIDE: The user is BEFORE SECURITY (LANDSIDE). ONLY recommend landside venues — restaurants, cafés, and lounges accessible before the security checkpoint. Most premium airside lounges will NOT be accessible. Focus on landside dining, hotel restaurants near the terminal, and any landside lounges.`
      : airportSide === "after_security"
      ? `\nSECURITY SIDE: The user is AFTER SECURITY (AIRSIDE). Focus on airside venues — gate-area restaurants, duty-free dining, and airside lounges. Prioritize premium lounges and sit-down restaurants past the security checkpoint.`
      : "";
    const airportNote = isAtAirport && isAirportTier
      ? `AIRPORT MODE — CRITICAL:
The user is INSIDE an airport.${isExclusiveAirport ? " They selected the MOST EXCLUSIVE tier." : ""}${airportSideNote}

ACCESSIBILITY RULE (NON-NEGOTIABLE):
- ONLY recommend lounges, restaurants, and experiences that are ACCESSIBLE TO THE PUBLIC — either via:
  1. Business/First class boarding pass
  2. Payment (day pass, walk-in fee, Priority Pass, credit card lounge programs like Amex Centurion, Diners Club, etc.)
  3. Walk-in access (any passenger can enter)
- DO NOT recommend:
  - Staff-only restaurants or cafeterias
  - Corporate/employee-only lounges
  - Private facilities that require airline employment or special corporate passes
  - Any venue that a regular passenger CANNOT access by purchasing entry or holding a qualifying ticket/card
- For each recommendation, CLEARLY STATE how to gain access (e.g., "Business class ticket on Lufthansa", "Day pass available for €50", "Free with Priority Pass", "Walk-in, open to all passengers")

- PRIORITIZE the absolute best airport LOUNGES available — first class lounges, VIP private terminals, invitation-only lounges.
${isExclusiveAirport ? `- For EXCLUSIVE tier, go ALL OUT: find the most prestigious lounges in this airport.
  - First Class lounges (e.g., Lufthansa First Class Terminal, Emirates First Class Lounge, Qatar Al Safwa, Singapore Airlines Private Room)
  - Independent VIP terminal services (e.g., PS at LAX, Private Suite, Primeclass, VIP Terminal services)
  - Priority Pass Lounges with the highest ratings
  - If the airport has a private terminal or VIP arrival/departure service, HIGHLIGHT IT.` : ""}
- For each lounge, describe in detail:
  - Food quality (buffet quality, à la carte dining, champagne selection, spirits)
  - Comfort level (seating, sleeping pods, daybeds, noise levels)
  - Premium amenities: showers, spa treatments, massage, quiet rooms, private suites
  - Wi-Fi quality, workspaces, printing
  - Access requirements: airline status, credit card programs, Priority Pass, day-pass price (BE SPECIFIC)
- Also include any genuinely excellent sit-down restaurants inside the airport with 4.5+ stars.
- For restaurants, mention celebrity chef connections, awards, or unique features.
- Do NOT recommend fast food chains, food courts, or generic cafés.
- Rank lounges ABOVE restaurants unless a restaurant is truly exceptional.
- For EVERY recommendation, include a short "directionHint" — a brief phrase helping the user physically find the place inside the airport (e.g., "Terminal 2, past Gate B12 on the left", "Landside arrivals hall, ground floor near exit 3", "After security, turn right at duty-free"). Be as specific as possible using terminal, gate, floor, and landmark references.`
      : "";

    // Distance note for expanded radius
    const distanceNote = expandedRadius && maxDistance
      ? `\nIMPORTANT: The user requested results within ${maxDistance} km, but we had to expand to ${(actualRadiusUsed / 1000).toFixed(0)} km to find enough options. In your summary, briefly note that the best options are further than the ${maxDistance} km radius they requested.`
      : "";

    const scopeNote = isBestInTown
      ? "BEST IN TOWN mode: Pick the absolute best from the list, regardless of distance (up to 45 min drive)."
      : "CLOSEST mode: Prioritize the nearest high-quality options. All must be walkable (under 15 min walk).";

    const lowCarbTipInstruction = `LOW-CARB TIPS: For EVERY meal option, include a "lowCarbTip" — a short, practical phrase to optimize the dish for high saturated fat, high protein, and low carbs (e.g. "Ask without the fries — extra butter on the steak", "Skip the bread, ask for bone marrow butter on the side", "Request it cooked in butter or tallow, not seed oil").`;

    const isBudgetTier = ["cheapest", "good_deal", "affordable", "value"].includes(priceTier || "");

    const menuVerificationInstruction = isBudgetTier
      ? `MENU VERIFICATION (ZERO TOLERANCE — ALL TIERS INCLUDING BUDGET): You MUST carefully read the "Menu Content" provided for each restaurant. This content has been cleaned and structured from their actual menu pages, PDF menus, and dining sub-pages. Your dish recommendations MUST come ONLY from dishes that actually appear in this scraped content OR from your CONFIRMED, SPECIFIC knowledge of this exact restaurant's real menu items. If the content mentions specific dishes with prices, use those EXACT names and prices.

ABSOLUTELY FORBIDDEN: Do NOT invent dishes based on cuisine type. Do NOT suggest "typical" dishes. Do NOT assume a Greek restaurant serves souvlaki, or that a steakhouse serves ribeye, unless you found that EXACT dish in the Menu Content or you have verified knowledge of THIS specific restaurant's menu. A wrong dish recommendation destroys trust.

If NO menu content is available AND you cannot confirm specific dishes from this exact restaurant:
- Still recommend the restaurant (it passed verification).
- Leave mealOptions as an EMPTY array [].
- In "whatToOrder", write a SHORT 1-2 line description of the cuisine style (e.g. "Traditional Greek grill house"). No bullet points.
- In "whyThisPlace", add: "Menu not available online — check their website or Google Maps photos for current dishes."

DISH PRICING (CRITICAL): Include exact price ONLY if found in the Menu Content or verified source. If not found, OMIT dishPrice. NEVER invent prices.

DISH NAMING: The "dish" field must be the EXACT name as shown on the menu. The "englishName" field = English translation. The "localName" = exact dish name from menu in original language.

HOTEL RESTAURANTS: If a "Restaurant page" URL is provided, use it as websiteUrl.

DISH PAGE URL (CRITICAL): For each mealOption, include "dishPageUrl" linking to the EXACT source where the dish was found. Priority: 1) specific menu page URL, 2) restaurant website URL. If neither available, OMIT. NEVER use Google search URLs or invented URLs.`
      : `MENU VERIFICATION (CRITICAL — ZERO TOLERANCE): You MUST carefully read the "Menu Content" provided for each restaurant. This content has been cleaned and structured from their actual menu pages, PDF menus, and dining sub-pages. Your dish recommendations MUST come ONLY from dishes that actually appear in this scraped content OR from your CONFIRMED, SPECIFIC knowledge of this exact restaurant's real menu (not generic cuisine guesses).

ABSOLUTELY FORBIDDEN: Do NOT invent dishes. Do NOT guess based on cuisine type. Do NOT assume a steakhouse serves ribeye or a Greek restaurant serves souvlaki unless you found that EXACT dish in the Menu Content or have verified knowledge of THIS specific restaurant's actual menu. "A typical [cuisine] restaurant might serve X" is NEVER acceptable.

If NO menu content is available AND you cannot confirm specific dishes from this exact restaurant:
- Still recommend the restaurant (it passed operational verification).
- Leave mealOptions as an EMPTY array [].
- In "whatToOrder", write a SHORT 1-2 line description of the cuisine style. No bullet points.
- In "whyThisPlace", add: "Menu not available online — check their website or Google Maps photos for current dishes."
- This is ALWAYS better than inventing dishes that don't exist.

DISH PRICING (CRITICAL): Include exact price ONLY if found in Menu Content or verified source. OMIT dishPrice if not found. NEVER invent prices.

DISH NAMING: "dish" = EXACT name from the menu in original language. "englishName" = English translation. "localName" = exact original language name.

HOTEL RESTAURANTS: If "Restaurant page" URL is provided, use it as websiteUrl.

DISH PAGE URL (CRITICAL): Include "dishPageUrl" linking to the EXACT source. Priority: 1) specific menu page, 2) restaurant website. If neither available, OMIT. NEVER use Google search URLs or invented URLs.`;

    const languageInstruction = lang === "el"
      ? `\nLANGUAGE RULES — CRITICAL:
- ALL text fields MUST be in Greek (Ελληνικά): summary, whyThisPlace, whatToAvoid, lowCarbTip, verificationNote, orderingPhrase (unless the restaurant is NOT in Greece — then orderingPhrase stays in the restaurant's local language).
- Restaurant names: keep in their ORIGINAL form exactly as they appear on Google Maps (Latin stays Latin, Greek stays Greek).
- Dish names: "dish"/"localName" = original menu language, "englishName" = English translation. In lowCarbTip and descriptions, use the Greek translation of the dish name.
- Location names: keep original characters.
- Do NOT mix English into Greek text. The ONLY exception: dish names in englishName field.\n`
      : "";

    const clientProfile = await clientProfilePromise;
    const systemPrompt = isShopping
      ? `${clientProfile}${buildShoppingPrompt()}
${languageInstruction}
${userLocalNote}

GPS coordinates: ${latitude}, ${longitude}

PRICE TIER: ${buildPriceTierInstruction(priceTier)}

VERIFIED SHOPS FROM GOOGLE PLACES (you MUST only pick from this list):
${placesListText}

RULES:
- Pick the best 3-4 options from the list above for shopping
- Use the EXACT name, address, rating, review count, and distance shown above
- COPY THE EXACT Place ID from each listing into the "placeId" field — this is CRITICAL for map links to work
- Do NOT change or invent any shop data

${menuVerificationInstruction}
- Do NOT generate googleMapsUrl or appleMapsUrl — they will be built automatically from the placeId
- Add your expertise: what to buy, product tips, carnivore shopping guidance
- For each product, include an estimated price per kilo (pricePerKg) in the local currency of the location. If the local currency is not EUR, add the EUR equivalent in parentheses, e.g. "~CHF 25-35/kg (~EUR 23-32)". If it is EUR, just use EUR, e.g. "~25-35 EUR/kg". Base estimates on realistic local market prices for the specific store type and price tier.
- Resolve the GPS coordinates to the nearest neighborhood name for display
- If you know or suspect a shop is permanently closed, temporarily closed, or under renovation, DO NOT recommend it even if it appears in the list.
- NEVER recommend a shop that you cannot match to an entry in the verified list above.
- If a shop doesn't sell meat, animal products, or carnivore essentials, skip it.
${exclude && exclude.length > 0 ? `\nDO NOT recommend any of the following shops (already shown to the user):\n${exclude.map((n: string) => `- ${n}`).join("\n")}\n` : ""}
${filterRelaxationNote}
${contextNote}`
      : isDelivery
      ? `${clientProfile}${buildDeliveryPrompt()}
${languageInstruction}
${userLocalNote}
${mealTimeInstruction}

GPS coordinates: ${latitude}, ${longitude}

PRICE TIER: ${buildPriceTierInstruction(priceTier)}

VERIFIED RESTAURANTS FROM GOOGLE PLACES (you MUST only pick from this list):
${placesListText}

RULES:
- Pick the best 3-4 options from the list above for delivery
- Use the EXACT name, address, rating, review count, and distance shown above
- Do NOT change or invent any restaurant data
- Add your expertise: meal suggestions, ordering phrases, concierge commentary

AVERAGE PRICE PER PERSON (CRITICAL): For each restaurant, include "averagePrice" — the estimated cost per person for a typical meal in local currency. If not EUR, add EUR equivalent in parentheses, e.g. "~CHF 45/person (~EUR42)". If already EUR, just "~EUR30/person". This MUST reflect the selected price tier.

${menuVerificationInstruction}
- Resolve the GPS coordinates to the nearest neighborhood name for display
- If you know or suspect a restaurant is permanently closed, temporarily closed, or under renovation, DO NOT recommend it even if it appears in the list.
${exclude && exclude.length > 0 ? `\nDO NOT recommend any of the following restaurants (already shown to the user):\n${exclude.map((n: string) => `- ${n}`).join("\n")}\n` : ""}
${filterRelaxationNote}
${contextNote}`
      : `${clientProfile}You are an elite food concierge for high-performing executives who follow a high-saturated-fat, high-protein, low-carb lifestyle. Saturated fat is a CORNERSTONE of this diet — it is actively sought, not avoided. Prioritize dishes rich in animal fats: fatty cuts of meat, butter-cooked preparations, bone marrow, duck fat, lard, tallow, full-fat dairy. Never mention "keto" or "carnivore" — recommend the best rich, fatty protein options naturally.
${languageInstruction}
GPS: ${latitude}, ${longitude}
${userLocalNote}
${mealTimeInstruction}

PRICE TIER: ${buildPriceTierInstruction(priceTier)}

${airportNote}

${scopeNote}
${distanceNote}

VERIFIED RESTAURANTS — NUMBERED LIST (pick ONLY from this numbered list):
${placesListText}

⚠️ CRITICAL WARNING: If you recommend a restaurant NOT in the numbered list above, it will be AUTOMATICALLY REMOVED by our verification system and the user will see NOTHING. This is WORSE than recommending a lower-rated place from the list. EVERY restaurant you mention MUST match one of the numbered entries above BY EXACT NAME. Reference the number when possible (e.g. "Restaurant #3").

RULES:
You MUST ONLY recommend restaurants that appear in the VERIFIED numbered list above. Every place in this list has been confirmed CURRENTLY OPEN and OPERATIONAL via Google Maps right now. Do NOT recommend any restaurant not in this list — even if you know it exists or consider it superior. If it is not listed, it is either closed right now or could not be verified.

Pick the 3-4 best options from what IS available. For exclusive/high-end tiers, choose the highest-rated and most upscale options from this open list. It is ALWAYS better to recommend a verified open restaurant than to recommend nothing.

HARD MINIMUM: You MUST recommend AT LEAST 3 restaurants from this list. Returning fewer than 3 is NEVER acceptable.

NO-MENU FALLBACK (ALL TIERS — CRITICAL): If you cannot find specific dishes in the scraped Menu Content AND you do not have CONFIRMED knowledge of this exact restaurant's real menu:
- NEVER invent or guess dish names. NEVER present a dish as real if you haven't verified it.
- Leave mealOptions as an EMPTY array [].
- In "whatToOrder", write a SHORT 1-2 line description of the cuisine style (e.g. "Traditional Greek grill house"). Do NOT list specific dish names even as examples — that is guessing.
- Add in "whyThisPlace": "Menu not available online — check their website or Google Maps photos for current dishes."
- Still include the restaurant with all other verified details.
- This is ALWAYS better than recommending a dish that doesn't exist at the restaurant.

Use the EXACT name, rating, review count, distance, and walking/driving time from the list.
- ALL meal suggestions MUST be high-saturated-fat, high-protein, low-carb: fatty steaks (ribeye, côte de boeuf, T-bone), lamb chops, bone marrow, duck confit, pork belly, butter-basted fish, seafood platters, eggs cooked in butter. Prioritize the FATTIEST preparations available. NEVER recommend pasta, pizza, bread dishes, seed-oil-fried items, or carb-heavy sides.
- If a restaurant has no suitable high-fat protein dishes, skip it.

${lowCarbTipInstruction}

${menuVerificationInstruction}

PRICE TIER BACKFILL: If fewer than 3 qualify at the selected tier, backfill from the next lower tier. Label backfilled items with "(High-End alternative)" or "(Good Deal alternative)" in whyThisPlace.

YOUR ADDITIONS (on top of verified data):
- Concierge "why this place" description
- The "Menu Content" provided has been cleaned and structured by an AI pre-processor. Scan ALL sections thoroughly — every dish listed there has been verified as a real menu item.
- If a restaurant has NO Menu Content section or it is empty, follow the NO-MENU FALLBACK rule above. NEVER guess dishes.
- Meal options organized by COURSE. Include ALL suitable low-carb/protein dishes you can find in the Menu Content — do NOT limit to 2-3. The more great options we show, the better the experience:
  * "starter": Any compelling high-fat, low-carb starters (bone marrow, tartare, carpaccio, charcuterie boards, seafood platters, foie gras, duck rillettes, burrata, salads without carbs, rich soups, etc.). Prioritize items with high saturated fat content. Skip this course entirely only if truly nothing qualifies.
  * "main": Look for ANY section with keywords: Grill, Meat, Fish, Steak, Eggs, Omelette, Seafood, Rotisserie, Charcoal, Poultry, Lamb, Beef, Côte, Entrecôte, Ribeye, T-Bone, Pork Belly, Duck, Confit — most dishes in these sections are suitable. PRIORITIZE the fattiest cuts and preparations: ribeye over filet, côte de boeuf over tournedos, duck confit over grilled chicken breast, butter-basted over dry-grilled. Include ALL good high-fat protein options. Always include at least 2 main course options. Do NOT skip dishes just because there are already enough — include EVERY suitable option.
  * "dessert": Any low-carb, high-fat desserts (cheese plate with aged/full-fat cheeses, berries with heavy cream, panna cotta, crème brûlée, chocolate mousse, etc.). Skip only if truly nothing qualifies.
- COURSE ASSIGNMENT: Use your best judgment to categorize each dish as "starter", "main", or "dessert". It doesn't need to be 100% precise — a small appetizer plate listed under mains can be a starter, and vice versa. What matters is that ALL good options are included somewhere.
- Each meal option MUST include the "course" field with one of: "starter", "main", "dessert"
- Mark the single best option per course as isRecommended: true
- Dish names in original language + English translation if different
- Ordering phrase in local language
- Kitchen hours (the restaurant's actual kitchen service times, NOT hotel reception hours)
- Average price per person: specific number in local currency. If NOT EUR, add EUR equivalent in parentheses, e.g. "~CHF 45/person (~EUR42)". If already EUR, just "~EUR30/person".
- Bold 1-2 sentence summary recommendation
- What to avoid in the area

OPENING HOURS:
- Skip restaurants that are closed or close within 15 min.
- NEVER recommend places marked temporarily/permanently closed.
- HOTEL RESTAURANTS: When a restaurant is inside a hotel, the "name" field MUST be ONLY the restaurant's own name — NEVER the hotel name, NEVER "Hotel - Restaurant" format. Examples: ✅ "Chat-Botté" ✅ "L'Aparté" ❌ "Beau-Rivage" ❌ "Hôtel Royal Genève - L'Aparté". In "whyThisPlace", mention: "Located inside [Hotel Name]." ALL data (kitchenHours, price range, cuisine) must come from the RESTAURANT, not the hotel. kitchenHours must be the restaurant's service times, never "Open 24 hours" from the hotel. The system will verify the restaurant independently on Google Maps using its own name — this gives the client the restaurant's photos, reviews, menu, and correct Maps links.
- MICHELIN STARS (IMPORTANT): Actively screen every restaurant in the list for current Michelin stars. Cross-reference your knowledge of the current Michelin Guide for the city/region. If a restaurant holds 1, 2, or 3 Michelin stars, you MUST include "michelinStars" with the correct count. This is a premium concierge service — Michelin recognition is critical information for the client. Do NOT guess; only include if you are confident the restaurant currently holds the star(s). Omit the field entirely if the restaurant has no Michelin stars or you are unsure.

Tone: Direct, calm, confident. No diet language. No calorie counts. No fat-shaming — saturated fat is a feature, not a bug. Think private concierge.

CLOSED RESTAURANTS SAFETY NET: CRITICAL — Before recommending any restaurant, verify it is currently open and operating. Skip any you know or suspect is temporarily closed (renovation, seasonal), permanently closed, or has uncertain status. This applies even if the restaurant appears in the verified list. When in doubt, skip it and pick another.
${exclude && exclude.length > 0 ? `\nDO NOT recommend (already shown):\n${exclude.map((n: string) => `- ${n}`).join("\n")}\n` : ""}
Resolve GPS to nearest street/neighborhood name.

${filterRelaxationNote}
${contextNote}`;

    const placeByName = new Map<string, GooglePlace>();
    const placeById = new Map<string, GooglePlace>();
    for (const p of placesToSend) {
      placeByName.set(p.name.toLowerCase(), p);
      placeById.set(p.place_id, p);
    }

    const mealOptionSchema = {
      type: "object",
      properties: {
        dish: { type: "string", description: "Exact dish name as shown on the menu in the original local language" },
        localName: { type: "string", description: "Exact dish name from the menu in original language (same as dish if already local)" },
        englishName: { type: "string", description: "English translation of the dish name" },
        isRecommended: { type: "boolean" },
        lowCarbTip: { type: "string" },
        pricePerKg: { type: "string", description: "Estimated price per kilo in local currency with EUR conversion in parentheses, e.g. '~25-35 EUR/kg' or '~CHF 25-35/kg (~EUR 23-32)'" },
        dishPrice: { type: "string", description: "Exact price from the menu/website, e.g. 'EUR 28' or 'CHF 32 (~EUR 29)'. ONLY include if found on menu. NEVER invent." },
      dishPageUrl: { type: "string", description: "Direct URL to the exact source page where this dish was found (menu page or business website). MUST be a verified, real URL. NEVER invent." },
        course: { type: "string", enum: ["starter", "main", "dessert"], description: "Course category: starter, main, or dessert" },
      },
      required: ["dish", "isRecommended", "lowCarbTip", "course"],
    };

    const shoppingToolSchema = {
      type: "function",
      function: {
        name: "provide_recommendations",
        description: "Return structured shopping recommendations for supermarkets, butchers, and markets",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "1-2 sentence recommendation summary about where to shop" },
            locationName: { type: "string", description: "Resolved neighborhood/street name" },
            restaurants: {
              type: "array",
              description: "Array of shops (supermarkets, butchers, markets)",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  cuisine: { type: "string", description: "Type of shop, e.g. 'Butcher', 'Supermarket', 'Organic Market'" },
                  distance: { type: "string" },
                  walkingTime: { type: "string" },
                  drivingTime: { type: "string" },
                  rating: { type: "number" },
                  reviewCount: { type: "number" },
                  averagePrice: { type: "string", description: "General price level description" },
                  whyThisPlace: { type: "string" },
                  mealOptions: {
                    type: "array",
                    description: "Products to buy at this shop",
                    items: mealOptionSchema,
                  },
                  orderingPhrase: { type: "string", description: "What to ask for at the shop" },
                  kitchenHours: { type: "string", description: "Store opening hours today" },
                  address: { type: "string" },
                  websiteUrl: { type: "string" },
                  photoQuery: { type: "string" },
                  verificationNote: { type: "string" },
                  placeId: { type: "string", description: "The Place ID from the verified list. MUST be copied exactly." },
                  michelinStars: { type: "number", description: "Number of Michelin stars (1, 2, or 3). Only include if the restaurant currently holds Michelin stars. Omit if none or unknown." },
                },
                required: ["name", "cuisine", "distance", "walkingTime", "drivingTime", "rating", "reviewCount", "whyThisPlace", "mealOptions", "orderingPhrase", "kitchenHours", "address", "placeId", "verificationNote"],
              },
            },
            whatToAvoid: { type: "string", description: "What products/aisles to avoid when shopping" },
          },
          required: ["summary", "locationName", "restaurants", "whatToAvoid"],
        },
      },
    };

    const toolSchema = isShopping
      ? shoppingToolSchema
      : isDelivery
      ? {
          type: "function",
          function: {
            name: "provide_recommendations",
            description: "Return structured delivery recommendations",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "1-2 sentence recommendation summary" },
                locationName: { type: "string", description: "Resolved neighborhood/street name" },
                restaurants: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      cuisine: { type: "string" },
                      distance: { type: "string" },
                      rating: { type: "number" },
                      reviewCount: { type: "number" },
                      averagePrice: { type: "string", description: "Price per person in local currency + EUR equivalent, e.g. '~CHF 45/person (~EUR42)'. If already EUR, just '~EUR30/person'." },
                      whyThisPlace: { type: "string" },
                      mealOptions: {
                        type: "array",
                        items: mealOptionSchema,
                      },
                      deliveryTime: { type: "string", description: "Estimated delivery time, e.g. '25-35 min'" },
                      orderingMethod: { type: "string" },
                      dietBadges: { type: "array", items: { type: "string" } },
                      orderingPhrase: { type: "string" },
                      kitchenHours: { type: "string", description: "Kitchen service hours today (not hotel reception)" },
                      address: { type: "string" },
                      websiteUrl: { type: "string" },
                      photoQuery: { type: "string" },
                      verificationNote: { type: "string" },
                      placeId: { type: "string", description: "The Place ID from the verified list. MUST be copied exactly." },
                      michelinStars: { type: "number", description: "Number of Michelin stars (1, 2, or 3). Only include if the restaurant currently holds Michelin stars. Omit if none or unknown." },
                    },
                    required: ["name", "cuisine", "distance", "rating", "reviewCount", "whyThisPlace", "mealOptions", "deliveryTime", "orderingPhrase", "kitchenHours", "address", "verificationNote", "placeId"],
                  },
                },
                whatToAvoid: { type: "string" },
              },
              required: ["summary", "locationName", "restaurants", "whatToAvoid"],
            },
          },
        }
      : {
          type: "function",
          function: {
            name: "provide_recommendations",
            description: "Return structured restaurant recommendations",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "1-2 sentence bold recommendation summary" },
                locationName: { type: "string", description: "Resolved neighborhood/street name" },
                restaurants: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      cuisine: { type: "string" },
                      distance: { type: "string" },
                      walkingTime: { type: "string" },
                      drivingTime: { type: "string" },
                      rating: { type: "number" },
                      reviewCount: { type: "number" },
                      averagePrice: { type: "string", description: "Price per person in local currency + EUR equivalent, e.g. '~CHF 45/person (~EUR42)'. If already EUR, just '~EUR30/person'." },
                      whyThisPlace: { type: "string" },
                      mealOptions: {
                        type: "array",
                        items: mealOptionSchema,
                      },
                      orderingPhrase: { type: "string" },
                      kitchenHours: { type: "string", description: "Kitchen service hours today (not hotel reception)" },
                      address: { type: "string" },
                      photoQuery: { type: "string" },
                      verificationNote: { type: "string" },
                      directionHint: { type: "string", description: "Short phrase with directions to find the place inside an airport (terminal, gate, floor). Only for airport mode." },
                      michelinStars: { type: "number", description: "Number of Michelin stars (1, 2, or 3). Only include if the restaurant currently holds Michelin stars. Omit if none or unknown." },
                    },
                    required: ["name", "cuisine", "distance", "walkingTime", "drivingTime", "rating", "reviewCount", "whyThisPlace", "mealOptions", "orderingPhrase", "kitchenHours", "address", "verificationNote"],
                  },
                },
                whatToAvoid: { type: "string" },
              },
              required: ["summary", "locationName", "restaurants", "whatToAvoid"],
            },
          },
        };

    // Debug logging: show candidates being sent to GPT
    console.info(`GPT call: sending ${placesToSend.length} candidates: ${placesToSend.map((p: any) => `"${p.name}"`).join(", ")}`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `My current GPS coordinates: ${latitude}, ${longitude}. Pick the best 3-4 ${isShopping ? "shops (supermarkets, butchers, markets)" : isDelivery ? "delivery options" : "restaurants"} from the verified list and give me your concierge recommendations.`,
          },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "provide_recommendations" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error("OpenAI API error:", status);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Service busy. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Service temporarily unavailable");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const recommendations = JSON.parse(toolCall.function.arguments);

    if (recommendations.restaurants) {
      const verified: typeof recommendations.restaurants = [];
      for (const r of recommendations.restaurants) {
        // Fuzzy matching: exact placeId > exact name > substring containment > website text match
        const lower = r.name.toLowerCase();
        let matchedPlace = (r.placeId && placeById.get(r.placeId))
          || placeByName.get(lower)
          || (() => { for (const [pn, p] of placeByName) { if (lower.includes(pn) || pn.includes(lower)) return p; } return undefined; })();

        // Website-text fallback: if GPT used internal restaurant name (e.g. "Le Jardin" for hotel "Le Richemond")
        if (!matchedPlace) {
          for (const [pid, text] of menuTexts) {
            if (text.toLowerCase().includes(lower)) {
              matchedPlace = placeById.get(pid);
              if (matchedPlace) { console.info(`Matched "${r.name}" via website text of "${matchedPlace.name}"`); break; }
            }
          }
        }

        // If still no match, drop — GPT went off-list
        if (!matchedPlace) {
          console.info(`Dropping "${r.name}": NOT in verified open list (GPT went off-list)`);
          continue;
        }
        r.googleMapsUrl = buildGoogleMapsUrl(matchedPlace);
        r.appleMapsUrl = buildAppleMapsUrl(matchedPlace);
        r.address = matchedPlace.vicinity;
        r.rating = matchedPlace.rating ?? r.rating;
        r.reviewCount = matchedPlace.user_ratings_total ?? r.reviewCount;
        const dist = haversineDistance(latitude, longitude, matchedPlace.geometry.location.lat, matchedPlace.geometry.location.lng);
        r.distance = formatDistance(dist);
        r.walkingTime = estimateWalkingTime(dist);
        r.drivingTime = estimateDrivingTime(dist);
        r.verificationNote = `Verified on Google Maps: ${matchedPlace.rating ?? "N/A"}★, ${matchedPlace.user_ratings_total ?? 0} reviews`;
        r.photoReference = matchedPlace.photos?.[0]?.photo_reference || null;
        const details = detailsMap.get(matchedPlace.place_id);
        if (details?.weekday_text) {
          r.kitchenHours = getTodayHours(details.weekday_text);
        }
        if (details?.website && !r.websiteUrl) {
          r.websiteUrl = details.website;
        }
        // Prefer restaurant/menu-specific page URL over generic homepage for all venues
        const menuUrl = menuPageUrls.get(matchedPlace.place_id);
        if (menuUrl) {
          r.websiteUrl = menuUrl;
        }
        verified.push(r);
      }
      // Post-verification auto-fill: ensure minimum 3 results
      if (verified.length > 0 && verified.length < 3 && placesToSend.length > 0) {
        const verifiedNames = new Set(verified.map((r: any) => r.name.toLowerCase()));
        const remaining = placesToSend
          .filter(p => !verifiedNames.has(p.name.toLowerCase()))
          .filter(p => !isCheapTierQuality || !isHotelVenue(p));
        for (const place of remaining.slice(0, 3 - verified.length)) {
          const dist = haversineDistance(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng);
          const details = detailsMap.get(place.place_id);
          const menuUrl = menuPageUrls.get(place.place_id);
          verified.push({
            name: place.name,
            cuisine: place.types?.find((t: string) => !["restaurant", "food", "point_of_interest", "establishment"].includes(t)) || "Restaurant",
            rating: place.rating ?? 0,
            reviewCount: place.user_ratings_total ?? 0,
            distance: formatDistance(dist),
            walkingTime: estimateWalkingTime(dist),
            drivingTime: estimateDrivingTime(dist),
            whyThisPlace: `Verified open nearby. ${place.rating ?? "N/A"}★ with ${place.user_ratings_total ?? 0} reviews.`,
            whatToOrder: `${place.types?.includes('cafe') ? 'Cafe-style dining' : 'Restaurant'} -- check Google Maps photos or their website for current menu and protein options.`,
            orderingPhrase: "",
            googleMapsUrl: buildGoogleMapsUrl(place),
            appleMapsUrl: buildAppleMapsUrl(place),
            address: place.vicinity,
            verificationNote: `Auto-filled to meet minimum 3: ${place.rating ?? "N/A"}★`,
            photoReference: place.photos?.[0]?.photo_reference || null,
            kitchenHours: details?.weekday_text ? getTodayHours(details.weekday_text) : undefined,
            websiteUrl: menuUrl || details?.website || undefined,
          });
        }
        console.info(`Auto-filled to ${verified.length} results (minimum 3 enforcement)`);
      }
      recommendations.restaurants = verified;
      console.info(`Verification: ${verified.length} verified, ${recommendations.restaurants.length - verified.length || 0} dropped`);

      // Debug logging: show what GPT returned vs what matched
      if (recommendations.restaurants) {
        const gptNames = recommendations.restaurants.filter((r: any) => !verified.includes(r)).map((r: any) => r.name);
        if (gptNames.length > 0) {
          console.info(`GPT returned off-list names: ${gptNames.join(", ")}`);
        }
      }

      // Direct fallback: if GPT went entirely off-list, re-run GPT with forced picks
      // Use placesToSend if available, otherwise fall back to original places array
      const fallbackPool = placesToSend.length > 0 ? placesToSend : places;
      if (verified.length === 0 && fallbackPool.length > 0) {
        console.info(`GPT went entirely off-list. Re-running with forced picks from ${fallbackPool.length} verified places.`);
        let topPlaces = [...fallbackPool]
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, 6);
        // Filter hotels from retry path for cheap tiers
        if (isCheapTierQuality && !isAtAirport) {
          topPlaces = topPlaces.filter(p => !isHotelVenue(p));
        }

        const forcedList = placesToPromptList(topPlaces, latitude, longitude, detailsMap, menuTexts, generalTexts, menuPageUrls);
        const forcedPrompt = `You are an elite food concierge. Here are ${topPlaces.length} venues confirmed OPEN right now near GPS ${latitude}, ${longitude}. Recommend ALL of them with full concierge details (meal options, ordering phrase in local language, kitchen hours, why this place, average price per person).
${languageInstruction}
CRITICAL NAME RULE: The "name" field in your response MUST be the EXACT name shown in the list below. Do NOT rename venues. If a venue is a hotel with a restaurant inside, use the HOTEL name exactly as listed (e.g. "Le Richemond" not "Le Jardin", "Beau-Rivage Genève" not "Chat-Botté"). Mention the internal restaurant name in "whyThisPlace" instead (e.g. "Home to Le Jardin restaurant").

⚠️ WARNING: You MUST use the EXACT restaurant names from this list. Any name not matching will be removed and the user sees NOTHING.

VENUES (ALL verified open — recommend ALL):
${forcedList}

Focus on meat-based, high-protein options. Tone: calm, confident, like a private concierge.
${menuVerificationInstruction}
${lowCarbTipInstruction}`;

        try {
          const retryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                { role: "system", content: forcedPrompt },
                { role: "user", content: "Give me your concierge recommendations for ALL these restaurants." },
              ],
              tools: [toolSchema],
              tool_choice: { type: "function", function: { name: "provide_recommendations" } },
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            const retryTool = retryData.choices?.[0]?.message?.tool_calls?.[0];
            if (retryTool) {
              const retryRecs = JSON.parse(retryTool.function.arguments);
              if (retryRecs.restaurants?.length > 0) {
                for (const r of retryRecs.restaurants) {
                  const lower = r.name.toLowerCase();
                  let mp = (r.placeId && placeById.get(r.placeId))
                    || placeByName.get(lower)
                    || (() => { for (const [pn, p] of placeByName) { if (lower.includes(pn) || pn.includes(lower)) return p; } return undefined; })();
                  // Website-text fallback: if GPT used internal restaurant name, match via website content
                  if (!mp) {
                    for (const [pid, text] of menuTexts) {
                      if (text.toLowerCase().includes(lower)) {
                        mp = placeById.get(pid);
                        if (mp) { console.log(`Retry: matched "${r.name}" via website text of "${mp.name}"`); break; }
                      }
                    }
                  }
                  if (mp) {
                    // Keep GPT's restaurant name (may differ from hotel name) for better UX
                    r.googleMapsUrl = buildGoogleMapsUrl(mp);
                    r.appleMapsUrl = buildAppleMapsUrl(mp);
                    r.address = mp.vicinity;
                    r.rating = mp.rating ?? r.rating;
                    r.reviewCount = mp.user_ratings_total ?? r.reviewCount;
                    const dist = haversineDistance(latitude, longitude, mp.geometry.location.lat, mp.geometry.location.lng);
                    r.distance = formatDistance(dist);
                    r.walkingTime = estimateWalkingTime(dist);
                    r.drivingTime = estimateDrivingTime(dist);
                    r.verificationNote = `Verified on Google Maps: ${mp.rating ?? "N/A"}★, ${mp.user_ratings_total ?? 0} reviews`;
                    r.photoReference = mp.photos?.[0]?.photo_reference || null;
                    const details = detailsMap.get(mp.place_id);
                    if (details?.weekday_text) r.kitchenHours = getTodayHours(details.weekday_text);
                    if (details?.website) r.websiteUrl = details.website;
                    // Prefer restaurant/menu-specific page URL over generic homepage for all venues
                    const menuUrl2 = menuPageUrls.get(mp.place_id);
                    if (menuUrl2) r.websiteUrl = menuUrl2;
                    verified.push(r);
                  } else {
                    console.log(`Retry: could not match "${r.name}" to any verified place`);
                  }
                }
                recommendations.restaurants = verified;
                recommendations.summary = retryRecs.summary || recommendations.summary;
                recommendations.whatToAvoid = retryRecs.whatToAvoid || recommendations.whatToAvoid;
                console.info(`Retry GPT: ${verified.length} restaurants verified from forced picks`);
                // Log extra GPT call
                logApiUsage(userId, "recommend-restaurants", "openai", "gpt-4o", 0.003);
              }
            }
          }
        } catch (retryErr) {
          console.error("Retry GPT error:", retryErr);
        }

        // Final bare fallback if retry also produced 0
        if (verified.length === 0) {
          let barePlaces = topPlaces.length > 0 ? topPlaces : [...fallbackPool].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 4);
          // Filter hotels from bare fallback for cheap tiers
          if (isCheapTierQuality && !isAtAirport) {
            barePlaces = barePlaces.filter(p => !isHotelVenue(p));
          }
          console.info(`Retry also failed. Auto-picking top ${Math.min(4, barePlaces.length)} as bare entries.`);
          for (const place of barePlaces.slice(0, 4)) {
            const dist = haversineDistance(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng);
            const details = detailsMap.get(place.place_id);
            verified.push({
              name: place.name,
              cuisine: place.types?.find((t: string) => !["restaurant", "food", "point_of_interest", "establishment"].includes(t)) || "Restaurant",
              rating: place.rating ?? 0,
              reviewCount: place.user_ratings_total ?? 0,
              distance: formatDistance(dist),
              walkingTime: estimateWalkingTime(dist),
              drivingTime: estimateDrivingTime(dist),
              whyThisPlace: `Top-rated nearby restaurant, verified open right now. ${place.rating ?? "N/A"}★ with ${place.user_ratings_total ?? 0} reviews.`,
              whatToOrder: `Verified open nearby -- browse Google Maps photos or visit their website to explore menu options for meat and protein dishes.`,
              orderingPhrase: "",
              googleMapsUrl: buildGoogleMapsUrl(place),
              appleMapsUrl: buildAppleMapsUrl(place),
              address: place.vicinity,
              verificationNote: `Auto-selected from verified open list: ${place.rating ?? "N/A"}★`,
              photoReference: place.photos?.[0]?.photo_reference || null,
              kitchenHours: details?.weekday_text ? getTodayHours(details.weekday_text) : undefined,
              websiteUrl: details?.website || undefined,
            });
          }
          recommendations.restaurants = verified;
          recommendations.summary = (recommendations.summary || "") + " (Auto-selected from verified open restaurants nearby.)";
        }
      }

      // Price tier fallback: if still 0 results, retry with lower tier + expanded radius
      if (verified.length === 0 && !fallbackAttempted) {
        const tierFallbackChain: Record<string, string> = {
          "most_exclusive": "high_end",
          "exclusive": "high_end",
          "high_end": "good_deal",
          "good_deal": "value",
          "fine_dining": "good_deal",
        };
        const nextTier = priceTier ? tierFallbackChain[priceTier] : undefined;
        if (nextTier) {
          // Expand radius by 1.5x, capped at 40km
          const expandedMaxDist = Math.min(Math.ceil((maxDistance || 17) * 1.5), 40);
          console.info(`Price tier fallback: "${priceTier}" -> "${nextTier}", radius ${maxDistance || 17}km -> ${expandedMaxDist}km`);
          const fallbackBody = {
            latitude, longitude,
            priceTier: nextTier,
            mode: mode || undefined,
            scope, mealTime, context,
            exclude,
            maxDistance: expandedMaxDist,
            fallbackAttempted: true,
          };
          const selfUrl = `https://lglgmhzgxyvyftdhvdsy.supabase.co/functions/v1/recommend-restaurants`;
          const fallbackRes = await fetch(selfUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": req.headers.get("Authorization") || "",
              "apikey": req.headers.get("apikey") || "",
            },
            body: JSON.stringify(fallbackBody),
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackData.restaurants?.length > 0) {
            const tierLabel = priceTier === "most_exclusive" || priceTier === "exclusive" ? "exclusive" : priceTier === "high_end" ? "high-end" : priceTier || "";
            const nextLabel = nextTier === "high_end" ? "premium" : nextTier === "good_deal" ? "good value" : "budget-friendly";
            fallbackData.summary = `No ${tierLabel} options are open nearby right now. Here are excellent ${nextLabel} alternatives within ${expandedMaxDist}km. ${fallbackData.summary || ""}`;
          }
          return new Response(JSON.stringify(fallbackData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Log API usage (non-blocking) — count the API calls made
    // Google: 1 geocoding (airport detect), nearby searches vary, place details
    // OpenAI: verification (gpt-4o-mini), recommendation (gpt-4o), optional delivery pre-screen (gpt-4o-mini)
    const nearbySearchCount = isShopping ? 3 : isDelivery ? 3 : (isAtAirport && isAirportTier ? 5 : (expandedRadius ? 2 : 1));
    const placeDetailsCount = detailsMap.size;
    const hadVerification = unverifiedPlaces.length > 0;
    const hadPrescreen = isDelivery && placesToSend.length > 0;

    logApiUsage(userId, "recommend-restaurants", "google_maps", "geocoding", 0.0005); // airport detect
    logApiUsage(userId, "recommend-restaurants", "google_maps", "nearby_search", 0.0032 * nearbySearchCount, nearbySearchCount);
    if (placeDetailsCount > 0) logApiUsage(userId, "recommend-restaurants", "google_maps", "place_details", 0.0017 * placeDetailsCount, placeDetailsCount);
    if (hadVerification) logApiUsage(userId, "recommend-restaurants", "openai", "gpt-4o-mini", 0.0002);
    if (hadPrescreen) logApiUsage(userId, "recommend-restaurants", "openai", "gpt-4o-mini", 0.0002);
    logApiUsage(userId, "recommend-restaurants", "openai", "gpt-4o", 0.003);

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-restaurants error:", e);
    const isValidationError = e instanceof Error && (
      e.message.startsWith("Invalid") || e.message.includes("must be")
    );
    return new Response(
      JSON.stringify({ error: isValidationError ? e.message : "Service temporarily unavailable" }),
      { status: isValidationError ? 400 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
