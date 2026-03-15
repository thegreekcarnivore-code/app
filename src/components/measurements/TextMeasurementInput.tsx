import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Save, X, CheckCircle2, Mic, Square } from "lucide-react";
import useLiveDictation from "@/hooks/useLiveDictation";

interface ParsedEntry {
  date: string;
  weight_kg?: number;
  height_cm?: number;
  fat_kg?: number;
  muscle_kg?: number;
  waist_cm?: number;
  hip_cm?: number;
  right_arm_cm?: number;
  left_arm_cm?: number;
  right_leg_cm?: number;
  left_leg_cm?: number;
  energy?: number;
  digestion?: number;
  skin_health?: number;
  mood?: number;
  stress?: number;
  cravings?: number;
  breathing_health?: number;
  mental_health?: number;
  pain?: number;
}

interface TextMeasurementInputProps {
  userId: string;
}

const fieldLabels: Record<string, { en: string; el: string }> = {
  weight_kg: { en: "Weight", el: "Βάρος" },
  height_cm: { en: "Height", el: "Ύψος" },
  fat_kg: { en: "Fat", el: "Λίπος" },
  muscle_kg: { en: "Muscle", el: "Μυϊκή Μάζα" },
  waist_cm: { en: "Waist", el: "Μέση" },
  hip_cm: { en: "Hip", el: "Γοφοί" },
  right_arm_cm: { en: "R. Arm", el: "Δεξί Μπράτσο" },
  left_arm_cm: { en: "L. Arm", el: "Αριστ. Μπράτσο" },
  right_leg_cm: { en: "R. Leg", el: "Δεξί Πόδι" },
  left_leg_cm: { en: "L. Leg", el: "Αριστ. Πόδι" },
  energy: { en: "Energy", el: "Ενέργεια" },
  digestion: { en: "Digestion", el: "Πέψη" },
  skin_health: { en: "Skin", el: "Δέρμα" },
  mood: { en: "Mood", el: "Διάθεση" },
  stress: { en: "Stress", el: "Στρες" },
  cravings: { en: "Cravings", el: "Λιγούρες" },
  breathing_health: { en: "Breathing", el: "Αναπνοή" },
  mental_health: { en: "Mental", el: "Ψυχική Υγεία" },
  pain: { en: "Pain", el: "Πόνος" },
};

const getUnit = (key: string) => {
  if (key.endsWith("_kg")) return "kg";
  if (key.endsWith("_cm")) return "cm";
  return "";
};

