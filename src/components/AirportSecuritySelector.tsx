import { motion } from "framer-motion";
import { ShieldCheck, Plane } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  onSelect: (side: "before_security" | "after_security") => void;
}

const AirportSecuritySelector = ({ onSelect }: Props) => {
  const { t } = useLanguage();

  const options = [
    {
      id: "before_security" as const,
      label: t("beforeSecurity"),
      icon: ShieldCheck,
      description: t("beforeSecurityDesc"),
    },
    {
      id: "after_security" as const,
      label: t("afterSecurity"),
      icon: Plane,
      description: t("afterSecurityDesc"),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
      <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">{t("airportDetected")}</p>
      <p className="font-serif text-lg text-foreground">{t("airportSecurityQuestion")}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-gold/40 hover:bg-gold/5"
          >
            <opt.icon className="h-4 w-4 text-gold" />
            <span className="font-sans text-sm font-medium text-foreground">{opt.label}</span>
            <span className="font-sans text-[10px] text-muted-foreground">{opt.description}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default AirportSecuritySelector;
