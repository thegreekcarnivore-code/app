import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SignupEmail } from "../_shared/email-templates/signup.tsx";
import { InviteEmail } from "../_shared/email-templates/invite.tsx";
import { MagicLinkEmail } from "../_shared/email-templates/magic-link.tsx";
import { RecoveryEmail } from "../_shared/email-templates/recovery.tsx";
import { EmailChangeEmail } from "../_shared/email-templates/email-change.tsx";
import { ReauthenticationEmail } from "../_shared/email-templates/reauthentication.tsx";
import {
  buildAppUrl,
  getAppBaseUrl,
  getSupabaseProjectUrl,
} from "../_shared/app-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmailType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "reauthentication";

interface SendEmailHookPayload {
  user?: {
    id?: string;
    email?: string;
    email_change?: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data?: {
    token?: string;
    token_hash?: string;
    token_hash_new?: string;
    redirect_to?: string;
    email_action_type?: EmailType;
    site_url?: string;
  };
  data?: {
    email?: string;
    token?: string;
    token_hash?: string;
    new_email?: string;
    action_type?: EmailType;
    redirect_to?: string;
    user_metadata?: Record<string, unknown>;
  };
}

const EMAIL_SUBJECTS: Record<EmailType, string> = {
  signup: "Confirm your email",
  invite: "You've been invited",
  magiclink: "Your login link",
  recovery: "Reset your password",
  email_change: "Confirm your new email",
  reauthentication: "Your verification code",
};

const EMAIL_SUBJECTS_EL: Record<EmailType, string> = {
  signup: "Επιβεβαιωστε το email σας",
  invite: "Η πρόσκλησή σου προς την πραγματική αλλαγή",
  magiclink: "Ο συνδεσμος συνδεσης σας",
  recovery: "Επαναφορα κωδικου",
  email_change: "Επιβεβαιωστε το νεο email σας",
  reauthentication: "Ο κωδικος επαληθευσης σας",
};

const EMAIL_TEMPLATES: Record<EmailType, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
};

const SITE_NAME = "The Greek Carnivore";
const FROM_EMAIL = "The Greek Carnivore <noreply@thegreekcarnivore.com>";
const SAMPLE_EMAIL = "user@example.test";

function getEmailType(payload: SendEmailHookPayload): EmailType | null {
  return (
    payload.email_data?.email_action_type ||
    payload.data?.action_type ||
    null
  );
}

function getRecipientEmail(payload: SendEmailHookPayload) {
  return payload.user?.email || payload.data?.email || "";
}

function getNewEmail(payload: SendEmailHookPayload) {
  return payload.user?.email_change || payload.data?.new_email || "";
}

function getUserMetadata(payload: SendEmailHookPayload) {
  return payload.user?.user_metadata || payload.data?.user_metadata || {};
}

function getDefaultRedirectPath(emailType: EmailType) {
  if (emailType === "recovery") return "/reset-password";
  return "/auth";
}

function buildAuthConfirmationUrl(emailType: EmailType, payload: SendEmailHookPayload) {
  const redirectTo =
    payload.email_data?.redirect_to ||
    payload.data?.redirect_to ||
    buildAppUrl(getDefaultRedirectPath(emailType));

  if (emailType === "reauthentication") {
    return redirectTo;
  }

  const tokenHash =
    emailType === "email_change"
      ? payload.email_data?.token_hash_new ||
        payload.email_data?.token_hash ||
        payload.data?.token_hash
      : payload.email_data?.token_hash || payload.data?.token_hash;

  if (!tokenHash) {
    throw new Error(`Missing token_hash for auth email type "${emailType}"`);
  }

  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: emailType,
    redirect_to: redirectTo,
  });

  return `${getSupabaseProjectUrl()}/auth/v1/verify?${params.toString()}`;
}

function buildSampleData(emailType: EmailType) {
  const sampleProjectUrl = getAppBaseUrl();

  switch (emailType) {
    case "signup":
      return {
        siteName: SITE_NAME,
        siteUrl: sampleProjectUrl,
        recipient: SAMPLE_EMAIL,
        confirmationUrl: sampleProjectUrl,
      };
    case "invite":
      return {
        siteName: SITE_NAME,
        siteUrl: sampleProjectUrl,
        confirmationUrl: sampleProjectUrl,
      };
    case "magiclink":
    case "recovery":
      return {
        siteName: SITE_NAME,
        confirmationUrl: sampleProjectUrl,
      };
    case "email_change":
      return {
        siteName: SITE_NAME,
        email: SAMPLE_EMAIL,
        newEmail: SAMPLE_EMAIL,
        confirmationUrl: sampleProjectUrl,
      };
    case "reauthentication":
      return {
        token: "123456",
      };
  }
}

