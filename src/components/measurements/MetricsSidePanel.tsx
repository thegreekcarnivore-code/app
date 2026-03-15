import { useRef } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MetricsSidePanelProps {
  open: boolean;
  onClose: () => void;
  lang: "en" | "el";
  allMetrics: { key: string; label: string }[];
  metric: string;
  measurements: any[];
  getMetricValue: (m: any, key: string) => number | null;
  metricLabels: Record<string, { en: string; el: string; unit: string }>;
  onChangeMetric: (key: string) => void;
}

const MetricsSidePanel = ({
  open,
  onClose,
  lang,
  allMetrics,
  metric,
  measurements,
  getMetricValue,
  metricLabels,
  onChangeMetric,
}: MetricsSidePanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Compute variation between the two most recent entries for a given metric
  const getVariation = (key: string) => {
    // measurements are sorted newest-first
    const withValue = measurements.filter((m) => getMetricValue(m, key) !== null);
    if (withValue.length < 2) return null;
    const current = getMetricValue(withValue[0], key)!;
    const previous = getMetricValue(withValue[1], key)!;
    return current - previous;
  };

  const getLastDate = (key: string) => {
    const entry = measurements.find((m) => getMetricValue(m, key) !== null);
    return entry ? new Date(entry.measured_at) : null;
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString(lang === "en" ? "en-GB" : "el-GR", { day: "2-digit", month: "short" });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 256, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="shrink-0 overflow-hidden border-r border-border bg-background"
        >
          <div className="w-64">
            <div className="flex items-center justify-between px-4 pt-5 pb-3">
              <h3 className="font-serif text-lg font-semibold text-foreground">
                {lang === "en" ? "All Metrics" : "Όλες οι Μετρήσεις"}
              </h3>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="px-2 pb-6 space-y-0.5">
                {allMetrics.map((m) => {
                  const val = measurements[0] ? getMetricValue(measurements[0], m.key) : null;
                  const mMeta = metricLabels[m.key];
                  const mUnit = mMeta?.unit || "";
                  const isActive = m.key === metric;
                  const variation = getVariation(m.key);
                  const lastDate = getLastDate(m.key);

                  return (
                    <button
                      key={m.key}
                      onClick={() => onChangeMetric(m.key)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
                        isActive
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/60 border border-transparent"
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className={cn(
                          "text-sm font-sans font-semibold",
                          isActive ? "text-primary" : "text-foreground"
                        )}>
                          {m.label}
                        </span>
                        <span className="text-xs font-sans font-medium text-muted-foreground">
                          {val !== null ? `${val.toFixed(1)}${mUnit}` : "—"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {lastDate && (
                            <span className="text-[10px] font-sans font-medium text-muted-foreground">
                              {formatDate(lastDate)}
                            </span>
                          )}
                          {variation !== null && variation !== 0 && (
                            <span className={cn(
                              "text-[10px] font-sans font-bold",
                              variation > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                            )}>
                              {variation > 0 ? "+" : ""}{variation.toFixed(1)}{mUnit}
                            </span>
                          )}
                        </div>
                      </div>
                      {isActive && (
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MetricsSidePanel;
