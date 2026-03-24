import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getEmailLogoUrl } from "../_shared/app-config.ts";
import {
  ensureInvitedClientAccess,
  normalizeEmail,
  toFeatureAccessRecord,
} from "../_shared/invited-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildInviteHtml({
  firstName,
  language,
  loginUrl,
  programName,
  startDate,
}: {
  firstName: string;
  language: string;
  loginUrl: string;
  programName: string | null;
  startDate: string | null;
}) {
  const logoUrl = getEmailLogoUrl();
  const isGreek = language === "el";
  const greeting = isGreek
    ? `Γεια σου${firstName ? ` <strong>${firstName}</strong>` : ""},`
    : `Hi${firstName ? ` <strong>${firstName}</strong>` : ""},`;
  const heading = isGreek ? "Η πρόσβασή σου είναι έτοιμη" : "Your access is ready";
  const body1 = isGreek
    ? "Η πρόσβασή σου στο The Greek Carnivore έχει εγκριθεί αυτόματα από τον coach σου."
    : "Your access to The Greek Carnivore has been approved automatically by your coach.";
  const body2 = isGreek
    ? "Πάτησε το κουμπί παρακάτω για να μπεις κατευθείαν στην εφαρμογή. Δεν χρειάζεται να περιμένεις άλλη έγκριση."
    : "Use the button below to enter the app directly. No extra approval step is needed.";
  const body3 = isGreek
    ? "Αν θέλεις, μπορείς αργότερα να ορίσεις δικό σου κωδικό από τη σελίδα σύνδεσης."
    : "If you want, you can set your own password later from the login page.";
  const ctaText = isGreek ? "Άνοιγμα εφαρμογής" : "Open the app";
  const programLine = programName
    ? isGreek
      ? `<p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 8px;"><strong>Πρόγραμμα:</strong> ${programName}</p>`
      : `<p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 8px;"><strong>Program:</strong> ${programName}</p>`
    : "";
  const startLine = startDate
    ? isGreek
      ? `<p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 20px;"><strong>Έναρξη:</strong> ${startDate}</p>`
      : `<p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 20px;"><strong>Starts:</strong> ${startDate}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="${isGreek ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${logoUrl}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">
      ${heading}
    </h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 16px;">${body1}</p>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 16px;">${body2}</p>
    ${programLine}
    ${startLine}
    <a href="${loginUrl}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">
      ${ctaText}
    </a>
    <p style="font-size:12px;color:#999;margin:24px 0 0;line-height:1.5;">${body3}</p>
  </div>
</body>
</html>`;
}

async function requireAdminCaller(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller } } = await anonClient.auth.getUser();
  if (!caller) {
    throw new Error("Unauthorized");
  }

  const { data: roleData } = await anonClient
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

async function sendInviteEmail({
  email,
  subject,
  html,
}: {
  email: string;
  subject: string;
  html: string;
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
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

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await requireAdminCaller(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      email,
      language,
      feature_access,
      program_template_id,
      start_date,
      measurement_day,
      group_id,
      resend,
    } = await req.json();

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let programName: string | null = null;
    if (program_template_id) {
      const { data: tpl } = await serviceClient
        .from("program_templates")
        .select("name")
        .eq("id", program_template_id)
        .maybeSingle();
      programName = tpl?.name ?? null;
    }

    const { data: invitationRow, error: invitationInsertError } = await serviceClient
      .from("email_invitations")
      .insert({
        email: normalizedEmail,
        language: language || "el",
        feature_access: feature_access || {},
        program_template_id: program_template_id || null,
        start_date: start_date || null,
        measurement_day: measurement_day != null ? Number(measurement_day) : null,
        group_id: group_id || null,
        created_by: caller.id,
        resent_at: resend ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (invitationInsertError || !invitationRow?.id) {
      return new Response(JSON.stringify({ error: invitationInsertError?.message || "Failed to store invitation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessResult = await ensureInvitedClientAccess({
      serviceClient,
      email: normalizedEmail,
      language: language || "el",
      featureAccess: toFeatureAccessRecord(feature_access),
      programTemplateId: program_template_id || null,
      startDate: start_date || null,
      measurementDay: measurement_day != null ? Number(measurement_day) : null,
      groupId: group_id || null,
      createdBy: caller.id,
      invitationId: invitationRow.id,
      redirectPath: "/home",
    });

    const firstName = accessResult.displayName?.split(" ")[0] || "";
    const emailLanguage = accessResult.language || language || "el";
    const html = buildInviteHtml({
      firstName,
      language: emailLanguage,
      loginUrl: accessResult.loginUrl,
      programName,
      startDate: start_date || null,
    });

    const subject = emailLanguage === "el"
      ? resend
        ? "Νέος σύνδεσμος εισόδου για την εφαρμογή σου"
        : "Η πρόσβασή σου στο The Greek Carnivore είναι έτοιμη"
      : resend
        ? "Your fresh app access link"
        : "Your access to The Greek Carnivore is ready";

    await sendInviteEmail({
      email: normalizedEmail,
      subject,
      html,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: resend ? `Access link resent to ${normalizedEmail}` : `Access granted and invitation sent to ${normalizedEmail}`,
        direct_entry: true,
        restored_access: accessResult.restoredAccess,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Send invite error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : message === "Admin access required" ? 403 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
