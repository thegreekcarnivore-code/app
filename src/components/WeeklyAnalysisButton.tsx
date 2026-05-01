import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const WeeklyAnalysisButton = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);
  const [openAck, setOpenAck] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("weekly_analysis_acknowledged_at" as any)
      .eq("id", user!.id)
      .maybeSingle();
    setAcknowledged(!!(data as { weekly_analysis_acknowledged_at?: string | null } | null)?.weekly_analysis_acknowledged_at);
  };

  const handleClick = () => {
    if (!acknowledged) setOpenAck(true);
    else setOpenConfirm(true);
  };

  const acknowledge = async () => {
    await supabase
      .from("profiles")
      .update({ weekly_analysis_acknowledged_at: new Date().toISOString() } as never)
      .eq("id", user!.id);
    setAcknowledged(true);
    setOpenAck(false);
    setOpenConfirm(true);
  };

  const generate = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("request-weekly-analysis", {});
    setLoading(false);
    setOpenConfirm(false);

    if (error) {
      toast({ title: lang === "el" ? "Σφάλμα" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (!data?.ok) {
      const reasonText: Record<string, { el: string; en: string }> = {
        already_used_this_week: {
          el: "Έχεις πάρει ήδη την ανάλυση αυτής της εβδομάδας. Επόμενη: επόμενη Δευτέρα.",
          en: "You already pulled this week's analysis. Next available: next Monday.",
        },
        missing_measurements: {
          el: "Χρειάζονται μετρήσεις (βάρος) τις τελευταίες 7 μέρες.",
          en: "Need a weight measurement in the last 7 days.",
        },
        missing_photos: {
          el: "Χρειάζεται φωτογραφία προόδου τις τελευταίες 7 μέρες.",
          en: "Need a progress photo in the last 7 days.",
        },
      };
      const r = data?.reason as string;
      const t = reasonText[r];
      toast({
        title: lang === "el" ? "Δεν είναι ακόμα διαθέσιμη" : "Not yet available",
        description: t ? t[lang === "el" ? "el" : "en"] : r,
        variant: "destructive",
      });
      return;
    }
    navigate(`/weekly-report?id=${data.report_id}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-4 text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90"
      >
        <Sparkles className="h-4 w-4" />
        {lang === "el" ? "Πάρε την εβδομαδιαία ανάλυσή σου" : "Get your weekly analysis"}
      </button>

      <Dialog open={openAck} onOpenChange={setOpenAck}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-gold" />
              {lang === "el" ? "Πριν συνεχίσεις" : "Before you continue"}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              {lang === "el"
                ? "Αυτή είναι η εβδομαδιαία σου ανάλυση. Έχεις δικαίωμα μία (1) φορά την εβδομάδα. Μετά από αυτή, η επόμενη ευκαιρία είναι την επόμενη Δευτέρα. Συμφωνείς;"
                : "This is your weekly analysis. You can pull it once (1) per week. After that, the next chance is next Monday. Do you agree?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpenAck(false)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
            >
              {lang === "el" ? "Άκυρο" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={acknowledge}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground"
            >
              {lang === "el" ? "Συμφωνώ" : "I agree"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lang === "el" ? "Έτοιμος;" : "Ready?"}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              {lang === "el"
                ? "Αυτή είναι η ανάλυσή σου για αυτή την εβδομάδα. Επόμενη: επόμενη Δευτέρα."
                : "This is your analysis for this week. Next: next Monday."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpenConfirm(false)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
            >
              {lang === "el" ? "Άκυρο" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50"
            >
              {loading
                ? (lang === "el" ? "Δημιουργία..." : "Generating...")
                : (lang === "el" ? "Πάρε την ανάλυση" : "Pull analysis")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WeeklyAnalysisButton;
