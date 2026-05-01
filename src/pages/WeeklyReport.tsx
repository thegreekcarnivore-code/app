import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, MessageCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";

type Report = {
  id: string;
  iso_year: number;
  iso_week: number;
  generated_at: string;
  markdown: string;
};

const WeeklyReport = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, params]);

  const load = async () => {
    setLoading(true);
    const id = params.get("id");
    let q = supabase
      .from("weekly_reports" as any)
      .select("id, iso_year, iso_week, generated_at, markdown")
      .eq("user_id", user!.id);
    if (id) q = q.eq("id", id);
    const { data } = await q.order("generated_at", { ascending: false }).limit(1).maybeSingle();
    setReport((data as unknown as Report | null) ?? null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <p className="text-sm text-muted-foreground">
          {lang === "el" ? "Δεν υπάρχει διαθέσιμη ανάλυση ακόμα." : "No analysis available yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "el" ? "Πίσω" : "Back"}
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">
            <Sparkles className="h-3 w-3" />
            {lang === "el" ? "Εβδομαδιαία ανάλυση" : "Weekly analysis"}
          </div>
          <h1 className="mt-3 font-serif text-2xl font-semibold text-foreground sm:text-3xl">
            {lang === "el" ? "Εβδομάδα" : "Week"} {report.iso_week}, {report.iso_year}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(report.generated_at).toLocaleString(lang === "el" ? "el-GR" : "en-US")}
          </p>
        </div>

        <div className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm">
          <div
            className="prose prose-sm max-w-none font-sans text-foreground
            prose-headings:font-serif prose-headings:text-foreground
            prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-lg prose-h2:font-semibold
            prose-p:text-sm prose-p:leading-7 prose-p:text-muted-foreground
            prose-li:text-sm prose-li:leading-7 prose-li:text-muted-foreground
            prose-strong:text-foreground"
          >
            <ReactMarkdown>{report.markdown}</ReactMarkdown>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/coach?context=weekly_report&id=${report.id}`)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-4 text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" />
          {lang === "el" ? "Συζήτησέ το με τον Σύμβουλο" : "Discuss with the advisor"}
        </button>
      </div>
    </div>
  );
};

export default WeeklyReport;
