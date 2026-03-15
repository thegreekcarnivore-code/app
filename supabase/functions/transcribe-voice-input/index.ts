import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildOpenAIErrorResponse,
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
    const { audio, mimeType } = await req.json();
    if (!audio) {
      return new Response(JSON.stringify({ error: "audio (base64) is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mime = mimeType || "audio/webm";
    const ext = mime.includes("mp3")
      ? "mp3"
      : mime.includes("wav")
        ? "wav"
        : mime.includes("ogg")
          ? "ogg"
          : "webm";
    const binaryAudio = Uint8Array.from(atob(audio), (char) => char.charCodeAt(0));
    const transcript = await transcribeAudioWithOpenAI({
      audioBytes: binaryAudio,
      fileName: `voice-input.${ext}`,
      mimeType: mime,
      prompt:
        "Transcribe this audio exactly. Preserve the original language. Return only the transcription text.",
    });

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const openAIError = buildOpenAIErrorResponse(e, corsHeaders, {
      defaultMessage: "Transcription failed",
      rateLimitMessage: "Rate limited, please try again later",
    });
    if (openAIError) return openAIError;
    console.error("transcribe-voice-input error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
