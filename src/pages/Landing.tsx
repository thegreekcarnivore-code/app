import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const Landing = () => {
  const navigate = useNavigate();
  const { lang, toggleLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
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
        className="w-full max-w-sm text-center space-y-10 relative z-10"
      >
        {/* Brand */}
        <div className="space-y-2">
          <img src={logo} alt="The Greek Carnivore" className="mx-auto h-28 w-auto object-contain" />
          <h1 className="font-serif text-2xl font-semibold text-foreground">The Greek Carnivore</h1>
          <p className="text-[10px] font-sans uppercase tracking-[0.3em] text-gold font-medium">
            {lang === "el" ? "Συμβουλος Διατροφης" : "Food Concierge"}
          </p>
        </div>

        {/* Tagline */}
        <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          {lang === "el"
            ? "Η προσωπική σας υπηρεσία concierge για τις καλύτερες γαστρονομικές εμπειρίες."
            : "Your personal concierge for the finest dining experiences."}
        </p>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate("/auth?mode=login")}
            className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 shadow-gold-md"
          >
            {lang === "el" ? "Σύνδεση" : "Sign In"}
          </button>
          <button
            onClick={() => navigate("/auth?mode=signup")}
            className="flex w-full items-center justify-center rounded-2xl border border-gold/30 bg-card py-4 font-sans text-sm font-medium text-foreground transition-all duration-200 hover:bg-gold/5 hover:border-gold/50"
          >
            {lang === "el" ? "Δημιουργία Λογαριασμού" : "Create an Account"}
          </button>
        </div>

        <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
          {lang === "el"
            ? "Η δημιουργία λογαριασμού απαιτεί έγκριση διαχειριστή."
            : "Account creation requires admin approval."}
        </p>
      </motion.div>
    </div>
  );
};

export default Landing;
