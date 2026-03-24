import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import logo from "@/assets/logo.png";

function getSafeRedirectTarget(value: string | null) {
  if (!value) return "/home";

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/home";
    return `${url.pathname}${url.search}${url.hash}` || "/home";
  } catch {
    return value.startsWith("/") ? value : "/home";
  }
}

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const redirectTarget = useMemo(
    () => getSafeRedirectTarget(searchParams.get("redirect_to")),
    [searchParams],
  );

  useEffect(() => {
    let cancelled = false;

    const completeSignIn = async () => {
      if (!tokenHash || !type) {
        setError(
          lang === "el"
            ? "Το link σύνδεσης δεν είναι έγκυρο. Ζήτησε νέο email και δοκίμασε ξανά."
            : "This sign-in link is not valid. Request a new email and try again.",
        );
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "magiclink" | "invite" | "signup" | "recovery" | "email_change",
      });

      if (cancelled) return;

      if (verifyError) {
        setError(
          lang === "el"
            ? "Το link σύνδεσης έχει λήξει ή έχει ήδη χρησιμοποιηθεί. Ζήτησε νέο email και δοκίμασε ξανά."
            : "This sign-in link has expired or has already been used. Request a new email and try again.",
        );
        return;
      }

      navigate(type === "recovery" ? "/reset-password" : redirectTarget, { replace: true });
    };

    completeSignIn();

    return () => {
      cancelled = true;
    };
  }, [lang, navigate, redirectTarget, tokenHash, type]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)] dark:[background-image:none]" />
      <div className="relative z-10 w-full max-w-sm rounded-[1.75rem] border border-border bg-card p-6 text-center shadow-sm">
        <img src={logo} alt="The Greek Carnivore" className="mx-auto h-16 w-auto object-contain" />
        {error ? (
          <div className="mt-5 space-y-3">
            <h1 className="font-serif text-xl font-semibold text-foreground">
              {lang === "el" ? "Το link δεν μπορεί να χρησιμοποιηθεί" : "This link can’t be used"}
            </h1>
            <p className="font-sans text-sm leading-relaxed text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/auth", { replace: true })}
              className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-gold/40 hover:text-gold"
            >
              {lang === "el" ? "Πίσω στη σύνδεση" : "Back to sign in"}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <h1 className="font-serif text-xl font-semibold text-foreground">
              {lang === "el" ? "Γίνεται σύνδεση..." : "Signing you in..."}
            </h1>
            <p className="font-sans text-sm leading-relaxed text-muted-foreground">
              {lang === "el"
                ? "Επιβεβαιώνουμε το ασφαλές link σου και σε βάζουμε κατευθείαν στην εφαρμογή."
                : "We’re verifying your secure link and taking you straight into the app."}
            </p>
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
