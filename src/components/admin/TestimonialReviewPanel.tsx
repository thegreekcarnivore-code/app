import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { el, enUS } from "date-fns/locale";
import { useLanguage } from "@/context/LanguageContext";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Send,
  ShieldCheck,
  Mail,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Candidate = {
  id: string;
  user_id: string;
  detected_at: string;
  source: string;
  quote: string | null;
  quantitative: Record<string, unknown> | null;
  photo_before_url: string | null;
  photo_after_url: string | null;
  consent_status: "pending" | "requested" | "granted" | "denied";
  consent_anonymous: boolean | null;
  screenshot_url: string | null;
  pushed_to_reels_app_at: string | null;
  reels_app_asset_id: string | null;
  admin_status: "new" | "approved" | "rejected" | "shipped";
  admin_notes: string | null;
};

type ProfileLite = { id: string; display_name: string | null; email: string | null };

const SOURCE_LABEL: Record<string, { el: string; en: string }> = {
  chat: { el: "Συνομιλία", en: "Chat" },
  group_post: { el: "Κοινότητα", en: "Community" },
  feedback: { el: "Feedback", en: "Feedback" },
  daily_win: { el: "Νίκη ημέρας", en: "Daily win" },
  measurement: { el: "Μέτρηση", en: "Measurement" },
  before_after: { el: "Πριν/Μετά", en: "Before/After" },
  weekly_report: { el: "Ανάλυση", en: "Weekly report" },
};

const CONSENT_TONE: Record<Candidate["consent_status"], string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  requested: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  granted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  denied: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const STATUS_TONE: Record<Candidate["admin_status"], string> = {
  new: "bg-muted text-muted-foreground",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  shipped: "bg-gold/20 text-gold",
};

