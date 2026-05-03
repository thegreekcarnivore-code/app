import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, Heart, Send, Pencil, X, Check, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type Member = {
  userId: string;
  name: string;
  email: string | null;
  subscriptionStatus: string | null;
  paused: boolean;
  daysIn: number | null;
  daysSinceLogin: number | null;
  daysSinceWeight: number | null;
  daysSinceFoodLog: number | null;
  daysSinceChat: number | null;
  weightDeltaKg: number | null;
  band: "healthy" | "slipping" | "at_risk" | "lost" | "deep_lost";
};

type PendingMessage = {
  id: string;
  user_id: string;
  tier: string;
  trigger_signal: string;
  days_idle: number;
  generated_text: string;
  email_subject: string;
  status: string;
  generated_at: string;
};

const SUPABASE_URL = "https://bowvosskzbtuxmrwatoj.supabase.co";

const BAND_STYLE: Record<Member["band"], { color: string; label_el: string; label_en: string }> = {
  healthy:   { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label_el: "Healthy",  label_en: "Healthy"  },
  slipping:  { color: "bg-yellow-50 text-yellow-800 border-yellow-200",   label_el: "Slipping", label_en: "Slipping" },
  at_risk:   { color: "bg-orange-50 text-orange-700 border-orange-200",   label_el: "At risk",  label_en: "At risk"  },
  lost:      { color: "bg-red-50 text-red-700 border-red-200",            label_el: "Lost",     label_en: "Lost"     },
  deep_lost: { color: "bg-zinc-100 text-zinc-700 border-zinc-300",        label_el: "Deep lost",label_en: "Deep lost"},
};

function fmtDays(n: number | null): string {
  if (n === null) return "—";
  if (n === 0) return "today";
  if (n === 1) return "1d";
  if (n > 99) return "99+d";
  return `${n}d`;
}

