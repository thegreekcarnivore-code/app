import { buildAppUrl } from "./app-config.ts";

export type FeatureAccessRecord = Record<string, boolean>;

interface EmailInvitationRow {
  id: string;
  email: string;
  language: string | null;
  feature_access: unknown;
  program_template_id: string | null;
  start_date: string | null;
  measurement_day: number | null;
  group_id: string | null;
  created_by: string | null;
  status: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  approved: boolean | null;
  feature_access: unknown;
  height_cm: number | null;
  sex: string | null;
  date_of_birth: string | null;
  language: string | null;
  timezone: string | null;
  vocative_name_el: string | null;
  avatar_url: string | null;
  onboarding_tour_completed: boolean | null;
  stripe_customer_id: string | null;
}

export interface EnsureInvitedClientAccessInput {
  serviceClient: any;
  email: string;
  language?: string | null;
  featureAccess?: FeatureAccessRecord | null;
  programTemplateId?: string | null;
  startDate?: string | null;
  measurementDay?: number | null;
  groupId?: string | null;
  createdBy?: string | null;
  invitationId?: string | null;
  redirectPath?: string;
}

export interface EnsureInvitedClientAccessResult {
  normalizedEmail: string;
  userId: string;
  profileId: string;
  loginUrl: string;
  displayName: string | null;
  language: string;
  restoredAccess: boolean;
  authUserCreated: boolean;
  legacyProfileMerged: boolean;
  invitationId: string | null;
}

