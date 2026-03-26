import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completePasswordReset,
  issuePasswordResetEmail,
  preparePasswordResetUser,
  verifyPasswordResetToken,
} from "../_shared/password-reset.ts";
import { createAppAccessLink } from "../_shared/app-access-links.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function isAdminRequest(req: Request, serviceClient: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await callerClient.auth.getUser();
  if (!user) return false;

  const { data } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email, token, password } = await req.json();

    if (action === "request") {
      if (!email || typeof email !== "string") {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminRequest = await isAdminRequest(req, serviceClient);
      const target = await preparePasswordResetUser({
        serviceClient,
        email,
        allowAccessGrant: true,
      });

      if (target.user && resendApiKey) {
        const shortLink = await createAppAccessLink({
          serviceClient,
          purpose: "password_reset",
          email: target.email,
          userId: target.user.id,
          language: target.language || "el",
        });

        await issuePasswordResetEmail({
          resendApiKey,
          email: target.email,
          language: target.language || "el",
          user: target.user,
          confirmationUrl: shortLink.url,
        });
      } else if (adminRequest && !target.user) {
        return new Response(JSON.stringify({ error: "User not found or reset link could not be generated" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!token || typeof token !== "string") {
        return new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = await verifyPasswordResetToken(token);
      const { data: authData, error: authError } = await serviceClient.auth.admin.getUserById(payload.sub);
      if (authError || !authData.user) {
        throw new Error("This reset link is not valid anymore");
      }

      const currentNonce = typeof authData.user.user_metadata?.password_reset_nonce === "string"
        ? authData.user.user_metadata.password_reset_nonce
        : "";

      if (!currentNonce || currentNonce !== payload.nonce) {
        throw new Error("This reset link has already been used or has expired");
      }

      return new Response(JSON.stringify({
        success: true,
        email: authData.user.email,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "complete") {
      if (!token || typeof token !== "string" || !password || typeof password !== "string") {
        return new Response(JSON.stringify({ error: "Token and password are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await completePasswordReset({
        serviceClient,
        token,
        password,
      });

      return new Response(JSON.stringify({
        success: true,
        email: result.email,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Password reset function failed:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Password reset failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
