import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { RecoveryEmail } from "../_shared/email-templates/recovery.tsx";
import { buildAppUrl } from "../_shared/app-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDER_DOMAIN = "thegreekcarnivore.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
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

    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Look up user by email in profiles table
    const { data: profileData } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (!profileData) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: targetUser }, error: getUserError } = await adminClient.auth.admin.getUserById(profileData.id);
    if (getUserError || !targetUser) {
      console.error("getUserById error:", getUserError);
      return new Response(JSON.stringify({ error: "User not found in auth" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm email if not yet verified
    if (!targetUser.email_confirmed_at) {
      console.log("Confirming unverified email for:", trimmedEmail);
      await adminClient.auth.admin.updateUserById(targetUser.id, {
        email_confirm: true,
      });
    }

    // Generate recovery link (bypasses rate limits)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: trimmedEmail,
      options: {
        redirectTo: buildAppUrl("/reset-password"),
      },
    });

    if (linkError) {
      console.error("Generate link error:", linkError);
      return new Response(JSON.stringify({ error: "Failed to generate reset link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionLink = linkData?.properties?.action_link || "";
    if (!actionLink) {
      return new Response(JSON.stringify({ error: "Failed to generate reset link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve language preference
    const language = targetUser.user_metadata?.language || "en";

    // Render branded recovery email
    const html = await renderAsync(
      React.createElement(RecoveryEmail, {
        siteName: "The Greek Carnivore",
        confirmationUrl: actionLink,
        language,
      })
    );

    const subject = language === "el" ? "Επαναφορα κωδικου" : "Reset your password";

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "The Greek Carnivore <noreply@thegreekcarnivore.com>",
        to: [trimmedEmail],
        subject,
        html,
        headers: {
          "X-Entity-Ref-ID": `admin-reset-${targetUser.id}-${Date.now()}`,
        },
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend API error:", resendRes.status, errBody);
      return new Response(JSON.stringify({ error: "Failed to send reset email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Recovery email sent to:", trimmedEmail);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
