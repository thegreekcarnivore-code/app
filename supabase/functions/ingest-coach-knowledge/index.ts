import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOpenAIEmbeddings } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH_SIZE = 64;

type SourceType =
  | "fathom_call"
  | "message"
  | "ebook"
  | "lead_magnet"
  | "email"
  | "recipe_note"
  | "reels_caption"
  | "manual";

interface IngestRow {
  source_type: SourceType;
  source_id: string | null;
  source_title: string | null;
  source_url: string | null;
  language: string;
  chunk_text: string;
  metadata: Record<string, unknown>;
}

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= CHUNK_SIZE) return [cleaned];
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    let slice = cleaned.slice(start, end);
    if (end < cleaned.length) {
      const lastBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "), slice.lastIndexOf("\n"));
      if (lastBreak > CHUNK_SIZE * 0.6) slice = slice.slice(0, lastBreak + 1);
    }
    chunks.push(slice.trim());
    start += slice.length - CHUNK_OVERLAP;
    if (start < 0) start = 0;
  }
  return chunks.filter((c) => c.length > 50);
}

function detectLanguage(text: string): string {
  const greekChars = (text.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g) ?? []).length;
  return greekChars > text.length * 0.1 ? "el" : "en";
}

async function authenticateAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("UNAUTHORIZED");
  const userId = data.claims.sub as string;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("FORBIDDEN");
  return userId;
}

async function collectFathomCalls(admin: SupabaseClient): Promise<IngestRow[]> {
  const rows: IngestRow[] = [];
  const { data, error } = await admin
    .from("fathom_recordings")
    .select("id, recording_id, meeting_title, share_url, transcript_text, summary_markdown, transcript_language, recording_start_time")
    .neq("transcript_text", "")
    .order("recording_start_time", { ascending: false })
    .limit(1000);
  if (error) throw error;
  for (const r of data ?? []) {
    const fullText = [r.summary_markdown, r.transcript_text].filter(Boolean).join("\n\n");
    if (!fullText) continue;
    for (const chunk of chunkText(fullText)) {
      rows.push({
        source_type: "fathom_call",
        source_id: r.recording_id,
        source_title: r.meeting_title ?? `Call ${r.recording_id}`,
        source_url: r.share_url,
        language: r.transcript_language ?? detectLanguage(chunk),
        chunk_text: chunk,
        metadata: { recorded_at: r.recording_start_time },
      });
    }
  }
  return rows;
}

async function collectAlexMessages(admin: SupabaseClient): Promise<IngestRow[]> {
  const rows: IngestRow[] = [];
  const { data: adminIds } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const adminUserIds = (adminIds ?? []).map((r: { user_id: string }) => r.user_id);
  if (adminUserIds.length === 0) return rows;

  const { data, error } = await admin
    .from("messages")
    .select("id, sender_id, receiver_id, content, created_at")
    .in("sender_id", adminUserIds)
    .not("content", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  for (const m of data ?? []) {
    if (!m.content || m.content.length < 80) continue;
    for (const chunk of chunkText(m.content)) {
      rows.push({
        source_type: "message",
        source_id: m.id,
        source_title: `Message ${m.id}`,
        source_url: null,
        language: detectLanguage(chunk),
        chunk_text: chunk,
        metadata: { sent_at: m.created_at, receiver_id: m.receiver_id },
      });
    }
  }
  return rows;
}

async function collectManualText(payload: { title?: string; text: string; language?: string; url?: string; source_type?: SourceType }): Promise<IngestRow[]> {
  const rows: IngestRow[] = [];
  const sourceType: SourceType = payload.source_type ?? "manual";
  for (const chunk of chunkText(payload.text)) {
    rows.push({
      source_type: sourceType,
      source_id: null,
      source_title: payload.title ?? null,
      source_url: payload.url ?? null,
      language: payload.language ?? detectLanguage(chunk),
      chunk_text: chunk,
      metadata: {},
    });
  }
  return rows;
}

async function embedAndStore(admin: SupabaseClient, rows: IngestRow[]): Promise<{ inserted: number }> {
  if (rows.length === 0) return { inserted: 0 };
  let inserted = 0;
  for (let i = 0; i < rows.length; i += EMBED_BATCH_SIZE) {
    const batch = rows.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await createOpenAIEmbeddings(batch.map((r) => r.chunk_text));
    const records = batch.map((row, idx) => ({
      source_type: row.source_type,
      source_id: row.source_id,
      source_title: row.source_title,
      source_url: row.source_url,
      language: row.language,
      chunk_index: i + idx,
      chunk_text: row.chunk_text,
      token_count: Math.round(row.chunk_text.length / 4),
      embedding: embeddings[idx],
      metadata: row.metadata,
    }));
    const { error } = await admin.from("coach_knowledge").insert(records);
    if (error) throw error;
    inserted += records.length;
  }
  return { inserted };
}

async function clearSource(admin: SupabaseClient, sourceType: SourceType, sourceId?: string) {
  let q = admin.from("coach_knowledge").delete().eq("source_type", sourceType);
  if (sourceId) q = q.eq("source_id", sourceId);
  const { error } = await q;
  if (error) throw error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await authenticateAdmin(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message === "FORBIDDEN" ? 403 : 401;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const source = (body?.source as string) ?? "all";
    const replace = Boolean(body?.replace);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const summary: Record<string, number> = {};

    if (source === "fathom_calls" || source === "all") {
      if (replace) await clearSource(admin, "fathom_call");
      const rows = await collectFathomCalls(admin);
      summary.fathom_call = (await embedAndStore(admin, rows)).inserted;
    }

    if (source === "messages" || source === "all") {
      if (replace) await clearSource(admin, "message");
      const rows = await collectAlexMessages(admin);
      summary.message = (await embedAndStore(admin, rows)).inserted;
    }

    if (source === "manual_text") {
      if (!body?.text || typeof body.text !== "string") {
        return new Response(JSON.stringify({ error: "manual_text requires a 'text' field" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rows = await collectManualText({
        title: body.title,
        text: body.text,
        language: body.language,
        url: body.url,
        source_type: body.source_type,
      });
      summary.manual = (await embedAndStore(admin, rows)).inserted;
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-coach-knowledge error:", e);
    const message = e instanceof Error ? e.message : "ingestion failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
