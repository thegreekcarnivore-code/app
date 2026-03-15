import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildOpenAIErrorResponse,
  getOpenAIModel,
  transcribeAudioWithOpenAI,
} from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { audioPath, messageId } = await req.json();
    if (!audioPath || !messageId) {
      return new Response(JSON.stringify({ error: "audioPath and messageId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download audio using service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("chat-audio")
      .download(audioPath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to download audio" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();

    // Determine mime type from path
    const ext = audioPath.split(".").pop()?.toLowerCase() || "webm";
    const mimeMap: Record<string, string> = {
      webm: "audio/webm",
      ogg: "audio/ogg",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
    };
    const mimeType = mimeMap[ext] || "audio/webm";

    const transcriptModel = getOpenAIModel("OPENAI_MODEL_TRANSCRIPTION", "gpt-4o-mini-transcribe");
    const transcript = await transcribeAudioWithOpenAI({
      audioBytes: new Uint8Array(arrayBuffer),
      fileName: `chat-audio.${ext}`,
      mimeType,
      model: transcriptModel,
      prompt:
        "Transcribe this audio exactly. Preserve the original language. Return only the transcription text.",
    });

    if (!transcript) {
      return new Response(JSON.stringify({ error: "No transcript generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update message with transcript using service role
    const { error: updateError } = await adminClient
      .from("messages")
      .update({ transcript })
      .eq("id", messageId);

    if (updateError) {
      console.error("Update error:", updateError);
      // Still return transcript even if DB update fails
    }

    // Log API usage
    try {
      await adminClient.rpc("log_api_usage", {
        _user_id: userId,
        _function_name: "transcribe-audio",
        _service: "openai",
        _model: transcriptModel,
        _estimated_cost: 0.005,
      });
    } catch (e) {
      console.error("Failed to log usage:", e);
    }

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "Transcription failed",
      rateLimitMessage: "Rate limited, please try again later",
    });
    if (openAIError) return openAIError;
    console.error("transcribe-audio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
