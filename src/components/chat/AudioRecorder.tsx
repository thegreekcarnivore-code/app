import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  userId: string;
  otherUserId: string;
  onSent: () => void;
  hasText: boolean;
}

const MAX_DURATION = 120; // 2 minutes

const AudioRecorder = ({ userId, otherUserId, onSent, hasText }: AudioRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        if (chunksRef.current.length === 0) {
          setRecording(false);
          return;
        }

        setUploading(true);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const path = `${userId}/${Date.now()}.webm`;

        const { error: uploadError } = await supabase.storage
          .from("chat-audio")
          .upload(path, blob, { contentType: "audio/webm" });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          setUploading(false);
          setRecording(false);
          return;
        }

        const { error: insertError } = await supabase.from("messages").insert({
          sender_id: userId,
          receiver_id: otherUserId,
          content: "",
          audio_url: path,
          message_type: "audio",
        } as any);

        if (insertError) {
          console.error("Insert error:", insertError);
        }

        setUploading(false);
        setRecording(false);
        setElapsed(0);
        onSent();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= MAX_DURATION - 1) {
            mediaRecorderRef.current?.stop();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  }, [userId, otherUserId, onSent]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      chunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
  }, []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (uploading) {
    return (
      <button disabled className="rounded-full bg-gold p-2 text-gold-foreground opacity-60">
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-sans text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {formatTime(elapsed)}
        </span>
        <button
          onClick={cancelRecording}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={stopRecording}
          className="rounded-full bg-destructive p-2 text-destructive-foreground transition-opacity hover:opacity-90"
          title="Stop & send"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (hasText) return null;

  return (
    <button
      onClick={startRecording}
      className="rounded-full bg-gold p-2 text-gold-foreground transition-opacity hover:opacity-90"
      title="Record voice message"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
};

export default AudioRecorder;
