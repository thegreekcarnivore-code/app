import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2, ExternalLink,
  CreditCard, FileSignature, FileText, MessageSquare, BookOpen,
  BarChart3, Sparkles, ShieldAlert, MessageCircleHeart, Camera,
  Zap, Database, Server, RefreshCw,
} from "lucide-react";

type Status = "ready" | "config" | "missing" | "loading";

type SubItem = {
  label: string;
  detail?: string;
  status: Status;
  ref?: string;
};

type Stage = {
  id: string;
  number: string;
  title: string;
  goal: string;
  icon: React.ComponentType<{ className?: string }>;
  status: Status;
  items: SubItem[];
};

const STATUS_META: Record<Status, { label: string; cls: string; ring: string; Icon: React.ComponentType<{ className?: string }> }> = {
  ready:   { label: "Ready",        cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", ring: "ring-emerald-500/30", Icon: CheckCircle2 },
  config:  { label: "Needs config", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",       ring: "ring-amber-500/30",   Icon: AlertTriangle },
  missing: { label: "Missing",      cls: "bg-rose-500/15 text-rose-400 border-rose-500/30",         ring: "ring-rose-500/30",    Icon: XCircle },
  loading: { label: "Checking…",    cls: "bg-muted text-muted-foreground border-border",            ring: "ring-border",         Icon: Loader2 },
};

const StatusPill = ({ status, dense = false }: { status: Status; dense?: boolean }) => {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-sans ${dense ? "text-[10px]" : "text-[11px]"} font-medium ${m.cls}`}>
      <m.Icon className={`${dense ? "h-3 w-3" : "h-3.5 w-3.5"} ${status === "loading" ? "animate-spin" : ""}`} />
      {m.label}
    </span>
  );
};

type LiveCounts = {
  loading: boolean;
  intakeCount: number | null;
  enrollmentCount: number | null;
  weeklyReportCount: number | null;
  feedbackCount: number | null;
  testimonialCandidatesCount: number | null;
  policySigsCount: number | null;
  pastDueCount: number | null;
};

const useLiveCounts = (): LiveCounts => {
  const [c, setC] = useState<LiveCounts>({
    loading: true, intakeCount: null, enrollmentCount: null, weeklyReportCount: null,
    feedbackCount: null, testimonialCandidatesCount: null, policySigsCount: null, pastDueCount: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const headCount = async (table: string, filter?: (q: any) => any) => {
        try {
          let q: any = (supabase.from as any)(table).select("*", { count: "exact", head: true });
          if (filter) q = filter(q);
          const { count, error } = await q;
          if (error) return null;
          return count ?? 0;
        } catch {
          return null;
        }
      };

      const [intake, enroll, weekly, feedback, candidates, policy, pastDue] = await Promise.all([
        headCount("member_intakes"),
        headCount("client_program_enrollments"),
        headCount("weekly_reports"),
        headCount("member_feedback"),
        headCount("testimonial_candidates"),
        headCount("policy_signatures"),
        headCount("profiles", (q: any) => q.eq("subscription_status", "past_due")),
      ]);
      if (cancelled) return;
      setC({
        loading: false,
        intakeCount: intake,
        enrollmentCount: enroll,
        weeklyReportCount: weekly,
        feedbackCount: feedback,
        testimonialCandidatesCount: candidates,
        policySigsCount: policy,
        pastDueCount: pastDue,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  return c;
};

const buildStages = (live: LiveCounts): Stage[] => {
  const tableReady = (n: number | null): Status =>
    live.loading ? "loading" : n === null ? "missing" : "ready";

  return [
    {
      id: "purchase",
      number: "01",
      title: "Stripe Purchase → Welcome Email",
      goal: "New member completes checkout, gets Greek welcome email with magic-login link.",
      icon: CreditCard,
      status: "config",
      items: [
        { label: "create-metamorphosis-checkout edge function", detail: "Stripe Checkout session", status: "ready", ref: "supabase/functions/create-metamorphosis-checkout/index.ts" },
        { label: "stripe-webhook handles checkout.session.completed", detail: "Auto-enroll member", status: "ready", ref: "supabase/functions/stripe-webhook/index.ts" },
        { label: "send-enrollment-welcome edge function", detail: "Greek email + magic link via Resend", status: "ready", ref: "supabase/functions/send-enrollment-welcome/index.ts" },
        { label: "Stripe webhook subscribed in Dashboard", detail: "Must include checkout.session.completed", status: "config" },
        { label: "RESEND_API_KEY secret set", detail: "Required to send welcome email", status: "config" },
      ],
    },
    {
      id: "policy",
      number: "02",
      title: "Policy Sign Gate",
      goal: "Every member signs the Metamorphosis terms (results-guarantee + lifestyle-coach disclaimer).",
      icon: FileSignature,
      status: "config",
      items: [
        { label: "PolicySigningGate wraps protected routes", status: "ready", ref: "src/components/PolicySigningGate.tsx" },
        { label: `policy_signatures table (${live.policySigsCount ?? "—"} signed)`, status: tableReady(live.policySigsCount) },
        { label: "Policy text v3.0 (Metamorphosis terms)", detail: "Bump POLICY_VERSION to 3.0 to force re-sign", status: "config", ref: "src/pages/Policy.tsx" },
      ],
    },
    {
      id: "intake",
      number: "03",
      title: "Detailed Intake Form",
      goal: "5-step intake captures goals, allergies, struggles → feeds personalization.",
      icon: FileText,
      status: "ready",
      items: [
        { label: `member_intakes table (${live.intakeCount ?? "—"} entries)`, status: tableReady(live.intakeCount) },
        { label: "Intake page (5 steps, autosave)", status: "ready", ref: "src/pages/Intake.tsx" },
        { label: "IntakeGate wraps protected routes", status: "ready", ref: "src/components/IntakeGate.tsx" },
        { label: `Existing members backfilled (${live.enrollmentCount ?? "—"} enrolled)`, detail: "raw_payload.backfilled = true", status: "ready" },
      ],
    },
    {
      id: "onboarding",
      number: "04",
      title: "Day-by-Day Onboarding",
      goal: "Day 1 baseline → Day 7 first weekly review, scripted via program_template_messages.",
      icon: BookOpen,
      status: "missing",
      items: [
        { label: "program_templates engine + cron", detail: "Existing infrastructure reused", status: "ready", ref: "supabase/functions/process-program-automations/index.ts" },
        { label: "onboarding_progress table", status: "ready" },
        { label: "Day 1–7 messages seeded for Metamorphosis template", detail: "20260501000100 created table only — no Day 1–7 content rows yet", status: "missing" },
        { label: "Day-completion buttons on Home Σήμερα tab", detail: "Not wired yet", status: "missing", ref: "src/pages/Home.tsx" },
        { label: "Day 1 forces 4 photos + measurements before unlock", status: "missing" },
      ],
    },
    {
      id: "advisor",
      number: "05",
      title: "24/7 Σύμβουλος (Coach Chat)",
      goal: "Personalized advisor with intake + journey-log context, no Alex impersonation.",
      icon: MessageSquare,
      status: "ready",
      items: [
        { label: "concierge-chat coach mode + RAG", status: "ready", ref: "supabase/functions/concierge-chat/index.ts" },
        { label: "Σύμβουλος framing (no AI/assistant naming)", status: "ready" },
        { label: "<member_context> injection from intake + journey log", status: "ready" },
        { label: "Hard rule: no 1-on-1 escalation", status: "ready" },
        { label: "Crisis-flag detection + safety message", status: "ready" },
      ],
    },
    {
      id: "memory",
      number: "5b",
      title: "Per-Member Journey Memory",
      goal: "Append-only summarized log so Σύμβουλος remembers prior chats / milestones.",
      icon: Sparkles,
      status: "config",
      items: [
        { label: "member_journey_log table", status: "ready" },
        { label: "Auto-summarize after each chat exchange", detail: "Verify summarization pass actually fires + writes a row", status: "config" },
        { label: "Trigger on weight delta ≥1kg", detail: "DB trigger not yet wired", status: "missing" },
        { label: "Weekly food-journal summarizer cron", status: "missing" },
      ],
    },
    {
      id: "weekly",
      number: "06",
      title: "User-Pushed Weekly Analysis",
      goal: "Member taps once-per-week. Gated on measurements + photos in last 7 days.",
      icon: BarChart3,
      status: "ready",
      items: [
        { label: "request-weekly-analysis edge function", status: "ready", ref: "supabase/functions/request-weekly-analysis/index.ts" },
        { label: `weekly_reports table (${live.weeklyReportCount ?? "—"} generated)`, status: tableReady(live.weeklyReportCount) },
        { label: "WeeklyAnalysisButton on Σήμερα tab", detail: "First-time popup + per-press confirm", status: "ready", ref: "src/components/WeeklyAnalysisButton.tsx" },
        { label: "WeeklyReport page", status: "ready", ref: "src/pages/WeeklyReport.tsx" },
        { label: "Auto-feed journey log after generation", status: "ready" },
      ],
    },
    {
      id: "tailored",
      number: "07",
      title: "Tailored Guidance from Intake",
      goal: "Meal plan + AI advisor read intake allergies, preferences, cooking_skill.",
      icon: Zap,
      status: "config",
      items: [
        { label: "Σύμβουλος reads intake (Stage 5)", status: "ready" },
        { label: "generate-meal-plan reads member_intakes", detail: "Verify allergies + dislikes + cooking_skill respected", status: "config", ref: "supabase/functions/generate-meal-plan/index.ts" },
      ],
    },
    {
      id: "feedback",
      number: "08",
      title: "Feedback / Ideas Collection",
      goal: "Floating button on every page → category + message → Telegram ping to Alex.",
      icon: MessageCircleHeart,
      status: "config",
      items: [
        { label: "FeedbackButton (floating, all auth pages)", status: "ready", ref: "src/components/FeedbackButton.tsx" },
        { label: `member_feedback table (${live.feedbackCount ?? "—"} entries)`, status: tableReady(live.feedbackCount) },
        { label: "OpenClaw → Telegram/Discord ping wired", detail: "notify-admin-feedback edge function + webhook URL", status: "config" },
        { label: "Admin Feedback tab", detail: "Sortable list, status updates, replies", status: "missing" },
      ],
    },
    {
      id: "lockout",
      number: "09",
      title: "Failed Payment → App Lockout",
      goal: "Card fails → SubscriptionGate locks app until member updates billing.",
      icon: ShieldAlert,
      status: "config",
      items: [
        { label: "stripe-webhook handles invoice.payment_failed", status: "ready", ref: "supabase/functions/stripe-webhook/index.ts" },
        { label: "stripe-webhook handles invoice.payment_succeeded", detail: "Auto-restore + welcome-back email", status: "ready" },
        { label: "stripe-webhook handles customer.subscription.updated/deleted", status: "ready" },
        { label: "create-customer-portal-session edge function", status: "ready", ref: "supabase/functions/create-customer-portal-session/index.ts" },
        { label: `SubscriptionGate (${live.pastDueCount ?? 0} past_due now)`, status: "ready", ref: "src/components/SubscriptionGate.tsx" },
        { label: "Stripe Customer Portal enabled in Dashboard", status: "config" },
        { label: "Stripe smart-retries enabled (3 retries / 21 days)", status: "config" },
        { label: "STRIPE_CUSTOMER_PORTAL_RETURN_URL secret set", status: "config" },
        { label: "process-program-automations filters past_due users", detail: "Verify cron skips inactive subscribers", status: "config" },
      ],
    },
    {
      id: "testimonials",
      number: "9b",
      title: "Testimonial Pipeline → Reels App",
      goal: "Detect wins → request consent → render card → push to reels.thegreekcarnivore.com.",
      icon: Camera,
      status: "config",
      items: [
        { label: `testimonial_candidates table (${live.testimonialCandidatesCount ?? "—"} entries)`, status: tableReady(live.testimonialCandidatesCount) },
        { label: "detect-testimonials edge function", detail: "Cron weekly Sunday 22:00 — needs scheduling", status: "config", ref: "supabase/functions/detect-testimonials/index.ts" },
        { label: "request-testimonial-consent edge function", status: "ready", ref: "supabase/functions/request-testimonial-consent/index.ts" },
        { label: "render-testimonial-card edge function (1080×1920 SVG)", status: "ready", ref: "supabase/functions/render-testimonial-card/index.ts" },
        { label: "push-to-reels-app edge function (consent-gated)", status: "ready", ref: "supabase/functions/push-to-reels-app/index.ts" },
        { label: "REELS_APP_INGEST_URL + REELS_APP_API_KEY secrets", status: "config" },
        { label: "testimonial-cards storage bucket", detail: "Create bucket + public read policy", status: "config" },
        { label: "Admin 'Ιστορίες πελατών' tab", status: "missing" },
        { label: "Cron schedule for detect-testimonials (weekly)", status: "missing" },
      ],
    },
    {
      id: "reactivation",
      number: "10",
      title: "Reactivation on Payment Resume",
      goal: "past_due → active flips automatically; cancel → reactivate flow preserves intake.",
      icon: RefreshCw,
      status: "ready",
      items: [
        { label: "invoice.payment_succeeded after past_due restores enrollment", status: "ready" },
        { label: "Welcome-back email sent on resume", status: "ready" },
        { label: "checkout.session.completed reactivation preserves intake + policy_signatures", status: "ready" },
      ],
    },
  ];
};

const recomputeStageStatus = (s: Stage): Stage => {
  const statuses = s.items.map(i => i.status);
  if (statuses.some(x => x === "loading")) return { ...s, status: "loading" };
  if (statuses.some(x => x === "missing")) return { ...s, status: "missing" };
  if (statuses.some(x => x === "config")) return { ...s, status: "config" };
  return { ...s, status: "ready" };
};

const StageCard = ({ stage }: { stage: Stage }) => {
  const Icon = stage.icon;
  const meta = STATUS_META[stage.status];
  const counts = useMemo(() => {
    const ready = stage.items.filter(i => i.status === "ready").length;
    return { ready, total: stage.items.length };
  }, [stage]);
  const pct = Math.round((counts.ready / counts.total) * 100);

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:ring-1 ${meta.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.cls}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Stage {stage.number}</p>
            <h3 className="font-serif text-base font-semibold text-foreground leading-tight">{stage.title}</h3>
          </div>
        </div>
        <StatusPill status={stage.status} />
      </div>

      <p className="mt-3 font-sans text-xs leading-relaxed text-muted-foreground">{stage.goal}</p>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between font-sans text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{counts.ready}/{counts.total} components</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${stage.status === "ready" ? "bg-emerald-500" : stage.status === "config" ? "bg-amber-500" : stage.status === "missing" ? "bg-rose-500" : "bg-muted-foreground"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {stage.items.map((item, idx) => {
          const im = STATUS_META[item.status];
          return (
            <li key={idx} className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
              <im.Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.status === "ready" ? "text-emerald-500" : item.status === "config" ? "text-amber-500" : item.status === "missing" ? "text-rose-500" : "text-muted-foreground animate-spin"}`} />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[12px] font-medium text-foreground leading-snug">{item.label}</p>
                {item.detail && <p className="font-sans text-[10px] text-muted-foreground leading-snug mt-0.5">{item.detail}</p>}
                {item.ref && (
                  <p className="font-mono text-[10px] text-muted-foreground/80 mt-0.5 truncate">{item.ref}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const LaunchReadinessPanel = () => {
  const live = useLiveCounts();
  const stages = useMemo(() => buildStages(live).map(recomputeStageStatus), [live]);

  const summary = useMemo(() => {
    const all = stages.flatMap(s => s.items);
    return {
      total: all.length,
      ready: all.filter(i => i.status === "ready").length,
      config: all.filter(i => i.status === "config").length,
      missing: all.filter(i => i.status === "missing").length,
      loading: all.filter(i => i.status === "loading").length,
    };
  }, [stages]);
  const overallPct = Math.round((summary.ready / summary.total) * 100);

  const blockers = stages.flatMap(s => s.items.filter(i => i.status === "missing").map(i => ({ stage: s.title, ...i })));
  const configItems = stages.flatMap(s => s.items.filter(i => i.status === "config").map(i => ({ stage: s.title, ...i })));

  return (
    <div className="space-y-6">
      {/* Hero summary */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">Launch Readiness</p>
            <h2 className="font-serif text-2xl font-semibold text-foreground">Μεταμόρφωση €47/mo Pipeline</h2>
            <p className="font-sans text-sm text-muted-foreground max-w-xl">
              The full A-to-Z lifecycle: Stripe purchase → Policy → Intake → Onboarding → Σύμβουλος → Weekly analysis → Feedback → Lockout → Reactivation → Testimonials.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right space-y-0.5">
              <p className="font-serif text-4xl font-semibold tabular-nums text-foreground">{overallPct}%</p>
              <p className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{summary.ready} / {summary.total} ready</p>
            </div>
            <div className="h-12 w-1 bg-border" />
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="font-serif text-xl font-semibold text-emerald-400 tabular-nums">{summary.ready}</p>
                <p className="font-sans text-[9px] uppercase tracking-wider text-muted-foreground">Ready</p>
              </div>
              <div className="text-center">
                <p className="font-serif text-xl font-semibold text-amber-400 tabular-nums">{summary.config}</p>
                <p className="font-sans text-[9px] uppercase tracking-wider text-muted-foreground">Config</p>
              </div>
              <div className="text-center">
                <p className="font-serif text-xl font-semibold text-rose-400 tabular-nums">{summary.missing}</p>
                <p className="font-sans text-[9px] uppercase tracking-wider text-muted-foreground">Missing</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="flex h-full">
            <div className="bg-emerald-500 transition-all" style={{ width: `${(summary.ready / summary.total) * 100}%` }} />
            <div className="bg-amber-500 transition-all" style={{ width: `${(summary.config / summary.total) * 100}%` }} />
            <div className="bg-rose-500 transition-all" style={{ width: `${(summary.missing / summary.total) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Blockers + Config required side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-4 w-4 text-rose-400" />
            <h3 className="font-serif text-base font-semibold text-foreground">Blocking launch ({blockers.length})</h3>
          </div>
          {blockers.length === 0 ? (
            <p className="font-sans text-xs text-muted-foreground">Nothing missing — every component is built.</p>
          ) : (
            <ul className="space-y-1.5">
              {blockers.map((b, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg bg-background/40 px-2.5 py-1.5">
                  <span className="font-sans text-[9px] uppercase tracking-wider text-rose-400/80 mt-0.5 shrink-0">{b.stage.split(" ")[0]}</span>
                  <div className="min-w-0">
                    <p className="font-sans text-[12px] text-foreground leading-snug">{b.label}</p>
                    {b.detail && <p className="font-sans text-[10px] text-muted-foreground leading-snug mt-0.5">{b.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="font-serif text-base font-semibold text-foreground">Manual config to flip ({configItems.length})</h3>
          </div>
          {configItems.length === 0 ? (
            <p className="font-sans text-xs text-muted-foreground">All manual config items handled.</p>
          ) : (
            <ul className="space-y-1.5">
              {configItems.map((c, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg bg-background/40 px-2.5 py-1.5">
                  <span className="font-sans text-[9px] uppercase tracking-wider text-amber-400/80 mt-0.5 shrink-0">{c.stage.split(" ")[0]}</span>
                  <div className="min-w-0">
                    <p className="font-sans text-[12px] text-foreground leading-snug">{c.label}</p>
                    {c.detail && <p className="font-sans text-[10px] text-muted-foreground leading-snug mt-0.5">{c.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick links to dashboards */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink className="h-4 w-4 text-gold" />
          <h3 className="font-serif text-sm font-semibold text-foreground">External dashboards</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="https://supabase.com/dashboard/project/bowvosskzbtuxmrwatoj/functions" target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <Server className="h-3 w-3" /> Edge Functions
          </a>
          <a href="https://supabase.com/dashboard/project/bowvosskzbtuxmrwatoj/database/tables" target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <Database className="h-3 w-3" /> Database
          </a>
          <a href="https://supabase.com/dashboard/project/bowvosskzbtuxmrwatoj/settings/functions" target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <Sparkles className="h-3 w-3" /> Function secrets
          </a>
          <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <CreditCard className="h-3 w-3" /> Stripe Webhooks
          </a>
          <a href="https://dashboard.stripe.com/settings/billing/portal" target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <CreditCard className="h-3 w-3" /> Stripe Portal config
          </a>
        </div>
      </div>

      {/* Stage grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stages.map(stage => <StageCard key={stage.id} stage={stage} />)}
      </div>
    </div>
  );
};

export default LaunchReadinessPanel;
