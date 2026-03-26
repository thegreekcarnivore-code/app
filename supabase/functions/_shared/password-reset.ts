import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { RecoveryEmail } from "./email-templates/recovery.tsx";
import { buildAppUrl } from "./app-config.ts";
import { ensureInvitedClientAccess, normalizeEmail } from "./invited-access.ts";

const RESET_TOKEN_TTL_SECONDS = 60 * 60;

function base64UrlEncode(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function importHmacKey(secret: string) {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payloadBase64: string, secret: string) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadBase64));
  return base64UrlEncode(new Uint8Array(signature));
}

function generateNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return base64UrlEncode(bytes);
}

function getResetTokenSecret() {
  return (
    Deno.env.get("PASSWORD_RESET_TOKEN_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_JWT_SECRET") ||
    ""
  );
}

export interface PasswordResetTokenPayload {
  v: 1;
  sub: string;
  email: string;
  nonce: string;
  exp: number;
}

export async function createPasswordResetToken(payload: Omit<PasswordResetTokenPayload, "v">) {
  const secret = getResetTokenSecret();
  if (!secret) throw new Error("Password reset secret is not configured");

  const fullPayload: PasswordResetTokenPayload = { v: 1, ...payload };
  const payloadBase64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = await signPayload(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
}

export async function verifyPasswordResetToken(token: string): Promise<PasswordResetTokenPayload> {
  const secret = getResetTokenSecret();
  if (!secret) throw new Error("Password reset secret is not configured");

  const [payloadBase64, signature] = String(token || "").split(".");
  if (!payloadBase64 || !signature) {
    throw new Error("Invalid reset token");
  }

  const expectedSignature = await signPayload(payloadBase64, secret);
  if (signature !== expectedSignature) {
    throw new Error("Invalid reset token");
  }

  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadBase64))) as PasswordResetTokenPayload;

  if (payload.v !== 1 || !payload.sub || !payload.email || !payload.nonce || !payload.exp) {
    throw new Error("Invalid reset token");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Reset token expired");
  }

  return payload;
}

async function findAuthUserByEmail(serviceClient: any, email: string) {
  const normalized = normalizeEmail(email);
  let page = 1;

  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);

    const user = data.users.find((candidate: any) => candidate.email?.toLowerCase() === normalized) ?? null;
    if (user) return user;
    if (data.users.length < 1000) break;
    page += 1;
  }

  return null;
}

