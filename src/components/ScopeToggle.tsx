import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  scope: "closest" | "best_in_town";
  onChange: (scope: "closest" | "best_in_town") => void;
  isLoading?: boolean;
}

const ScopeToggle = ({ scope, onChange, isLoading }: Props) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      <button onClick={() => onChange("closest")} disabled={isLoading} className={cn("rounded-md px-3 py-1.5 font-sans text-xs font-medium transition-all", scope === "closest" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground")}>
        {t("closest")}
      </button>
      <button onClick={() => onChange("best_in_town")} disabled={isLoading} className={cn("rounded-md px-3 py-1.5 font-sans text-xs font-medium transition-all", scope === "best_in_town" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground")}>
        {t("bestInTown")}
      </button>
    </div>
  );
};

export default ScopeToggle;
