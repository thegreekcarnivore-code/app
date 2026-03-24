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

function buildRecoveryUrl({
  tokenHash,
}: {
  tokenHash: string;
}) {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: "recovery",
  });

  return `${buildAppUrl("/reset-password")}?${params.toString()}`;
}

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

    // Look up every profile row for this email because migrated users may still
    // have duplicate same-email rows and only one of them is auth-linked.
    const { data: profileRows, error: profileLookupError } = await adminClient
      .from("profiles")
      .select("id, language, approved, created_at, last_login_at")
      .eq("email", trimmedEmail);

    if (profileLookupError) {
      console.error("Profile lookup error:", profileLookupError);
    }

    let targetUser: any = null;
    let targetProfile: any = null;

    for (const profileRow of profileRows || []) {
      const { data: authData, error: getUserError } = await adminClient.auth.admin.getUserById(profileRow.id);
      if (!getUserError && authData?.user) {
        targetUser = authData.user;
        targetProfile = profileRow;
        break;
      }
    }

    // If we found the auth-linked user, confirm the email before generating the link.
    if (targetUser && !targetUser.email_confirmed_at) {
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
      return new Response(JSON.stringify({ error: "User not found or reset link could not be generated" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenHash = linkData?.properties?.hashed_token;
    const actionLink =
      (typeof tokenHash === "string" && tokenHash
        ? buildRecoveryUrl({ tokenHash })
        : null) ||
      linkData?.properties?.action_link ||
      "";

    if (!actionLink) {
      return new Response(JSON.stringify({ error: "Failed to generate reset link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve language preference
    const language =
      targetUser?.user_metadata?.language ||
      targetProfile?.language ||
      profileRows?.[0]?.language ||
      "el";

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
          "X-Entity-Ref-ID": `admin-reset-${targetUser?.id || trimmedEmail}-${Date.now()}`,
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