export default function TestimonialReviewPanel() {
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [rows, setRows] = useState<Candidate[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [filter, setFilter] = useState<"all" | Candidate["admin_status"]>("new");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    const { data } = await (supabase.from as any)("testimonial_candidates")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(200);
    const list = (data ?? []) as Candidate[];
    setRows(list);
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", userIds);
      const map = new Map<string, ProfileLite>();
      (profs ?? []).forEach((p: any) => map.set(p.id, p as ProfileLite));
      setProfiles(map);
    }
  };

  useEffect(() => { load(); }, []);

  const runDetect = async () => {
    setScanning(true);
    const { error } = await supabase.functions.invoke("detect-testimonials", { body: {} });
    setScanning(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isGreek ? "Σάρωση ολοκληρώθηκε" : "Scan complete" });
    load();
  };

  const requestConsent = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.functions.invoke("request-testimonial-consent", {
      body: { candidate_id: id },
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isGreek ? "Στάλθηκε αίτημα συγκατάθεσης" : "Consent request sent" });
    load();
  };

  const renderCard = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.functions.invoke("render-testimonial-card", {
      body: { candidate_id: id },
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isGreek ? "Η κάρτα δημιουργήθηκε" : "Card rendered" });
    load();
  };

  const setStatus = async (id: string, admin_status: Candidate["admin_status"]) => {
    setBusyId(id);
    const { error } = await (supabase.from as any)("testimonial_candidates")
      .update({ admin_status })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, admin_status } : r)));
  };

  const pushToReels = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.functions.invoke("push-to-reels-app", {
      body: { candidate_id: id },
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isGreek ? "Στάλθηκε στο reels app" : "Pushed to reels app" });
    load();
  };

  const visible = rows.filter((r) => filter === "all" || r.admin_status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            {isGreek ? "Ιστορίες πελατών" : "Client stories"}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {isGreek ? "Ανανέωση" : "Refresh"}
          </Button>
          <Button size="sm" onClick={runDetect} disabled={scanning}>
            {scanning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {isGreek ? "Σάρωση τώρα" : "Scan now"}
          </Button>
        </div>
      </div>

      <p className="rounded-xl border border-amber-300/40 bg-amber-50/40 p-3 font-sans text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
        {isGreek
          ? "Καμία ιστορία δεν προωθείται στο reels app χωρίς ρητή συγκατάθεση του μέλους."
          : "No story is pushed to the reels app without explicit member consent."}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "new", "approved", "shipped", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s as any)}
            className={`rounded-full px-3 py-1 font-sans text-xs font-medium ${
              filter === s
                ? "bg-gold text-gold-foreground"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? (isGreek ? "Όλα" : "All") : s}
            {s !== "all" && (
              <span className="ml-1.5 opacity-60">
                {rows.filter((r) => r.admin_status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {isGreek ? "Δεν εντοπίστηκαν ακόμη ιστορίες." : "No stories detected yet."}
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((r) => {
            const profile = profiles.get(r.user_id);
            const sourceLabel = SOURCE_LABEL[r.source] ?? { el: r.source, en: r.source };
            const canRequestConsent = r.consent_status === "pending";
            const canRender = r.consent_status === "granted";
            const canPush = r.consent_status === "granted" && !!r.screenshot_url && r.admin_status === "approved";
            const stat = r.quantitative as { weight_lost_kg?: number; days_in_program?: number } | null;
            return (
              <li key={r.id} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 font-sans text-[11px] font-semibold ${CONSENT_TONE[r.consent_status]}`}>
                      {r.consent_status}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 font-sans text-[11px] font-semibold ${STATUS_TONE[r.admin_status]}`}>
                      {r.admin_status}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-0.5 font-sans text-[11px] text-muted-foreground">
                      {isGreek ? sourceLabel.el : sourceLabel.en}
                    </span>
                  </div>
                  <span className="font-sans text-[11px] text-muted-foreground">
                    {format(new Date(r.detected_at), "d MMM HH:mm", { locale: isGreek ? el : enUS })}
                  </span>
                </div>

                <div className="font-sans text-xs text-muted-foreground">
                  {profile?.display_name || profile?.email || r.user_id.slice(0, 8)}
                </div>

                {r.quote && (
                  <blockquote className="border-l-2 border-gold/50 pl-3 font-serif text-sm italic leading-relaxed text-foreground">
                    "{r.quote}"
                  </blockquote>
                )}

                {stat && (stat.weight_lost_kg != null || stat.days_in_program != null) && (
                  <div className="flex flex-wrap gap-2">
                    {stat.weight_lost_kg != null && (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-sans text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        −{stat.weight_lost_kg}kg
                      </span>
                    )}
                    {stat.days_in_program != null && (
                      <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 font-sans text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                        {stat.days_in_program} {isGreek ? "μέρες" : "days"}
                      </span>
                    )}
                  </div>
                )}

                {(r.photo_before_url || r.photo_after_url) && (
                  <div className="grid grid-cols-2 gap-2">
                    {r.photo_before_url && (
                      <img src={r.photo_before_url} alt="before" className="aspect-[3/4] w-full rounded-lg object-cover" />
                    )}
                    {r.photo_after_url && (
                      <img src={r.photo_after_url} alt="after" className="aspect-[3/4] w-full rounded-lg object-cover" />
                    )}
                  </div>
                )}

                {r.screenshot_url && (
                  <a href={r.screenshot_url} target="_blank" rel="noreferrer" className="block">
                    <img src={r.screenshot_url} alt="card" className="w-full rounded-lg border border-border" />
                  </a>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {canRequestConsent && (
                    <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => requestConsent(r.id)}>
                      <Mail className="mr-1.5 h-3 w-3" />
                      {isGreek ? "Αίτημα συγκατάθεσης" : "Request consent"}
                    </Button>
                  )}
                  {canRender && (
                    <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => renderCard(r.id)}>
                      <ImageIcon className="mr-1.5 h-3 w-3" />
                      {r.screenshot_url ? (isGreek ? "Επανα-render" : "Re-render") : (isGreek ? "Δημιούργησε κάρτα" : "Render card")}
                    </Button>
                  )}
                  {r.admin_status === "new" && (
                    <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => setStatus(r.id, "approved")}>
                      <CheckCircle2 className="mr-1.5 h-3 w-3" />
                      {isGreek ? "Έγκριση" : "Approve"}
                    </Button>
                  )}
                  {r.admin_status !== "rejected" && r.admin_status !== "shipped" && (
                    <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => setStatus(r.id, "rejected")}>
                      <XCircle className="mr-1.5 h-3 w-3" />
                      {isGreek ? "Απόρριψη" : "Reject"}
                    </Button>
                  )}
                  {canPush && (
                    <Button size="sm" disabled={busyId === r.id} onClick={() => pushToReels(r.id)}>
                      <Send className="mr-1.5 h-3 w-3" />
                      {isGreek ? "Στείλε στο reels app" : "Push to reels app"}
                    </Button>
                  )}
                </div>

                {r.pushed_to_reels_app_at && (
                  <p className="font-sans text-[11px] text-emerald-700 dark:text-emerald-300">
                    {isGreek ? "Στάλθηκε" : "Pushed"} {format(new Date(r.pushed_to_reels_app_at), "d MMM HH:mm", { locale: isGreek ? el : enUS })}
                    {r.reels_app_asset_id && ` · ${r.reels_app_asset_id.slice(0, 8)}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