async function renderEmailTemplate(emailType: EmailType, props: Record<string, unknown>) {
  const EmailTemplate = EMAIL_TEMPLATES[emailType];

  const html = await renderAsync(React.createElement(EmailTemplate, props));
  const text = await renderAsync(React.createElement(EmailTemplate, props), {
    plainText: true,
  });

  return { html, text };
}

async function resolveLanguage(
  adminClient: ReturnType<typeof createClient>,
  payload: SendEmailHookPayload,
  recipientEmail: string,
) {
  const metadata = getUserMetadata(payload);
  const explicitLanguage =
    typeof metadata.language === "string" ? metadata.language : "";

  if (explicitLanguage) return explicitLanguage;

  try {
    const { data: invitation } = await adminClient
      .from("email_invitations")
      .select("language")
      .eq("email", recipientEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invitation?.language) {
      return invitation.language;
    }

    if (payload.user?.id) {
      const { data: userData } = await adminClient.auth.admin.getUserById(payload.user.id);
      const userLanguage = userData.user?.user_metadata?.language;

      if (typeof userLanguage === "string" && userLanguage) {
        return userLanguage;
      }
    } else if (recipientEmail) {
      const { data: userList } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });

      const matchedUser = userList.users.find((user) => user.email === recipientEmail);
      const userLanguage = matchedUser?.user_metadata?.language;

      if (typeof userLanguage === "string" && userLanguage) {
        return userLanguage;
      }
    }
  } catch (error) {
    console.error("Failed to resolve language for auth email", { error, recipientEmail });
  }

  return "en";
}

async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
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
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

async function handlePreview(req: Request) {
  const previewCorsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: previewCorsHeaders });
  }

  const previewKey = Deno.env.get("EMAIL_TEMPLATE_PREVIEW_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!previewKey || authHeader !== `Bearer ${previewKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...previewCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const emailType = body.type as EmailType;

  if (!EMAIL_TEMPLATES[emailType]) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${emailType}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const sampleData = {
    ...buildSampleData(emailType),
    ...(body.language ? { language: body.language } : {}),
    ...(body.email ? { email: body.email, recipient: body.email } : {}),
    ...(body.newEmail ? { newEmail: body.newEmail } : {}),
  };

  const { html } = await renderEmailTemplate(emailType, sampleData);

  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

async function handleWebhook(req: Request) {
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

  if (!hookSecret) {
    return new Response(JSON.stringify({ error: "SEND_EMAIL_HOOK_SECRET not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const webhook = new Webhook(hookSecret);

  let payload: SendEmailHookPayload;
  try {
    payload = webhook.verify(rawBody, {
      "webhook-id": req.headers.get("webhook-id") || "",
      "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
      "webhook-signature": req.headers.get("webhook-signature") || "",
    }) as SendEmailHookPayload;
  } catch (error) {
    console.error("Invalid auth email webhook signature", { error });
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailType = getEmailType(payload);
  const recipientEmail = getRecipientEmail(payload);

  if (!emailType || !recipientEmail) {
    return new Response(JSON.stringify({ error: "Invalid auth email payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const EmailTemplate = EMAIL_TEMPLATES[emailType];
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${emailType}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const language = await resolveLanguage(adminClient, payload, recipientEmail);
  const metadata = getUserMetadata(payload);

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: getAppBaseUrl(),
    recipient: recipientEmail,
    confirmationUrl: buildAuthConfirmationUrl(emailType, payload),
    token:
      payload.email_data?.token ||
      payload.data?.token ||
      "",
    email: recipientEmail,
    newEmail: getNewEmail(payload),
    language,
    programName:
      typeof metadata.program_name === "string" ? metadata.program_name : null,
    startDate:
      typeof metadata.start_date === "string" ? metadata.start_date : null,
  };

  const { html, text } = await renderEmailTemplate(emailType, templateProps);
  const subject =
    language === "el"
      ? EMAIL_SUBJECTS_EL[emailType]
      : EMAIL_SUBJECTS[emailType];

  try {
    const result = await sendTransactionalEmail({
      to: recipientEmail,
      subject,
      html,
      text,
    });

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to send auth email", { error, emailType, recipientEmail });
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (url.pathname.endsWith("/preview")) {
    return handlePreview(req);
  }

  try {
    return await handleWebhook(req);
  } catch (error) {
    console.error("Auth email hook error", { error });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
