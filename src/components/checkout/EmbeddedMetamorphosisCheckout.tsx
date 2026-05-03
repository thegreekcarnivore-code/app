import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  isGreek: boolean;
}

const SUPABASE_URL = "https://bowvosskzbtuxmrwatoj.supabase.co";

const publishableKey = (() => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_STRIPE_PUBLISHABLE_KEY ?? "";
})();

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const EmbeddedMetamorphosisCheckout = ({ open, onClose, isGreek }: Props) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setError(null);
      return;
    }
    void createSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
      const anonKey =
        env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? env?.VITE_SUPABASE_ANON_KEY ?? "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      };
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/create-metamorphosis-checkout`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mode: "embedded" }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || (isGreek ? "Σφάλμα κατά τη δημιουργία πληρωμής" : "Failed to create payment session"));
      }
      const data = (await resp.json()) as { client_secret?: string; session_id?: string };
      if (!data.client_secret) {
        throw new Error(isGreek ? "Δεν λάβαμε client secret" : "No client secret returned");
      }
      setClientSecret(data.client_secret);
    } catch (e) {
      const message = e instanceof Error ? e.message : (isGreek ? "Κάτι πήγε στραβά" : "Something went wrong");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const options = useMemo(() => (clientSecret ? { clientSecret } : null), [clientSecret]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-8 w-full max-w-2xl rounded-[2rem] bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={isGreek ? "Κλείσιμο" : "Close"}
          className="absolute right-4 top-4 z-10 rounded-full bg-background/80 p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8">
          <h2 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
            {isGreek ? "Ολοκλήρωσε τη συνδρομή σου" : "Complete your subscription"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isGreek
              ? "Ασφαλής πληρωμή μέσω Stripe. Όλα μέσα στην εφαρμογή."
              : "Secure payment via Stripe. Everything inside the app."}
          </p>

          {!stripePromise && (
            <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {isGreek
                ? "Λείπει το κλειδί VITE_STRIPE_PUBLISHABLE_KEY στο build."
                : "Missing VITE_STRIPE_PUBLISHABLE_KEY in this build."}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading && !clientSecret && !error && (
            <div className="mt-12 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            </div>
          )}

          {stripePromise && options && (
            <div className="mt-6">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbeddedMetamorphosisCheckout;
