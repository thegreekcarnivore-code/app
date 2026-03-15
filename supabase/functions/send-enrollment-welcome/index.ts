import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getAppBaseUrl } from "../_shared/app-config.ts";
import { createOpenAIChatCompletion, getOpenAIModel } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM_EMAIL = "The Greek Carnivore <noreply@thegreekcarnivore.com>";
const LOGO_URL = "https://lglgmhzgxyvyftdhvdsy.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1";
const APP_URL = getAppBaseUrl();

function formatDate(dateStr: string, lang: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === "el" ? "el-GR" : "en-US", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return dateStr; }
}

interface PersonalizedContent {
  greeting: string;
  goalsSentence: string;
}

async function personalizeWithAI(
  firstName: string,
  clientNotes: string[],
  lang: string,
): Promise<PersonalizedContent> {
  const fallbackGreeting = lang === "el" ? `Αγαπητέ/ή ${firstName}` : `Dear ${firstName}`;
  const fallbackGoals = lang === "el"
    ? "θα δουλέψουμε σκληρά για να πετύχεις τους στόχους σου."
    : "we'll work hard together to achieve your goals.";

  const notesContext = clientNotes.length > 0
    ? `Client notes/goals:\n${clientNotes.join("\n")}`
    : "No specific goals recorded.";

  const langInstructions = lang === "el"
    ? `Write everything in Greek. Use "Αγαπητέ" for male, "Αγαπητή" for female. Convert the first name to Greek vocative case.`
    : `Write everything in English. Use "Dear" as the greeting prefix.`;

  const prompt = `You are a language expert helping personalize a welcome email for a nutrition/wellness coaching program called "The Greek Carnivore".

Given the client's first name: "${firstName}"
${notesContext}

${langInstructions}

Return a JSON object with exactly these fields:
1. "greeting": The proper greeting with the name.
2. "goalsSentence": A warm, personalized 1-2 sentence paragraph about what you'll work on together, based on the client's notes/goals.

Return ONLY valid JSON, no markdown, no explanation.`;

  try {
    const data = await createOpenAIChatCompletion({
      model: getOpenAIModel("OPENAI_MODEL_SMALL", "gpt-4.1-mini"),
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    });
    const cleaned = (data?.choices?.[0]?.message?.content || "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      greeting: parsed.greeting || fallbackGreeting,
      goalsSentence: parsed.goalsSentence || fallbackGoals,
    };
  } catch {
    return { greeting: fallbackGreeting, goalsSentence: fallbackGoals };
  }
}