async function getLatestInvitation(serviceClient: any, email: string) {
  const { data, error } = await serviceClient
    .from("email_invitations")
    .select("id, language")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function getProfilesForEmail(serviceClient: any, email: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, approved, language, display_name")
    .eq("email", email);

  if (error) throw new Error(error.message);
  return data ?? [];
}

function sanitizeUserMetadata(userMetadata: Record<string, unknown> | undefined, nonce?: string | null) {
  const next = { ...(userMetadata || {}) };
  delete next.password_reset_nonce;
  delete next.password_reset_requested_at;

  if (typeof nonce === "string" && nonce) {
    next.password_reset_nonce = nonce;
    next.password_reset_requested_at = new Date().toISOString();
  }

  return next;
}

export async function preparePasswordResetUser({
  serviceClient,
  email,
  allowAccessGrant,
}: {
  serviceClient: any;
  email: string;
  allowAccessGrant: boolean;
}) {
  const normalizedEmail = normalizeEmail(email);
  const invitation = await getLatestInvitation(serviceClient, normalizedEmail);
  const profiles = await getProfilesForEmail(serviceClient, normalizedEmail);
  const approvedProfileExists = profiles.some((profile) => profile.approved);
  const language = invitation?.language || profiles.find((profile) => profile.language)?.language || "el";

  if (allowAccessGrant && (invitation || approvedProfileExists || profiles.length > 0)) {
    const result = await ensureInvitedClientAccess({
      serviceClient,
      email: normalizedEmail,
      language,
    });

    const { data: authData, error: authError } = await serviceClient.auth.admin.getUserById(result.userId);
    if (authError || !authData.user) {
      throw new Error(authError?.message || "Failed to load password reset user");
    }

    return {
      email: normalizedEmail,
      language: result.language || language,
      user: authData.user,
      hasKnownProfile: true,
    };
  }

  const existingAuthUser = await findAuthUserByEmail(serviceClient, normalizedEmail);
  if (!existingAuthUser) {
    return {
      email: normalizedEmail,
      language,
      user: null,
      hasKnownProfile: profiles.length > 0 || !!invitation,
    };
  }

  if (!existingAuthUser.email_confirmed_at) {
    await serviceClient.auth.admin.updateUserById(existingAuthUser.id, {
      email_confirm: true,
    });
  }

  return {
    email: normalizedEmail,
    language:
      (typeof existingAuthUser.user_metadata?.language === "string" && existingAuthUser.user_metadata.language) ||
      language,
    user: existingAuthUser,
    hasKnownProfile: profiles.length > 0 || !!invitation,
  };
}

export async function issuePasswordResetEmail({
  resendApiKey,
  email,
  language,
  user,
  confirmationUrl,
}: {
  resendApiKey: string;
  email: string;
  language: string;
  user: any;
  confirmationUrl: string;
}) {
  const html = await renderAsync(
    React.createElement(RecoveryEmail, {
      siteName: "The Greek Carnivore",
      confirmationUrl,
      language,
    }),
  );

  const subject = language === "el" ? "Επαναφορα κωδικου" : "Reset your password";

  const resendRes = await fetch("https://api.resend.com/emails", {
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
      headers: {
        "X-Entity-Ref-ID": `password-reset-${user.id}-${Date.now()}`,
      },
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    throw new Error(`Resend API error: ${resendRes.status} ${errBody}`);
  }

  return {
    confirmationUrl,
  };
}

export async function createPasswordResetSessionLink({
  serviceClient,
  email,
  user,
}: {
  serviceClient: any;
  email: string;
  user: any;
}) {
  const nonce = generateNonce();
  const exp = Math.floor(Date.now() / 1000) + RESET_TOKEN_TTL_SECONDS;
  const resetToken = await createPasswordResetToken({
    sub: user.id,
    email,
    nonce,
    exp,
  });

  const userMetadata = sanitizeUserMetadata(user.user_metadata, nonce);

  const { data: updatedUserData, error: updateUserError } = await serviceClient.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (updateUserError || !updatedUserData.user) {
    throw new Error(updateUserError?.message || "Failed to prepare password reset session");
  }

  const confirmationUrl = `${buildAppUrl("/reset-password")}?reset_token=${encodeURIComponent(resetToken)}`;

  return {
    confirmationUrl,
    expiresAt: exp,
    resetToken,
  };
}

export async function completePasswordReset({
  serviceClient,
  token,
  password,
}: {
  serviceClient: any;
  token: string;
  password: string;
}) {
  const payload = await verifyPasswordResetToken(token);
  const { data: authData, error: authError } = await serviceClient.auth.admin.getUserById(payload.sub);
  if (authError || !authData.user) {
    throw new Error(authError?.message || "This reset link is not valid anymore");
  }

  const user = authData.user;
  const currentNonce = typeof user.user_metadata?.password_reset_nonce === "string"
    ? user.user_metadata.password_reset_nonce
    : "";

  if (!currentNonce || currentNonce !== payload.nonce) {
    throw new Error("This reset link has already been used or has expired");
  }

  if (user.email?.toLowerCase() !== payload.email) {
    throw new Error("This reset link does not match the account");
  }

  const nextUserMetadata = sanitizeUserMetadata(user.user_metadata, null);
  const { data: updatedUserData, error: updateError } = await serviceClient.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: nextUserMetadata,
  });

  if (updateError || !updatedUserData.user) {
    throw new Error(updateError?.message || "Failed to update password");
  }

  const { error: grantAccessError } = await serviceClient.rpc("grant_profile_access_system", {
    _user_id: user.id,
    _feature_access: null,
  });

  if (grantAccessError) {
    console.error("Failed to grant access after password reset", grantAccessError);
  }

  return {
    userId: user.id,
    email: user.email,
  };
}
