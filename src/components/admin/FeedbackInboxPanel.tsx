import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { el, enUS } from "date-fns/locale";
import { useLanguage } from "@/context/LanguageContext";
import { Inbox, Lightbulb, Bug, FileText, Heart, AlertTriangle, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type FeedbackRow = {
  id: string;
  user_id: string;
  category: "idea" | "bug" | "content_request" | "praise" | "complaint";
  message: string;
  status: "open" | "reviewing" | "planned" | "shipped" | "declined";
  admin_response: string | null;
  created_at: string;
};

type ProfileLite = { id: string; display_name: string | null; email: string | null };

const CATEGORY_META: Record<FeedbackRow["category"], { icon: typeof Lightbulb; label_el: string; label_en: string; tone: string }> = {
  idea: { icon: Lightbulb, label_el: "Ιδέα", label_en: "Idea", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  bug: { icon: Bug, label_el: "Bug", label_en: "Bug", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  content_request: { icon: FileText, label_el: "Αίτημα", label_en: "Request", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  praise: { icon: Heart, label_el: "Έπαινος", label_en: "Praise", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  complaint: { icon: AlertTriangle, label_el: "Παράπονο", label_en: "Complaint", tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
};

const STATUSES: Array<FeedbackRow["status"]> = ["open", "reviewing", "planned", "shipped", "declined"];

export default function FeedbackInboxPanel() {
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [filter, setFilter] = useState<"all" | FeedbackRow["status"]>("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await (supabase.from as any)("member_feedback")
      .select("id, user_id, category, message, status, admin_response, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data ?? []) as FeedbackRow[];
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

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: FeedbackRow["status"]) => {
    setBusyId(id);
    const { error } = await (supabase.from as any)("member_feedback")
      .update({ status })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const sendResponse = async (id: string) => {
    const text = (responseDraft[id] || "").trim();
    if (text.length < 5) return;
    setBusyId(id);
    const { error } = await (supabase.from as any)("member_feedback")
      .update({ admin_response: text, status: "reviewing" })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, admin_response: text, status: "reviewing" } : r)));
    setResponseDraft((d) => ({ ...d, [id]: "" }));
    toast({ title: isGreek ? "Απαντήθηκε" : "Response saved" });
  };

  const visible = rows.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-gold" />
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            {isGreek ? "Feedback μελών" : "Member feedback"}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {isGreek ? "Ανανέωση" : "Refresh"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", ...STATUSES] as const).map((s) => (
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
                {rows.filter((r) => r.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {isGreek ? "Δεν υπάρχουν μηνύματα σε αυτή την κατηγορία." : "No messages in this filter."}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => {
            const meta = CATEGORY_META[r.category];
            const Icon = meta.icon;
            const profile = profiles.get(r.user_id);
            const draft = responseDraft[r.id] ?? r.admin_response ?? "";
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-sans text-[11px] font-semibold ${meta.tone}`}>
                      <Icon className="h-3 w-3" />
                      {isGreek ? meta.label_el : meta.label_en}
                    </span>
                    <span className="font-sans text-xs text-muted-foreground">
                      {profile?.display_name || profile?.email || r.user_id.slice(0, 8)}
                    </span>
                    <span className="font-sans text-xs text-muted-foreground/70">
                      · {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: isGreek ? el : enUS })}
                    </span>
                  </div>
                  <select
                    value={r.status}
                    disabled={busyId === r.id}
                    onChange={(e) => updateStatus(r.id, e.target.value as FeedbackRow["status"])}
                    className="rounded-md border border-border bg-background px-2 py-1 font-sans text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="mt-2.5 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {r.message}
                </p>

                <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-background/50 p-2.5">
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isGreek ? "Απάντηση (προαιρετική)" : "Response (optional)"}
                  </p>
                  <Textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setResponseDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    placeholder={isGreek ? "Σύντομη απάντηση…" : "Short reply…"}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={busyId === r.id || draft.trim().length < 5}
                      onClick={() => sendResponse(r.id)}
                    >
                      <Send className="mr-1.5 h-3 w-3" />
                      {isGreek ? "Αποθήκευση" : "Save"}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
