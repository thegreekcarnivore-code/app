import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { Activity, ClipboardCheck, MessageCircle, ShieldCheck } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();
  const { lang, toggleLanguage } = useLanguage();
  const isGreek = lang === "el";
  const highlights = [
    {
      icon: Activity,
      en: "Track body, food, and progress in one place",
      el: "Παρακολούθησε σώμα, διατροφή και πρόοδο σε ένα μέρος",
    },
    {
      icon: ClipboardCheck,
      en: "Stay consistent with weekly check-ins and daily tasks",
      el: "Μείνε συνεπής με εβδομαδιαία check-ins και καθημερινές εργασίες",
    },
    {
      icon: MessageCircle,
      en: "Keep every coach message, program update, and next step together",
      el: "Κράτησε μαζί κάθε μήνυμα coach, ενημέρωση προγράμματος και επόμενο βήμα",
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      {/* Subtle radial background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)]" />

      {/* Language toggle */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-0.5 rounded-xl border border-border/50 glass-card p-1 text-xs font-sans font-medium shadow-lg shadow-black/5">
          <button
            onClick={() => lang !== "en" && toggleLanguage()}
            className={cn(
              "rounded-md px-2 py-1 transition-all duration-200",
              lang === "en" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            EN
          </button>
          <button
            onClick={() => lang !== "el" && toggleLanguage()}
            className={cn(
              "rounded-md px-2 py-1 transition-all duration-200",
              lang === "el" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Ελ
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.15fr,0.85fr]"
      >
        <div className="rounded-[2rem] border border-border/60 bg-background/75 p-7 shadow-2xl shadow-black/5 backdrop-blur">
          <div className="space-y-3">
            <img src={logo} alt="The Greek Carnivore" className="h-16 w-auto object-contain" />
            <div className="space-y-3">
              <p className="text-[11px] font-sans uppercase tracking-[0.35em] text-gold font-semibold">
                {isGreek ? "Coaching App" : "Coaching App"}
              </p>
              <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                {isGreek
                  ? "Η πλατφόρμα coaching για συνέπεια, πρόοδο και πραγματική καθοδήγηση."
                  : "The coaching platform built for consistency, progress, and real accountability."}
              </h1>
              <p className="max-w-xl font-sans text-base leading-relaxed text-muted-foreground">
                {isGreek
                  ? "Όλα όσα χρειάζεται ο πελάτης σου σε ένα σημείο: μετρήσεις, check-ins, καθημερινές εργασίες, υλικό υποστήριξης και άμεση επικοινωνία."
                  : "Everything your clients need in one place: measurements, check-ins, daily tasks, support resources, and direct coach communication."}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, en, el }) => (
              <div key={en} className="rounded-2xl border border-border/70 bg-card/80 p-4 text-left">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="font-sans text-sm font-medium leading-relaxed text-foreground">
                  {isGreek ? el : en}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/60 bg-background/80 p-6 shadow-2xl shadow-black/5 backdrop-blur">
          <div className="space-y-4 text-center">
            <div className="space-y-2">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-sans font-semibold uppercase tracking-[0.24em] text-gold">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isGreek ? "Πρόσβαση με έγκριση" : "Approval-Based Access"}
              </div>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                {isGreek ? "Σύνδεση στο coaching portal" : "Sign in to your coaching portal"}
              </h2>
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                {isGreek
                  ? "Οι υπάρχοντες πελάτες συνεχίζουν στο προσωπικό τους dashboard. Νέοι λογαριασμοί ενεργοποιούνται μετά από έγκριση."
                  : "Existing clients continue into their personal dashboard. New accounts are activated after review and approval."}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate("/auth?mode=login")}
                className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 shadow-gold-md"
              >
                {isGreek ? "Σύνδεση" : "Sign In"}
              </button>
              <button
                onClick={() => navigate("/auth?mode=signup")}
                className="flex w-full items-center justify-center rounded-2xl border border-gold/30 bg-card py-4 font-sans text-sm font-medium text-foreground transition-all duration-200 hover:bg-gold/5 hover:border-gold/50"
              >
                {isGreek ? "Αίτηση Πρόσβασης" : "Request Access"}
              </button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/70 p-4 text-left">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {isGreek ? "Τι περιλαμβάνει" : "Inside the App"}
              </p>
              <ul className="mt-3 space-y-2 font-sans text-sm text-foreground">
                <li>{isGreek ? "Μετρήσεις σώματος, διατροφής και φωτογραφιών" : "Body, food, and progress-photo tracking"}</li>
                <li>{isGreek ? "Καθημερινές εργασίες και εβδομαδιαία accountability" : "Daily tasks and weekly accountability"}</li>
                <li>{isGreek ? "Άμεση επικοινωνία και εξατομικευμένη καθοδήγηση" : "Direct communication and personalized coaching support"}</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Landing;