function buildAppAuthActionUrl({
  tokenHash,
  type,
  redirectTo,
}: {
  tokenHash: string;
  type: "magiclink";
  redirectTo: string;
}) {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type,
    redirect_to: redirectTo,
  });

  return `${buildAppUrl("/auth/callback")}?${params.toString()}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function toFeatureAccessRecord(value: unknown): FeatureAccessRecord | null {
  if (!isObject(value)) return null;
  const entries = Object.entries(value).filter(([, flag]) => typeof flag === "boolean");
  if (entries.length === 0) return null;
  return Object.fromEntries(entries) as FeatureAccessRecord;
}

export function mergeFeatureAccess(...values: Array<FeatureAccessRecord | null | undefined>) {
  const merged: FeatureAccessRecord = {};

  for (const value of values) {
    if (!value) continue;
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) merged[key] = true;
      else if (!(key in merged)) merged[key] = false;
    }
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

async function findAuthUserByEmail(serviceClient: any, normalizedEmail: string) {
  const { data, error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw new Error(error.message);
  }

  return data.users.find((candidate: any) => candidate.email?.toLowerCase() === normalizedEmail) ?? null;
}

async function ensureAuthUser(serviceClient: any, normalizedEmail: string, language: string) {
  const existing = await findAuthUserByEmail(serviceClient, normalizedEmail);
  if (existing) {
    return { user: existing, created: false };
  }

  const { data, error } = await serviceClient.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    user_metadata: { language },
  });

  if (error || !data.user) {
    throw new Error(error?.message || "Failed to create auth user");
  }

  return { user: data.user, created: true };
}

async function getLatestInvitation(serviceClient: any, normalizedEmail: string) {
  const { data, error } = await serviceClient
    .from("email_invitations")
    .select("id, email, language, feature_access, program_template_id, start_date, measurement_day, group_id, created_by, status")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as EmailInvitationRow | null) ?? null;
}

async function loadProfilesForEmail(serviceClient: any, normalizedEmail: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, email, display_name, approved, feature_access, height_cm, sex, date_of_birth, language, timezone, vocative_name_el, avatar_url, onboarding_tour_completed, stripe_customer_id")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProfileRow[]) ?? [];
}

async function ensureAuthLinkedProfile(
  serviceClient: any,
  targetUserId: string,
  normalizedEmail: string,
  baseProfile: ProfileRow | null,
  language: string,
  featureAccess: FeatureAccessRecord | null,
) {
  const { data: existingProfile, error: existingProfileError } = await serviceClient
    .from("profiles")
    .select("id, email, display_name, approved, feature_access, height_cm, sex, date_of_birth, language, timezone, vocative_name_el, avatar_url, onboarding_tour_completed, stripe_customer_id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(existingProfileError.message);
  }

  if (existingProfile) {
    return existingProfile as ProfileRow;
  }

  const { error: insertError } = await serviceClient
    .from("profiles")
    .insert({
      id: targetUserId,
      email: normalizedEmail,
      approved: false,
      feature_access: featureAccess ?? undefined,
      display_name: baseProfile?.display_name ?? null,
      height_cm: baseProfile?.height_cm ?? null,
      sex: baseProfile?.sex ?? null,
      date_of_birth: baseProfile?.date_of_birth ?? null,
      language: baseProfile?.language || language || "el",
      timezone: baseProfile?.timezone ?? null,
      vocative_name_el: baseProfile?.vocative_name_el ?? null,
      avatar_url: baseProfile?.avatar_url ?? null,
      onboarding_tour_completed: baseProfile?.onboarding_tour_completed ?? false,
      stripe_customer_id: baseProfile?.stripe_customer_id ?? null,
    });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    id: targetUserId,
    email: normalizedEmail,
    display_name: baseProfile?.display_name ?? null,
    approved: false,
    feature_access: featureAccess,
    height_cm: baseProfile?.height_cm ?? null,
    sex: baseProfile?.sex ?? null,
    date_of_birth: baseProfile?.date_of_birth ?? null,
    language: baseProfile?.language || language || "el",
    timezone: baseProfile?.timezone ?? null,
    vocative_name_el: baseProfile?.vocative_name_el ?? null,
    avatar_url: baseProfile?.avatar_url ?? null,
    onboarding_tour_completed: baseProfile?.onboarding_tour_completed ?? false,
    stripe_customer_id: baseProfile?.stripe_customer_id ?? null,
  };
}

async function ensureProgramEnrollment(
  serviceClient: any,
  userId: string,
  programTemplateId: string | null,
  featureAccess: FeatureAccessRecord | null,
  startDate: string | null,
  measurementDay: number | null,
  createdBy: string | null,
) {
  if (!programTemplateId) return;

  const { data: existingEnrollment, error: existingEnrollmentError } = await serviceClient
    .from("client_program_enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("program_template_id", programTemplateId)
    .maybeSingle();

  if (existingEnrollmentError) {
    throw new Error(existingEnrollmentError.message);
  }

  if (existingEnrollment) return;

  const { error: insertEnrollmentError } = await serviceClient
    .from("client_program_enrollments")
    .insert({
      user_id: userId,
      program_template_id: programTemplateId,
      feature_access_override: featureAccess ?? undefined,
      start_date: startDate || new Date().toISOString().slice(0, 10),
      weekly_day: measurementDay ?? 1,
      created_by: createdBy,
      status: "active",
    });

  if (insertEnrollmentError) {
    throw new Error(insertEnrollmentError.message);
  }
}

async function ensureGroupMembership(
  serviceClient: any,
  userId: string,
  groupId: string | null,
) {
  if (!groupId) return;

  const { data: existingMembership, error: existingMembershipError } = await serviceClient
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMembershipError) {
    throw new Error(existingMembershipError.message);
  }

  if (existingMembership) return;

  const { error: insertMembershipError } = await serviceClient
    .from("group_members")
    .insert({
      group_id: groupId,
      user_id: userId,
    });

  if (insertMembershipError) {
    throw new Error(insertMembershipError.message);
  }
}

async function markInvitationUsed(
  serviceClient: any,
  invitationId: string | null,
  userId: string,
) {
  if (!invitationId) return;

  const { error } = await serviceClient
    .from("email_invitations")
    .update({
      status: "used",
      used_at: new Date().toISOString(),
      used_by: userId,
    })
    .eq("id", invitationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function ensureInvitedClientAccess(
  input: EnsureInvitedClientAccessInput,
): Promise<EnsureInvitedClientAccessResult> {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const latestInvitation = await getLatestInvitation(input.serviceClient, normalizedEmail);
  const resolvedLanguage = input.language || latestInvitation?.language || "el";
  const { user: authUser, created: authUserCreated } = await ensureAuthUser(
    input.serviceClient,
    normalizedEmail,
    resolvedLanguage,
  );

  const profiles = await loadProfilesForEmail(input.serviceClient, normalizedEmail);
  const authProfile = profiles.find((profile) => profile.id === authUser.id) ?? null;
  const legacyProfile = profiles.find((profile) => profile.id !== authUser.id) ?? null;
  const resolvedFeatureAccess = mergeFeatureAccess(
    toFeatureAccessRecord(latestInvitation?.feature_access),
    toFeatureAccessRecord(legacyProfile?.feature_access),
    toFeatureAccessRecord(authProfile?.feature_access),
    input.featureAccess ?? null,
  );

  await ensureAuthLinkedProfile(
    input.serviceClient,
    authUser.id,
    normalizedEmail,
    authProfile ?? legacyProfile,
    resolvedLanguage,
    resolvedFeatureAccess,
  );

  let legacyProfileMerged = false;
  if (legacyProfile && legacyProfile.id !== authUser.id) {
    const { error: mergeError } = await input.serviceClient.rpc("_merge_duplicate_profiles", {
      _source_user_id: legacyProfile.id,
      _target_user_id: authUser.id,
    });

    if (mergeError) {
      throw new Error(mergeError.message);
    }

    legacyProfileMerged = true;
  }

  const { data: profileBeforeGrant, error: profileBeforeGrantError } = await input.serviceClient
    .from("profiles")
    .select("id, display_name, approved, language")
    .eq("id", authUser.id)
    .single();

  if (profileBeforeGrantError) {
    throw new Error(profileBeforeGrantError.message);
  }

  const { error: grantAccessError } = await input.serviceClient.rpc("grant_profile_access_system", {
    _user_id: authUser.id,
    _feature_access: resolvedFeatureAccess,
  });

  if (grantAccessError) {
    throw new Error(grantAccessError.message);
  }

  await ensureProgramEnrollment(
    input.serviceClient,
    authUser.id,
    input.programTemplateId ?? latestInvitation?.program_template_id ?? null,
    resolvedFeatureAccess,
    input.startDate ?? latestInvitation?.start_date ?? null,
    input.measurementDay ?? latestInvitation?.measurement_day ?? null,
    input.createdBy ?? latestInvitation?.created_by ?? null,
  );

  await ensureGroupMembership(
    input.serviceClient,
    authUser.id,
    input.groupId ?? latestInvitation?.group_id ?? null,
  );

  await markInvitationUsed(
    input.serviceClient,
    input.invitationId ?? latestInvitation?.id ?? null,
    authUser.id,
  );

  const { data: refreshedProfile, error: refreshedProfileError } = await input.serviceClient
    .from("profiles")
    .select("id, display_name, approved, language")
    .eq("id", authUser.id)
    .single();

  if (refreshedProfileError) {
    throw new Error(refreshedProfileError.message);
  }

  const redirectTo = buildAppUrl(input.redirectPath || "/home");

  const { data: magicLinkData, error: magicLinkError } = await input.serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
    options: {
      redirectTo,
    },
  });

  if (magicLinkError) {
    throw new Error(magicLinkError.message);
  }

  const tokenHash = magicLinkData?.properties?.hashed_token;
  const loginUrl =
    (typeof tokenHash === "string" && tokenHash
      ? buildAppAuthActionUrl({
          tokenHash,
          type: "magiclink",
          redirectTo,
        })
      : null) ||
    magicLinkData?.properties?.action_link;

  if (!loginUrl) {
    throw new Error("Failed to generate direct-entry login link");
  }

  return {
    normalizedEmail,
    userId: authUser.id,
    profileId: authUser.id,
    loginUrl,
    displayName: refreshedProfile?.display_name ?? profileBeforeGrant?.display_name ?? null,
    language: refreshedProfile?.language || profileBeforeGrant?.language || resolvedLanguage,
    restoredAccess: !(profileBeforeGrant?.approved ?? false),
    authUserCreated,
    legacyProfileMerged,
    invitationId: input.invitationId ?? latestInvitation?.id ?? null,
  };
}
