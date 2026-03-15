import { MapPin, Clock, Wallet, Ruler, Eye, Wine, Crown, Utensils, Coffee, Sun, Moon, Compass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";

interface SearchParam {
  label: string;
  value: string;
  icon: React.ReactNode;
}

interface Props {
  location?: string;
  mealTime?: string;
  priceTier?: string;
  maxDistance?: number;
  scope?: "closest" | "best_in_town";
  categories?: string[];
  dateRange?: { from: string; to: string };
  mode?: string;
}

const MEAL_ICONS: Record<string, React.ReactNode> = {
  now: <Utensils className="h-3 w-3" />,
  next_breakfast: <Coffee className="h-3 w-3" />,
  next_lunch: <Sun className="h-3 w-3" />,
  next_dinner: <Moon className="h-3 w-3" />,
};

const PRICE_ICONS: Record<string, React.ReactNode> = {
  good_deal: <Wallet className="h-3 w-3" />,
  high_end: <Wine className="h-3 w-3" />,
  most_exclusive: <Crown className="h-3 w-3" />,
};

const SearchParamsSummary = ({ location, mealTime, priceTier, maxDistance, scope, categories, dateRange, mode }: Props) => {
  const { t } = useLanguage();

  const mealLabels: Record<string, string> = {
    now: t("rightNow"),
    next_breakfast: t("nextBreakfast"),
    next_lunch: t("nextLunch"),
    next_dinner: t("nextDinner"),
  };

  const priceLabels: Record<string, string> = {
    good_deal: t("goodDeal"),
    high_end: t("highEnd"),
    most_exclusive: t("mostExclusive"),
    value: t("goodDeal"),
  };

  const params: SearchParam[] = [];

  if (mealTime && mealLabels[mealTime]) {
    params.push({ label: mealLabels[mealTime], value: "", icon: MEAL_ICONS[mealTime] || <Clock className="h-3 w-3" /> });
  }

  if (priceTier && priceLabels[priceTier]) {
    params.push({ label: priceLabels[priceTier], value: "", icon: PRICE_ICONS[priceTier] || <Wallet className="h-3 w-3" /> });
  }

  if (maxDistance) {
    params.push({ label: `${maxDistance >= 80 ? "80+" : maxDistance} ${t("km")}`, value: "", icon: <Ruler className="h-3 w-3" /> });
  }

  if (scope) {
    const scopeLabel = scope === "closest" ? t("closest") : t("bestInTown");
    params.push({ label: scopeLabel, value: "", icon: <Eye className="h-3 w-3" /> });
  }

  if (categories && categories.length > 0) {
    const labels = categories.map(c => t(c as any)).join(", ");
    params.push({ label: labels, value: "", icon: <Compass className="h-3 w-3" /> });
  }

  if (dateRange) {
    params.push({ label: `${dateRange.from} → ${dateRange.to}`, value: "", icon: <Clock className="h-3 w-3" /> });
  }

  if (params.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {params.map((p, i) => (
        <Badge key={i} variant="outline" className="gap-1 px-2 py-0.5 text-[10px] font-sans font-medium text-muted-foreground border-border bg-card/50">
          {p.icon}
          {p.label}
        </Badge>
      ))}
    </div>
  );
};

export default SearchParamsSummary;
