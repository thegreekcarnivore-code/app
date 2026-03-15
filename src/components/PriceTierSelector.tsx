import { motion } from "framer-motion";
import { Wallet, Wine, Crown, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  onSelect: (tier: string) => void;
  isLoading: boolean;
  selected?: string;
}

const PriceTierSelector = ({ onSelect, isLoading, selected }: Props) => {
  const { t, tUp } = useLanguage();

  const tiers = [
    { id: "good_deal", label: t("goodDeal"), icon: Wallet, description: t("goodDealDesc") },
    { id: "high_end", label: t("highEnd"), icon: Wine, description: t("highEndDesc") },
    { id: "most_exclusive", label: t("mostExclusive"), icon: Crown, description: t("mostExclusiveDesc") },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3" data-guide="price-tier-selector">
      <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-gold font-medium">{tUp("howMuchSpend")}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {tiers.map((tier) => (
          <button key={tier.id} onClick={() => onSelect(tier.id)} disabled={isLoading} className={`relative flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 card-inset ${selected === tier.id ? "border-gold/50 bg-gold/10 ring-2 ring-gold/20 shadow-gold-sm" : "border-border bg-card hover:border-gold/40 hover:bg-gold/5"}`}>
            {selected === tier.id && (
              <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold">
                <Check className="h-2.5 w-2.5 text-gold-foreground" />
              </span>
            )}
            <tier.icon className="h-5 w-5 text-gold" />
            <span className="font-sans text-sm font-medium text-foreground">{tier.label}</span>
            <span className="font-sans text-[10px] text-muted-foreground leading-relaxed">{tier.description}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default PriceTierSelector;
