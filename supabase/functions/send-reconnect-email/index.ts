import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getEmailLogoUrl } from "../_shared/app-config.ts";
import { ensureInvitedClientAccess, normalizeEmail } from "../_shared/invited-access.ts";
import { createAppAccessLink } from "../_shared/app-access-links.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildReconnectHtml(firstName: string, language: string, loginUrl: string) {
  const logoUrl = getEmailLogoUrl();
  const isGreek = language === "el";

  const heading = isGreek ? "Η πρόσβασή σου είναι ήδη ενεργή" : "Your access is already active";
  const body1 = isGreek
    ? `Γεια σου${firstName ? ` <strong>${firstName}</strong>` : ""},`
    : `Hi${firstName ? ` <strong>${firstName}</strong>` : ""},`;
  const body2 = isGreek
    ? "Σου στέλνουμε νέο σύνδεσμο για να μπεις κατευθείαν στην εφαρμογή. Ο λογαριασμός σου είναι ήδη εγκεκριμένος."
    : "We’re sending you a fresh link so you can enter the app directly. Your account is already approved.";
  const body3 = isGreek
    ? "Πάτησε το κουμπί παρακάτω και θα μπεις αμέσως, χωρίς να χρειάζεται νέα έγκριση."
    : "Use the button below and you’ll enter immediately, with no new approval step.";
  const ctaText = isGreek ? "Άνοιγμα εφαρμογής" : "Open the app";

  return `<!DOCTYPE html>
<html lang="${isGreek ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${logoUrl}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">
      ${heading}
    </h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px;">${body1}</p>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 16px;">${body2}</p>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 24px;">${body3}</p>
    <a href="${loginUrl}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">
      ${ctaText}
    </a>
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

async function sendReconnectEmail({
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

    const { email, language } = await req.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessResult = await ensureInvitedClientAccess({
      serviceClient,
      email: normalizedEmail,
      language: language || "el",
      createdBy: caller.id,
      redirectPath: "/home",
    });

    const firstName = accessResult.displayName?.split(" ")[0] || "";
    const emailLanguage = accessResult.language || language || "el";
    const shortLink = await createAppAccessLink({
      serviceClient,
      purpose: "magic_login",
      email: normalizedEmail,
      userId: accessResult.userId,
      createdBy: caller.id,
      language: emailLanguage,
      redirectPath: "/home",
    });
    const html = buildReconnectHtml(firstName, emailLanguage, shortLink.url);
    const subject = emailLanguage === "el"
      ? "Νέος σύνδεσμος εισόδου για το The Greek Carnivore"
      : "Your fresh login link for The Greek Carnivore";

    await sendReconnectEmail({
      email: normalizedEmail,
      subject,
      html,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reconnect email sent to ${normalizedEmail}`,
        restored_access: accessResult.restoredAccess,
        direct_entry: true,
        link_url: shortLink.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Send reconnect email error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : message === "Admin access required" ? 403 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
