import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Play, MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type GroupSession = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_minutes: number | null;
  recorded_at: string;
  published_at: string | null;
};

// Convert various YouTube/Vimeo URLs to embed URLs.
function toEmbedUrl(url: string): string {
  // YouTube watch links
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?#]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?rel=0`;
  // YouTube embed already
  if (/youtube\.com\/embed\//.test(url)) return url;
  // Vimeo
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return url;
}

const GroupSessions = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)("group_sessions")
      .select("id, title, description, video_url, thumbnail_url, duration_minutes, recorded_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as GroupSession[];
    setSessions(rows);
    setActiveId(rows[0]?.id ?? null);
    setLoading(false);
  };

  const submitQuestion = async () => {
    const text = question.trim();
    if (text.length < 10) {
      toast({ title: isGreek ? "Πολύ σύντομο" : "Too short", description: isGreek ? "Τουλάχιστον 10 χαρακτήρες." : "At least 10 characters.", variant: "destructive" });
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase.from as any)("group_session_questions").insert({ user_id: user.id, question_text: text });
      if (error) throw error;
      setQuestion("");
      toast({ title: isGreek ? "Στάλθηκε" : "Submitted", description: isGreek ? "Η ερώτησή σου φτάνει στον Αλέξανδρο για το επόμενο group session." : "Your question reached Alex for the next group session." });
    } catch (e) {
      toast({ title: isGreek ? "Σφάλμα" : "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const active = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-[10px] font-sans uppercase tracking-[0.22em] text-gold">
            {isGreek ? "Group Session" : "Group Session"}
          </p>
          <h1 className="mt-2 font-serif text-2xl font-semibold text-foreground sm:text-3xl">
            {isGreek ? "Μηνιαίες ομαδικές συναντήσεις" : "Monthly group sessions"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isGreek
              ? "Κάθε μήνα ο Αλέξανδρος γυρίζει ένα 30λεπτο βίντεο απαντώντας τις ερωτήσεις των μελών. Δες τις προηγούμενες ή στείλε τη δική σου για την επόμενη."
              : "Every month Alex records a 30-min video answering member questions. Watch past sessions or submit yours for the next one."}
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card p-6 text-center text-sm text-muted-foreground">
            {isGreek
              ? "Δεν έχει δημοσιευτεί κανένα session ακόμα. Στείλε ερώτηση για το επόμενο πιο κάτω."
              : "No sessions published yet. Submit a question below for the next one."}
          </div>
        ) : (
          <>
            {active && (
              <div className="rounded-[2rem] border border-border/70 bg-card overflow-hidden">
                <div className="aspect-video w-full bg-black">
                  <iframe
                    key={active.id}
                    src={toEmbedUrl(active.video_url)}
                    title={active.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
                <div className="p-5 sm:p-6 space-y-2">
                  <p className="text-[10px] font-sans uppercase tracking-wider text-gold">
                    {new Date(active.recorded_at).toLocaleDateString(isGreek ? "el-GR" : "en-US", { year: "numeric", month: "long" })}
                    {active.duration_minutes ? ` · ${active.duration_minutes} ${isGreek ? "λεπτά" : "min"}` : ""}
                  </p>
                  <h2 className="font-serif text-xl font-semibold text-foreground">{active.title}</h2>
                  {active.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{active.description}</p>
                  )}
                </div>
              </div>
            )}

            {sessions.length > 1 && (
              <div>
                <h3 className="font-serif text-base font-semibold text-foreground mb-2">
                  {isGreek ? "Προηγούμενα sessions" : "Past sessions"}
                </h3>
                <div className="space-y-2">
                  {sessions.filter((s) => s.id !== activeId).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveId(s.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 text-left hover:border-gold/40"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                        <Play className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{s.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(s.recorded_at).toLocaleDateString(isGreek ? "el-GR" : "en-US", { year: "numeric", month: "long" })}
                          {s.duration_minutes ? ` · ${s.duration_minutes} ${isGreek ? "λεπτά" : "min"}` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="rounded-[2rem] border border-gold/40 bg-gold/5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <MessageCircle className="h-5 w-5 shrink-0 text-gold" />
            <div className="flex-1 min-w-0">
              <h3 className="font-serif text-lg font-semibold text-foreground">
                {isGreek ? "Στείλε ερώτηση για το επόμενο session" : "Submit a question for the next session"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {isGreek
                  ? "Ο Αλέξανδρος επιλέγει τις πιο συχνές ή χρήσιμες και τις απαντά στο επόμενο group video. Ανώνυμα — η ταυτότητά σου δεν εμφανίζεται."
                  : "Alex picks the most common or useful questions and answers them in the next group video. Anonymous — your identity is not shown."}
              </p>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={4}
                placeholder={isGreek ? "Π.χ. πώς διαχειρίζομαι ένα γάμο/ταξίδι/πρόκληση..." : "e.g. how do I handle a wedding / trip / challenge..."}
                className="mt-3 text-sm"
              />
              <button
                type="button"
                onClick={submitQuestion}
                disabled={submitting || question.trim().length < 10}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {isGreek ? "Στείλε ερώτηση" : "Submit question"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GroupSessions;
