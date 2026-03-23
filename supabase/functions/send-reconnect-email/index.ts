import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildAppUrl, getEmailLogoUrl } from "../_shared/app-config.ts";
// buildAppUrl used as fallback login URL when magic link generation fails

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildReconnectHtml(firstName: string, language: string, loginUrl: string) {
  const logoUrl = getEmailLogoUrl();

  const isGreek = language === "el";

  const heading = isGreek ? "Καλως ηρθες ξανα" : "Welcome Back";
  const body1 = isGreek
    ? `Γεια σου${firstName ? ` <strong>${firstName}</strong>` : ""},`
    : `Hi${firstName ? ` <strong>${firstName}</strong>` : ""},`;
  const body2 = isGreek
    ? "Σου στελνουμε αυτο το μηνυμα ως υπενθυμιση οτι ο λογαριασμος σου στο The Greek Carnivore ειναι ετοιμος και σε περιμενει."
    : "We're sending you this message as a reminder that your account on The Greek Carnivore is ready and waiting for you.";
  const body3 = isGreek
    ? "Πατα το κουμπι παρακατω για να συνδεθεις απευθειας — δεν χρειαζεται κωδικος."
    : "Click the button below to log straight in — no password needed.";
  const ctaText = isGreek ? "Συνδεση στην Εφαρμογη" : "Log In to the App";
  const footer = "The Greek Carnivore";

  return `<!DOCTYPE html>
<html lang="${isGreek ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${logoUrl}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 20px;letter-spacing:0.02em;">
      ${heading}
    </h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px;">
      ${body1}
    </p>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 16px;">
      ${body2}
    </p>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 24px;">
      ${body3}
    </p>
    <a href="${loginUrl}" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;">
      ${ctaText}
    </a>
    <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">
      ${footer}
    </p>
  </div>
</body>
</html>`;
}

