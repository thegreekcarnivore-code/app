import {
  createOpenAIChatCompletion,
  getOpenAIModel,
} from "./openai.ts";

export const WEEKLY_CHECK_IN_HOUR = 20;
export const WEEKLY_CHECK_IN_MINUTE = 0;

type Lang = "en" | "el";

interface WeeklyCheckInParams {
  adminClient: any;
  userId: string;
  lang?: Lang;
  weekEnd?: string;
}

interface WeeklyCheckInResult {
  summary: string;
  report: string;
  coachMessage: string;
  language: Lang;
  weekStart: string;
  weekEnd: string;
  dataSnapshot: Record<string, unknown>;
}

const BODY_FIELDS = [
  "weight_kg",
  "fat_kg",
  "muscle_kg",
  "waist_cm",
  "hip_cm",
  "right_arm_cm",
  "left_arm_cm",
  "right_leg_cm",
  "left_leg_cm",
];

const WELLNESS_FIELDS = [
  "energy",
  "digestion",
  "skin_health",
  "mood",
  "stress",
  "cravings",
  "breathing_health",
  "mental_health",
  "pain",
];

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeLang(value: unknown): Lang {
  return value === "en" ? "en" : "el";
}

function safeValue(value: unknown) {
  return value === null || value === undefined || value === "" ? "N/A" : String(value);
}

function buildMeasurementHistory(entries: any[]) {
  if (!entries.length) return "No measurements logged.";

  return entries
    .map((entry) => {
      const body = BODY_FIELDS
        .map((field) => `${field}: ${safeValue(entry[field])}`)
        .join(" | ");
      const wellness = WELLNESS_FIELDS
        .filter((field) => entry[field] !== null && entry[field] !== undefined)
        .map((field) => `${field}: ${entry[field]}/10`)
        .join(" | ");

      return `[${entry.measured_at}] ${body}${wellness ? ` | ${wellness}` : ""}`;
    })
    .join("\n");
}

function buildFoodHistory(entries: any[]) {
  if (!entries.length) return "No food entries logged this week.";

  return entries
    .slice(0, 60)
    .map((entry) => {
      const notes = entry.notes ? ` (${entry.notes})` : "";
      return `- ${entry.entry_date} [${entry.meal_type || "meal"}]: ${entry.description || "No description"}${notes}`;
    })
    .join("\n");
}

function buildPhotoHistory(allPhotos: any[], weekStart: string) {
  if (!allPhotos.length) return "No progress photos uploaded yet.";

  const weeklyPhotos = allPhotos.filter((photo) => photo.taken_at >= weekStart);
  const byAngle = new Map<string, any[]>();

  for (const photo of allPhotos) {
    const key = photo.angle || "unknown";
    const items = byAngle.get(key) || [];
    items.push(photo);
    byAngle.set(key, items);
  }

  const lines = [`Weekly photos: ${weeklyPhotos.length}`, `Total photos: ${allPhotos.length}`];
  for (const [angle, photos] of byAngle.entries()) {
    const latest = photos[photos.length - 1];
    lines.push(`- ${angle}: ${photos.length} total, latest ${latest?.taken_at || "N/A"}`);
  }

  return lines.join("\n");
}

function buildNotesContext(notes: any[]) {
  if (!notes.length) return "No saved client notes yet.";

  const grouped = new Map<string, any[]>();
  for (const note of notes) {
    const key = note.category || "general";
    const items = grouped.get(key) || [];
    items.push(note);
    grouped.set(key, items);
  }

  const lines: string[] = [];
  for (const [category, items] of grouped.entries()) {
    lines.push(`${category.toUpperCase()}:`);
    for (const item of items.slice(0, 12)) {
      lines.push(`- [${item.created_at?.slice(0, 10) || "unknown"}] ${item.title || "Untitled"}${item.content ? `: ${item.content}` : ""}`);
    }
  }

  return lines.join("\n");
}

function buildMessagesContext(messages: any[], adminIds: Set<string>) {
  if (!messages.length) return "No recent chat messages.";

  return messages
    .slice(0, 30)
    .map((message) => {
      const speaker = adminIds.has(message.sender_id) ? "Coach" : "Client";
      return `- [${message.created_at?.slice(0, 16).replace("T", " ") || "unknown"}] ${speaker}: ${message.content || ""}`;
    })
    .join("\n");
}

function buildPreviousCheckInsContext(checkIns: any[]) {
  if (!checkIns.length) return "No previous weekly check-ins yet.";

  return checkIns
    .map((checkIn) => {
      return `Week ${checkIn.week_start} to ${checkIn.week_end}
Summary: ${checkIn.summary || "N/A"}
Detailed analysis:
${checkIn.report_content || "N/A"}`;
    })
    .join("\n\n");
}

