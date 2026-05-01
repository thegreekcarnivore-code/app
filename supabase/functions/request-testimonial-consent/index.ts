import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REQUEST-TESTIMONIAL-CONSENT] ${step}${tail}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin gate.
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { candidate_id } = await req.json();
    if (!candidate_id) {
      return new Response(JSON.stringify({ error: "candidate_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: candidate } = await admin
      .from("testimonial_candidates")
      .select("id, user_id, quote")
      .eq("id", candidate_id)
      .maybeSingle();
    if (!candidate) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", candidate.user_id)
      .maybeSingle();

    // Mark consent_requested_at; the actual member-facing prompt lives in-app
    // and the email is sent as a polite ask.
    await admin
      .from("testimonial_candidates")
      .update({
        consent_status: "requested",
        consent_requested_at: new Date().toISOString(),
      })
      .eq("id", candidate_id);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && profile?.email) {
      const html = `
<p>Γεια σου ${profile.full_name ?? ""},</p>
<p>Η πρόοδός σου στη Μεταμόρφωση είναι εκπληκτική. Θα θέλαμε να μοιραστούμε ένα μικρό απόσπασμα ως ιστορία επιτυχίας — με τον δικό σου τρόπο.</p>
<p><strong>Τι θα μοιραστεί:</strong> ${candidate.quote ? `«${candidate.quote.slice(0, 280)}»` : "Σύντομο απόσπασμα από την πορεία σου."}</p>
<p>Μπες στην εφαρμογή και πάτα <strong>ΣΥΜΦΩΝΩ</strong> ή <strong>ΌΧΙ</strong>. Μπορείς και να επιλέξεις ανώνυμη δημοσίευση.</p>
<p>— Η ομάδα της Μεταμόρφωσης</p>
      `.trim();

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "Μεταμόρφωση <noreply@thegreekcarnivore.com>",
          to: [profile.email],
          subject: "Η ιστορία σου — μπορούμε να τη μοιραστούμε;",
          html,
        }),
      }).catch((err) => log("email send failed", { err: String(err) }));
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "request consent failed";
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
