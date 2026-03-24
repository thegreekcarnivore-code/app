import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Lock, Check, Eye, EyeOff, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState<boolean | null>(null);
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let active = true;
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    const syncRecoveryState = async () => {
      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (!active) return;

        if (error) {
          setRecoveryReady(false);
          return;
        }

        setRecoveryReady(true);
        navigate("/reset-password", { replace: true });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      setRecoveryReady(!!session?.user);
    };

    syncRecoveryState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session?.user)) {
        setRecoveryReady(true);
      }

      if (event === "SIGNED_OUT" && !session?.user) {
        setRecoveryReady(false);
      }
    });

    const fallbackTimer = window.setTimeout(() => {
      setRecoveryReady((current) => current ?? false);
    }, 1200);

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [navigate, searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryReady) {
      toast({
        title: lang === "el" ? "Το link δεν είναι έγκυρο" : "This link is not valid",
        description: lang === "el"
          ? "Ζητήστε νέο email επαναφοράς και δοκιμάστε ξανά."
          : "Request a new password reset email and try again.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 6) {
      toast({ title: lang === "el" ? "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες" : "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: lang === "el" ? "Οι κωδικοί δεν ταιριάζουν" : "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: lang === "el" ? "Σφάλμα" : "Error", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
      toast({
        title: lang === "el" ? "Ο κωδικός ενημερώθηκε!" : "Password updated!",
        description: lang === "el"
          ? "Μπαίνεις τώρα ξανά στην πλατφόρμα."
          : "You are being taken back into the platform now.",
      });
      setTimeout(() => navigate("/home", { replace: true }), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)] dark:[background-image:none]" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-5 relative z-10">
        <div className="space-y-1 text-center">
          <img src={logo} alt="The Greek Carnivore" className="mx-auto h-16 w-auto object-contain" />
          <h1 className="font-serif text-xl font-semibold text-foreground mt-1">
            {lang === "el" ? "Νέος Κωδικός" : "Set New Password"}
          </h1>
          <p className="font-sans text-sm text-muted-foreground mt-1">
            {lang === "el" ? "Εισάγετε τον νέο σας κωδικό πρόσβασης." : "Enter your new password below."}
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-5">
            <div className="rounded-full bg-gold/10 p-3">
              <Check className="h-7 w-7 text-gold" />
            </div>
            <p className="font-sans text-sm text-foreground">
              {lang === "el" ? "Ανακατεύθυνση..." : "Redirecting..."}
            </p>
          </div>
        ) : recoveryReady === false ? (
          <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-5 text-center shadow-sm">
            <div className="space-y-2">
              <h2 className="font-serif text-xl font-semibold text-foreground">
                {lang === "el" ? "Το link επαναφοράς έχει λήξει ή δεν είναι έγκυρο" : "This reset link has expired or is not valid"}
              </h2>
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                {lang === "el"
                  ? "Ζήτησε νέο email επαναφοράς από τη σελίδα σύνδεσης και άνοιξε μόνο το πιο πρόσφατο link."
                  : "Request a new password reset email from the sign-in page and open only the most recent link."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/auth", { replace: true })}
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-gold/40 hover:text-gold"
            >
              <ArrowLeft className="h-4 w-4" />
              {lang === "el" ? "Πίσω στη σύνδεση" : "Back to sign in"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={lang === "el" ? "Νέος κωδικός" : "New password"} required minLength={6} className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                <button type="button" onClick={() => setShowPassword((current) => !current)} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground font-sans pl-1 -mt-1">
                {lang === "el"
                  ? "Γράψε τον νέο σου κωδικό και επιβεβαίωσέ τον ξανά ακριβώς από κάτω."
                  : "Write your new password once and confirm it exactly the same below."}
              </p>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <input type={showConfirm ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={lang === "el" ? "Επιβεβαίωση κωδικού" : "Confirm password"} required minLength={6} className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                <button type="button" onClick={() => setShowConfirm((current) => !current)} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-3 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-50 shadow-gold-md">
              {loading ? (lang === "el" ? "Παρακαλώ περιμένετε..." : "Please wait...") : (lang === "el" ? "Ενημέρωση Κωδικού" : "Update Password")}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
