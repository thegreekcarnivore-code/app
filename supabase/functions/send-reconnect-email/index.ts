import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildAppUrl } from "../_shared/app-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildReconnectHtml(firstName: string, language: string) {
  const logoUrl =
    "https://lglgmhzgxyvyftdhvdsy.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1";
  const appUrl = buildAppUrl("/auth");

  const isGreek = language === "el";

  const heading = isGreek ? "Καλως ηρθες ξανα" : "Welcome Back";
  const body1 = isGreek
    ? `Γεια σου${firstName ? ` <strong>${firstName}</strong>` : ""},`
    : `Hi${firstName ? ` <strong>${firstName}</strong>` : ""},`;
  const body2 = isGreek
    ? "Σου στελνουμε αυτο το μηνυμα ως υπενθυμιση οτι ο λογαριασμος σου στο The Greek Carnivore ειναι ετοιμος και σε περιμενει."
    : "We're sending you this message as a reminder that your account on The Greek Carnivore is ready and waiting for you.";
  const body3 = isGreek
    ? "Αν εχεις ξεχασει τον κωδικο σου ή δεν εχεις ορισει ακομα κωδικο, πατησε <strong>\"Ξεχασα τον κωδικο μου\"</strong> στη σελιδα συνδεσης για να τον επαναφερεις."
    : "If you've forgotten your password or haven't set one up yet, click <strong>\"Forgot Password\"</strong> on the login page to reset it.";
  const ctaText = isGreek ? "Συνδεση στην Εφαρμογη" : "Log In to the App";
  const footer = "The Greek Carnivore";

  return `<!DOCTYPE html>
<html lang="${isGreek ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${logoUrl}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">
      ${heading}
    </h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px;">
      ${body1}
    </p>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 16px;">
      ${body2}
    </p>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 24px;">
      ${body3}
    </p>
    <a href="${appUrl}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">
      ${ctaText}
    </a>
    <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">
      ${footer}
    </p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, language } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up display name for personalization
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("display_name")
      .eq("email", email)
      .maybeSingle();

    const firstName = profile?.display_name?.split(" ")[0] || "";

    const html = buildReconnectHtml(firstName, language || "el");
    const subject = (language || "el") === "el"
      ? "Επιστροφη στο The Greek Carnivore"
      : "Welcome Back to The Greek Carnivore";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "The Greek Carnivore <noreply@thegreekcarnivore.com>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await res.text(); // consume body

    console.log("Reconnect email sent to:", email);
    return new Response(
      JSON.stringify({ success: true, message: `Reconnect email sent to ${email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Send reconnect email error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
