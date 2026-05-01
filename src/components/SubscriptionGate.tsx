import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, CreditCard, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";

type SubStatus = "active" | "past_due" | "canceled" | "trialing" | "unpaid";

const ALLOWED_PATHS = ["/billing", "/policy", "/auth", "/metamorphosis", "/unico"];

const SubscriptionGate = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user || isAdmin) {
      setStatus("active");
      setLoading(false);
      return;
    }
    void fetchStatus();
  }, [user, isAdmin]);

  const fetchStatus = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("subscription_status" as any)
      .eq("id", user!.id)
      .maybeSingle();
    setStatus((((data as { subscription_status?: SubStatus } | null)?.subscription_status) ?? "active"));
    setLoading(false);
  };

  const openPortal = async () => {
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("create-customer-portal-session", {});
    setActionLoading(false);
    if (error || !data?.url) {
      toast({
        title: lang === "el" ? "Σφάλμα" : "Error",
        description: lang === "el"
          ? "Δεν μπορέσαμε να ανοίξουμε το portal. Δοκίμασε ξανά."
          : "Could not open the portal. Please try again.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = data.url as string;
  };

  const reactivate = async () => {
    setActionLoading(true);
    const { data, error } = await supabase.functions.invoke("create-metamorphosis-checkout", {});
    setActionLoading(false);
    if (error || !data?.url) {
      toast({
        title: lang === "el" ? "Σφάλμα" : "Error",
        description: lang === "el"
          ? "Δεν μπορέσαμε να ξεκινήσουμε την επανενεργοποίηση."
          : "Could not start reactivation.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = data.url as string;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  const blocked = status === "past_due" || status === "canceled" || status === "unpaid";
  const onAllowedPath = ALLOWED_PATHS.some((p) => location.pathname.startsWith(p));

  if (!blocked || onAllowedPath) return <>{children}</>;

  const isCanceled = status === "canceled";

  return (
    <div className="fixed inset-0 z-[190] overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm">
          <div className="border-b border-border/70 bg-gold/5 px-6 py-6">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">
              <Sparkles className="h-3 w-3" />
              {lang === "el" ? "Συνδρομή Μεταμόρφωσης" : "Metamorphosis subscription"}
            </div>
            <h1 className="mt-3 font-serif text-2xl font-semibold text-foreground sm:text-3xl">
              {isCanceled
                ? (lang === "el" ? "Η συνδρομή σου ακυρώθηκε" : "Your subscription is canceled")
                : (lang === "el" ? "Η συνδρομή σου είναι σε εκκρεμότητα" : "Your subscription is past due")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {isCanceled
                ? (lang === "el"
                    ? "Η πρόσβαση στο πρόγραμμα έχει σταματήσει. Μπορείς να επιστρέψεις όποτε θέλεις — η ιστορία σου, οι μετρήσεις και η υπογραφή σου παραμένουν στον λογαριασμό σου."
                    : "Your program access has stopped. You can return any time — your history, measurements and signature stay on your account.")
                : (lang === "el"
                    ? "Η τελευταία πληρωμή δεν ολοκληρώθηκε. Μάλλον ξέχασες να ενημερώσεις την κάρτα σου — ενημέρωσέ την για να συνεχίσεις χωρίς διακοπή."
                    : "Your last payment did not complete. Update your card to continue without interruption.")}
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="flex items-start gap-3 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">
                  {lang === "el" ? "Τι έχει παγώσει αυτή τη στιγμή" : "What is paused right now"}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{lang === "el" ? "Ο Σύμβουλος (24/7 chat)" : "The advisor (24/7 chat)"}</li>
                  <li>{lang === "el" ? "Η εβδομαδιαία ανάλυση" : "The weekly analysis"}</li>
                  <li>{lang === "el" ? "Νέο περιεχόμενο, βίντεο, καθημερινά prompts" : "New content, videos, daily prompts"}</li>
                  <li>{lang === "el" ? "Κοινότητα και νέες αναρτήσεις" : "Community and new posts"}</li>
                </ul>
              </div>
            </div>

            {isCanceled ? (
              <button
                type="button"
                onClick={reactivate}
                disabled={actionLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-4 text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {actionLoading
                  ? (lang === "el" ? "Φόρτωση..." : "Loading...")
                  : (lang === "el" ? "Επανενεργοποίηση Μεταμόρφωσης" : "Reactivate Metamorphosis")}
              </button>
            ) : (
              <button
                type="button"
                onClick={openPortal}
                disabled={actionLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-4 text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                {actionLoading
                  ? (lang === "el" ? "Φόρτωση..." : "Loading...")
                  : (lang === "el" ? "Ενημέρωση κάρτας" : "Update card")}
              </button>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => fetchStatus()}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {lang === "el" ? "Ανανέωση κατάστασης" : "Refresh status"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/policy")}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {lang === "el" ? "Όροι & πολιτική" : "Terms & policy"}
              </button>
            </div>

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              {lang === "el"
                ? "Για ερωτήσεις χρέωσης: info@thegreekcarnivore.com"
                : "Billing questions: info@thegreekcarnivore.com"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGate;
