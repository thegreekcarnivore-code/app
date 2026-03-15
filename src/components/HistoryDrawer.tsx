import { useEffect } from "react";
import { MapPin, Trash2, Clock } from "lucide-react";
import IconButtonWithTooltip from "@/components/IconButtonWithTooltip";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useLanguage } from "@/context/LanguageContext";
import { HistoryEntry } from "@/hooks/useRecommendationHistory";
import { formatDistanceToNow } from "date-fns";

interface HistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: HistoryEntry[];
  loading: boolean;
  onFetch: () => void;
  onSelect: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

const HistoryDrawer = ({ open, onOpenChange, history, loading, onFetch, onSelect, onDelete }: HistoryDrawerProps) => {
  const { lang, t } = useLanguage();

  useEffect(() => {
    if (open) onFetch();
  }, [open, onFetch]);

  const paramLabel = (params: Record<string, any>) => {
    const parts: string[] = [];
    if (params.mealTime) parts.push(params.mealTime);
    if (params.priceTier) parts.push(params.priceTier);
    if (params.maxDistance) parts.push(`${params.maxDistance}km`);
    if (params.categories?.length) parts.push(`${params.categories.length} categories`);
    return parts.join(" · ") || "";
  };

  const resultCount = (data: Record<string, any>) => {
    const restaurants = data.restaurants?.length || 0;
    const activities = data.activities?.length || 0;
    if (activities > 0) return `${activities} ${lang === "en" ? "activities" : "δραστηριότητες"}`;
    if (restaurants > 0) return `${restaurants} ${lang === "en" ? "results" : "αποτελέσματα"}`;
    return "";
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] pb-6">
        <DrawerTitle className="px-4 pt-4 font-serif text-xl">
          {t("history")}
        </DrawerTitle>
        <div className="overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-7 w-7 text-muted-foreground/40 mb-2" />
              <p className="font-sans text-sm text-muted-foreground">{t("noHistory")}</p>
              <p className="font-sans text-xs text-muted-foreground mt-1">{t("noHistoryHint")}</p>
            </div>
          ) : (
            history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => { onSelect(entry); onOpenChange(false); }}
                className="w-full rounded-xl border border-border bg-card p-4 text-left space-y-1 transition-colors hover:border-gold/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-sans font-medium text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-gold shrink-0" />
                    <span className="line-clamp-1">{entry.location_name || "Unknown"}</span>
                  </div>
                  <IconButtonWithTooltip
                    tooltip="Delete"
                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                    className="p-1 rounded-full text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButtonWithTooltip>
                </div>
                <p className="text-xs font-sans text-muted-foreground">
                  {paramLabel(entry.request_params)}
                </p>
                <p className="text-xs font-sans text-muted-foreground">
                  {resultCount(entry.response_data)}
                  {" · "}
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </p>
              </button>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default HistoryDrawer;