function toFeatureAccess(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, boolean>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const anonClient = createClient(supabaseUrl, anonKey, {
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

    const { email, language } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: matchingProfiles, error: profileLookupError } = await serviceClient
      .from("profiles")
      .select("id, display_name, approved, feature_access, height_cm, sex, date_of_birth, language, timezone, vocative_name_el, avatar_url, onboarding_tour_completed, stripe_customer_id")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(5);

    if (profileLookupError) {
      return new Response(JSON.stringify({ error: profileLookupError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const legacyProfile = matchingProfiles?.[0] ?? null;

    const { data: latestInvitation } = await serviceClient
      .from("email_invitations")
      .select("id, status, feature_access, program_template_id, start_date, measurement_day, group_id, created_by")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: authUsersPage, error: authUsersError } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authUsersError) {
      return new Response(JSON.stringify({ error: authUsersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authUser = authUsersPage.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail) ?? null;

    if (!authUser) {
      const { data: createdUserData, error: createUserError } = await serviceClient.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { language: language || legacyProfile?.language || "el" },
      });

      if (createUserError || !createdUserData.user) {
        return new Response(JSON.stringify({ error: createUserError?.message || "Failed to create auth user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      authUser = createdUserData.user;
    }

    const targetUserId = authUser.id;

    const { data: authProfile, error: authProfileError } = await serviceClient
      .from("profiles")
      .select("id, display_name, approved, feature_access, height_cm, sex, date_of_birth, language, timezone, vocative_name_el, avatar_url, onboarding_tour_completed, stripe_customer_id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (authProfileError) {
      return new Response(JSON.stringify({ error: authProfileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseProfile = authProfile ?? legacyProfile;
    const profileFeatureAccess = toFeatureAccess(authProfile?.feature_access) || toFeatureAccess(legacyProfile?.feature_access);
    const invitationFeatureAccess = toFeatureAccess(latestInvitation?.feature_access);
    const resolvedFeatureAccess = profileFeatureAccess || invitationFeatureAccess;
    const profilePatch: Record<string, unknown> = {};

    if (!(authProfile?.approved ?? false)) {
      profilePatch.approved = true;
    }

    if ((!profileFeatureAccess || Object.keys(profileFeatureAccess).length === 0) && resolvedFeatureAccess) {
      profilePatch.feature_access = resolvedFeatureAccess;
    }

    if (authProfile) {
      if (Object.keys(profilePatch).length > 0) {
        const { error: profileUpdateError } = await serviceClient
          .from("profiles")
          .update(profilePatch)
          .eq("id", targetUserId);

        if (profileUpdateError) {
          return new Response(JSON.stringify({ error: profileUpdateError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      const { error: profileUpdateError } = await serviceClient
        .from("profiles")
        .insert({
          id: targetUserId,
          email: normalizedEmail,
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
          approved: true,
          feature_access: resolvedFeatureAccess ?? undefined,
        });

      if (profileUpdateError) {
        return new Response(JSON.stringify({ error: profileUpdateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (legacyProfile?.id && legacyProfile.id !== targetUserId) {
      const { data: legacyEnrollments } = await serviceClient
        .from("client_program_enrollments")
        .select("program_template_id, start_date, weekly_day, status, feature_access_override, duration_weeks_override, created_by")
        .eq("user_id", legacyProfile.id);

      for (const enrollment of legacyEnrollments || []) {
        const { data: existingEnrollment } = await serviceClient
          .from("client_program_enrollments")
          .select("id")
          .eq("user_id", targetUserId)
          .eq("program_template_id", enrollment.program_template_id)
          .maybeSingle();

        if (!existingEnrollment) {
          const { error: copyEnrollmentError } = await serviceClient
            .from("client_program_enrollments")
            .insert({
              user_id: targetUserId,
              program_template_id: enrollment.program_template_id,
              start_date: enrollment.start_date,
              weekly_day: enrollment.weekly_day,
              status: enrollment.status,
              feature_access_override: enrollment.feature_access_override,
              duration_weeks_override: enrollment.duration_weeks_override,
              created_by: enrollment.created_by,
            });

          if (copyEnrollmentError) {
            console.warn("Reconnect legacy enrollment copy skipped:", copyEnrollmentError.message);
          }
        }
      }

      const { data: legacyMemberships } = await serviceClient
        .from("group_members")
        .select("group_id")
        .eq("user_id", legacyProfile.id);

      for (const membership of legacyMemberships || []) {
        const { data: existingMembership } = await serviceClient
          .from("group_members")
          .select("id")
          .eq("group_id", membership.group_id)
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (!existingMembership) {
          const { error: copyMembershipError } = await serviceClient
            .from("group_members")
            .insert({
              group_id: membership.group_id,
              user_id: targetUserId,
            });

          if (copyMembershipError) {
            console.warn("Reconnect legacy group membership copy skipped:", copyMembershipError.message);
          }
        }
      }
    }

    if (latestInvitation?.program_template_id) {
      const { data: existingEnrollment } = await serviceClient
        .from("client_program_enrollments")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("program_template_id", latestInvitation.program_template_id)
        .maybeSingle();

      if (!existingEnrollment) {
        const { error: enrollmentError } = await serviceClient
          .from("client_program_enrollments")
          .insert({
            user_id: targetUserId,
            program_template_id: latestInvitation.program_template_id,
            feature_access_override: invitationFeatureAccess,
            start_date: latestInvitation.start_date || new Date().toISOString().slice(0, 10),
            weekly_day: latestInvitation.measurement_day ?? 1,
            created_by: latestInvitation.created_by,
          });

        if (enrollmentError) {
          console.warn("Reconnect enrollment restore skipped:", enrollmentError.message);
        }
      }
    }

    if (latestInvitation?.group_id) {
      const { data: existingMembership } = await serviceClient
        .from("group_members")
        .select("id")
        .eq("group_id", latestInvitation.group_id)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (!existingMembership) {
        const { error: membershipError } = await serviceClient
          .from("group_members")
          .insert({
            group_id: latestInvitation.group_id,
            user_id: targetUserId,
          });

        if (membershipError) {
          console.warn("Reconnect group restore skipped:", membershipError.message);
        }
      }
    }

    if (latestInvitation?.status === "pending") {
      const { error: invitationUpdateError } = await serviceClient
        .from("email_invitations")
        .update({
          status: "used",
          used_at: new Date().toISOString(),
          used_by: targetUserId,
        })
        .eq("id", latestInvitation.id);

      if (invitationUpdateError) {
        console.warn("Reconnect invitation status update skipped:", invitationUpdateError.message);
      }
    }

    const firstName = (authProfile?.display_name || legacyProfile?.display_name || "")?.split(" ")[0] || "";

    // Generate a magic link so the client can log in with one click
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: { redirectTo: buildAppUrl("/auth") },
    });
    const loginUrl = linkData?.properties?.action_link || buildAppUrl("/auth");
    if (linkError) console.warn("Magic link generation failed, falling back to /auth:", linkError.message);

    const html = buildReconnectHtml(firstName, language || "el", loginUrl);
    const subject = (language || "el") === "el"
      ? "Επιστροφη στο The Greek Carnivore"
      : "Welcome Back to The Greek Carnivore";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "The Greek Carnivore <noreply@thegreekcarnivore.com>",
        to: [normalizedEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await res.text(); // consume body

    console.log("Reconnect email sent to:", normalizedEmail);
    return new Response(
      JSON.stringify({
        success: true,
        message: `Reconnect email sent to ${normalizedEmail}`,
        restored_access: !(authProfile?.approved ?? false),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Send reconnect email error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
