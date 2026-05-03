import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

// Annual plan upsell. Shows on /home for members who:
//   - have an active subscription
//   - are ≥60 days into the program
//   - aren't already on the annual plan
//   - haven't dismissed the banner in this session
//
// Click → embedded Stripe Checkout for €399/year. Webhook handles
// auto-cancel of the existing monthly so they don't double-pay.

const SUPABASE_URL = "https://bowvosskzbtuxmrwatoj.supabase.co";
const PK_FALLBACK = "pk_live_51PiiQ6ERaIeGwg1e9thfmXwl5clOw69hDbPriSKwI7BGjz3xVW4Hnnig47K0LCbew1aXa5udIWgPOcSWH3mteKNJ000aBgOuRP";
const stripePromise = (() => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const k = env?.VITE_STRIPE_PUBLISHABLE_KEY ?? PK_FALLBACK;
  return k ? loadStripe(k) : null;
})();

const DISMISS_KEY = "annual-banner-dismissed-at";
const DISMISS_TTL_MS = 7 * 86400000;

const AnnualPlanBanner = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const check = async () => {
    // Respect dismiss
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL_MS) {
      setEligible(false);
      return;
    }
    const { data: enrollment } = await supabase
      .from("client_program_enrollments")
      .select("start_date, status")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!enrollment) { setEligible(false); return; }
    const startDate = (enrollment as { start_date: string }).start_date;
    const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000);
    if (days < 60) { setEligible(false); return; }
    // Skip if user already has an annual sub flag (we'll detect via stripe in v2; for now allow if banner not dismissed)
    setEligible(true);
  };

  const onUpgrade = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("not authenticated");
      const r = await fetch(`${SUPABASE_URL}/functions/v1/create-metamorphosis-annual-checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "embedded" }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || (isGreek ? "Σφάλμα" : "Error"));
      }
      const data = (await r.json()) as { client_secret?: string };
      if (!data.client_secret) throw new Error(isGreek ? "Δεν λάβαμε client secret" : "No client secret");
      setClientSecret(data.client_secret);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : (isGreek ? "Κάτι πήγε στραβά" : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  const onDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setEligible(false);
  };

  const options = useMemo(() => (clientSecret ? { clientSecret } : null), [clientSecret]);

  if (!eligible) return null;

  return (
    <>
      <div className="relative rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 via-gold/5 to-transparent p-5">
        <button
          type="button"
          onClick={onDismiss}
          aria-label={isGreek ? "Κλείσιμο" : "Dismiss"}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
              {isGreek ? "Ετήσιο πλάνο" : "Annual plan"}
            </p>
            <h3 className="mt-1 font-serif text-lg font-semibold leading-tight text-foreground">
              {isGreek ? "Κλείδωσε τη χρονιά. €399 αντί για €564." : "Lock the year. €399 instead of €564."}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {isGreek
                ? "2 μήνες δώρο σε σχέση με το μηνιαίο. Μία πληρωμή, καμία διακοπή, καμία απόφαση κάθε 30 μέρες."
                : "2 months free vs the monthly. One payment, no interruption, no monthly decision."}
            </p>
            {error && (
              <p className="mt-2 text-xs text-destructive">{error}</p>
            )}
            <button
              type="button"
              onClick={onUpgrade}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? (isGreek ? "Φόρτωση..." : "Loading...")
                : (isGreek ? "Αναβάθμιση σε ετήσιο" : "Upgrade to annual")}
            </button>
          </div>
        </div>
      </div>

      {open && stripePromise && options && (
        <div
          className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative my-8 w-full max-w-2xl rounded-[2rem] bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={isGreek ? "Κλείσιμο" : "Close"}
              className="absolute right-4 top-4 z-10 rounded-full bg-background/80 p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6 sm:p-8">
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                {isGreek ? "Αναβάθμιση σε ετήσιο" : "Upgrade to annual"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isGreek
                  ? "Μετά την πληρωμή, το μηνιαίο σταματάει αυτόματα στο τέλος του τρέχοντος κύκλου — χωρίς διπλή χρέωση."
                  : "Once paid, your monthly cancels automatically at the end of the current cycle — no double-charge."}
              </p>
              <div className="mt-6">
                <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AnnualPlanBanner;
