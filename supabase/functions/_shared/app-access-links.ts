import { buildAppUrl } from "./app-config.ts";
import { ensureInvitedClientAccess, normalizeEmail } from "./invited-access.ts";
import {
  createPasswordResetSessionLink,
  preparePasswordResetUser,
} from "./password-reset.ts";

type AccessLinkPurpose = "magic_login" | "password_reset";

function getAccessLinkPath(purpose: AccessLinkPurpose, token: string) {
  if (purpose === "magic_login") {
    return buildAppUrl(`/go/${token}`);
  }

  return buildAppUrl(`/reset/${token}`);
}

export async function createAppAccessLink({
  serviceClient,
  purpose,
  email,
  userId,
  createdBy,
  language,
  redirectPath,
  expiresInHours = 72,
}: {
  serviceClient: any;
  purpose: AccessLinkPurpose;
  email: string;
  userId?: string | null;
  createdBy?: string | null;
  language?: string | null;
  redirectPath?: string | null;
  expiresInHours?: number;
}) {
  const normalizedEmail = normalizeEmail(email);

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await serviceClient
    .from("app_access_links")
    .insert({
      purpose,
      email: normalizedEmail,
      user_id: userId || null,
      created_by: createdBy || null,
      language: language || null,
      redirect_path: redirectPath || null,
      expires_at: expiresAt,
    })
    .select("token, purpose, expires_at")
    .single();

  if (error || !data?.token) {
    throw new Error(error?.message || "Failed to create access link");
  }

  return {
    token: data.token,
    purpose: data.purpose as AccessLinkPurpose,
    expiresAt: data.expires_at,
    url: getAccessLinkPath(data.purpose as AccessLinkPurpose, data.token),
  };
}

export async function resolveAppAccessLink({
  serviceClient,
  token,
}: {
  serviceClient: any;
  token: string;
}) {
  const { data: linkRow, error: linkError } = await serviceClient
    .from("app_access_links")
    .select("id, token, purpose, email, user_id, language, redirect_path, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (linkError) {
    throw new Error(linkError.message);
  }

  if (!linkRow) {
    throw new Error("This link is not valid anymore");
  }

  const expiresAt = new Date(linkRow.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    throw new Error("This link has expired");
  }

  await serviceClient
    .from("app_access_links")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", linkRow.id);

  if (linkRow.purpose === "magic_login") {
    const accessResult = await ensureInvitedClientAccess({
      serviceClient,
      email: linkRow.email,
      language: linkRow.language || "el",
      redirectPath: linkRow.redirect_path || "/home",
    });

    return {
      purpose: "magic_login" as const,
      redirectUrl: accessResult.loginUrl,
    };
  }

  if (linkRow.purpose === "password_reset") {
    const target = await preparePasswordResetUser({
      serviceClient,
      email: linkRow.email,
      allowAccessGrant: true,
    });

    if (!target.user) {
      throw new Error("This reset link is not valid anymore");
    }

    const session = await createPasswordResetSessionLink({
      serviceClient,
      email: target.email,
      user: target.user,
    });

    return {
      purpose: "password_reset" as const,
      redirectUrl: session.confirmationUrl,
    };
  }

  throw new Error("Unsupported access link");
}
