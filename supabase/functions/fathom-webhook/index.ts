import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

type FathomInvitee = {
  name?: string | null;
  email?: string | null;
  matched_speaker_display_name?: string | null;
  is_external?: boolean | null;
  email_domain?: string | null;
};

type FathomTranscriptEntry = {
  speaker?: {
    display_name?: string | null;
    matched_calendar_invitee_email?: string | null;
  } | null;
  text?: string | null;
  timestamp?: string | null;
};

type FathomActionItem = {
  description?: string | null;
  user_generated?: boolean | null;
  completed?: boolean | null;
  recording_timestamp?: string | null;
  recording_playback_url?: string | null;
  assignee?: {
    name?: string | null;
    email?: string | null;
    team?: string | null;
  } | null;
};

type FathomPayload = {
  recording_id?: number | string;
  title?: string | null;
  meeting_title?: string | null;
  url?: string | null;
  share_url?: string | null;
  created_at?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  recording_start_time?: string | null;
  recording_end_time?: string | null;
  calendar_invitees_domains_type?: string | null;
  transcript_language?: string | null;
  transcript?: FathomTranscriptEntry[] | null;
  default_summary?: {
    template_name?: string | null;
    markdown_formatted?: string | null;
  } | null;
  action_items?: FathomActionItem[] | null;
  calendar_invitees?: FathomInvitee[] | null;
  recorded_by?: {
    name?: string | null;
    email?: string | null;
    team?: string | null;
    email_domain?: string | null;
  } | null;
  crm_matches?: Record<string, unknown> | null;
};

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} not configured`);
  }
  return value;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyWebhookSignature(rawBody: string, headers: Headers, secret: string) {
  const webhookId = headers.get("webhook-id");
  const webhookTimestamp = headers.get("webhook-timestamp");
  const webhookSignature = headers.get("webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { ok: false, reason: "Missing webhook signature headers" };
  }

  const timestampSeconds = Number(webhookTimestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: "Invalid webhook timestamp" };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (ageSeconds > 300) {
    return { ok: false, reason: "Webhook timestamp too old" };
  }

  const secretValue = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = await crypto.subtle.importKey(
    "raw",
    fromBase64(secretValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expected = toBase64(new Uint8Array(signature));

  const provided = webhookSignature
    .split(/\s+/)
    .map((part) => part.split(",")[1]?.trim())
    .filter((part): part is string => Boolean(part));

  return {
    ok: provided.some((candidate) => constantTimeEqual(candidate, expected)),
    reason: "Signature mismatch",
    webhookId,
  };
}

function transcriptToText(entries: FathomTranscriptEntry[] | null | undefined) {
  if (!entries?.length) return "";
  return entries
    .map((entry) => {
      const speaker = entry.speaker?.display_name?.trim();
      const text = entry.text?.trim();
      if (!text) return "";
      return speaker ? `${speaker}: ${text}` : text;
    })
    .filter(Boolean)
    .join("\n");
}

function deriveCallType(invitees: FathomInvitee[] | null | undefined) {
  const count = invitees?.length ?? 0;
  return count > 2 ? "group" : "one_on_one";
}

function cleanEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();
    const verification = await verifyWebhookSignature(
      rawBody,
      req.headers,
      getEnv("FATHOM_WEBHOOK_SECRET"),
    );

    if (!verification.ok) {
      return new Response(JSON.stringify({ error: verification.reason }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody) as FathomPayload;
    const recordingId = String(payload.recording_id ?? "");
    if (!recordingId) {
      return new Response(JSON.stringify({ error: "recording_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    const invitees = payload.calendar_invitees ?? [];
    const transcript = payload.transcript ?? [];
    const actionItems = payload.action_items ?? [];
    const allEmails = new Set<string>();

    for (const invitee of invitees) {
      const email = cleanEmail(invitee.email);
      if (email) allEmails.add(email);
    }
    for (const entry of transcript) {
      const email = cleanEmail(entry.speaker?.matched_calendar_invitee_email);
      if (email) allEmails.add(email);
    }
    for (const item of actionItems) {
      const email = cleanEmail(item.assignee?.email);
      if (email) allEmails.add(email);
    }
    const recordedByEmail = cleanEmail(payload.recorded_by?.email);
    if (recordedByEmail) allEmails.add(recordedByEmail);

    const emailList = [...allEmails];
    const { data: profiles } = emailList.length
      ? await serviceClient
          .from("profiles")
          .select("id, email")
          .in("email", emailList)
      : { data: [] as { id: string; email: string | null }[] };

    const profileByEmail = new Map(
      (profiles ?? [])
        .filter((profile) => profile.email)
        .map((profile) => [profile.email!.toLowerCase(), profile.id]),
    );

    const transcriptText = transcriptToText(transcript);
    const externalParticipantCount = invitees.filter((invitee) => invitee.is_external).length;

    const { data: recordingRows, error: recordingError } = await serviceClient
      .from("fathom_recordings")
      .upsert({
        recording_id: recordingId,
        source: "fathom",
        event_type: "newMeeting",
        title: payload.title ?? payload.meeting_title ?? "",
        meeting_title: payload.meeting_title ?? null,
        meeting_url: payload.url ?? "",
        share_url: payload.share_url ?? null,
        transcript_language: payload.transcript_language ?? null,
        scheduled_start_time: payload.scheduled_start_time ?? null,
        scheduled_end_time: payload.scheduled_end_time ?? null,
        recording_start_time: payload.recording_start_time ?? null,
        recording_end_time: payload.recording_end_time ?? null,
        calendar_invitees_domains_type: payload.calendar_invitees_domains_type ?? null,
        recorded_by_name: payload.recorded_by?.name ?? null,
        recorded_by_email: recordedByEmail,
        recorded_by_team: payload.recorded_by?.team ?? null,
        recorded_by_email_domain: payload.recorded_by?.email_domain ?? null,
        participant_count: invitees.length,
        external_participant_count: externalParticipantCount,
        call_type: deriveCallType(invitees),
        summary_template_name: payload.default_summary?.template_name ?? null,
        summary_markdown: payload.default_summary?.markdown_formatted ?? null,
        transcript_text: transcriptText,
        transcript_segments: transcript,
        action_items: actionItems,
        crm_matches: payload.crm_matches ?? {},
        raw_payload: payload,
        automation_status: "pending",
        automation_last_error: null,
      }, {
        onConflict: "recording_id",
      })
      .select("id");

    if (recordingError || !recordingRows?.[0]) {
      throw recordingError ?? new Error("Failed to upsert Fathom recording");
    }

    const fathomRecordingId = recordingRows[0].id;

    const { error: webhookError } = await serviceClient
      .from("fathom_webhook_events")
      .upsert({
        webhook_id: verification.webhookId,
        event_type: "newMeeting",
        recording_id: recordingId,
        payload,
        processed_at: new Date().toISOString(),
      }, {
        onConflict: "webhook_id",
      });

    if (webhookError) {
      throw webhookError;
    }

    await serviceClient.from("fathom_recording_invitees").delete().eq("fathom_recording_id", fathomRecordingId);
    await serviceClient.from("fathom_action_items").delete().eq("fathom_recording_id", fathomRecordingId);

    if (invitees.length > 0) {
      const inviteeRows = invitees.map((invitee) => {
        const email = cleanEmail(invitee.email);
        return {
          fathom_recording_id: fathomRecordingId,
          name: invitee.name ?? null,
          email,
          matched_speaker_display_name: invitee.matched_speaker_display_name ?? null,
          is_external: Boolean(invitee.is_external),
          email_domain: invitee.email_domain ?? null,
          matched_user_id: email ? profileByEmail.get(email) ?? null : null,
        };
      });

      const { error: inviteeError } = await serviceClient
        .from("fathom_recording_invitees")
        .insert(inviteeRows);
      if (inviteeError) throw inviteeError;
    }

    if (actionItems.length > 0) {
      const actionRows = actionItems.map((item) => {
        const email = cleanEmail(item.assignee?.email);
        return {
          fathom_recording_id: fathomRecordingId,
          description: item.description ?? "",
          user_generated: Boolean(item.user_generated),
          completed: Boolean(item.completed),
          recording_timestamp: item.recording_timestamp ?? null,
          recording_playback_url: item.recording_playback_url ?? null,
          assignee_name: item.assignee?.name ?? null,
          assignee_email: email,
          assignee_team: item.assignee?.team ?? null,
          matched_user_id: email ? profileByEmail.get(email) ?? null : null,
        };
      });

      const { error: actionError } = await serviceClient
        .from("fathom_action_items")
        .insert(actionRows);
      if (actionError) throw actionError;
    }

    return new Response(JSON.stringify({ ok: true, recording_id: recordingId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fathom-webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
