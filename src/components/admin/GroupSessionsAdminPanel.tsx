import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Eye, EyeOff, Trash2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Session = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  duration_minutes: number | null;
  recorded_at: string;
  published_at: string | null;
  status: string;
  created_at: string;
};

type Question = {
  id: string;
  user_id: string;
  question_text: string;
  submitted_at: string;
  answered_in_session: string | null;
};

const GroupSessionsAdminPanel = () => {
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [sessions, setSessions] = useState<Session[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newDuration, setNewDuration] = useState<string>("");
  const [newRecordedAt, setNewRecordedAt] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [sessionsRes, questionsRes] = await Promise.all([
      (supabase.from as any)("group_sessions")
        .select("id, title, description, video_url, duration_minutes, recorded_at, published_at, status, created_at")
        .order("created_at", { ascending: false }),
      (supabase.from as any)("group_session_questions")
        .select("id, user_id, question_text, submitted_at, answered_in_session")
        .is("answered_in_session", null)
        .order("submitted_at", { ascending: false })
        .limit(100),
    ]);
    setSessions((sessionsRes.data ?? []) as Session[]);
    setQuestions((questionsRes.data ?? []) as Question[]);
    setLoading(false);
  };

  const createSession = async () => {
    if (!newTitle.trim() || !newVideoUrl.trim()) {
      toast({ title: isGreek ? "Λείπουν στοιχεία" : "Missing fields", description: isGreek ? "Τίτλος + URL υποχρεωτικά." : "Title + URL required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { error } = await (supabase.from as any)("group_sessions").insert({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        video_url: newVideoUrl.trim(),
        duration_minutes: newDuration ? Number(newDuration) : null,
        recorded_at: newRecordedAt,
        status: "draft",
      });
      if (error) throw error;
      setNewTitle(""); setNewDescription(""); setNewVideoUrl(""); setNewDuration("");
      void load();
      toast({ title: isGreek ? "Δημιουργήθηκε ως draft" : "Saved as draft" });
    } catch (e) {
      toast({ title: isGreek ? "Σφάλμα" : "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = async (s: Session) => {
    const isPublishing = s.status !== "published";
    const { error } = await (supabase.from as any)("group_sessions")
      .update({
        status: isPublishing ? "published" : "draft",
        published_at: isPublishing ? new Date().toISOString() : null,
      })
      .eq("id", s.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      void load();
    }
  };

  const remove = async (s: Session) => {
    if (!confirm(isGreek ? `Διαγραφή "${s.title}";` : `Delete "${s.title}"?`)) return;
    const { error } = await (supabase.from as any)("group_sessions").delete().eq("id", s.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      void load();
    }
  };

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          {isGreek ? "Ομαδικά Sessions" : "Group Sessions"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isGreek ? "Ανέβασε YouTube/Vimeo URL · γράψε τίτλο και περιγραφή · δημοσίευσε." : "Upload to YouTube/Vimeo · paste URL · publish."}
        </p>
      </div>

      <div className="rounded-[2rem] border border-border/70 bg-card p-5 sm:p-6 space-y-4">
        <h3 className="font-serif text-base font-semibold text-foreground inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> {isGreek ? "Νέο session" : "New session"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{isGreek ? "Τίτλος" : "Title"}</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={isGreek ? "Π.χ. Group session — Μάιος 2026" : "e.g. Group session — May 2026"} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isGreek ? "Ημερομηνία γυρίσματος" : "Recorded on"}</Label>
            <Input type="date" value={newRecordedAt} onChange={(e) => setNewRecordedAt(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">{isGreek ? "URL βίντεο (YouTube unlisted ή Vimeo private)" : "Video URL (YouTube unlisted or Vimeo private)"}</Label>
            <Input value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isGreek ? "Διάρκεια (λεπτά)" : "Duration (minutes)"}</Label>
            <Input type="number" inputMode="numeric" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} placeholder="30" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">{isGreek ? "Περιγραφή (προαιρετικά)" : "Description (optional)"}</Label>
            <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} placeholder={isGreek ? "Τι καλύπτει αυτό το session..." : "What this session covers..."} />
          </div>
        </div>
        <button type="button" onClick={createSession} disabled={creating || !newTitle.trim() || !newVideoUrl.trim()} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground hover:opacity-90 disabled:opacity-50">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isGreek ? "Αποθήκευση ως draft" : "Save as draft"}
        </button>
      </div>

      <div className="rounded-[2rem] border border-border/70 bg-card overflow-hidden">
        <div className="border-b border-border/70 px-5 py-4">
          <h3 className="font-serif text-base font-semibold text-foreground">
            {isGreek ? "Όλα τα sessions" : "All sessions"}
          </h3>
        </div>
        <div className="divide-y divide-border/60">
          {sessions.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">{isGreek ? "Κανένα ακόμα." : "None yet."}</div>
          ) : sessions.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{s.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${s.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                    {s.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(s.recorded_at).toLocaleDateString(isGreek ? "el-GR" : "en-US")}
                  {s.duration_minutes ? ` · ${s.duration_minutes} ${isGreek ? "λεπτά" : "min"}` : ""}
                  <span className="mx-2">·</span>
                  <a href={s.video_url} target="_blank" rel="noreferrer" className="underline">URL</a>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => togglePublish(s)} title={s.status === "published" ? (isGreek ? "Unpublish" : "Unpublish") : (isGreek ? "Publish" : "Publish")} className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground">
                  {s.status === "published" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => remove(s)} className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-border/70 bg-card overflow-hidden">
        <div className="border-b border-border/70 px-5 py-4">
          <h3 className="font-serif text-base font-semibold text-foreground inline-flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {isGreek ? "Ερωτήσεις μελών (pending)" : "Member questions (pending)"}
            <span className="ml-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold">{questions.length}</span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {isGreek ? "Διάλεξε τις πιο χρήσιμες και απάντησέ τες στο επόμενο session." : "Pick the most useful and answer them in the next session."}
          </p>
        </div>
        <div className="divide-y divide-border/60">
          {questions.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">{isGreek ? "Καμία ερώτηση ακόμα." : "No questions yet."}</div>
          ) : questions.map((q) => (
            <div key={q.id} className="px-5 py-3">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{q.question_text}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(q.submitted_at).toLocaleDateString(isGreek ? "el-GR" : "en-US")} · {q.user_id.slice(0, 8)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupSessionsAdminPanel;
