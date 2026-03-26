import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createAppAccessLink,
  resolveAppAccessLink,
} from "../_shared/app-access-links.ts";
import { preparePasswordResetUser } from "../_shared/password-reset.ts";
import { ensureInvitedClientAccess, normalizeEmail } from "../_shared/invited-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function requireAdminCaller(req: Request, serviceClient: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) {
    throw new Error("Unauthorized");
  }

  const { data: roleData } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    throw new Error("Admin access required");
  }

  return caller;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { action, purpose, email, token, language, redirect_path } = await req.json();

    if (action === "create") {
      const caller = await requireAdminCaller(req, serviceClient);
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (purpose === "magic_login") {
        const accessResult = await ensureInvitedClientAccess({
          serviceClient,
          email: normalizedEmail,
          language: language || "el",
          createdBy: caller.id,
          redirectPath: redirect_path || "/home",
        });

        const link = await createAppAccessLink({
          serviceClient,
          purpose: "magic_login",
          email: normalizedEmail,
          userId: accessResult.userId,
          createdBy: caller.id,
          language: accessResult.language || language || "el",
          redirectPath: redirect_path || "/home",
        });

        return new Response(JSON.stringify({ success: true, url: link.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (purpose === "password_reset") {
        const resetTarget = await preparePasswordResetUser({
          serviceClient,
          email: normalizedEmail,
          allowAccessGrant: true,
        });

        if (!resetTarget.user) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const link = await createAppAccessLink({
          serviceClient,
          purpose: "password_reset",
          email: normalizedEmail,
          userId: resetTarget.user.id,
          createdBy: caller.id,
          language: resetTarget.language || language || "el",
        });

        return new Response(JSON.stringify({ success: true, url: link.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unsupported purpose" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resolve") {
      if (!token || typeof token !== "string") {
        return new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await resolveAppAccessLink({
        serviceClient,
        token,
      });

      return new Response(JSON.stringify({
        success: true,
        purpose: result.purpose,
        redirect_url: result.redirectUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Access link error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : message === "Admin access required" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
