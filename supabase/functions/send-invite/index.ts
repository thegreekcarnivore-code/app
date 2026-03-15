import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildAppUrl } from "../_shared/app-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin using their JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

    const { email, language, feature_access, program_template_id, start_date, measurement_day, group_id, resend } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch program template name if assigned
    let programName: string | null = null;
    if (program_template_id) {
      const { data: tpl } = await adminClient
        .from("program_templates")
        .select("name")
        .eq("id", program_template_id)
        .single();
      if (tpl) programName = tpl.name;
    }

    // Handle resend: check if a pending invitation already exists for this email
    if (resend) {
      // Update existing pending invitation instead of inserting
      const { data: existing } = await adminClient
        .from("email_invitations")
        .select("id")
        .eq("email", email)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        await adminClient
          .from("email_invitations")
          .update({
            language: language || "en",
            feature_access: feature_access || {},
            program_template_id: program_template_id || null,
            start_date: start_date || null,
            measurement_day: measurement_day != null ? measurement_day : null,
            group_id: group_id || null,
            resent_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }
      // If no pending invitation exists (e.g. status is 'used'), skip insertion
    } else {
      // New invitation: insert record
      const { error: insertError } = await adminClient
        .from("email_invitations")
        .insert({
          email,
          language: language || "en",
          feature_access: feature_access || {},
          program_template_id: program_template_id || null,
          start_date: start_date || null,
          measurement_day: measurement_day != null ? measurement_day : null,
          group_id: group_id || null,
          created_by: caller.id,
        });

      if (insertError) {
        console.error("Failed to store invitation:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Pass program details in user metadata so the invite email template can display them
    const userMetadata: Record<string, string> = { language: language || 'en' };
    if (programName) userMetadata.program_name = programName;
    if (start_date) userMetadata.start_date = start_date;

    // Use Supabase Admin API to invite user by email
    // This triggers the "invite" auth email type which uses our custom template
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: buildAppUrl("/auth"),
      data: userMetadata,
    });

    if (inviteError) {
      console.error("Failed to send invite:", inviteError);
      // Only clean up if this was a new invitation (not a resend)
      if (!resend) {
        await adminClient
          .from("email_invitations")
          .delete()
          .eq("email", email)
          .eq("status", "pending");
      }

      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action = resend ? "resent" : "sent";
    console.log(`Invite ${action} successfully to:`, email);

    return new Response(
      JSON.stringify({ success: true, message: `Invitation ${action} to ${email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send invite error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
