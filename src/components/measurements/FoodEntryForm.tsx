import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Camera, X, Coffee, Sun, Moon, Cookie, Wine, CalendarIcon, Clock, ImagePlus, Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getSignedUrl } from "@/lib/storage";
import useLiveDictation from "@/hooks/useLiveDictation";

const MAX_VOICE_DURATION = 120;
const TRANSCRIBE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice-input`;

interface FoodEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEntry: any | null;
  mealType: string;
  userId: string;
  date: string;
  foodPhotoAiEnabled?: boolean;
}

const MEAL_TYPES = [
  { value: "breakfast", en: "Breakfast", el: "Πρωινό", icon: Coffee },
  { value: "lunch", en: "Lunch", el: "Μεσημεριανό", icon: Sun },
  { value: "dinner", en: "Dinner", el: "Βραδινό", icon: Moon },
  { value: "snack", en: "Snack", el: "Σνακ", icon: Cookie },
  { value: "drinks", en: "Drinks", el: "Ποτά", icon: Wine },
];

/* Grade colors removed — AI now documents foods without grading */

const FoodEntryForm = ({ open, onOpenChange, editEntry, mealType, userId, date, foodPhotoAiEnabled = false }: FoodEntryFormProps) => {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedMealType, setSelectedMealType] = useState(mealType);
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(date + "T00:00:00"));
  const [selectedTime, setSelectedTime] = useState(format(new Date(), "HH:mm"));
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState("");
  const timeInputRef = useRef<HTMLInputElement | null>(null);

  // --- Live dictation (Web Speech API) ---
  const dictation = useLiveDictation({
    lang,
    onFinalTranscript: useCallback((t: string) => {
      setDescription((prev) => (prev ? prev + t : t));
    }, []),
  });

  // --- Batch fallback state (for browsers without Web Speech API) ---
  const [batchVoiceState, setBatchVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceElapsed, setVoiceElapsed] = useState(0);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      if (voiceRecorderRef.current?.state === "recording") voiceRecorderRef.current.stop();
    };
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const startBatchVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      voiceChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) voiceChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
        if (voiceChunksRef.current.length === 0) { setBatchVoiceState("idle"); return; }
        setBatchVoiceState("transcribing");
        const blob = new Blob(voiceChunksRef.current, { type: "audio/webm" });
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
            setBatchVoiceState("idle"); return;
          }
          const { transcript } = await resp.json();
          if (transcript) {
            setDescription(prev => prev ? prev + " " + transcript : transcript);
          } else {
            toast({ title: lang === "en" ? "No speech detected" : "Δεν ανιχνεύθηκε ομιλία", variant: "destructive" });
          }
        } catch { toast({ title: lang === "en" ? "Transcription failed" : "Αποτυχία μεταγραφής", variant: "destructive" }); }
        setBatchVoiceState("idle");
        setVoiceElapsed(0);
      };
      voiceRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setBatchVoiceState("recording");
      setVoiceElapsed(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceElapsed(prev => { if (prev >= MAX_VOICE_DURATION - 1) { voiceRecorderRef.current?.stop(); return prev; } return prev + 1; });
      }, 1000);
    } catch { toast({ title: lang === "en" ? "Microphone access denied" : "Δεν επιτράπηκε η πρόσβαση στο μικρόφωνο", variant: "destructive" }); }
  }, [lang]);

  const stopBatchVoice = useCallback(() => { voiceRecorderRef.current?.stop(); }, []);
  const cancelBatchVoice = useCallback(() => { if (voiceRecorderRef.current?.state === "recording") { voiceChunksRef.current = []; voiceRecorderRef.current.stop(); } }, []);
  const formatVoiceTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // --- Unified dictation controls ---
  const useLiveVoice = dictation.isSupported;
  const isVoiceDictating = useLiveVoice ? dictation.isListening : batchVoiceState === "recording";
  const isVoiceTranscribing = !useLiveVoice && batchVoiceState === "transcribing";

  const handleVoiceStart = useLiveVoice ? dictation.start : startBatchVoice;
  const handleVoiceStop = useLiveVoice ? dictation.stop : stopBatchVoice;
  const handleVoiceCancel = useLiveVoice ? dictation.cancel : cancelBatchVoice;

  // Compose display text with interim preview
  const voiceDisplayDescription = useLiveVoice && dictation.isListening && dictation.interimText
    ? description + dictation.interimText
    : description;

  const openNativeTimePicker = () => {
    const input = timeInputRef.current;
    if (!input) return;
    const nativePickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof nativePickerInput.showPicker === "function") {
      nativePickerInput.showPicker();
    } else {
      input.focus();
    }
  };
  /* aiGrade removed */

  useEffect(() => {
    if (editEntry) {
      setSelectedMealType(editEntry.meal_type || mealType);
      setDescription(editEntry.description || "");
      setSelectedDate(new Date(editEntry.entry_date + "T00:00:00"));
      setSelectedTime(format(new Date(editEntry.created_at), "HH:mm"));
      setExistingPhotoUrl(editEntry.photo_url || null);
      setPhotoFiles([]);
      // Generate signed URL for existing photo
      if (editEntry.photo_url) {
        getSignedUrl("food-photos", editEntry.photo_url).then(url => {
          setPhotoPreviews(url ? [url] : []);
        });
      } else {
        setPhotoPreviews([]);
      }
    } else {
      setSelectedMealType(mealType);
      setDescription("");
      setSelectedDate(new Date(date + "T00:00:00"));
      setSelectedTime(format(new Date(), "HH:mm"));
      setExistingPhotoUrl(null);
      setPhotoPreviews([]);
      setPhotoFiles([]);
    }
    setAnalyzing(false);
  }, [editEntry, open, mealType, date]);

  // Upload a single file to storage and return { path, signedUrl }
  const uploadSinglePhoto = async (file: File, suffix = ""): Promise<{ path: string; signedUrl: string }> => {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}${suffix}.${ext}`;
    const { error } = await supabase.storage.from("food-photos").upload(path, file);
    if (error) throw error;
    const signedUrl = await getSignedUrl("food-photos", path, 3600);
    if (!signedUrl) throw new Error("Failed to generate signed URL");
    return { path, signedUrl };
  };

  // Analyze a single photo URL via edge function
  const analyzePhoto = async (imageUrl: string): Promise<{ foods: any[]; summary: string }> => {
    const { data, error } = await supabase.functions.invoke("analyze-food-photo", {
      body: { imageUrl, language: lang },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => {
      if (f.size > 4 * 1024 * 1024) {
        toast({ title: lang === "en" ? "File too large (max 4MB)" : "Αρχείο πολύ μεγάλο (μέγ. 4MB)", variant: "destructive" });
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    // For non-premium users, only allow 1 photo total
    if (!foodPhotoAiEnabled) {
      const file = valid[0];
      setPhotoFiles([file]);
      setPhotoPreviews([URL.createObjectURL(file)]);
      setExistingPhotoUrl(null);

      // Upload and analyze immediately
      setAnalyzing(true);
      setAnalyzingProgress(lang === "en" ? "Analyzing..." : "Ανάλυση...");
      try {
        const { path, signedUrl } = await uploadSinglePhoto(file);
        setPhotoPreviews([signedUrl]);
        // Store path as data attribute for later retrieval
        (window as any).__lastFoodPhotoPath = path;
        const result = await analyzePhoto(signedUrl);
        setDescription(result.summary);
      } catch (err: any) {
        console.error("Analysis error:", err);
        toast({ title: lang === "en" ? "Analysis failed" : "Η ανάλυση απέτυχε", description: err.message, variant: "destructive" });
      } finally {
        setAnalyzing(false);
        setAnalyzingProgress("");
      }
      return;
    }

    // Premium: allow multiple
    const newFiles = [...photoFiles, ...valid];
    const newPreviews = [...photoPreviews, ...valid.map(f => URL.createObjectURL(f))];
    setPhotoFiles(newFiles);
    setPhotoPreviews(newPreviews);
    if (valid.length > 0) setExistingPhotoUrl(null);

    // Upload and analyze each new photo
    setAnalyzing(true);
    const totalToAnalyze = valid.length;
    let analyzed = 0;
    let summaries: string[] = description ? [description] : [];

    for (const file of valid) {
      analyzed++;
      setAnalyzingProgress(
        lang === "en"
          ? `Analyzing ${analyzed}/${totalToAnalyze}...`
          : `Ανάλυση ${analyzed}/${totalToAnalyze}...`
      );
      try {
        const { path, signedUrl } = await uploadSinglePhoto(file, `_${analyzed}`);
        // Store first path for DB
        if (analyzed === 1) (window as any).__lastFoodPhotoPath = path;
        // Update preview with signed URL
        setPhotoPreviews(prev => {
          const copy = [...prev];
          const idx = copy.findIndex(p => p.startsWith("blob:"));
          if (idx >= 0) copy[idx] = signedUrl;
          return copy;
        });
        const result = await analyzePhoto(signedUrl);
        summaries.push(result.summary);
      } catch (err: any) {
        console.error("Analysis error:", err);
        toast({ title: lang === "en" ? "Analysis failed for a photo" : "Αποτυχία ανάλυσης φωτογραφίας", variant: "destructive" });
      }
    }

    setDescription(summaries.join("\n"));
    setAnalyzing(false);
    setAnalyzingProgress("");
  };

  const removePhoto = (idx: number) => {
    if (editEntry && idx === 0 && existingPhotoUrl && photoFiles.length === 0) {
      setExistingPhotoUrl(null);
      setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    const fileIdx = existingPhotoUrl ? idx - 1 : idx;
    setPhotoFiles(prev => prev.filter((_, i) => i !== fileIdx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadPhotos = async (): Promise<string | null> => {
    // Photos already uploaded during analysis - return the stored path
    if ((window as any).__lastFoodPhotoPath) {
      const path = (window as any).__lastFoodPhotoPath;
      delete (window as any).__lastFoodPhotoPath;
      return path;
    }
    if (photoPreviews.length > 0 && !photoPreviews[0].startsWith("blob:")) {
      // Existing photo URL from edit - keep as-is (legacy URL or path)
      return existingPhotoUrl;
    }
    if (photoFiles.length === 0) return existingPhotoUrl;
    setUploading(true);
    const file = photoFiles[0];
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("food-photos").upload(path, file);
    setUploading(false);
    if (error) throw error;
    return path; // Store path, not public URL
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const photoUrl = await uploadPhotos();
      const entryDate = format(selectedDate, "yyyy-MM-dd");
      const createdAt = new Date(`${entryDate}T${selectedTime}:00`).toISOString();
      const payload = {
        user_id: userId,
        entry_date: entryDate,
        meal_type: selectedMealType,
        description,
        notes: null as string | null,
        photo_url: photoUrl,
        created_at: createdAt,
      };
      if (editEntry) {
        const { error } = await supabase.from("food_journal").update(payload).eq("id", editEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("food_journal").insert(payload);
        if (error) throw error;

        // Additional photos as separate entries
        const additionalUrls = photoPreviews.slice(1).filter(u => !u.startsWith("blob:"));
        for (const url of additionalUrls) {
          await supabase.from("food_journal").insert({
            user_id: userId,
            entry_date: entryDate,
            meal_type: selectedMealType,
            description,
            notes: null,
            photo_url: url,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food_journal_all", userId] });
      onOpenChange(false);
      toast({ title: lang === "en" ? "Saved" : "Αποθηκεύτηκε" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Whether to show photo add buttons
  const canAddMorePhotos = foodPhotoAiEnabled || photoPreviews.length === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] pb-6">
        <DrawerTitle className="px-4 pt-4 font-serif text-xl">
          {editEntry ? (lang === "en" ? "Edit Entry" : "Επεξεργασία") : (lang === "en" ? "Add Entry" : "Νέα Καταχώρηση")}
        </DrawerTitle>
        <div className="overflow-y-auto px-4 py-3 space-y-5">
          {/* Meal Type Selector */}
          <div>
            <label className="block text-base font-sans text-muted-foreground mb-2">
              {lang === "en" ? "Type" : "Τύπος"}
            </label>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((mt) => {
                const Icon = mt.icon;
                const selected = selectedMealType === mt.value;
                return (
                  <button
                    key={mt.value}
                    type="button"
                    onClick={() => setSelectedMealType(mt.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-sans font-medium transition-colors border ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {lang === "en" ? mt.en : mt.el}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-base font-sans text-muted-foreground mb-2">
              {lang === "en" ? "Date & Time" : "Ημ/νία & Ώρα"}
            </label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-[3] justify-start text-left font-sans text-base",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    disabled={(d) => d > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <div className="relative flex-[2]" data-vaul-no-drag>
                <button
                  type="button"
                  onClick={openNativeTimePicker}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={lang === "en" ? "Open time picker" : "Άνοιγμα επιλογής ώρας"}
                  data-vaul-no-drag
                >
                  <Clock className="h-4 w-4" />
                </button>
                <input
                  ref={timeInputRef}
                  type="time"
                  value={selectedTime}
                  onClick={openNativeTimePicker}
                  onChange={(e) => {
                    if (e.target.value) setSelectedTime(e.target.value);
                  }}
                  step="300"
                  data-vaul-no-drag
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-base font-sans text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-base font-sans text-muted-foreground mb-1">
              {lang === "en" ? "Photos (optional)" : "Φωτογραφίες (προαιρετικό)"}
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {photoPreviews.map((url, idx) => (
                <div key={idx} className="relative">
                  <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {analyzing && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 h-16">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs font-sans text-muted-foreground">{analyzingProgress}</span>
                </div>
              )}
              {canAddMorePhotos && !analyzing && (
                <>
                  <label className="flex flex-col items-center cursor-pointer rounded-lg border border-dashed border-border h-16 w-16 justify-center text-muted-foreground hover:border-primary/50 transition-colors">
                    <Camera className="h-5 w-5" />
                    <span className="text-[9px] mt-0.5">{lang === "en" ? "Camera" : "Κάμερα"}</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                  </label>
                  <label className="flex flex-col items-center cursor-pointer rounded-lg border border-dashed border-border h-16 w-16 justify-center text-muted-foreground hover:border-primary/50 transition-colors">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[9px] mt-0.5">{lang === "en" ? "Gallery" : "Συλλογή"}</span>
                    <input type="file" accept="image/*" multiple={foodPhotoAiEnabled} onChange={handlePhotoSelect} className="hidden" />
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-base font-sans text-muted-foreground">
                {lang === "en" ? "What did you eat/drink?" : "Τι φάγατε/ήπιατε;"}
              </label>

              {!isVoiceDictating && !isVoiceTranscribing && (
                <button
                  onClick={handleVoiceStart}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-sans font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                >
                  <Mic className="h-3.5 w-3.5" />
                  {lang === "en" ? "Dictate" : "Υπαγόρευση"}
                </button>
              )}

              {isVoiceDictating && (
                <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1.5">
                  <span className="flex items-center gap-1 text-xs font-sans text-destructive">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                    {useLiveVoice
                      ? (lang === "en" ? "Dictating..." : "Υπαγόρευση...")
                      : formatVoiceTime(voiceElapsed)}
                  </span>
                  <button onClick={handleVoiceCancel} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={handleVoiceStop} className="rounded-full bg-destructive p-1 text-destructive-foreground transition-opacity hover:opacity-90">
                    <Square className="h-3 w-3" />
                  </button>
                </div>
              )}

              {isVoiceTranscribing && (
                <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-xs font-sans text-primary">
                    {lang === "en" ? "Transcribing..." : "Μεταγραφή..."}
                  </span>
                </div>
              )}
            </div>
            <textarea
              data-guide="food-description-input"
              value={voiceDisplayDescription}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base font-sans text-foreground resize-none"
              placeholder={lang === "en" ? "Describe everything you had today..." : "Περιγράψτε ό,τι φάγατε/ήπιατε σήμερα..."}
            />
          </div>

          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || analyzing || !description.trim()} className="w-full text-base py-5">
            {mutation.isPending || uploading ? (lang === "en" ? "Saving..." : "Αποθήκευση...") : (lang === "en" ? "Save" : "Αποθήκευση")}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default FoodEntryForm;
