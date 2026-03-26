import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

const COPY = {
  join: {
    title: "Σύνδεση στην εφαρμογή",
    body: "Ετοιμάζουμε την ασφαλή είσοδό σου. Θα μπεις αυτόματα σε λίγα δευτερόλεπτα.",
    errorTitle: "Το link δεν μπορεί να χρησιμοποιηθεί",
  },
  reset: {
    title: "Επαναφορά κωδικού",
    body: "Ετοιμάζουμε την ασφαλή φόρμα επαναφοράς. Θα μεταφερθείς αυτόματα στο επόμενο βήμα.",
    errorTitle: "Το link επαναφοράς δεν είναι διαθέσιμο",
  },
} as const;

const AccessLink = ({ mode }: { mode: "join" | "reset" }) => {
  const { token } = useParams();
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const copy = COPY[mode];

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      if (!token) {
        setError("Το link λείπει ή δεν είναι έγκυρο.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("access-link", {
        body: {
          action: "resolve",
          token,
        },
      });

      if (!active) return;

      if (error || !data?.redirect_url) {
        setError(error?.message || "Ζήτησε νέο link και δοκίμασε ξανά.");
        return;
      }

      window.location.replace(data.redirect_url);
    };

    resolve();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-8 text-center shadow-sm">
        <img src={logo} alt="The Greek Carnivore" className="mx-auto mb-6 h-16 w-auto object-contain" />
        <h1 className="font-serif text-3xl font-semibold text-foreground">{error ? copy.errorTitle : copy.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {error || copy.body}
        </p>
        {!error ? (
          <div className="mx-auto mt-8 h-9 w-9 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        ) : (
          <button
            type="button"
            onClick={() => navigate("/auth", { replace: true })}
            className="mt-8 inline-flex rounded-2xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-gold/40 hover:text-gold"
          >
            Πίσω στη σύνδεση
          </button>
        )}
      </div>
    </div>
  );
};

export default AccessLink;
