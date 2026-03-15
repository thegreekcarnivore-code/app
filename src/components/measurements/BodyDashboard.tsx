import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { Plus, TrendingUp, TrendingDown, Minus, Trash2, Edit2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { el, enUS } from "date-fns/locale";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import MeasurementForm from "./MeasurementForm";
import MetricChart from "./MetricChart";


interface BodyDashboardProps {
  userId?: string;
}

type Measurement = {
  id: string;
  user_id: string;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  fat_kg: number | null;
  muscle_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  right_arm_cm: number | null;
  left_arm_cm: number | null;
  right_leg_cm: number | null;
  left_leg_cm: number | null;
  energy: number | null;
  digestion: number | null;
  skin_health: number | null;
  mood: number | null;
  stress: number | null;
  cravings: number | null;
  breathing_health: number | null;
  mental_health: number | null;
  pain: number | null;
  created_at: string;
};

const wellnessKeys = ["energy", "digestion", "skin_health", "mood", "stress", "cravings", "breathing_health", "mental_health", "pain"] as const;

const wellnessLabels: Record<string, { en: string; el: string }> = {
  energy: { en: "Energy", el: "Ενέργεια" },
  digestion: { en: "Digestion", el: "Πέψη" },
  skin_health: { en: "Skin Health", el: "Υγεία Δέρματος" },
  mood: { en: "Mood", el: "Διάθεση" },
  stress: { en: "Stress", el: "Στρες" },
  cravings: { en: "Cravings", el: "Λιγούρες" },
  breathing_health: { en: "Breathing", el: "Αναπνοή" },
  mental_health: { en: "Mental Health", el: "Ψυχική Υγεία" },
  pain: { en: "Pain", el: "Πόνους" },
};

const BodyDashboard = ({ userId }: BodyDashboardProps) => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;

  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Measurement | null>(null);
  const [chartMetric, setChartMetric] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Fetch height from profile for BMI calculation
  const { data: profileData } = useQuery({
    queryKey: ["profile-body", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("height_cm")
        .eq("id", targetUserId)
        .maybeSingle();
      return data as { height_cm: number | null } | null;
    },
    enabled: !!targetUserId,
  });

  const profileHeightNum = profileData?.height_cm ?? null;

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ["measurements", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const { data, error } = await supabase
        .from("measurements")
        .select("*")
        .eq("user_id", targetUserId)
        .order("measured_at", { ascending: false });
      if (error) throw error;
      return data as Measurement[];
    },
    enabled: !!targetUserId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("measurements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurements", targetUserId] });
      toast({ title: lang === "en" ? "Entry deleted" : "Η εγγραφή διαγράφηκε" });
    },
  });

  const latest = measurements[0];
  const sparklineData = [...measurements].reverse().slice(-10);

  // Find the only known height across all measurements (it's always the same)
  const knownHeight = profileHeightNum || (measurements.find((m) => m.height_cm)?.height_cm ?? null);

  const calcBmi = (m: Measurement) => {
    const weight = m.weight_kg;
    const height = knownHeight || m.height_cm;
    return weight && height ? weight / Math.pow(height / 100, 2) : null;
  };
  const calcFatPct = (m: Measurement) => m.fat_kg && m.weight_kg ? (m.fat_kg / m.weight_kg) * 100 : null;
  const calcMusclePct = (m: Measurement) => m.muscle_kg && m.weight_kg ? (m.muscle_kg / m.weight_kg) * 100 : null;

  const getTrend = (key: string) => {
    if (measurements.length < 2) return "neutral";
    const curr = getMetricValue(measurements[0], key);
    const prev = getMetricValue(measurements[1], key);
    if (curr === null || prev === null) return "neutral";
    return curr > prev ? "up" : curr < prev ? "down" : "neutral";
  };

  const getMetricValue = (m: Measurement | undefined, key: string): number | null => {
    if (!m) return null;
    if (key === "bmi") return calcBmi(m);
    if (key === "fat_pct") return calcFatPct(m);
    if (key === "muscle_pct") return calcMusclePct(m);
    return (m as any)[key] ?? null;
  };

  // Get the date of the latest measurement that has a value for a given metric
  const getLastMeasurementDate = (key: string): string | null => {
    const entry = measurements.find((m) => getMetricValue(m, key) !== null);
    if (!entry) return null;
    return format(new Date(entry.measured_at), "d MMM", { locale: lang === "el" ? el : enUS });
  };

  const getSparklineData = (key: string) =>
    sparklineData.map((m) => ({ value: getMetricValue(m, key) })).filter((d) => d.value !== null);

  const getSparklineDomain = (key: string): [number, number] => {
    const data = getSparklineData(key);
    const values = data.map((d) => d.value as number);
    if (values.length === 0) return [0, 10];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || 1;
    return [min - pad, max + pad];
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-primary" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const oldest = measurements.length > 1 ? measurements[measurements.length - 1] : null;

  const getOverallChange = (key: string): number | null => {
    if (!latest || !oldest) return null;
    const curr = getMetricValue(latest, key);
    const first = getMetricValue(oldest, key);
    if (curr === null || first === null) return null;
    return curr - first;
  };

  const metricCards = [
    { key: "weight_kg", label: lang === "en" ? "Weight" : "Βάρος", unit: "kg", value: latest?.weight_kg },
    { key: "bmi", label: lang === "en" ? "BMI" : "ΔΜΣ", unit: "", value: latest ? calcBmi(latest) : null },
    { key: "fat_pct", label: lang === "en" ? "Fat %" : "Λίπος %", unit: "%", value: latest ? calcFatPct(latest) : null },
    { key: "muscle_pct", label: lang === "en" ? "Muscle %" : "Μυϊκή Μάζα %", unit: "%", value: latest ? calcMusclePct(latest) : null },
    { key: "muscle_kg", label: lang === "en" ? "Muscle (kg)" : "Μυϊκή Μάζα (kg)", unit: "kg", value: latest?.muscle_kg },
  ];

  const circumferences = [
    { key: "waist_cm", label: lang === "en" ? "Waist" : "Περίμετρος Μέσης", value: latest?.waist_cm },
    { key: "hip_cm", label: lang === "en" ? "Hip" : "Περίμετρος Γοφών", value: latest?.hip_cm },
    { key: "right_arm_cm", label: lang === "en" ? "Right Arm" : "Περίμετρος Μπράτσο Δεξί", value: latest?.right_arm_cm },
    { key: "left_arm_cm", label: lang === "en" ? "Left Arm" : "Περίμετρος Μπράτσο (Αριστ.)", value: latest?.left_arm_cm },
    { key: "right_leg_cm", label: lang === "en" ? "Right Leg" : "Περίμετρος Μέσου Μηρού (Δεξί)", value: latest?.right_leg_cm },
    { key: "left_leg_cm", label: lang === "en" ? "Left Leg" : "Περίμετρος Μέσου Μηρού (Αριστ.)", value: latest?.left_leg_cm },
  ];

  const allMetrics = [
    ...metricCards.map(({ key, label }) => ({ key, label })),
    ...circumferences.map(({ key, label }) => ({ key, label })),
    ...wellnessKeys.map((key) => ({ key, label: wellnessLabels[key][lang] })),
  ];

  if (chartMetric) {
    return (
      <MetricChart
        metric={chartMetric}
        measurements={measurements}
        getMetricValue={getMetricValue}
        onBack={() => setChartMetric(null)}
        onChangeMetric={setChartMetric}
        allMetrics={allMetrics}
        userId={targetUserId || ""}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Sparkline cards - inspired grid layout */}
      <div className="grid grid-cols-2 gap-3">
        {metricCards.map(({ key, label, unit, value }) => {
          const change = getOverallChange(key);
          const changePct = (() => {
            if (!latest || !oldest) return null;
            const first = getMetricValue(oldest, key);
            if (first === null || first === 0 || change === null) return null;
            return (change / Math.abs(first)) * 100;
          })();
          return (
            <Card
              key={key}
              className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md overflow-hidden"
              onClick={() => setChartMetric(key)}
            >
              <CardContent className="p-0">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-sm font-serif font-bold text-foreground tracking-tight mb-1">{label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-serif font-bold text-foreground">
                      {value !== null && value !== undefined ? value.toFixed(1) : "—"}
                    </span>
                    {unit && <span className="text-sm font-sans text-muted-foreground">{unit}</span>}
                    {changePct !== null && (
                      <span className={`text-xs font-sans font-semibold px-1.5 py-0.5 rounded-full ${changePct > 0 ? "bg-primary/10 text-primary" : changePct < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                        {changePct > 0 ? "↑" : changePct < 0 ? "↓" : ""} {Math.abs(changePct).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {getLastMeasurementDate(key) && (
                    <p className="text-[10px] font-sans text-muted-foreground mt-0.5">{getLastMeasurementDate(key)}</p>
                  )}
                </div>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getSparklineData(key)} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <YAxis domain={getSparklineDomain(key)} hide />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Circumferences */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-serif font-bold text-foreground mb-3">
            {lang === "en" ? "Circumferences" : "Περιφέρειες"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {circumferences.map(({ key, label, value }) => (
              <button key={key} onClick={() => setChartMetric(key)} className="text-left space-y-1 hover:opacity-70 transition-opacity p-2 rounded-lg hover:bg-muted/50">
                <p className="text-sm font-serif font-bold text-foreground tracking-tight">{label}</p>
                <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-foreground">{value ? `${value}cm` : "—"}</p>
                    <TrendIcon trend={getTrend(key)} />
                  </div>
                  {getLastMeasurementDate(key) && (
                    <p className="text-[10px] font-sans text-muted-foreground">{getLastMeasurementDate(key)}</p>
                  )}
                  <div className="h-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getSparklineData(key)}>
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                      <YAxis domain={getSparklineDomain(key)} hide />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Wellness scores */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-serif font-bold text-foreground mb-3">
            {lang === "en" ? "Wellness Scores" : "Βαθμολογίες Ευεξίας"}
          </h3>
          <div className="space-y-3">
            {wellnessKeys.map((key) => {
              const value = latest ? (latest as any)[key] : null;
              const trend = getTrend(key);
              // For stress, cravings, pain: lower is better (invert arrow color)
              const invertedKeys = ["stress", "cravings", "pain"];
              const isInverted = invertedKeys.includes(key);
              const arrowColor = trend === "neutral"
                ? "text-muted-foreground"
                : (trend === "up" && !isInverted) || (trend === "down" && isInverted)
                  ? "text-primary"
                  : "text-destructive";
              return (
                <button key={key} onClick={() => setChartMetric(key)} className="w-full flex items-center gap-3 hover:opacity-70 transition-opacity">
                  <span className="text-sm font-sans text-muted-foreground w-24 text-left truncate">
                    {wellnessLabels[key][lang]}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: value !== null ? `${(value / 10) * 100}%` : "0%" }}
                      />
                    </div>
                    {trend === "up" ? (
                      <TrendingUp className={`h-4 w-4 shrink-0 ${arrowColor}`} />
                    ) : trend === "down" ? (
                      <TrendingDown className={`h-4 w-4 shrink-0 ${arrowColor}`} />
                    ) : (
                      <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-sans font-medium text-foreground w-10 text-right">
                    {value !== null ? `${value}/10` : "—"}
                  </span>
                  {getLastMeasurementDate(key) && (
                    <span className="text-[9px] font-sans text-muted-foreground w-12 text-right">
                      {getLastMeasurementDate(key)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Collapsible History */}
      <div className="space-y-2">
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="w-full flex items-center justify-between py-2"
        >
          <h3 className="text-lg font-serif font-semibold text-foreground">
            {lang === "en" ? "History" : "Ιστορικό"}
            <span className="text-sm font-sans font-normal text-muted-foreground ml-2">({measurements.length})</span>
          </h3>
          {historyOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>
        {historyOpen && (
          <>
            {isLoading && <p className="text-base text-muted-foreground">Loading...</p>}
            {measurements.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-sans font-medium text-foreground">
                        {new Date(m.measured_at).toLocaleDateString(lang === "en" ? "en-GB" : "el-GR")}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm font-sans text-muted-foreground">
                        {m.weight_kg && <span>{m.weight_kg}kg</span>}
                        {m.height_cm && <span>{m.height_cm}cm</span>}
                        {m.waist_cm && <span>W:{m.waist_cm}</span>}
                        {m.hip_cm && <span>H:{m.hip_cm}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditEntry(m); setFormOpen(true); }} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(m.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isLoading && measurements.length === 0 && (
              <p className="text-center text-base font-sans text-muted-foreground py-6">
                {lang === "en" ? "No measurements yet" : "Δεν υπάρχουν μετρήσεις ακόμα"}
              </p>
            )}
          </>
        )}
      </div>

      <MeasurementForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editEntry={editEntry}
        userId={targetUserId || ""}
      />
    </div>
  );
};

export default BodyDashboard;