function buildWelcomeEmail(
  personalized: PersonalizedContent,
  programName: string,
  durationWeeks: number,
  startDate: string,
  lang: string,
): string {
  const months = Math.round(durationWeeks / 4.33);
  const isEl = lang === "el";
  const durationLabel = isEl
    ? (months >= 2 ? `${months} μήνες` : `${durationWeeks} εβδομάδες`)
    : (months >= 2 ? `${months} months` : `${durationWeeks} weeks`);
  const formattedStart = formatDate(startDate, lang);

  const heading = isEl ? "Καλωσόρισες στο πρόγραμμά σου! 🎉" : "Welcome to your program! 🎉";
  const introText = isEl
    ? `Είμαι πολύ χαρούμενος που ξεκινάμε μαζί αυτό το ταξίδι! Θα είμαστε μαζί για τους επόμενους <strong>${durationLabel}</strong> και ${personalized.goalsSentence}`
    : `I'm so excited to start this journey together! We'll be working together for the next <strong>${durationLabel}</strong> and ${personalized.goalsSentence}`;
  const programLabel = isEl ? "Το πρόγραμμά σου" : "Your Program";
  const programRow = isEl ? "Πρόγραμμα" : "Program";
  const durationRow = isEl ? "Διάρκεια" : "Duration";
  const startRow = isEl ? "Ημ. Έναρξης" : "Start Date";
  const nextSteps = isEl ? "📋 <strong>Τα επόμενα βήματα:</strong>" : "📋 <strong>Next Steps:</strong>";
  const steps = isEl
    ? ["Συμπλήρωσε το προφίλ σου στην εφαρμογή", "Καταχώρησε τις αρχικές μετρήσεις σου", "Βγάλε τις πρώτες φωτογραφίες προόδου", "Εξερεύνησε τα εκπαιδευτικά βίντεο"]
    : ["Complete your profile in the app", "Log your initial measurements", "Take your first progress photos", "Explore the educational videos"];
  const ctaText = isEl ? "Δες το Προφίλ σου" : "View Your Profile";
  const noProfileText = isEl
    ? "Αν δεν έχεις φτιάξει ακόμα προφίλ, μπορείς να το κάνεις πατώντας το κουμπί παραπάνω. Θα σε καθοδηγήσει η εφαρμογή βήμα-βήμα."
    : "If you haven't set up your profile yet, click the button above. The app will guide you step by step.";
  const closingLine = isEl ? "Σε περιμένει ένα υπέροχο ταξίδι μεταμόρφωσης! 💪" : "An amazing transformation journey awaits you! 💪";

  return `<!DOCTYPE html>
<html lang="${isEl ? "el" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 30px;">
    <img src="${LOGO_URL}" alt="The Greek Carnivore" width="80" style="display:block;margin:0 0 24px;" />
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:600;color:#1a1a1a;margin:0 0 24px;letter-spacing:0.02em;">${heading}</h1>
    <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">${personalized.greeting},</p>
    <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 24px;">${introText}</p>
    <div style="background:#faf8f4;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">${programLabel}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:13px;color:#888;width:120px;">${programRow}</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${programName}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">${durationRow}</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${durationLabel}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#888;">${startRow}</td><td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;">${formattedStart}</td></tr>
      </table>
    </div>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 8px;">${nextSteps}</p>
    <ol style="font-size:14px;color:#555;line-height:1.9;margin:0 0 28px;padding-left:18px;">
      ${steps.map(s => `<li>${s}</li>`).join("\n      ")}
    </ol>
    <a href="${APP_URL}/profile" target="_blank" style="display:inline-block;background-color:#b39a64;color:#141414;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;border-radius:12px;padding:14px 28px;text-decoration:none;margin:0 0 12px;">${ctaText}</a>
    <p style="font-size:13px;color:#888;line-height:1.6;margin:20px 0 0;">${noProfileText}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 20px;" />
    <p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 4px;">${closingLine}</p>
    <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">Alexandros — <strong>The Greek Carnivore</strong></p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await anonClient
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, program_name, duration_weeks, start_date } = await req.json();
    if (!client_id || !program_name) {
      return new Response(JSON.stringify({ error: "client_id and program_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [profileRes, notesRes] = await Promise.all([
      serviceClient.from("profiles").select("display_name, email, language").eq("id", client_id).single(),
      serviceClient.from("client_notes").select("title, content, category").eq("user_id", client_id).eq("is_active", true).order("created_at", { ascending: false }).limit(20),
    ]);

    const profile = profileRes.data;
    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "Client email not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = (profile as any).language || "el";
    const firstName = profile.display_name || profile.email.split("@")[0] || "there";
    const noteTexts = ((notesRes.data || []) as any[]).map((n: any) => {
      const parts = [n.category ? `[${n.category}]` : "", n.title, n.content].filter(Boolean);
      return parts.join(" — ");
    });

    const personalized = await personalizeWithAI(firstName, noteTexts, lang);
    const html = buildWelcomeEmail(personalized, program_name, duration_weeks || 26, start_date || new Date().toISOString().split("T")[0], lang);

    const subject = lang === "el"
      ? `Καλωσόρισες στο ${program_name}! 🎉 — The Greek Carnivore`
      : `Welcome to ${program_name}! 🎉 — The Greek Carnivore`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: [profile.email], subject, html }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Email send failed:", errText);
      return new Response(JSON.stringify({ success: false, error: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Enrollment welcome email sent to:", profile.email, "lang:", lang);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send enrollment welcome error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
