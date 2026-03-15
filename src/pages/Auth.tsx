import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const mode = searchParams.get("mode");
  const [isLogin, setIsLogin] = useState(inviteToken ? false : mode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();

  useEffect(() => {
    if (user && inviteToken) {
      supabase.rpc("use_invite_token", { _token: inviteToken, _user_id: user.id }).then(({ data }) => {
        if (data) {
          toast({ title: lang === "el" ? "Πρόσκληση αποδεκτή!" : "Invite accepted!", description: lang === "el" ? "Ο λογαριασμός σας εγκρίθηκε αυτόματα." : "Your account has been auto-approved." });
        }
      });
    }
  }, [user, inviteToken]);

  const friendlyError = (error: Error, isSignUp: boolean): string => {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials"))
      return lang === "el"
        ? "Λάθος email ή κωδικός. Ελέγξτε τα στοιχεία σας και δοκιμάστε ξανά."
        : "Incorrect email or password. Please check your details and try again.";
    if (msg.includes("email not confirmed"))
      return lang === "el"
        ? "Δεν έχετε επιβεβαιώσει το email σας. Ελέγξτε τα εισερχόμενά σας για τον σύνδεσμο επιβεβαίωσης."
        : "Your email is not verified yet. Check your inbox for the verification link.";
    if (msg.includes("password") && (msg.includes("short") || msg.includes("least") || msg.includes("weak") || msg.includes("characters")))
      return lang === "el"
        ? "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες (π.χ. MyDiet2024!)."
        : "Password must be at least 6 characters (e.g. MyDiet2024!).";
    if (msg.includes("user already registered") || msg.includes("already been registered"))
      return lang === "el"
        ? "Αυτό το email χρησιμοποιείται ήδη. Δοκιμάστε να συνδεθείτε ή να επαναφέρετε τον κωδικό σας."
        : "This email is already registered. Try signing in or resetting your password.";
    if (msg.includes("rate") || msg.includes("too many"))
      return lang === "el"
        ? "Πολλές προσπάθειες. Περιμένετε λίγο και δοκιμάστε ξανά."
        : "Too many attempts. Please wait a moment and try again.";
    return error.message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) toast({ title: t("signInFailed"), description: friendlyError(error, false), variant: "destructive" });
    } else {
      if (password.length < 6) {
        toast({
          title: t("signUpFailed"),
          description: lang === "el"
            ? "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες (π.χ. MyDiet2024!)."
            : "Password must be at least 6 characters (e.g. MyDiet2024!).",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password);
      if (error) {
        toast({ title: t("signUpFailed"), description: friendlyError(error, true), variant: "destructive" });
      } else {
        toast({ title: t("checkEmail"), description: t("verificationLink") });
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: lang === "el" ? "Σφάλμα" : "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: lang === "el" ? "Ελέγξτε το email σας" : "Check your email",
        description: lang === "el" ? "Σας στείλαμε σύνδεσμο επαναφοράς κωδικού." : "We sent you a password reset link.",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)]" />

      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-0.5 rounded-xl border border-border/50 glass-card p-1 text-xs font-sans font-medium shadow-lg shadow-black/5">
          <button onClick={() => lang !== "en" && toggleLanguage()} className={`rounded-md px-2 py-1 transition-all duration-200 ${lang === "en" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}>EN</button>
          <button onClick={() => lang !== "el" && toggleLanguage()} className={`rounded-md px-2 py-1 transition-all duration-200 ${lang === "el" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}>EL</button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-8 relative z-10">
        <div className="space-y-1 text-center">
          <img src={logo} alt="The Greek Carnivore" className="mx-auto h-24 w-auto object-contain" />
          <h1 className="font-serif text-xl font-semibold text-foreground mt-2">{t("appName")}</h1>
          <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-gold font-medium">{t("subtitle")}</p>
          {inviteToken && (
            <p className="font-sans text-sm text-gold mt-2">
              {lang === "el" ? "🎉 Έχετε πρόσκληση! Δημιουργήστε λογαριασμό." : "🎉 You've been invited! Create your account."}
            </p>
          )}
          <p className="font-sans text-sm text-muted-foreground mt-3 leading-relaxed">
            {forgotMode
              ? (lang === "el" ? "Εισάγετε το email σας για επαναφορά κωδικού" : "Enter your email to reset your password")
              : isLogin ? t("signInToContinue") : t("createAccount")}
          </p>
        </div>

        {forgotMode ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} required className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            </div>
            <button type="submit" disabled={loading} className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-50 shadow-gold-md">
              {loading ? t("pleaseWait") : (lang === "el" ? "Αποστολή Συνδέσμου" : "Send Reset Link")}
            </button>
            <p className="text-center">
              <button type="button" onClick={() => setForgotMode(false)} className="inline-flex items-center gap-1 font-sans text-xs text-gold hover:underline font-medium">
                <ArrowLeft className="h-3 w-3" />
                {lang === "el" ? "Πίσω στη σύνδεση" : "Back to sign in"}
              </button>
            </p>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} required className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} required minLength={6} className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <p className="text-[11px] text-muted-foreground font-sans pl-1 -mt-1">{t("passwordRequirement")}</p>
              )}
              {isLogin && (
                <p className="text-right">
                  <button type="button" onClick={() => setForgotMode(true)} className="font-sans text-xs text-muted-foreground hover:text-gold transition-colors">
                    {lang === "el" ? "Ξεχάσατε τον κωδικό;" : "Forgot password?"}
                  </button>
                </p>
              )}
              <button type="submit" disabled={loading} className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-50 shadow-gold-md">
                {loading ? t("pleaseWait") : isLogin ? t("signIn") : t("signUp")}
              </button>
            </form>

            <p className="text-center font-sans text-xs text-muted-foreground">
              {isLogin ? t("noAccount") : t("haveAccount")}{" "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-gold hover:underline font-medium">
                {isLogin ? t("signUp").toLowerCase() : t("signIn").toLowerCase()}
              </button>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Auth;
