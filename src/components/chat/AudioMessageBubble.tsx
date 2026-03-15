import { useState, useEffect, useRef } from "react";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

interface AudioMessageBubbleProps {
  messageId: string;
  audioUrl: string;
  transcript: string | null;
  isMe: boolean;
}

const AudioMessageBubble = ({ messageId, audioUrl, transcript, isMe }: AudioMessageBubbleProps) => {
  const { lang } = useLanguage();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState(transcript);
  const [transcribing, setTranscribing] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getSignedUrl("chat-audio", audioUrl).then((url) => {
      if (url) setSignedUrl(url);
    });
  }, [audioUrl]);

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: { audioPath: audioUrl, messageId },
      });

      if (error) throw error;
      if (data?.transcript) {
        setCurrentTranscript(data.transcript);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {signedUrl ? (
        <audio controls preload="metadata" className="max-w-full h-8" style={{ minWidth: "180px" }}>
          <source src={signedUrl} type="audio/webm" />
        </audio>
      ) : (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {lang === "el" ? "Φόρτωση…" : "Loading…"}
        </div>
      )}

      {currentTranscript ? (
        <p className={cn("text-xs italic", isMe ? "text-gold-foreground/80" : "text-muted-foreground")}>
          {currentTranscript}
        </p>
      ) : (
        <button
          onClick={handleTranscribe}
          disabled={transcribing}
          className={cn(
            "flex items-center gap-1 text-[10px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50",
            isMe ? "text-gold-foreground/70" : "text-primary"
          )}
        >
          {transcribing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          {transcribing
            ? lang === "el" ? "Μεταγραφή…" : "Transcribing…"
            : lang === "el" ? "Μεταγραφή" : "Transcribe"}
        </button>
      )}
    </div>
  );
};

export default AudioMessageBubble;
