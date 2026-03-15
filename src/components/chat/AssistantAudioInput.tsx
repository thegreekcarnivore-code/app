import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useLiveDictation from "@/hooks/useLiveDictation";

interface AssistantAudioInputProps {
  hasText: boolean;
  onTranscript: (text: string) => void;
  onInterimText?: (text: string) => void;
  disabled?: boolean;
  lang?: string;
}

const MAX_DURATION = 120;
const TRANSCRIBE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice-input`;

const AssistantAudioInput = ({ hasText, onTranscript, onInterimText, disabled, lang = "en" }: AssistantAudioInputProps) => {
  // --- Live dictation (Web Speech API) ---
  const dictation = useLiveDictation({
    lang,
    onFinalTranscript: useCallback((t: string) => {
      onTranscript(t);
    }, [onTranscript]),
    onInterimUpdate: onInterimText,
  });

  // --- Batch fallback state ---
  const [batchState, setBatchState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const startBatchRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (chunksRef.current.length === 0) { setBatchState("idle"); return; }
        setBatchState("transcribing");
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        try {
          const base64 = await blobToBase64(blob);
          const resp = await fetch(TRANSCRIBE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ audio: base64, mimeType: "audio/webm" }),
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            toast.error(err.error || "Transcription failed");
            setBatchState("idle"); return;
          }
          const { transcript } = await resp.json();
          if (transcript) {
            onTranscript(transcript);
          } else {
            toast.error("No speech detected");
          }
        } catch (e) {
          console.error("Transcription error:", e);
          toast.error("Transcription failed");
        }
        setBatchState("idle");
        setElapsed(0);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setBatchState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => { if (prev >= MAX_DURATION - 1) { mediaRecorderRef.current?.stop(); return prev; } return prev + 1; });
      }, 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  }, [onTranscript]);

  const stopBatchRecording = useCallback(() => { mediaRecorderRef.current?.stop(); }, []);
  const cancelBatchRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") { chunksRef.current = []; mediaRecorderRef.current.stop(); }
  }, []);
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // --- Unified controls ---
  const useLive = dictation.isSupported;
  const isDictating = useLive ? dictation.isListening : batchState === "recording";
  const isTranscribing = !useLive && batchState === "transcribing";

  const handleStart = useLive ? dictation.start : startBatchRecording;
  const handleStop = useLive ? dictation.stop : stopBatchRecording;
  const handleCancel = useLive ? dictation.cancel : cancelBatchRecording;

  if (isTranscribing) {
    return (
      <button disabled className="rounded-full bg-gold p-2 text-gold-foreground opacity-60">
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  if (isDictating) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-sans text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {useLive ? (lang === "en" ? "Live" : "Ζωντανά") : formatTime(elapsed)}
        </span>
        <button
          onClick={handleCancel}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={handleStop}
          className="rounded-full bg-destructive p-2 text-destructive-foreground transition-opacity hover:opacity-90"
          title="Stop & transcribe"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (hasText || disabled) return null;

  return (
    <button
      onClick={handleStart}
      className="rounded-full bg-gold p-2 text-gold-foreground transition-opacity hover:opacity-90"
      title="Voice input"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
};

export default AssistantAudioInput;