// Batch fallback constants
const MAX_DURATION = 120;
const TRANSCRIBE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice-input`;

const TextMeasurementInput = ({ userId }: TextMeasurementInputProps) => {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedEntry[] | null>(null);
  const [parsing, setParsing] = useState(false);

  // --- Live dictation (Web Speech API) ---
  const dictation = useLiveDictation({
    lang,
    onFinalTranscript: useCallback((t: string) => {
      setText((prev) => (prev ? prev + t : t));
    }, []),
  });

  // --- Batch fallback state (for browsers without Web Speech API) ---
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
            toast({ title: err.error || "Transcription failed", variant: "destructive" });
            setBatchState("idle"); return;
          }
          const { transcript } = await resp.json();
          if (transcript) {
            setText((prev) => (prev ? prev + " " + transcript : transcript));
          } else {
            toast({ title: lang === "en" ? "No speech detected" : "Δεν ανιχνεύθηκε ομιλία", variant: "destructive" });
          }
        } catch {
          toast({ title: lang === "en" ? "Transcription failed" : "Αποτυχία μεταγραφής", variant: "destructive" });
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
      toast({ title: lang === "en" ? "Microphone access denied" : "Δεν επιτράπηκε η πρόσβαση στο μικρόφωνο", variant: "destructive" });
    }
  }, [lang]);

  const stopBatchRecording = useCallback(() => { mediaRecorderRef.current?.stop(); }, []);
  const cancelBatchRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") { chunksRef.current = []; mediaRecorderRef.current.stop(); }
  }, []);
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // --- Unified dictation controls ---
  const useLive = dictation.isSupported;
  const isDictating = useLive ? dictation.isListening : batchState === "recording";
  const isTranscribing = !useLive && batchState === "transcribing";

  const handleStart = useLive ? dictation.start : startBatchRecording;
  const handleStop = useLive ? dictation.stop : stopBatchRecording;
  const handleCancel = useLive ? dictation.cancel : cancelBatchRecording;

  // Compose display text: committed text + interim preview
  const displayText = useLive && dictation.isListening && dictation.interimText
    ? text + dictation.interimText
    : text;

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-measurements", {
        body: { text: text.trim(), language: lang },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.entries?.length) {
        toast({
          title: lang === "en" ? "No measurements found" : "Δεν βρέθηκαν μετρήσεις",
          description: lang === "en" ? "Try adding more detail to your text." : "Δοκιμάστε να προσθέσετε περισσότερες λεπτομέρειες.",
          variant: "destructive",
        });
        return;
      }
      setParsed(data.entries);
    } catch (e: any) {
      console.error("Parse error:", e);
      toast({ title: lang === "en" ? "Error" : "Σφάλμα", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (entries: ParsedEntry[]) => {
      const rows = entries.map((entry) => {
        const { date, ...fields } = entry;
        return { user_id: userId, measured_at: new Date(date).toISOString(), ...fields };
      });
      const { error } = await supabase.from("measurements").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurements", userId] });
      toast({ title: lang === "en" ? "Measurements saved!" : "Οι μετρήσεις αποθηκεύτηκαν!" });
      setParsed(null);
      setText("");
    },
    onError: (e: any) => {
      toast({ title: lang === "en" ? "Save failed" : "Αποτυχία αποθήκευσης", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-serif font-bold text-foreground">
          {lang === "en" ? "Quick Entry" : "Γρήγορη Καταχώρηση"}
        </span>
      </div>

      {/* Helper text */}
      <p className="text-xs font-sans text-muted-foreground leading-relaxed">
        {lang === "en"
          ? "Type, paste, or dictate your measurements. Include dates if you have entries from different days."
          : "Γράψτε, επικολλήστε ή υπαγορεύστε τις μετρήσεις σας. Συμπεριλάβετε ημερομηνίες αν έχετε καταχωρήσεις από διαφορετικές μέρες."}
      </p>

      {/* Voice dictation controls */}
      <div className="flex items-center gap-2">
        {!isDictating && !isTranscribing && (
          <button
            onClick={handleStart}
            disabled={parsing || !!parsed}
            className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-sans font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
          >
            <Mic className="h-4 w-4" />
            {lang === "en" ? "Dictate" : "Υπαγόρευση"}
          </button>
        )}

        {isDictating && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-sans text-destructive">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              {useLive
                ? (lang === "en" ? "Dictating..." : "Υπαγόρευση...")
                : formatTime(elapsed)}
            </span>
            <button
              onClick={handleCancel}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
              title={lang === "en" ? "Cancel" : "Ακύρωση"}
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={handleStop}
              className="rounded-full bg-destructive p-1.5 text-destructive-foreground transition-opacity hover:opacity-90"
              title={lang === "en" ? "Stop" : "Σταμάτα"}
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {isTranscribing && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-sans text-primary">
              {lang === "en" ? "Transcribing..." : "Μεταγραφή..."}
            </span>
          </div>
        )}
      </div>

      {/* Textarea */}
      <textarea
        value={displayText}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          lang === "en"
            ? "e.g. 15/2 weight 82.3kg, waist 88cm\n22/2 weight 81.5kg, waist 87cm"
            : "π.χ. 15/2 βάρος 82.3kg, μέση 88cm\n22/2 βάρος 81.5kg, μέση 87cm"
        }
        disabled={parsing || isTranscribing}
        className="w-full min-h-[80px] rounded-lg border border-input bg-muted/30 px-3 py-2.5 text-sm font-sans text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-50 resize-none transition-all"
      />

      {/* Parse button */}
      {!parsed && (
        <Button
          onClick={handleParse}
          disabled={parsing || !text.trim() || isDictating || isTranscribing}
          variant="outline"
          className="w-full gap-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40"
          size="sm"
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
          {lang === "en" ? "Parse Measurements" : "Ανάλυση Μετρήσεων"}
        </Button>
      )}

      {/* Parsed results */}
      {parsed && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <p className="text-xs font-sans font-medium text-foreground">
              {lang === "en"
                ? `Found ${parsed.length} entry(ies)`
                : `Βρέθηκαν ${parsed.length} καταχώρηση(-εις)`}
            </p>
          </div>

          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {parsed.map((entry, idx) => {
              const { date, ...fields } = entry;
              const nonNullFields = Object.entries(fields).filter(([, v]) => v !== undefined && v !== null);
              return (
                <div key={idx} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5">
                  <p className="text-sm font-serif font-bold text-foreground">
                    {new Date(date).toLocaleDateString(lang === "en" ? "en-GB" : "el-GR")}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {nonNullFields.map(([key, val]) => (
                      <span key={key} className="text-xs font-sans text-muted-foreground">
                        {fieldLabels[key]?.[lang] || key}:{" "}
                        <span className="font-medium text-foreground">
                          {val}
                          {getUnit(key)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate(parsed)} disabled={saveMutation.isPending} className="flex-1 gap-2" size="sm">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {lang === "en" ? "Save All" : "Αποθήκευση Όλων"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setParsed(null)} className="px-3">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextMeasurementInput;
