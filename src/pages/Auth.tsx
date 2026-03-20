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

  const trustSteps = [
    {
      title: lang === "el" ? "1. Δημιούργησε πρόσβαση" : "1. Create your access",
      body: lang === "el"
        ? "Χρησιμοποίησε το email σου για σύνδεση ή αίτημα πρόσβασης."
        : "Use your email to sign in or request access.",
    },
    {
      title: lang === "el" ? "2. Ο coach εγκρίνει" : "2. Coach approval",
      body: lang === "el"
        ? "Οι νέοι λογαριασμοί περνούν από approval πριν ανοίξει το πρόγραμμα."
        : "New accounts go through approval before the program opens.",
    },
    {
      title: lang === "el" ? "3. Ξεκινά η εισαγωγή" : "3. Guided onboarding starts",
      body: lang === "el"
        ? "Υπογραφή, υλικό προγράμματος και καθημερινό dashboard εμφανίζονται με σωστή σειρά."
        : "Signing, program material, and the daily dashboard appear in the right order.",
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)] dark:[background-image:none]" />

      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-0.5 rounded-xl border border-border/50 glass-card p-1 text-xs font-sans font-medium shadow-lg shadow-black/5">
          <button onClick={() => lang !== "en" && toggleLanguage()} className={`rounded-md px-2 py-1 transition-all duration-200 ${lang === "en" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}>EN</button>
          <button onClick={() => lang !== "el" && toggleLanguage()} className={`rounded-md px-2 py-1 transition-all duration-200 ${lang === "el" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}>EL</button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr,0.9fr]"
      >
        <div className="hidden rounded-[2rem] border border-border/60 bg-card/80 p-8 shadow-lg shadow-black/5 backdrop-blur lg:block">
          <div className="space-y-5">
            <img src={logo} alt="The Greek Carnivore" className="h-16 w-auto object-contain" />
            <div className="space-y-3">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.28em] text-gold">
                {lang === "el" ? "Πύλη Coaching" : "Coaching portal"}
              </p>
              <h1 className="font-serif text-4xl font-semibold leading-tight text-foreground">
                {lang === "el"
                  ? "Το καθημερινό σου coaching σε ένα καθαρό σύστημα."
                  : "Your daily coaching, in one cleaner system."}
              </h1>
              <p className="max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
                {lang === "el"
                  ? "Μετρήσεις, καθημερινά βήματα, υλικό προγράμματος και επικοινωνία με τον coach λειτουργούν μαζί, όχι σαν ξεχωριστά εργαλεία."
                  : "Measurements, daily actions, program support, and coach communication work together instead of feeling like separate tools."}
              </p>
            </div>

            <div className="grid gap-3">
              {trustSteps.map((step) => (
                <div key={step.title} className="rounded-[1.5rem] border border-border/60 bg-background/75 p-4">
                  <p className="font-serif text-lg font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 font-sans text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-lg shadow-black/5 backdrop-blur sm:p-6">
          <div className="space-y-3 text-center">
            <img src={logo} alt="The Greek Carnivore" className="mx-auto h-16 w-auto object-contain" />
            <div className="space-y-1">
              <h1 className="font-serif text-2xl font-semibold text-foreground">{t("appName")}</h1>
              <p className="text-[10px] font-sans font-medium uppercase tracking-[0.25em] text-gold">{t("subtitle")}</p>
            </div>
            <p className="font-sans text-sm leading-relaxed text-muted-foreground">
              {forgotMode
                ? (lang === "el" ? "Εισάγετε το email σας για να λάβετε σύνδεσμο επαναφοράς." : "Enter your email to receive a reset link.")
                : isLogin
                  ? (lang === "el" ? "Συνδέσου για να συνεχίσεις στο πρόγραμμα και στον πίνακα ελέγχου σου." : "Sign in to continue to your program and daily dashboard.")
                  : inviteToken
                    ? (lang === "el" ? "Η πρόσκλησή σου είναι έτοιμη. Δημιούργησε τον λογαριασμό σου για να ενεργοποιηθεί η πρόσβαση." : "Your invite is ready. Create your account to activate access.")
                    : (lang === "el" ? "Αν έχεις εγκριθεί από τον coach σου, δημιούργησε λογαριασμό για να ξεκινήσει η εισαγωγή." : "If you have been approved by your coach, create your account to start onboarding.")}
            </p>
          </div>

          {!forgotMode && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-background/70 p-1">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`rounded-[1rem] px-4 py-2.5 font-sans text-sm font-medium transition-all ${isLogin ? "bg-gold text-gold-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {lang === "el" ? "Σύνδεση" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`rounded-[1rem] px-4 py-2.5 font-sans text-sm font-medium transition-all ${!isLogin ? "bg-gold text-gold-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {inviteToken ? (lang === "el" ? "Ενεργοποίηση" : "Activate access") : (lang === "el" ? "Αίτημα πρόσβασης" : "Request access")}
              </button>
            </div>
          )}

          {inviteToken && !forgotMode && (
            <div className="rounded-[1.5rem] border border-gold/25 bg-gold/10 px-4 py-3 text-left">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {lang === "el" ? "Πρόσκληση" : "Invite ready"}
              </p>
              <p className="mt-1 font-sans text-sm text-foreground">
                {lang === "el" ? "Ο λογαριασμός σου θα συνδεθεί αυτόματα με την πρόσκληση μόλις ολοκληρώσεις την εγγραφή." : "Your account will be linked to the invite automatically as soon as sign-up is complete."}
              </p>
            </div>
          )}

          {forgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} required className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
              </div>
              <button type="submit" disabled={loading} className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-50 shadow-gold-md">
                {loading ? t("pleaseWait") : (lang === "el" ? "Αποστολή συνδέσμου" : "Send reset link")}
              </button>
              <p className="text-center">
                <button type="button" onClick={() => setForgotMode(false)} className="inline-flex items-center gap-1 font-sans text-xs font-medium text-gold hover:underline">
                  <ArrowLeft className="h-3 w-3" />
                  {lang === "el" ? "Πίσω στη σύνδεση" : "Back to sign in"}
                </button>
              </p>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} required className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm">
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} required minLength={6} className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {!isLogin && (
                  <div className="space-y-2 rounded-[1.5rem] border border-border/60 bg-background/70 px-4 py-3">
                    <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                      {lang === "el" ? "Τι γίνεται μετά" : "What happens next"}
                    </p>
                    <p className="font-sans text-xs leading-relaxed text-muted-foreground">
                      {inviteToken
                        ? (lang === "el" ? "Η πρόσκλησή σου θα ενεργοποιηθεί, θα μπεις στην εφαρμογή και θα ξεκινήσει η καθοδηγούμενη ρύθμιση." : "Your invite will activate, the app will open, and the guided setup flow will begin.")
                        : (lang === "el" ? "Ο λογαριασμός σου περνάει από έγκριση και μετά ανοίγουν η εισαγωγή, η υπογραφή πολιτικής και ο πίνακας ελέγχου σου." : "Your account goes through approval and then unlocks onboarding, policy signing, and your daily dashboard.")}
                    </p>
                    <p className="font-sans text-[11px] text-muted-foreground">{t("passwordRequirement")}</p>
                  </div>
                )}

                {isLogin && (
                  <p className="text-right">
                    <button type="button" onClick={() => setForgotMode(true)} className="font-sans text-xs text-muted-foreground transition-colors hover:text-gold">
                      {lang === "el" ? "Ξεχάσατε τον κωδικό;" : "Forgot password?"}
                    </button>
                  </p>
                )}

                <button type="submit" disabled={loading} className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-50 shadow-gold-md">
                  {loading
                    ? t("pleaseWait")
                    : isLogin
                      ? t("signIn")
                      : inviteToken
                        ? (lang === "el" ? "Ενεργοποίηση λογαριασμού" : "Activate account")
                        : (lang === "el" ? "Υποβολή πρόσβασης" : "Request access")}
                </button>
              </form>

              <p className="text-center font-sans text-xs text-muted-foreground">
                {isLogin ? t("noAccount") : t("haveAccount")}{" "}
                <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-gold hover:underline">
                  {isLogin
                    ? (lang === "el" ? "ζήτησε πρόσβαση" : "request access")
                    : t("signIn").toLowerCase()}
                </button>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
