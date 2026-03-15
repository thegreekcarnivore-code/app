import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";

type Feature = "restaurant" | "delivery" | "activities" | "shopping" | "travel";

interface AiSearchLoaderProps {
  feature: Feature;
  compact?: boolean;
}

const CONFIG: Record<Feature, {
  duration: number;
  savedMin: number;
  titleEn: string;
  titleEl: string;
  stepsEn: string[];
  stepsEl: string[];
}> = {
  restaurant: {
    duration: 15,
    savedMin: 25,
    titleEn: "Finding the best restaurants…",
    titleEl: "Αναζήτηση κορυφαίων εστιατορίων…",
    stepsEn: ["Scanning nearby venues", "Checking menus & prices", "Verifying opening hours", "Curating your top picks"],
    stepsEl: ["Σάρωση κοντινών χώρων", "Έλεγχος μενού & τιμών", "Επαλήθευση ωραρίου", "Επιλογή κορυφαίων προτάσεων"],
  },
  delivery: {
    duration: 12,
    savedMin: 20,
    titleEn: "Finding delivery options…",
    titleEl: "Αναζήτηση επιλογών delivery…",
    stepsEn: ["Checking delivery zones", "Reviewing menus", "Estimating delivery times", "Selecting best options"],
    stepsEl: ["Έλεγχος ζωνών delivery", "Ανασκόπηση μενού", "Εκτίμηση χρόνου παράδοσης", "Επιλογή καλύτερων"],
  },
  activities: {
    duration: 18,
    savedMin: 35,
    titleEn: "Curating experiences…",
    titleEl: "Επιμέλεια εμπειριών…",
    stepsEn: ["Exploring local activities", "Checking availability", "Reading reviews", "Picking the best for you"],
    stepsEl: ["Εξερεύνηση τοπικών δραστηριοτήτων", "Έλεγχος διαθεσιμότητας", "Ανάγνωση κριτικών", "Επιλογή των καλύτερων"],
  },
  shopping: {
    duration: 12,
    savedMin: 20,
    titleEn: "Finding the best shops…",
    titleEl: "Αναζήτηση καταστημάτων…",
    stepsEn: ["Scanning nearby stores", "Checking product availability", "Comparing prices", "Curating recommendations"],
    stepsEl: ["Σάρωση κοντινών καταστημάτων", "Έλεγχος διαθεσιμότητας", "Σύγκριση τιμών", "Επιλογή προτάσεων"],
  },
  travel: {
    duration: 15,
    savedMin: 25,
    titleEn: "Planning your dining…",
    titleEl: "Σχεδιασμός γεύσεων…",
    stepsEn: ["Scanning destination venues", "Verifying menus", "Checking hours & prices", "Building your guide"],
    stepsEl: ["Σάρωση χώρων προορισμού", "Επαλήθευση μενού", "Έλεγχος ωραρίου & τιμών", "Δημιουργία οδηγού"],
  },
};

const AiSearchLoader = ({ feature, compact = false }: AiSearchLoaderProps) => {
  const { lang } = useLanguage();
  const cfg = CONFIG[feature];
  const isEl = lang === "el";

  const steps = isEl ? cfg.stepsEl : cfg.stepsEn;
  const title = isEl ? cfg.titleEl : cfg.titleEn;
  const savedText = isEl
    ? `Αυτό θα σας έπαιρνε ~${cfg.savedMin} λεπτά χειροκίνητα`
    : `This would take you ~${cfg.savedMin} min to research manually`;

  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(cfg.duration);

  // Non-linear progress: fast start, slow middle, holds at ~92%
  useEffect(() => {
    const start = Date.now();
    const dur = cfg.duration * 1000;

    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / dur, 1);
      // ease-out cubic, cap at 92%
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.min(eased * 92, 92));
      setRemaining(Math.max(0, Math.ceil((dur - elapsed) / 1000)));
    };

    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [cfg.duration]);

  // Rotate steps every 3.5s
  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 3500);
    return () => clearInterval(id);
  }, [steps.length]);

  if (compact) {
    return (
      <div className="flex items-center justify-center py-6 gap-3">
        <div className="w-32 h-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gold"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
        <span className="text-[10px] font-sans text-muted-foreground">
          ~{remaining}s
        </span>
      </div>
    );
  }

  return (
    <motion.div
      key="ai-loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-28 text-center space-y-6"
    >
      {/* Title */}
      <p className="font-serif text-lg text-foreground">{title}</p>

      {/* Progress bar */}
      <div className="w-48 h-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gold"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Rotating step text */}
      <div className="h-5 relative w-full">
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="font-sans text-xs text-muted-foreground absolute inset-x-0"
          >
            {steps[stepIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Countdown */}
      <p className="font-sans text-[11px] text-muted-foreground/60">
        ~{remaining}s {isEl ? "απομένουν" : "remaining"}
      </p>

      {/* Time saved */}
      <p className="font-serif text-[10px] text-muted-foreground/40 italic max-w-[240px] leading-relaxed">
        {savedText}
      </p>
    </motion.div>
  );
};

export default AiSearchLoader;