const MemberHealthPanel = () => {
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("not authenticated");
      const headers = { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
      const [healthRes, pendingRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/functions/v1/compute-member-health`, { method: "POST", headers, body: "{}" }),
        (supabase.from as any)("re_engagement_messages")
          .select("id, user_id, tier, trigger_signal, days_idle, generated_text, email_subject, status, generated_at")
          .eq("status", "pending_approval")
          .order("generated_at", { ascending: false })
          .limit(50),
      ]);
      if (!healthRes.ok) throw new Error(`health endpoint ${healthRes.status}`);
      const healthJson = await healthRes.json();
      setMembers(healthJson.members ?? []);
      setPending((pendingRes.data ?? []) as PendingMessage[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const counts = { healthy: 0, slipping: 0, at_risk: 0, lost: 0, deep_lost: 0 } as Record<Member["band"], number>;
    for (const m of members) counts[m.band] += 1;
    return counts;
  }, [members]);

  const memberById = useMemo(() => {
    const m = new Map<string, Member>();
    for (const x of members) m.set(x.userId, x);
    return m;
  }, [members]);

  const onSend = async (msg: PendingMessage) => {
    setSendingId(msg.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const text = editingId === msg.id ? editText : msg.generated_text;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-re-engagement-message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msg.id, edited_text: text === msg.generated_text ? undefined : text }),
      });
      if (!r.ok) throw new Error(`send returned ${r.status}`);
      toast({ title: isGreek ? "Στάλθηκε" : "Sent", description: isGreek ? "Σε in-app μήνυμα + email." : "Sent to in-app + email." });
      setEditingId(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast({ title: isGreek ? "Σφάλμα" : "Error", description: e instanceof Error ? e.message : "send failed", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const onSkip = async (msg: PendingMessage) => {
    try {
      await (supabase.from as any)("re_engagement_messages")
        .update({ status: "skipped", reviewed_at: new Date().toISOString() })
        .eq("id", msg.id);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const onTogglePause = async (m: Member) => {
    try {
      await (supabase.from as any)("profiles")
        .update({ re_engagement_paused: !m.paused, re_engagement_paused_at: m.paused ? null : new Date().toISOString() })
        .eq("id", m.userId);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  if (loading && members.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {isGreek ? "Σφάλμα: " : "Error: "}{error}
      </div>
    );
  }

  const atRiskCount = totals.slipping + totals.at_risk + totals.lost + totals.deep_lost;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground inline-flex items-center gap-2">
            <Heart className="h-5 w-5 text-gold" />
            {isGreek ? "Υγεία μελών" : "Member health"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isGreek
              ? `${members.length} ενεργά μέλη · ${atRiskCount} χρειάζονται προσοχή`
              : `${members.length} active · ${atRiskCount} need attention`}
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["healthy", "slipping", "at_risk", "lost", "deep_lost"] as Member["band"][]).map((b) => (
          <div key={b} className={`rounded-2xl border p-3 ${BAND_STYLE[b].color}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-75">
              {BAND_STYLE[b][isGreek ? "label_el" : "label_en"]}
            </p>
            <p className="mt-1 font-serif text-2xl font-semibold">{totals[b]}</p>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="rounded-[2rem] border border-border/70 bg-card overflow-hidden">
          <div className="border-b border-border/70 px-5 py-4 flex items-start justify-between">
            <div>
              <h3 className="font-serif text-base font-semibold text-foreground inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                {isGreek ? "Pending — προς αποστολή" : "Pending outreach"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {isGreek
                  ? `${pending.length} μηνύματα έτοιμα για αποστολή — έλεγξε, διόρθωσε ή παράλειψε.`
                  : `${pending.length} messages ready — review, edit, or skip each.`}
              </p>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {pending.map((msg) => {
              const m = memberById.get(msg.user_id);
              const tierLabel = `Tier ${msg.tier} · ${msg.days_idle}d idle · ${msg.trigger_signal}`;
              const isEditing = editingId === msg.id;
              return (
                <div key={msg.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{m?.name ?? msg.user_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{m?.email ?? "—"} · <span className="font-mono">{tierLabel}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <button type="button" onClick={() => { setEditingId(msg.id); setEditText(msg.generated_text); }} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3 w-3" />{isGreek ? "Διόρθωση" : "Edit"}
                        </button>
                      )}
                      <button type="button" onClick={() => onSkip(msg)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />{isGreek ? "Παράλειψε" : "Skip"}
                      </button>
                      <button type="button" disabled={sendingId === msg.id} onClick={() => onSend(msg)} className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1 text-xs font-semibold text-gold-foreground hover:opacity-90 disabled:opacity-50">
                        {sendingId === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        {isGreek ? "Στείλε" : "Send"}
                      </button>
                    </div>
                  </div>
                  {isEditing ? (
                    <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={6} className="text-sm" />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">{msg.generated_text}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-[2rem] border border-border/70 bg-card overflow-hidden">
        <div className="border-b border-border/70 px-5 py-4">
          <h3 className="font-serif text-base font-semibold text-foreground">
            {isGreek ? "Όλα τα μέλη (κατά ρίσκο)" : "All members (by risk)"}
          </h3>
        </div>
        <div className="divide-y divide-border/60">
          {members.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {isGreek ? "Κανένα ενεργό μέλος ακόμα." : "No active members yet."}
            </div>
          ) : members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                  {m.paused && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
                      <Pause className="h-2.5 w-2.5" />paused
                    </span>
                  )}
                  {m.subscriptionStatus && m.subscriptionStatus !== "active" && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-orange-700">
                      {m.subscriptionStatus}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span>{isGreek ? "Στο πρόγραμμα" : "In program"}: {fmtDays(m.daysIn)}</span>
                  <span className="mx-2">·</span>
                  <span>{isGreek ? "Σύνδεση" : "Login"}: {fmtDays(m.daysSinceLogin)}</span>
                  <span className="mx-2">·</span>
                  <span>{isGreek ? "Ζυγαριά" : "Weight"}: {fmtDays(m.daysSinceWeight)}</span>
                  <span className="mx-2">·</span>
                  <span>{isGreek ? "Φαγητό" : "Food"}: {fmtDays(m.daysSinceFoodLog)}</span>
                  <span className="mx-2">·</span>
                  <span>{isGreek ? "Σύμβουλος" : "Chat"}: {fmtDays(m.daysSinceChat)}</span>
                  {m.weightDeltaKg !== null && (
                    <>
                      <span className="mx-2">·</span>
                      <span className={m.weightDeltaKg < 0 ? "text-emerald-700" : m.weightDeltaKg > 0 ? "text-orange-700" : ""}>
                        Δ {m.weightDeltaKg >= 0 ? "+" : ""}{m.weightDeltaKg}kg
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${BAND_STYLE[m.band].color}`}>
                  {BAND_STYLE[m.band][isGreek ? "label_el" : "label_en"]}
                </span>
                <button type="button" onClick={() => onTogglePause(m)} title={isGreek ? "Παύση/συνέχεια re-engagement" : "Pause/resume re-engagement"} className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground">
                  {m.paused ? <Check className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemberHealthPanel;
