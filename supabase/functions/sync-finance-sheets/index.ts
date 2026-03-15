import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Forbidden: admin only");

    // Get settings
    const { data: settings } = await supabase
      .from("finance_settings")
      .select("*")
      .eq("admin_id", user.id)
      .maybeSingle();

    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet ID not configured. Please set it in Finance Settings.");
    }

    const serviceKeyRaw = Deno.env.get("GOOGLE_SHEETS_SERVICE_KEY");
    if (!serviceKeyRaw) {
      throw new Error(
        "Google Sheets service account key not configured. Please contact support to set it up."
      );
    }

    const trimmedKey = serviceKeyRaw.trim();
    if (!trimmedKey.startsWith("{")) {
      // Common mistake: pasting a Google API key (starts with 'AIza...') instead of Service Account JSON.
      throw new Error(
        "GOOGLE_SHEETS_SERVICE_KEY must be a Google Service Account JSON (starts with '{'), not an API key (often starts with 'AIza')."
      );
    }

    // Parse the service account key
    let keyData: any;
    try {
      keyData = JSON.parse(trimmedKey);
    } catch {
      throw new Error(
        "GOOGLE_SHEETS_SERVICE_KEY is not valid JSON; paste the full Service Account JSON key."
      );
    }

    if (!keyData?.client_email || !keyData?.private_key) {
      throw new Error(
        "GOOGLE_SHEETS_SERVICE_KEY JSON is missing client_email/private_key; ensure you pasted the full Service Account key JSON."
      );
    }


    // Create JWT for Google Sheets API
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      iss: keyData.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));

    // Import the private key
    const pemKey = keyData.private_key;
    const pemContents = pemKey
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\n/g, "");
    const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureInput = new TextEncoder().encode(`${header}.${payload}`);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signatureInput);
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const jwt = `${header}.${payload}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error("Token exchange failed:", errText);
      throw new Error("Failed to authenticate with Google");
    }

    const { access_token } = await tokenResp.json();

    // Fetch all finance entries
    const { data: entries, error: entriesErr } = await supabase
      .from("finance_entries")
      .select("*")
      .eq("admin_id", user.id)
      .order("entry_date", { ascending: true });

    if (entriesErr) throw new Error("Failed to fetch entries");

    // Build rows: Header + data
    const rows = [
      ["Date", "Type", "Category", "Description", "Amount", "Currency"],
      ...(entries || []).map((e: any) => [
        e.entry_date,
        e.type,
        e.category,
        e.description,
        e.amount,
        e.currency,
      ]),
    ];

    const sheetTab = settings.google_sheet_tab || "Finance";
    const sheetId = settings.google_sheet_id;

    // Clear and write
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetTab)}!A:F?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: rows }),
      }
    );

    // Update last_synced_at
    await supabase
      .from("finance_settings")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("admin_id", user.id);

    return new Response(JSON.stringify({ success: true, rows_synced: (entries || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-finance-sheets error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
