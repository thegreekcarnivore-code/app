import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Plus, Edit2, Trash2, LayoutList, ArrowRight, CalendarDays, MessageCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import MeasurementForm from "./MeasurementForm";
import MetricsSidePanel from "./MetricsSidePanel";
import MeasurementComments from "./MeasurementComments";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

interface MetricChartProps {
  metric: string;
  measurements: any[];
  getMetricValue: (m: any, key: string) => number | null;
  onBack: () => void;
  onChangeMetric: (key: string) => void;
  allMetrics: { key: string; label: string }[];
  userId: string;
}

const metricLabels: Record<string, { en: string; el: string; unit: string }> = {
  weight_kg: { en: "Weight", el: "Βάρος", unit: "kg" },
  bmi: { en: "BMI", el: "ΔΜΣ", unit: "" },
  fat_pct: { en: "Fat %", el: "Λίπος %", unit: "%" },
  muscle_pct: { en: "Muscle %", el: "Μυϊκή Μάζα %", unit: "%" },
  muscle_kg: { en: "Muscle (kg)", el: "Μυϊκή Μάζα (kg)", unit: "kg" },
  waist_cm: { en: "Waist", el: "Περίμετρος Μέσης", unit: "cm" },
  hip_cm: { en: "Hip", el: "Περίμετρος Γοφών", unit: "cm" },
  right_arm_cm: { en: "Right Arm", el: "Περίμετρος Μπράτσο Δεξί", unit: "cm" },
  left_arm_cm: { en: "Left Arm", el: "Περίμετρος Μπράτσο (Αριστ.)", unit: "cm" },
  right_leg_cm: { en: "Right Leg", el: "Περίμετρος Μέσου Μηρού (Δεξί)", unit: "cm" },
  left_leg_cm: { en: "Left Leg", el: "Περίμετρος Μέσου Μηρού (Αριστ.)", unit: "cm" },
  energy: { en: "Energy", el: "Ενέργεια", unit: "/10" },
  digestion: { en: "Digestion", el: "Πέψη", unit: "/10" },
  skin_health: { en: "Skin Health", el: "Υγεία Δέρματος", unit: "/10" },
  mood: { en: "Mood", el: "Διάθεση", unit: "/10" },
  stress: { en: "Stress", el: "Στρες", unit: "/10" },
  cravings: { en: "Cravings", el: "Λιγούρες", unit: "/10" },
  breathing_health: { en: "Breathing", el: "Αναπνοή", unit: "/10" },
  mental_health: { en: "Mental Health", el: "Ψυχική Υγεία", unit: "/10" },
  pain: { en: "Pain", el: "Πόνους", unit: "/10" },
};

const timeRanges = [
  { key: "2w", weeks: 2, en: "2W", el: "2Ε" },
  { key: "4w", weeks: 4, en: "1M", el: "1Μ" },
  { key: "2m", weeks: 8, en: "2M", el: "2Μ" },
  { key: "3m", weeks: 13, en: "3M", el: "3Μ" },
  { key: "4m", weeks: 17, en: "4M", el: "4Μ" },
  { key: "6m", weeks: 26, en: "6M", el: "6Μ" },
  { key: "8m", weeks: 35, en: "8M", el: "8Μ" },
  { key: "12m", weeks: 52, en: "12M", el: "12Μ" },
  { key: "2y", weeks: 104, en: "2Y", el: "2Χ" },
  { key: "3y", weeks: 156, en: "3Y", el: "3Χ" },
  { key: "all", weeks: 0, en: "All", el: "Όλα" },
] as const;

