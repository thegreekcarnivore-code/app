import { motion } from "framer-motion";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import logo from "@/assets/logo.png";

const PendingApproval = () => {
  const { signOut } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 text-xs font-sans font-medium">
          <button onClick={() => lang !== "en" && toggleLanguage()} className={`rounded-md px-2 py-1 transition-all ${lang === "en" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}>EN</button>
          <button onClick={() => lang !== "el" && toggleLanguage()} className={`rounded-md px-2 py-1 transition-all ${lang === "el" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}>EL</button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center space-y-6">
        <img src={logo} alt="The Greek Carnivore" className="mx-auto h-20 w-auto object-contain" />
        <div className="space-y-2">
          <Clock className="h-10 w-10 text-gold mx-auto" />
          <h1 className="font-serif text-xl font-semibold text-foreground">
            {lang === "el" ? "Αναμονή Έγκρισης" : "Pending Approval"}
          </h1>
          <p className="font-sans text-sm text-muted-foreground">
            {lang === "el"
              ? "Ο λογαριασμός σας αναμένει έγκριση. Θα ενημερωθείτε όταν εγκριθεί."
              : "Your account is awaiting approval. You'll be notified once you're granted access."}
          </p>
        </div>
        <button onClick={signOut} className="flex mx-auto items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="h-4 w-4" />
          {lang === "el" ? "Αποσύνδεση" : "Sign Out"}
        </button>
      </motion.div>
    </div>
  );
};

export default PendingApproval;