function buildReportSystemPrompt(lang: Lang) {
  const languageInstruction =
    lang === "el"
      ? "Write everything in Greek (Ελληνικά). Do not mix languages."
      : "Write everything in English. Do not mix languages.";

  return `You are Alexandros' weekly coaching brain inside The Greek Carnivore app.

Your job is to write a weekly client check-in that sounds like a real coach wrote it.

VOICE AND STYLE:
- ${languageInstruction}
- Sound human, direct, calm, clear, and honest.
- Use simple words.
- No corporate tone, no AI tone, no jargon, no filler.
- Short paragraphs and bullet points only when they help clarity.
- Be caring, but do not soften the truth when the client is drifting.
- If data is missing, say it clearly and explain why it matters.
- Tie everything back to the client's goals and the promises they made to themselves.
- Use the previous weekly check-ins to compare patterns, not just the last 7 days in isolation.
- Notice what keeps repeating: good habits, missed habits, foods, emotional patterns, weak spots, excuses, and wins.

ANALYSIS RULES:
- Look at ALL relevant app data: measurements, food logs, wellness journal, progress photos, client notes, goals, and recent coach/client messages.
- If there are no fresh measurements, still write the check-in. Make it shorter, firmer, and focused on accountability.
- If there are wins, say exactly what they are.
- If there are setbacks, say exactly what happened and what likely drove them.
- If the data is mixed, explain the contradiction plainly.
- Always include comparison to previous weekly check-ins when possible.

OUTPUT FORMAT:
Return markdown with these exact headings:

## Weekly Check-In
2-3 short paragraphs with the straight story of the week.

## What Worked
- 2 to 4 bullets max.

## What Needs Work
- 2 to 4 bullets max.

## Pattern I See
One short paragraph about the deeper pattern behind the week.

## Next 7 Days
- 3 clear priorities max.

Do not use tables. Do not write generic encouragement. Make every line specific to this client.`;
}

function buildSummaryPrompt(lang: Lang) {
  return `Write one short summary sentence for a weekly coaching check-in.

RULES:
- ${lang === "el" ? "Write only in Greek (Ελληνικά)." : "Write only in English."}
- Maximum 18 words.
- Sound like a human coach.
- Simple, direct, specific.
- No markdown, no emojis, no quotation marks.
- Capture the main truth of the week, not a generic mood.`;
}

function buildCoachMessagePrompt(lang: Lang, firstName: string) {
  return `Write a short note telling the client that their 7-day check-in is ready.

RULES:
- ${lang === "el" ? "Write only in Greek (Ελληνικά)." : "Write only in English."}
- 3 short lines max.
- Mention the client's first name.
- Mention one real focus point from the check-in.
- Say the full weekly analysis (ανάλυση) is ready inside the app.
- No markdown, no emojis, no hype, no filler.`;
}