const MetricChart = ({ metric, measurements, getMetricValue, onBack, onChangeMetric, allMetrics, userId }: MetricChartProps) => {
  const { lang } = useLanguage();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRange, setSelectedRange] = useState("12m");
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const meta = metricLabels[metric] || { en: metric, el: metric, unit: "" };
  const label = meta[lang] || meta.en;
  const unit = meta.unit;

  // Fetch active program start date for reference line
  const { data: programStartDate } = useQuery({
    queryKey: ["program-start-date", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_programs" as any)
        .select("start_date")
        .eq("user_id", userId)
        .order("start_date", { ascending: false })
        .limit(1);
      if (data && (data as any[]).length > 0) return (data as any[])[0].start_date as string;
      return null;
    },
    enabled: !!userId,
  });

  const rangeWeeks = timeRanges.find((r) => r.key === selectedRange)?.weeks || 52;
  const isAllRange = selectedRange === "all";
  const cutoff = new Date();
  if (!isAllRange) {
    cutoff.setDate(cutoff.getDate() - rangeWeeks * 7);
  }

  const filtered = isAllRange ? measurements : measurements.filter((m) => new Date(m.measured_at) >= cutoff);
  const sorted = [...filtered].reverse();
  const programStart = programStartDate ? new Date(programStartDate) : null;

  // Build data with gaps for missing weeks
  const rawData = sorted
    .map((m) => ({
      date: (() => { const d = new Date(m.measured_at); const dm = d.toLocaleDateString(lang === "en" ? "en-GB" : "el-GR", { day: "2-digit", month: "short" }); return `${dm}\n${d.getFullYear()}`; })(),
      fullDate: m.measured_at,
      value: getMetricValue(m, metric),
      ts: new Date(m.measured_at).getTime(),
    }))
    .filter((d) => d.value !== null);

  // Insert null-gap entries for missing weeks and pad edges
  const data = (() => {
    if (rawData.length === 0) return [];
    const result: { date: string; fullDate: string; value: number | null }[] = [];
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const formatDate = (d: Date) => `${d.toLocaleDateString(lang === "en" ? "en-GB" : "el-GR", { day: "2-digit", month: "short" })}\n${d.getFullYear()}`;

    // Pad start: from range cutoff or program start to first data point
    const rangeStart = isAllRange
      ? (programStart ? programStart.getTime() : rawData[0].ts - WEEK_MS)
      : cutoff.getTime();
    if (rawData[0].ts - rangeStart > WEEK_MS) {
      result.push({ date: formatDate(new Date(rangeStart)), fullDate: new Date(rangeStart).toISOString(), value: null });
    }

    for (let i = 0; i < rawData.length; i++) {
      result.push({ date: rawData[i].date, fullDate: rawData[i].fullDate, value: rawData[i].value });
      if (i < rawData.length - 1) {
        const gap = rawData[i + 1].ts - rawData[i].ts;
        if (gap > WEEK_MS * 1.5) {
          // Insert a null gap point in the middle
          const midTs = rawData[i].ts + WEEK_MS;
          result.push({ date: formatDate(new Date(midTs)), fullDate: new Date(midTs).toISOString(), value: null });
        }
      }
    }

    // Pad end: from last data point to now
    const nowTs = Date.now();
    if (nowTs - rawData[rawData.length - 1].ts > DAY_MS) {
      result.push({ date: formatDate(new Date(nowTs)), fullDate: new Date(nowTs).toISOString(), value: null });
    }

    return result;
  })();

  // Find the index of the program start date in chart data for the reference line
  const programStartLabel = (() => {
    if (!programStartDate) return null;
    const startDate = new Date(programStartDate);
    // Find the closest data point to the start date
    let closestIdx = -1;
    let closestDist = Infinity;
    data.forEach((d, i) => {
      const dist = Math.abs(new Date(d.fullDate).getTime() - startDate.getTime());
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });
    if (closestIdx >= 0 && closestDist < 7 * 24 * 60 * 60 * 1000) return data[closestIdx].date;
    // If start date is in range but no close point, format it
    if ((!isAllRange && startDate >= cutoff) || isAllRange) {
      return startDate.toLocaleDateString(lang === "en" ? "en-GB" : "el-GR", { day: "2-digit", month: "short" });
    }
    return null;
  })();

  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 10;
  const range = dataMax - dataMin;
  const step = range > 30 ? 10 : 5;
  const yMin = Math.floor(dataMin / step) * step;
  const yMax = Math.ceil(dataMax / step) * step === Math.floor(dataMin / step) * step
    ? Math.ceil(dataMax / step) * step + step
    : Math.ceil(dataMax / step) * step;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v += step) yTicks.push(v);

  const currentValue = filtered.length > 0 ? getMetricValue(filtered[0], metric) : null;
  const firstInRange = sorted.length > 0 ? getMetricValue(sorted[0], metric) : null;
  const variation = currentValue !== null && firstInRange !== null ? currentValue - firstInRange : null;

  // Starting point: use program start date if set, otherwise first-ever measurement
  const allWithMetric = [...measurements].reverse().filter((m) => getMetricValue(m, metric) !== null);
  const startingEntry = programStart
    ? allWithMetric.find((m) => new Date(m.measured_at) >= programStart) || (allWithMetric.length > 1 ? allWithMetric[0] : null)
    : (allWithMetric.length > 1 ? allWithMetric[0] : null);
  const startingValue = startingEntry ? getMetricValue(startingEntry, metric) : null;
  const startingDate = startingEntry ? new Date(startingEntry.measured_at) : null;
  const latestDate = filtered.length > 0 ? new Date(filtered[0].measured_at) : null;
  const totalChange = currentValue !== null && startingValue !== null ? currentValue - startingValue : null;
  const totalChangePct = startingValue && totalChange !== null ? (totalChange / startingValue) * 100 : null;

  const updateProgramStartDate = async (date: Date | undefined) => {
    if (!date || !userId) return;
    const dateStr = format(date, "yyyy-MM-dd");
    // Check if a program exists for this user
    const { data: existing } = await supabase
      .from("client_programs" as any)
      .select("id")
      .eq("user_id", userId)
      .order("start_date", { ascending: false })
      .limit(1);
    if (existing && (existing as any[]).length > 0) {
      await supabase
        .from("client_programs" as any)
        .update({ start_date: dateStr } as any)
        .eq("id", (existing as any[])[0].id);
    } else {
      await supabase
        .from("client_programs" as any)
        .insert({ user_id: userId, start_date: dateStr, program_name: "Program" } as any);
    }
    queryClient.invalidateQueries({ queryKey: ["program-start-date", userId] });
    toast({ title: lang === "en" ? "Start date updated" : "Η ημερομηνία έναρξης ενημερώθηκε" });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("measurements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurements", userId] });
      toast({ title: lang === "en" ? "Entry deleted" : "Η εγγραφή διαγράφηκε" });
    },
  });

  // Build log entries with full measurement object for editing
  const logEntries = [...filtered]
    .map((m) => ({
      id: m.id,
      date: new Date(m.measured_at),
      value: getMetricValue(m, metric),
      raw: m,
    }))
    .filter((e) => e.value !== null);

  return (
    <div className="flex gap-4">
      {/* Side panel - inline, pushes content */}
      <MetricsSidePanel
        open={metricsOpen}
        onClose={() => setMetricsOpen(false)}
        lang={lang}
        allMetrics={allMetrics}
        metric={metric}
        measurements={measurements}
        getMetricValue={getMetricValue}
        metricLabels={metricLabels}
        onChangeMetric={onChangeMetric}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-base font-sans text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
            {lang === "en" ? "Back" : "Πίσω"}
          </button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setMetricsOpen(!metricsOpen)} className="gap-1.5">
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => { setEditEntry(null); setFormOpen(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {lang === "en" ? "Add" : "Προσθήκη"}
            </Button>
          </div>
        </div>

        {/* Header with current value and variation */}
        <div>
          <p className="text-sm font-sans text-muted-foreground mb-0.5">{lang === "en" ? "Current" : "Τρέχον"}</p>
          <h2 className="font-serif text-3xl font-bold text-foreground tracking-tight">{label}</h2>
          <div className="flex items-baseline gap-4 mt-1">
            <span className="text-3xl font-serif font-bold text-foreground">
              {currentValue !== null ? `${currentValue.toFixed(1)}${unit}` : "—"}
            </span>
            {variation !== null && variation !== 0 && (
              <span className={cn(
                "text-base font-sans font-medium",
                variation > 0 ? "text-emerald-500" : "text-destructive"
              )}>
                {lang === "en" ? "Variation" : "Μεταβολή"}: {variation > 0 ? "+" : ""}{variation.toFixed(1)}{unit}
              </span>
            )}
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
          {timeRanges.map((r) => (
            <button
              key={r.key}
              onClick={() => setSelectedRange(r.key)}
              className={cn(
                "flex-shrink-0 rounded-md px-2.5 py-1.5 text-sm font-sans font-medium transition-all",
                selectedRange === r.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r[lang]}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={({ x, y, payload }: any) => {
                  const parts = (payload.value || "").split("\n");
                  return (
                    <text x={x} y={y} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="font-sans">
                      <tspan x={x} dy={14} fontSize={11}>{parts[0]}</tspan>
                      {parts[1] && <tspan x={x} dy={13} fontSize={9} opacity={0.55}>{parts[1]}</tspan>}
                    </text>
                  );
                }}
                height={45}
              />
              <YAxis domain={[yMin, yMax]} ticks={yTicks} tickFormatter={(v: number) => Math.round(v).toString()} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "4 4" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const entry = payload[0].payload;
                  if (entry.value === null) return null;
                  return (
                    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
                      <p className="text-xl font-serif font-bold text-foreground">
                        {Number(entry.value).toFixed(1)}{unit}
                      </p>
                      <p className="text-xs font-sans text-muted-foreground mt-0.5">{entry.date}</p>
                    </div>
                  );
                }}
              />
              {programStartLabel && (
                <ReferenceLine
                  x={programStartLabel}
                  stroke="hsl(var(--gold))"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: `▸ ${lang === "en" ? "Program Start" : "Έναρξη Προγράμματος"}`,
                    position: "insideTopLeft",
                    fill: "hsl(var(--gold))",
                    fontSize: 11,
                    fontWeight: 600,
                    offset: 8,
                  }}
                />
              )}
              <defs>
                <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                connectNulls={true}
                dot={data.filter(d => d.value !== null).length > 30 ? false : data.filter(d => d.value !== null).length > 15 ? { r: 2, fill: "hsl(var(--primary))" } : { r: 3.5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {data.length === 0 && (
          <p className="text-center text-base font-sans text-muted-foreground py-4">
            {lang === "en" ? "No data for this period" : "Δεν υπάρχουν δεδομένα για αυτή την περίοδο"}
          </p>
        )}

        {/* Before / After comparison */}
        {startingValue !== null && currentValue !== null && totalChange !== null && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
                {/* Start */}
                <div className="p-4 text-center space-y-1">
                  <p className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                    {lang === "en" ? "Start" : "Αρχη"}
                  </p>
                  <p className="text-2xl font-serif font-bold text-foreground">
                    {startingValue.toFixed(1)}{unit}
                  </p>
                  {startingDate && (
                    <p className="text-[11px] font-sans text-muted-foreground">
                      {startingDate.toLocaleDateString(lang === "en" ? "en-GB" : "el-GR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                  {isAdmin && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1 mt-1 text-[10px] font-sans text-primary hover:text-primary/80 transition-colors">
                          <CalendarDays className="h-3 w-3" />
                          {programStartDate
                            ? (lang === "en" ? "Change date" : "Αλλαγή ημ/νίας")
                            : (lang === "en" ? "Set start date" : "Ορισμός ημ/νίας")}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center">
                        <Calendar
                          mode="single"
                          selected={programStart || undefined}
                          onSelect={updateProgramStartDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Arrow + change */}
                <div className="flex flex-col items-center justify-center px-3 border-x border-border bg-muted/30">
                  <ArrowRight className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className={cn(
                    "text-sm font-sans font-bold",
                    totalChange > 0 ? "text-emerald-600 dark:text-emerald-400" : totalChange < 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {totalChange > 0 ? "+" : ""}{totalChange.toFixed(1)}{unit}
                  </span>
                  {totalChangePct !== null && (
                    <span className="text-[10px] font-sans text-muted-foreground">
                      {totalChangePct > 0 ? "+" : ""}{totalChangePct.toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Now */}
                <div className="p-4 text-center space-y-1">
                  <p className="text-xs font-sans font-semibold uppercase tracking-wider text-primary">
                    {lang === "en" ? "Now" : "Τωρα"}
                  </p>
                  <p className="text-2xl font-serif font-bold text-foreground">
                    {currentValue.toFixed(1)}{unit}
                  </p>
                  {latestDate && (
                    <p className="text-[11px] font-sans text-muted-foreground">
                      {latestDate.toLocaleDateString(lang === "en" ? "en-GB" : "el-GR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Log list */}
        {logEntries.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-serif font-semibold text-foreground">
              {lang === "en" ? "Log" : "Καταγραφές"}
            </h3>
            <div className="space-y-1.5">
              {logEntries.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-sans text-muted-foreground">
                          {entry.date.toLocaleDateString(lang === "en" ? "en-GB" : "el-GR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        <span className="text-base font-sans font-semibold text-foreground">
                          {entry.value!.toFixed(1)}{unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setOpenCommentId(openCommentId === entry.id ? null : entry.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setEditEntry(entry.raw); setFormOpen(true); }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(entry.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {openCommentId === entry.id && (
                      <MeasurementComments measurementId={entry.id} measurementUserId={userId} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <MeasurementForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editEntry={editEntry}
          userId={userId}
        />
      </div>
    </div>
  );
};

export default MetricChart;
