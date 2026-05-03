import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

type UsageRow = {
  user_id: string;
  function_name: string;
  service: string;
  model: string | null;
  estimated_cost: number;
  call_count: number;
  created_at: string;
};

type ProfileLite = {
  id: string;
  email: string | null;
  display_name: string | null;
  subscription_status: string | null;
};

type PerUser = {
  userId: string;
  name: string;
  email: string;
  status: string | null;
  totalCost: number;
  totalCalls: number;
  byFunction: Record<string, { cost: number; calls: number }>;
};

const MONTHLY_REVENUE_PER_MEMBER = 47;
// Tier thresholds against 47€/mo revenue. Anything above 5€ = >10% margin loss
// per member just on AI; that's the line we don't want to cross at scale.
const TIER_GREEN = 2.0;
const TIER_AMBER = 3.5;
const TIER_RED = 5.0;

const colorForCost = (cost: number) => {
  if (cost >= TIER_RED) return "text-red-600 bg-red-50 border-red-200";
  if (cost >= TIER_AMBER) return "text-orange-600 bg-orange-50 border-orange-200";
  if (cost >= TIER_GREEN) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
};

const monthStartISO = (() => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
})();

const AiCostMonitorPanel = () => {
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: usageErr } = await supabase
        .from("api_usage")
        .select("user_id, function_name, service, model, estimated_cost, call_count, created_at")
        .gte("created_at", monthStartISO)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (usageErr) throw usageErr;
      const usageRows = (rows ?? []) as UsageRow[];
      setUsage(usageRows);

      const userIds = Array.from(new Set(usageRows.map((r) => r.user_id)));
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email, display_name, subscription_status")
          .in("id", userIds);
        const map: Record<string, ProfileLite> = {};
        for (const p of (profs ?? []) as ProfileLite[]) map[p.id] = p;
        setProfiles(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const aggregated = useMemo<PerUser[]>(() => {
    const acc: Record<string, PerUser> = {};
    for (const row of usage) {
      const cost = Number(row.estimated_cost ?? 0);
      const calls = Number(row.call_count ?? 1);
      if (!acc[row.user_id]) {
        const p = profiles[row.user_id];
        acc[row.user_id] = {
          userId: row.user_id,
          name: p?.display_name ?? p?.email?.split("@")[0] ?? row.user_id.slice(0, 8),
          email: p?.email ?? "—",
          status: p?.subscription_status ?? null,
          totalCost: 0,
          totalCalls: 0,
          byFunction: {},
        };
      }
      acc[row.user_id].totalCost += cost;
      acc[row.user_id].totalCalls += calls;
      const fnKey = row.function_name;
      if (!acc[row.user_id].byFunction[fnKey]) acc[row.user_id].byFunction[fnKey] = { cost: 0, calls: 0 };
      acc[row.user_id].byFunction[fnKey].cost += cost;
      acc[row.user_id].byFunction[fnKey].calls += calls;
    }
    return Object.values(acc).sort((a, b) => b.totalCost - a.totalCost);
  }, [usage, profiles]);

  const totals = useMemo(() => {
    let cost = 0;
    let calls = 0;
    for (const u of aggregated) {
      cost += u.totalCost;
      calls += u.totalCalls;
    }
    const memberCount = aggregated.length;
    const avgPerMember = memberCount > 0 ? cost / memberCount : 0;
    const overRed = aggregated.filter((u) => u.totalCost >= TIER_RED).length;
    const overAmber = aggregated.filter((u) => u.totalCost >= TIER_AMBER && u.totalCost < TIER_RED).length;
    return { cost, calls, memberCount, avgPerMember, overRed, overAmber };
  }, [aggregated]);

  if (loading && usage.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {isGreek ? "Σφάλμα φόρτωσης: " : "Failed to load: "}{error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            {isGreek ? "Κόστος AI ανά μέλος" : "AI cost per member"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isGreek
              ? `Τρέχων μήνας · έσοδο €${MONTHLY_REVENUE_PER_MEMBER}/μέλος · στόχος < €${TIER_RED}/μέλος`
              : `Current month · €${MONTHLY_REVENUE_PER_MEMBER}/member revenue · target <€${TIER_RED}/member`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:border-gold/40 hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
          {isGreek ? "Ανανέωση" : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isGreek ? "Σύνολο μήνα" : "Month total"}
          </p>
          <p className="mt-2 font-serif text-2xl font-semibold text-foreground">€{totals.cost.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isGreek ? "Μέλη με χρήση" : "Active users"}
          </p>
          <p className="mt-2 font-serif text-2xl font-semibold text-foreground">{totals.memberCount}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isGreek ? "Μ.Ο. ανά μέλος" : "Avg per member"}
          </p>
          <p className="mt-2 font-serif text-2xl font-semibold text-foreground">€{totals.avgPerMember.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isGreek ? "Σε ζώνη κινδύνου" : "In red/amber"}
          </p>
          <p className="mt-2 font-serif text-2xl font-semibold text-foreground">
            <span className="text-red-600">{totals.overRed}</span>
            <span className="mx-1 text-muted-foreground/50">·</span>
            <span className="text-orange-600">{totals.overAmber}</span>
          </p>
        </div>
      </div>

      {totals.overRed > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {isGreek
              ? `${totals.overRed} μέλη ξεπερνούν τα €${TIER_RED}/μήνα — αυτή η συμπεριφορά μειώνει το margin πάνω από 10% ανά συνδρομή. Δες τις λίστες παρακάτω και αποφάσισε αν χρειάζεται rate-limit ή μοντέλο-downgrade.`
              : `${totals.overRed} member(s) exceed €${TIER_RED}/month — over 10% margin loss per subscription. Review below and decide on rate-limit or model downgrade.`}
          </p>
        </div>
      )}

      <div className="rounded-[2rem] border border-border/70 bg-card overflow-hidden">
        <div className="border-b border-border/70 px-5 py-4">
          <h3 className="font-serif text-base font-semibold text-foreground">
            {isGreek ? "Λίστα μελών (φθίνον κόστος)" : "Members (descending cost)"}
          </h3>
        </div>
        <div className="divide-y divide-border/60">
          {aggregated.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {isGreek ? "Καμία κίνηση τον τρέχοντα μήνα." : "No usage this month."}
            </div>
          ) : (
            aggregated.slice(0, 50).map((u) => {
              const topFns = Object.entries(u.byFunction)
                .sort((a, b) => b[1].cost - a[1].cost)
                .slice(0, 3);
              return (
                <div key={u.userId} className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                      {u.status && u.status !== "active" && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {u.status}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {topFns.map(([fn, v]) => (
                        <span key={fn}>
                          <span className="text-foreground/80">{fn}</span> €{v.cost.toFixed(2)} · {v.calls}×
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold ${colorForCost(u.totalCost)}`}>
                    €{u.totalCost.toFixed(2)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {isGreek
          ? `Τα όρια: < €${TIER_GREEN} πράσινο · €${TIER_GREEN}-${TIER_AMBER} κίτρινο · €${TIER_AMBER}-${TIER_RED} πορτοκαλί · ≥ €${TIER_RED} κόκκινο. Στόχος είναι να κρατάμε τον μέσο όρο κάτω από €${TIER_GREEN}.`
          : `Tiers: <€${TIER_GREEN} green · €${TIER_GREEN}-${TIER_AMBER} yellow · €${TIER_AMBER}-${TIER_RED} amber · ≥€${TIER_RED} red. Aim to keep the average below €${TIER_GREEN}.`}
      </p>
    </div>
  );
};

export default AiCostMonitorPanel;