export async function generateWeeklyCheckIn({
  adminClient,
  userId,
  lang = "el",
  weekEnd,
}: WeeklyCheckInParams): Promise<WeeklyCheckInResult> {
  const normalizedWeekEnd = weekEnd || new Date().toISOString().slice(0, 10);
  const weekStart = addDays(normalizedWeekEnd, -6);
  const weekEndExclusive = addDays(normalizedWeekEnd, 1);

  const [
    profileRes,
    allMeasurementsRes,
    weeklyMeasurementsRes,
    foodRes,
    photosRes,
    notesRes,
    dietaryGuidelinesRes,
    journalRes,
    previousCheckInsRes,
    adminRolesRes,
    messagesRes,
  ] = await Promise.all([
    adminClient
      .from("profiles")
      .select("display_name, email, date_of_birth, language")
      .eq("id", userId)
      .maybeSingle(),
    adminClient
      .from("measurements")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: true }),
    adminClient
      .from("measurements")
      .select("*")
      .eq("user_id", userId)
      .gte("measured_at", weekStart)
      .lte("measured_at", normalizedWeekEnd)
      .order("measured_at", { ascending: true }),
    adminClient
      .from("food_journal")
      .select("*")
      .eq("user_id", userId)
      .gte("entry_date", weekStart)
      .lte("entry_date", normalizedWeekEnd)
      .order("entry_date", { ascending: false })
      .limit(100),
    adminClient
      .from("progress_photos")
      .select("*")
      .eq("user_id", userId)
      .order("taken_at", { ascending: true }),
    adminClient
      .from("client_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    adminClient
      .from("reference_documents")
      .select("content")
      .eq("key", "dietary_guidelines")
      .maybeSingle(),
    adminClient
      .from("wellness_journal")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .gte("created_at", `${weekStart}T00:00:00`)
      .lt("created_at", `${weekEndExclusive}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(50),
    adminClient
      .from("weekly_check_ins")
      .select("week_start, week_end, summary, report_content")
      .eq("user_id", userId)
      .order("week_end", { ascending: false })
      .limit(4),
    adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin"),
    adminClient
      .from("messages")
      .select("sender_id, receiver_id, content, created_at")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (allMeasurementsRes.error) throw allMeasurementsRes.error;
  if (weeklyMeasurementsRes.error) throw weeklyMeasurementsRes.error;
  if (foodRes.error) throw foodRes.error;
  if (photosRes.error) throw photosRes.error;
  if (notesRes.error) throw notesRes.error;
  if (dietaryGuidelinesRes.error) throw dietaryGuidelinesRes.error;
  if (journalRes.error) throw journalRes.error;
  if (previousCheckInsRes.error && previousCheckInsRes.error.code !== "42P01") throw previousCheckInsRes.error;
  if (adminRolesRes.error) throw adminRolesRes.error;
  if (messagesRes.error) throw messagesRes.error;

  const profile = profileRes.data || {};
  const resolvedLang = normalizeLang(profile.language || lang);
  const firstName = (profile.display_name || profile.email || "Client").split(" ")[0];
  const allMeasurements = allMeasurementsRes.data || [];
  const weeklyMeasurements = weeklyMeasurementsRes.data || [];
  const foodEntries = foodRes.data || [];
  const photos = photosRes.data || [];
  const notes = notesRes.data || [];
  const journalEntries = journalRes.data || [];
  const previousCheckIns = previousCheckInsRes.data || [];
  const adminIds = new Set((adminRolesRes.data || []).map((row: any) => row.user_id));
  const recentMessages = (messagesRes.data || []).filter((message: any) => adminIds.has(message.sender_id) || adminIds.has(message.receiver_id));

  const reportInput = `CLIENT:
Name: ${profile.display_name || "Not set"}
Email: ${profile.email || "Unknown"}
Date of birth: ${profile.date_of_birth || "Not provided"}
Language: ${resolvedLang}

WEEK WINDOW:
Start: ${weekStart}
End: ${normalizedWeekEnd}

GOALS, NOTES, MEETING CONTEXT:
${buildNotesContext(notes)}

RECENT CHAT CONTEXT:
${buildMessagesContext(recentMessages, adminIds)}

THIS WEEK'S MEASUREMENTS:
${buildMeasurementHistory(weeklyMeasurements)}

ALL MEASUREMENTS FOR LONG-TERM CONTEXT:
${buildMeasurementHistory(allMeasurements)}

THIS WEEK'S FOOD LOG:
${buildFoodHistory(foodEntries)}

PROGRESS PHOTOS:
${buildPhotoHistory(photos, weekStart)}

THIS WEEK'S WELLNESS JOURNAL:
${journalEntries.length
  ? journalEntries.map((entry: any) => `- [${entry.created_at?.slice(0, 16).replace("T", " ") || "unknown"}] ${entry.content}`).join("\n")
  : "No wellness journal entries this week."}

PREVIOUS WEEKLY CHECK-INS:
${buildPreviousCheckInsContext(previousCheckIns)}

DIETARY FRAMEWORK:
${dietaryGuidelinesRes.data?.content || "No dietary framework text available."}`;

  const reportResponse = await createOpenAIChatCompletion({
    model: getOpenAIModel("OPENAI_MODEL_PREMIUM", "gpt-4.1"),
    messages: [
      { role: "system", content: buildReportSystemPrompt(resolvedLang) },
      { role: "user", content: reportInput },
    ],
    max_tokens: 2600,
  });

  const report = reportResponse.choices?.[0]?.message?.content?.trim() || "";

  const summaryResponse = await createOpenAIChatCompletion({
    model: getOpenAIModel("OPENAI_MODEL_STANDARD", "gpt-4.1-mini"),
    messages: [
      { role: "system", content: buildSummaryPrompt(resolvedLang) },
      { role: "user", content: report },
    ],
    max_tokens: 120,
  });

  const coachMessageResponse = await createOpenAIChatCompletion({
    model: getOpenAIModel("OPENAI_MODEL_STANDARD", "gpt-4.1-mini"),
    messages: [
      { role: "system", content: buildCoachMessagePrompt(resolvedLang, firstName) },
      { role: "user", content: `Client first name: ${firstName}\nWeekly report:\n${report}` },
    ],
    max_tokens: 220,
  });

  return {
    summary: summaryResponse.choices?.[0]?.message?.content?.trim() || "",
    report,
    coachMessage: coachMessageResponse.choices?.[0]?.message?.content?.trim() || "",
    language: resolvedLang,
    weekStart,
    weekEnd: normalizedWeekEnd,
    dataSnapshot: {
      weeklyMeasurementCount: weeklyMeasurements.length,
      allMeasurementCount: allMeasurements.length,
      foodEntryCount: foodEntries.length,
      photoCount: photos.filter((photo) => photo.taken_at >= weekStart && photo.taken_at <= normalizedWeekEnd).length,
      journalEntryCount: journalEntries.length,
      previousCheckInCount: previousCheckIns.length,
    },
  };
}
