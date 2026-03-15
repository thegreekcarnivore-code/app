import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Compass, Ruler, Video, User, ChevronRight, ChevronLeft, MapPin, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useGuideHighlight } from "@/context/GuideHighlightContext";
import { Button } from "@/components/ui/button";

interface OnboardingTourProps {
  onComplete: () => void;
}

const OnboardingTour = ({ onComplete }: OnboardingTourProps) => {
  const [step, setStep] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { user } = useAuth();
  const { showHighlight } = useGuideHighlight();
  const isGreek = lang === "el";

  const steps = [
    {
      icon: Home,
      path: "/home",
      guide: "nav-home",
      title: isGreek ? "Καλωσόρισες! 🏠" : "Welcome! 🏠",
      body: isGreek
        ? "Αυτή είναι η αρχική σου σελίδα. Εδώ θα βρεις τις καθημερινές εργασίες σου, τα επερχόμενα ραντεβού, γρήγορη πρόσβαση στο ημερολόγιο διατροφής και τα βιβλία συνταγών σου."
        : "This is your home page. Here you'll see your daily tasks, upcoming calls, quick access to your food journal, and your recipe books.",
    },
    {
      icon: Compass,
      path: "/discover",
      guide: "nav-discover",
      title: isGreek ? "Ανακαλύψτε 🧭" : "Discover 🧭",
      body: isGreek
        ? "Εδώ μπορείς να βρεις εστιατόρια, delivery, δραστηριότητες και καταστήματα κοντά σου. Απλά μοιράσου την τοποθεσία σου και πάρε εξατομικευμένες προτάσεις."
        : "This is where you find restaurants, delivery, activities, and shops near you. Just share your location and get personalized recommendations.",
      hasDemo: true,
    },
    {
      icon: Ruler,
      path: "/measurements",
      guide: "nav-measurements",
      title: isGreek ? "Πρόοδος 📏" : "Accountability 📏",
      body: isGreek
        ? "Παρακολούθησε την πρόοδό σου εδώ — σωματικές μετρήσεις, ημερολόγιο διατροφής και φωτογραφίες προόδου. Ο coach σου τα ελέγχει κάθε εβδομάδα."
        : "Track your progress here — body measurements, food journal, and progress photos. Your coach reviews these weekly.",
    },
    {
      icon: Video,
      path: "/learn",
      guide: "nav-learn",
      title: isGreek ? "Μάθηση 🎓" : "Learn 🎓",
      body: isGreek
        ? "Παρακολούθησε εκπαιδευτικά βίντεο για τον σωστό τρόπο διατροφής και τη σωστή νοοτροπία σε κάθε κατάσταση."
        : "Watch training videos about the correct way of eating and the right mindset for every situation.",
    },
    {
      icon: User,
      path: "/profile",
      guide: "profile-button",
      title: isGreek ? "Προφίλ & Βοηθός 💬" : "Profile & Assistant 💬",
      body: isGreek
        ? "Επεξεργάσου τα στοιχεία σου, στείλε μήνυμα στον Αλέξανδρο απευθείας, και πάτησε τον Βοηθό ανά πάσα στιγμή για βοήθεια."
        : "Edit your info, message Alexandros directly, and tap the Assistant anytime for help navigating the app.",
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      finishTour();
      return;
    }
    const nextStep = step + 1;
    setStep(nextStep);
    navigate(steps[nextStep].path);
  };

  const handleBack = () => {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      navigate(steps[prevStep].path);
    }
  };

  const handleDemo = () => {
    setDemoMode(true);
    navigate("/discover");
    // Use the guide highlight system for restaurant demo
    showHighlight([
      { highlight: "scope-restaurants", label: isGreek ? "Πάτα εδώ για εστιατόρια" : "Tap here for restaurants" },
      { highlight: "location-input", label: isGreek ? "Γράψε ή μοιράσου την τοποθεσία σου" : "Type or share your location" },
      { highlight: "search-button", label: isGreek ? "Πάτα αναζήτηση για αποτελέσματα!" : "Tap search for results!" },
    ]);
    // After demo, user will need to continue manually
    setTimeout(() => {
      setDemoMode(false);
      setStep(2);
      navigate("/measurements");
    }, 15000);
  };

  const finishTour = async () => {
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_tour_completed: true } as any)
        .eq("id", user.id);
    }
    navigate("/home");
    onComplete();
  };

  const handleSkip = () => {
    finishTour();
  };

  // Navigate to current step path on mount
  useState(() => {
    navigate(current.path);
  });

  if (demoMode) return null;

  const Icon = current.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center pb-28 px-4 pointer-events-none"
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/40 pointer-events-auto" onClick={() => {}} />

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl pointer-events-auto"
        >
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-gold" : i < step ? "w-3 bg-gold/40" : "w-3 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-gold/15 flex items-center justify-center mb-3">
            <Icon className="h-6 w-6 text-gold" />
          </div>

          {/* Content */}
          <h2 className="font-serif text-lg font-semibold text-foreground mb-2">
            {current.title}
          </h2>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-5">
            {current.body}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                {isGreek ? "Πίσω" : "Back"}
              </Button>
            )}
            <div className="flex-1" />
            {current.hasDemo && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDemo}
                className="gap-1 border-gold/30 text-gold hover:bg-gold/10"
              >
                <MapPin className="h-4 w-4" />
                {isGreek ? "Δοκίμασε demo" : "Try a demo"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1 bg-gold text-gold-foreground hover:bg-gold/90"
            >
              {isLast
                ? (isGreek ? "Ας ξεκινήσουμε!" : "Let's go!")
                : (isGreek ? "Επόμενο" : "Next")}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingTour;
