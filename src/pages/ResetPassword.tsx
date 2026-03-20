import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Lock, Check } from "lucide-react";
import logo from "@/assets/logo.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase handles the recovery token from the URL hash automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // User arrived via reset link — ready to set new password
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast({ title: lang === "el" ? "Ο κωδικός ενημερώθηκε!" : "Password updated!" });
      setTimeout(() => navigate("/home"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)]" />
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
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={lang === "el" ? "Νέος κωδικός" : "New password"} required minLength={6} className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
              </div>
              <p className="text-[11px] text-muted-foreground font-sans pl-1 -mt-1">{lang === "el" ? "Τουλάχιστον 6 χαρακτήρες, π.χ. MyDiet2024!" : "Min 6 characters, e.g. MyDiet2024!"}</p>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={lang === "el" ? "Επιβεβαίωση κωδικού" : "Confirm password"} required minLength={6} className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
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
