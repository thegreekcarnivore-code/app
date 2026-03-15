import { motion } from "framer-motion";
import { Utensils, Coffee, Sun, Moon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  onSelect: (mealTime: string) => void;
  isLoading: boolean;
}

const MealTimeSelector = ({ onSelect, isLoading }: Props) => {
  const { t, tUp } = useLanguage();

  const options = [
    { id: "now", label: t("rightNow"), icon: Utensils, description: t("rightNowDesc") },
    { id: "next_breakfast", label: t("nextBreakfast"), icon: Coffee, description: t("nextBreakfastDesc") },
    { id: "next_lunch", label: t("nextLunch"), icon: Sun, description: t("nextLunchDesc") },
    { id: "next_dinner", label: t("nextDinner"), icon: Moon, description: t("nextDinnerDesc") },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3" data-guide="meal-time-selector">
      <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-gold font-medium">{tUp("whenEating")}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((opt) => (
          <button key={opt.id} onClick={() => onSelect(opt.id)} disabled={isLoading} className="flex flex-col items-start gap-1.5 rounded-2xl border border-border bg-card p-4 text-left transition-all duration-200 hover:border-gold/40 hover:bg-gold/5 hover:scale-[1.02] disabled:opacity-50 card-inset">
            <opt.icon className="h-5 w-5 text-gold" />
            <span className="font-sans text-sm font-medium text-foreground">{opt.label}</span>
            <span className="font-sans text-[10px] text-muted-foreground leading-relaxed">{opt.description}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default MealTimeSelector;
