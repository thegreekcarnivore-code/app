import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminRole) {
      return new Response(JSON.stringify({ message: "No admin found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminId = adminRole.user_id;

    // Get admin notification prefs
    const { data: prefs } = await supabase
      .from("admin_notification_prefs")
      .select("*")
      .eq("admin_id", adminId)
      .maybeSingle();

    // Default: notify_late = true, threshold = 7
    const notifyLate = prefs?.notify_late ?? true;
    const thresholdDays = prefs?.late_threshold_days ?? 7;

    if (!notifyLate) {
      return new Response(JSON.stringify({ message: "Late notifications disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active enrollments
    const { data: enrollments } = await supabase
      .from("client_program_enrollments")
      .select("user_id, start_date")
      .eq("status", "active");

    if (!enrollments || enrollments.length === 0) {
      return new Response(JSON.stringify({ message: "No active enrollments" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = enrollments.map((e) => e.user_id).filter((id) => id !== adminId);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No clients to check" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get last measurement date for each user
    const { data: measurements } = await supabase
      .from("measurements")
      .select("user_id, measured_at")
      .in("user_id", userIds)
      .order("measured_at", { ascending: false });

    const lastMeasurementMap = new Map<string, string>();
    (measurements || []).forEach((m) => {
      if (!lastMeasurementMap.has(m.user_id)) {
        lastMeasurementMap.set(m.user_id, m.measured_at);
      }
    });

    // Get profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    let notified = 0;

    // Check for already-sent late notifications today to avoid duplicates
    const { data: existingNotifs } = await supabase
      .from("client_notifications")
      .select("body")
      .eq("user_id", adminId)
      .eq("type", "client_late")
      .gte("created_at", `${todayStr}T00:00:00`);

    const alreadyNotifiedBodies = new Set(
      (existingNotifs || []).map((n: any) => n.body)
    );

    for (const userId of userIds) {
      const lastMeasured = lastMeasurementMap.get(userId);
      let daysSinceLast: number;

      if (!lastMeasured) {
        // Never measured — count from enrollment start
        const enrollment = enrollments.find((e) => e.user_id === userId);
        const startDate = new Date(enrollment!.start_date);
        daysSinceLast = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        const lastDate = new Date(lastMeasured);
        daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (daysSinceLast >= thresholdDays) {
        const profile = profileMap.get(userId);
        const name = profile?.display_name || profile?.email?.split("@")[0] || "Client";
        const body = `${name} — ${daysSinceLast} days without measurements`;

        if (alreadyNotifiedBodies.has(body)) continue;

        await supabase.from("client_notifications").insert({
          user_id: adminId,
          type: "client_late",
          title: `⚠️ ${name} is ${daysSinceLast} days late`,
          body,
          link: `/admin/client/${userId}?view=data`,
        });
        notified++;
      }
    }

    return new Response(
      JSON.stringify({ message: `Checked ${userIds.length} clients, notified ${notified} late` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-client-compliance error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
