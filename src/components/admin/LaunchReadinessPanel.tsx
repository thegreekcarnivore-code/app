import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2, ExternalLink,
  CreditCard, FileSignature, FileText, MessageSquare, BookOpen,
  BarChart3, Sparkles, ShieldAlert, MessageCircleHeart, Camera,
  Zap, Database, Server, RefreshCw, ChevronRight, X as CloseIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Status = "ready" | "config" | "missing" | "loading";

type SubItem = {
  label: string;
  detail?: string;
  status: Status;
  ref?: string;
  whatItDoes?: string;
  verify?: string;
  nextSteps?: string[];
  link?: { href: string; label: string };
};

type Stage = {
  id: string;
  number: string;
  title: string;
  goal: string;
  description?: string;
  triggers?: string[];
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

const SUPABASE_FN_URL = "https://supabase.com/dashboard/project/bowvosskzbtuxmrwatoj/functions";
const SUPABASE_SECRETS_URL = "https://supabase.com/dashboard/project/bowvosskzbtuxmrwatoj/settings/functions";
const SUPABASE_STORAGE_URL = "https://supabase.com/dashboard/project/bowvosskzbtuxmrwatoj/storage/buckets";
const STRIPE_WEBHOOKS_URL = "https://dashboard.stripe.com/webhooks";
const STRIPE_PORTAL_URL = "https://dashboard.stripe.com/settings/billing/portal";
const STRIPE_RETRIES_URL = "https://dashboard.stripe.com/settings/billing/automatic";

const buildStages = (live: LiveCounts): Stage[] => {
  const tableReady = (n: number | null): Status =>
    live.loading ? "loading" : n === null ? "missing" : "ready";

  return [
    {
      id: "purchase",
      number: "01",
      title: "Stripe Purchase → Welcome Email",
      goal: "New member completes checkout, gets Greek welcome email with magic-login link.",
      description: "When a member pays €47/mo on the marketing page, Stripe fires checkout.session.completed → our webhook auto-creates an enrollment in client_program_enrollments + invokes send-enrollment-welcome which sends the Greek welcome email through Resend with a one-click magic login.",
      triggers: ["User clicks Subscribe on /metamorphosis", "Stripe Checkout completes successfully"],
      icon: CreditCard,
      status: "config",
      items: [
        {
          label: "create-metamorphosis-checkout edge function",
          detail: "Creates Stripe Checkout session for the €47/mo plan",
          status: "ready",
          ref: "supabase/functions/create-metamorphosis-checkout/index.ts",
          whatItDoes: "When a visitor clicks Subscribe, the frontend calls this function which generates a Stripe Checkout session URL, returns it, and the browser redirects to Stripe-hosted checkout.",
          verify: "Visit /metamorphosis → click Subscribe → confirm redirect to a checkout.stripe.com URL.",
          link: { href: SUPABASE_FN_URL, label: "Open in Supabase" },
        },
        {
          label: "stripe-webhook handles checkout.session.completed",
          detail: "Auto-enroll + initialize subscription_status=active",
          status: "ready",
          ref: "supabase/functions/stripe-webhook/index.ts",
          whatItDoes: "Stripe POSTs checkout.session.completed → we look up the user by email, insert into client_program_enrollments, set profiles.subscription_status='active', then invoke send-enrollment-welcome.",
          verify: "Use Stripe CLI: stripe trigger checkout.session.completed, then check supabase logs for the enrollment row + welcome email.",
        },
        {
          label: "send-enrollment-welcome edge function",
          detail: "Greek email + magic login link via Resend",
          status: "ready",
          ref: "supabase/functions/send-enrollment-welcome/index.ts",
          whatItDoes: "Generates a one-click magic login link via Supabase Auth admin API, formats the Greek welcome email body, and ships it through Resend to the new member.",
          verify: "After a test purchase, check the Resend dashboard for the sent email and confirm the magic link logs you straight into /home.",
        },
        {
          label: "Stripe webhook subscribed in Dashboard",
          detail: "Endpoint must include checkout.session.completed",
          status: "config",
          nextSteps: [
            "Open the Stripe Webhooks dashboard.",
            "Add an endpoint pointing to https://bowvosskzbtuxmrwatoj.supabase.co/functions/v1/stripe-webhook",
            "Subscribe at minimum to: checkout.session.completed, invoice.payment_failed, invoice.payment_succeeded, customer.subscription.updated, customer.subscription.deleted",
            "Copy the signing secret and save it as STRIPE_WEBHOOK_SECRET in Supabase function secrets.",
          ],
          link: { href: STRIPE_WEBHOOKS_URL, label: "Stripe Webhooks" },
        },
        {
          label: "RESEND_API_KEY secret set",
          detail: "Required to send the welcome email",
          status: "config",
          nextSteps: [
            "Generate or copy your Resend API key from resend.com/api-keys.",
            "Open Supabase function secrets.",
            "Add RESEND_API_KEY = re_… as a secret.",
            "No redeploy needed — Deno reads secrets at invocation time.",
          ],
          link: { href: SUPABASE_SECRETS_URL, label: "Supabase secrets" },
        },
      ],
    },
    {
      id: "policy",
      number: "02",
      title: "Policy Sign Gate",
      goal: "Every member signs the Metamorphosis terms (results-guarantee + lifestyle-coach disclaimer).",
      description: "PolicySigningGate sits in front of every protected route. If the member hasn't signed POLICY_VERSION yet, they're redirected to /policy where they read the terms, type their full name, and sign — written to the policy_signatures table.",
      triggers: ["First login after policy_version bump", "Any user who hasn't signed the current version"],
      icon: FileSignature,
      status: "config",
      items: [
        {
          label: "PolicySigningGate wraps protected routes",
          status: "ready",
          ref: "src/components/PolicySigningGate.tsx",
          whatItDoes: "On every protected route render it queries policy_signatures for the current user + current POLICY_VERSION; if no row, force-redirects to /policy.",
          verify: "Open the app as a brand-new user → confirm /policy is the only reachable page until you sign.",
        },
        {
          label: `policy_signatures table (${live.policySigsCount ?? "—"} signed)`,
          status: tableReady(live.policySigsCount),
          whatItDoes: "Stores one row per (user_id, policy_version) with full_name, signed_at, ip_hash. Used both for gating and as audit trail.",
        },
        {
          label: "Policy text v3.0 (Metamorphosis terms)",
          detail: "Bump POLICY_VERSION to 3.0 to force re-sign by every existing member",
          status: "config",
          ref: "src/pages/Policy.tsx",
          nextSteps: [
            "Edit src/pages/Policy.tsx and replace the rendered terms with the v3.0 text: 60-day results guarantee, AI-only support, lifestyle-coach disclaimer, no medical advice, no 1-on-1.",
            "Edit src/components/PolicySigningGate.tsx and bump POLICY_VERSION constant to '3.0'.",
            "Commit and deploy — every existing member will be force-redirected on next login until they sign.",
          ],
        },
      ],
    },
    {
      id: "intake",
      number: "03",
      title: "Detailed Intake Form",
      goal: "5-step intake captures goals, allergies, struggles → feeds personalization for Σύμβουλος + meal plan.",
      description: "After signing the policy, IntakeGate force-redirects every NEW enrolled member to /intake. The form has 5 steps with autosave between steps. On submit, member_intakes.completed_at is set and the member is released into the app. Existing members were backfilled so they bypass the form.",
      triggers: ["First login of a newly-enrolled member", "Manual /intake visit"],
      icon: FileText,
      status: "ready",
      items: [
        {
          label: `member_intakes table (${live.intakeCount ?? "—"} entries)`,
          status: tableReady(live.intakeCount),
          whatItDoes: "One row per user_id. Stores demographics, goals, allergies, food preferences, lifestyle, commitment fields. raw_payload JSONB holds anything not yet promoted to a column.",
        },
        {
          label: "Intake page (5 steps, autosave)",
          status: "ready",
          ref: "src/pages/Intake.tsx",
          whatItDoes: "5 steps × ~5 questions: Body, Goals, Food, Lifestyle, Commitment. Each step writes to raw_payload immediately so progress isn't lost. Submit sets completed_at.",
          verify: "Visit /intake → fill all 5 steps → submit → confirm member_intakes row has completed_at set.",
        },
        {
          label: "IntakeGate wraps protected routes",
          status: "ready",
          ref: "src/components/IntakeGate.tsx",
          whatItDoes: "Checks if the member is enrolled AND member_intakes.completed_at is null. If yes, force-redirects to /intake. Skips for admins and the allowed public paths.",
          verify: "Log in as a brand-new enrolled user → confirm any nav attempt redirects to /intake.",
        },
        {
          label: `Existing members backfilled (${live.enrollmentCount ?? "—"} enrolled)`,
          detail: "raw_payload.backfilled = true marks them",
          status: "ready",
          whatItDoes: "Migration 20260501000600 inserted a member_intakes row for every currently-enrolled user with completed_at = now() and raw_payload.backfilled=true so they don't see the gate.",
          verify: "Run: SELECT count(*) FROM member_intakes WHERE raw_payload->>'backfilled' = 'true' — should equal your enrolled member count.",
        },
      ],
    },
    {
      id: "onboarding",
      number: "04",
      title: "Day-by-Day Onboarding",
      goal: "Day 1 baseline → Day 7 first weekly review, scripted via program_template_messages.",
      description: "Reuses the existing program_templates engine. The Metamorphosis template needs Day 1–7 entries seeded that fire scheduled messages and unlock features. Day 1 forces measurements + 4 photos before Day 2 unlocks. Existing process-program-automations cron walks each enrollee through their assigned template at user-local 09:00.",
      triggers: ["Member completes intake → onboarding_progress.current_day = 1", "Daily cron at user-local 09:00"],
      icon: BookOpen,
      status: "missing",
      items: [
        {
          label: "program_templates engine + cron",
          detail: "Existing infrastructure reused as-is",
          status: "ready",
          ref: "supabase/functions/process-program-automations/index.ts",
          whatItDoes: "Cron walks each client_program_enrollment, checks the template's program_template_messages for messages whose day_offset matches days-since-start, and dispatches them via push + email.",
        },
        {
          label: "onboarding_progress table",
          status: "ready",
          whatItDoes: "Tracks per-user day completion separately from message dispatch — current_day, day_completions JSONB ({\"1\": ts, \"2\": ts, …}), last_nudge_at.",
        },
        {
          label: "Day 1–7 messages seeded for Metamorphosis template",
          detail: "Migration only created tables. No content rows yet for Day 1–7.",
          status: "missing",
          nextSteps: [
            "Create migration 20260502_seed_metamorphosis_day1_to_day7.sql",
            "INSERT 7 rows into program_template_days for the Μεταμόρφωση template (day_number 1–7)",
            "INSERT corresponding program_template_messages with day_offset 0–6, Greek copy per the lifecycle plan (Baseline / πρώτη carnivore / καταγραφή φαγητού / Σύμβουλος / weekend / κοινότητα / επισκόπηση)",
            "Push migration: supabase db push --linked",
          ],
        },
        {
          label: "Day-completion buttons on Home Σήμερα tab",
          detail: "Card UI for each day that writes to onboarding_progress.day_completions",
          status: "missing",
          ref: "src/pages/Home.tsx",
          nextSteps: [
            "Add a OnboardingDayCard component",
            "Read from onboarding_progress + the day's program_template_message",
            "Add 'Mark complete' button that bumps current_day and stamps day_completions[day]",
            "Lock future days with a soft-lock badge until current_day reaches them",
          ],
        },
        {
          label: "Day 1 forces 4 photos + measurements before unlock",
          status: "missing",
          nextSteps: [
            "On the Day 1 card check: weight_measurements has a row in last 24h AND body_photos has ≥4 in last 24h",
            "Until both are true, disable the 'Mark Day 1 complete' button + show a clear instruction",
            "On completion, optionally play the personal_videos clip tagged milestone:day_1_baseline",
          ],
        },
      ],
    },
    {
      id: "advisor",
      number: "05",
      title: "24/7 Σύμβουλος (Coach Chat)",
      goal: "Personalized advisor with intake + journey-log context, no Alex impersonation, no 1-on-1.",
      description: "concierge-chat in mode='coach' answers every member question. It pulls coach_knowledge (RAG over ebook + Fathom calls + admin messages) PLUS the user's intake fields and last 20 journey-log rows, injected as <member_context>. Hard-rules block Alex impersonation, AI/assistant naming, and 1-on-1 escalation.",
      triggers: ["Member opens /coach", "Any chat message in coach mode"],
      icon: MessageSquare,
      status: "ready",
      items: [
        {
          label: "concierge-chat coach mode + RAG",
          status: "ready",
          ref: "supabase/functions/concierge-chat/index.ts",
          whatItDoes: "Streams responses from gpt-4.1-mini with retrieved coach_knowledge chunks + member context. Logs every message to concierge_chat_history.",
        },
        {
          label: "Σύμβουλος framing (no AI/assistant naming)",
          status: "ready",
          whatItDoes: "System prompt hard-codes self-identification as 'Σύμβουλος της εφαρμογής' — never AI, never assistant, never personal name.",
          verify: "Open /coach and ask 'ποιος είσαι;' — confirm response says Σύμβουλος.",
        },
        {
          label: "<member_context> injection from intake + journey log",
          status: "ready",
          whatItDoes: "Before each LLM call we prepend goal, biggest_struggle, allergies, why_now, biggest_fear, recent journey log entries, current weight delta — so answers cite the user's own context.",
          verify: "Ask 'θυμάσαι ποιος ήταν ο μεγαλύτερος μου φόβος;' — should cite the intake's biggest_fear field.",
        },
        {
          label: "Hard rule: no 1-on-1 escalation",
          status: "ready",
          whatItDoes: "Any request for a personal call / coaching session / direct contact returns the locked Greek message pointing to info@thegreekcarnivore.com waitlist.",
          verify: "Ask 'μπορούμε να κάνουμε ένα 1-on-1 call;' — confirm exact locked response.",
        },
        {
          label: "Crisis-flag detection + safety message",
          status: "ready",
          whatItDoes: "If keywords for self-harm / ED / acute medical fire, the function logs to crisis_flags and returns a Greek safety message + helpline.",
        },
      ],
    },
    {
      id: "memory",
      number: "5b",
      title: "Per-Member Journey Memory",
      goal: "Append-only summarized log so Σύμβουλος remembers prior chats / milestones / decisions.",
      description: "After each concierge-chat exchange we run a tiny gpt-4.1-mini pass that decides if anything durable was said (milestone / struggle / preference / decision / observation) and writes a ≤200 char Greek summary to member_journey_log. Recency-ordered retrieval (no embeddings yet) feeds future chats. Triggers also fire on weight deltas and food-journal patterns.",
      triggers: ["After every concierge-chat response", "Weight delta ≥1kg or stall ≥14 days", "Weekly food-journal cron"],
      icon: Sparkles,
      status: "config",
      items: [
        {
          label: "member_journey_log table",
          status: "ready",
          whatItDoes: "Append-only log: kind, summary, source, source_ref, raw_excerpt, metadata. Indexed on (user_id, occurred_at DESC) for cheap recency retrieval.",
        },
        {
          label: "Auto-summarize after each chat exchange",
          detail: "Verify the summarization pass actually fires + writes a row",
          status: "config",
          nextSteps: [
            "Open concierge-chat and confirm the post-response summarization block exists.",
            "Test: have a chat exchange, then SELECT * FROM member_journey_log WHERE source='concierge_chat' ORDER BY occurred_at DESC LIMIT 1.",
            "If empty: verify the gpt-4.1-mini call is awaited (or fire-and-forget but logged on error).",
          ],
        },
        {
          label: "Trigger on weight delta ≥1kg",
          detail: "DB trigger not yet wired",
          status: "missing",
          nextSteps: [
            "Add migration: CREATE TRIGGER on weight_measurements AFTER INSERT",
            "Trigger function compares new weight vs. baseline (member_intakes.weight_kg) — if delta ≥1kg lost, insert a 'milestone' row into member_journey_log.",
            "Also handle the stall case: no weight loss AND ≥14 days since last journal — insert a 'struggle' row.",
          ],
        },
        {
          label: "Weekly food-journal summarizer cron",
          status: "missing",
          nextSteps: [
            "Add an edge function summarize-food-journal-week",
            "Schedule via pg_cron weekly Sunday 22:00",
            "Reads last 7 days of food_journal_entries per active user, asks gpt-4.1-mini for ONE 200-char observation, inserts into member_journey_log.",
          ],
        },
      ],
    },
    {
      id: "weekly",
      number: "06",
      title: "User-Pushed Weekly Analysis",
      goal: "Member taps once-per-week. Gated on measurements + photos in last 7 days.",
      description: "Member taps 'Πάρε την εβδομαδιαία ανάλυσή σου' on the Σήμερα tab. We verify (a) at least one weight + photo in last 7 days, (b) no existing report for this ISO week. If gates pass, gpt-4.1-mini writes a Greek markdown review (Νίκες / Σήματα προσοχής / Εστίαση / Σύσταση), saves to weekly_reports, appends a row to member_journey_log, navigates to /weekly-report.",
      triggers: ["Member taps the Weekly Analysis button on Home"],
      icon: BarChart3,
      status: "ready",
      items: [
        {
          label: "request-weekly-analysis edge function",
          status: "ready",
          ref: "supabase/functions/request-weekly-analysis/index.ts",
          whatItDoes: "Validates eligibility, pulls intake + journey log + measurements, calls gpt-4.1-mini, writes weekly_reports row, updates profiles.weekly_analysis_last_generated_at.",
        },
        {
          label: `weekly_reports table (${live.weeklyReportCount ?? "—"} generated)`,
          status: tableReady(live.weeklyReportCount),
          whatItDoes: "Stores id, user_id, iso_year, iso_week, generated_at, markdown body, summary_for_journey_log, signals JSONB.",
        },
        {
          label: "WeeklyAnalysisButton on Σήμερα tab",
          detail: "First-time popup acknowledgement + per-press confirm",
          status: "ready",
          ref: "src/components/WeeklyAnalysisButton.tsx",
          whatItDoes: "Shows a one-time mandatory acknowledgement dialog (saved to profiles.weekly_analysis_acknowledged_at) then a smaller per-press confirm before each generation.",
        },
        {
          label: "WeeklyReport page",
          status: "ready",
          ref: "src/pages/WeeklyReport.tsx",
          whatItDoes: "Read-only view of the markdown report. CTA 'Συζήτησέ το με τον Σύμβουλο' deep-links to /coach with the report context preloaded.",
        },
        {
          label: "Auto-feed journey log after generation",
          status: "ready",
          whatItDoes: "After each weekly report, summary_for_journey_log is appended to member_journey_log so future Σύμβουλος chats remember the takeaway.",
        },
      ],
    },
    {
      id: "tailored",
      number: "07",
      title: "Tailored Guidance from Intake",
      goal: "Meal plan + AI advisor read intake allergies, preferences, cooking_skill.",
      description: "Two consumers of intake data: the Σύμβουλος (already wired in Stage 5) and generate-meal-plan. The latter currently uses a generic profile — we need to verify it reads member_intakes and respects allergies, disliked_foods, eats_eggs/dairy/organs, cooking_skill.",
      triggers: ["User generates a meal plan", "Σύμβουλος chat (covered in Stage 5)"],
      icon: Zap,
      status: "config",
      items: [
        {
          label: "Σύμβουλος reads intake (Stage 5)",
          status: "ready",
          whatItDoes: "Already injected via <member_context>; see Stage 5 for verification.",
        },
        {
          label: "generate-meal-plan reads member_intakes",
          detail: "Verify allergies + dislikes + cooking_skill respected",
          status: "config",
          ref: "supabase/functions/generate-meal-plan/index.ts",
          nextSteps: [
            "Open supabase/functions/generate-meal-plan/index.ts",
            "Confirm it SELECTs from member_intakes for the calling user (allergies, disliked_foods, eats_eggs/dairy/organs, cooking_skill).",
            "Patch the prompt to: filter recipes against allergies, exclude disliked_foods, scale technique to cooking_skill.",
            "Test by setting allergies=['αυγά'] in intake → generate plan → confirm zero egg recipes returned.",
          ],
        },
      ],
    },
    {
      id: "feedback",
      number: "08",
      title: "Feedback / Ideas Collection",
      goal: "Floating button on every page → category + message → Telegram ping to Alex.",
      description: "Low-friction way for members to send feedback without expecting Alex to reply personally. Categories: idea, bug, content_request, praise, complaint. Stored in member_feedback. Telegram/Discord ping fires via OpenClaw on insert.",
      triggers: ["Member taps the floating feedback button on any auth page"],
      icon: MessageCircleHeart,
      status: "config",
      items: [
        {
          label: "FeedbackButton (floating, all auth pages)",
          status: "ready",
          ref: "src/components/FeedbackButton.tsx",
          whatItDoes: "Floating bottom-right button (z-40) opens a modal with category select + textarea + optional screenshot. Hidden on /auth, /policy, /intake, /billing.",
        },
        {
          label: `member_feedback table (${live.feedbackCount ?? "—"} entries)`,
          status: tableReady(live.feedbackCount),
          whatItDoes: "Stores id, user_id, category, message, screenshot_url, status (open/reviewing/planned/shipped/declined), admin_response.",
        },
        {
          label: "OpenClaw → Telegram/Discord ping wired",
          detail: "notify-admin-feedback edge function + webhook URL",
          status: "config",
          nextSteps: [
            "Reuse the existing OpenClaw notifier (per memory reference_openclaw.md).",
            "Add a notify-admin-feedback edge function OR a DB trigger that POSTs to OpenClaw on member_feedback insert.",
            "Payload: category + first 200 chars of message + user email.",
          ],
        },
        {
          label: "Admin Feedback tab",
          detail: "Sortable list, status updates, optional in-app reply",
          status: "missing",
          nextSteps: [
            "Add a 'Feedback' tab in Admin.tsx after Programs.",
            "Build FeedbackInbox component: list with category filters + status dropdown.",
            "Allow updating status + writing admin_response which sends an in-app message back to the user.",
          ],
        },
      ],
    },
    {
      id: "lockout",
      number: "09",
      title: "Failed Payment → App Lockout",
      goal: "Card fails → SubscriptionGate locks app until member updates billing.",
      description: "Stripe smart-retries handle the grace window. On invoice.payment_failed we flip subscription_status to past_due → SubscriptionGate shows the full-screen lockout with a Customer Portal link. On invoice.payment_succeeded after past_due we restore access. process-program-automations skips inactive subscribers.",
      triggers: ["Stripe invoice.payment_failed", "Stripe invoice.payment_succeeded", "Stripe customer.subscription.updated/deleted"],
      icon: ShieldAlert,
      status: "config",
      items: [
        {
          label: "stripe-webhook handles invoice.payment_failed",
          status: "ready",
          ref: "supabase/functions/stripe-webhook/index.ts",
          whatItDoes: "Sets profiles.subscription_status='past_due' + client_program_enrollments.status='past_due' + sends gentle Greek dunning email with portal link.",
        },
        {
          label: "stripe-webhook handles invoice.payment_succeeded",
          detail: "Auto-restore + welcome-back email after past_due",
          status: "ready",
          whatItDoes: "If prior status was past_due, flips back to active and sends 'καλωσόρισες πίσω' email. Σύμβουλος also greets them on next /coach visit.",
        },
        {
          label: "stripe-webhook handles customer.subscription.updated/deleted",
          status: "ready",
          whatItDoes: "updated with status=past_due is idempotent with payment_failed. deleted sets status=canceled and locks the user with a 'reactivate' CTA.",
        },
        {
          label: "create-customer-portal-session edge function",
          status: "ready",
          ref: "supabase/functions/create-customer-portal-session/index.ts",
          whatItDoes: "Generates a Stripe Customer Portal URL so the member can update their card / cancel / view invoices, with return_url=/billing.",
        },
        {
          label: `SubscriptionGate (${live.pastDueCount ?? 0} past_due now)`,
          status: "ready",
          ref: "src/components/SubscriptionGate.tsx",
          whatItDoes: "Full-screen Greek lockout when subscription_status is past_due/canceled. Allows /billing, /policy, /auth, /metamorphosis. Admins bypass.",
        },
        {
          label: "Stripe Customer Portal enabled in Dashboard",
          status: "config",
          nextSteps: [
            "Open Stripe Dashboard → Settings → Billing → Customer portal.",
            "Enable: update payment method, cancel subscription, view invoices.",
            "Set the return URL to https://app.thegreekcarnivore.com/billing.",
            "Save.",
          ],
          link: { href: STRIPE_PORTAL_URL, label: "Stripe Portal config" },
        },
        {
          label: "Stripe smart-retries enabled (3 retries / 21 days)",
          status: "config",
          nextSteps: [
            "Open Stripe → Settings → Billing → Subscriptions and emails → Failed payment retries.",
            "Enable Smart Retries.",
            "Confirm 'Email customer when card is declined' is on.",
          ],
          link: { href: STRIPE_RETRIES_URL, label: "Stripe retries config" },
        },
        {
          label: "STRIPE_CUSTOMER_PORTAL_RETURN_URL secret set",
          status: "config",
          nextSteps: [
            "In Supabase function secrets add STRIPE_CUSTOMER_PORTAL_RETURN_URL = https://app.thegreekcarnivore.com/billing",
            "create-customer-portal-session reads this on each invocation.",
          ],
          link: { href: SUPABASE_SECRETS_URL, label: "Supabase secrets" },
        },
        {
          label: "process-program-automations filters past_due users",
          detail: "Verify cron skips inactive subscribers",
          status: "config",
          ref: "supabase/functions/process-program-automations/index.ts",
          nextSteps: [
            "Open the function, find the main loop over enrollments.",
            "Add a join/filter to exclude users where profiles.subscription_status != 'active'.",
            "Past_due users get NO new content — read-only view of past content only.",
          ],
        },
      ],
    },
    {
      id: "testimonials",
      number: "9b",
      title: "Testimonial Pipeline → Reels App",
      goal: "Detect wins → request consent → render card → push to reels.thegreekcarnivore.com.",
      description: "Weekly cron scans last 7 days of chat / posts / measurements for quotable wins, creates testimonial_candidates rows. Admin reviews, requests consent, renders an SVG card on grant, pushes the asset to ReelForge ingest. Hard rule: nothing pushes without consent_granted_at.",
      triggers: ["Weekly cron Sunday 22:00 (detect-testimonials)", "Admin click in Ιστορίες πελατών tab"],
      icon: Camera,
      status: "config",
      items: [
        {
          label: `testimonial_candidates table (${live.testimonialCandidatesCount ?? "—"} entries)`,
          status: tableReady(live.testimonialCandidatesCount),
          whatItDoes: "Stores detected wins + consent state + render output URL + reels-app asset id. Source dedupes on (user_id, source, source_ref).",
        },
        {
          label: "detect-testimonials edge function",
          detail: "Cron weekly Sunday 22:00 — needs scheduling",
          status: "config",
          ref: "supabase/functions/detect-testimonials/index.ts",
          nextSteps: [
            "In Supabase Dashboard → Database → Cron, add a new pg_cron schedule.",
            "Schedule: 0 22 * * 0 (every Sunday 22:00 UTC).",
            "Job: SELECT supabase_functions.http_request to invoke detect-testimonials.",
          ],
        },
        {
          label: "request-testimonial-consent edge function",
          status: "ready",
          ref: "supabase/functions/request-testimonial-consent/index.ts",
          whatItDoes: "Admin invokes with candidate_id → updates consent_status='requested' + sends Greek email asking ΣΥΜΦΩΝΩ / ΌΧΙ.",
        },
        {
          label: "render-testimonial-card edge function (1080×1920 SVG)",
          status: "ready",
          ref: "supabase/functions/render-testimonial-card/index.ts",
          whatItDoes: "Generates a 1080×1920 SVG: gold ΜΕΤΑΜΟΡΦΩΣΗ wordmark + member quote (wrapped) + stat badge (kg lost / days) + attribution (first name or 'Μέλος της Μεταμόρφωσης' if anonymous). Uploads to testimonial-cards bucket.",
        },
        {
          label: "push-to-reels-app edge function (consent-gated)",
          status: "ready",
          ref: "supabase/functions/push-to-reels-app/index.ts",
          whatItDoes: "Hard-gates on consent_status='granted' + consent_granted_at set. POSTs the asset URL + metadata to ReelForge ingest with brand='the_greek_carnivore'.",
        },
        {
          label: "REELS_APP_INGEST_URL + REELS_APP_API_KEY secrets",
          status: "config",
          nextSteps: [
            "Coordinate with the ReelForge codebase to confirm the ingest endpoint contract.",
            "Add REELS_APP_INGEST_URL and REELS_APP_API_KEY in Supabase function secrets.",
          ],
          link: { href: SUPABASE_SECRETS_URL, label: "Supabase secrets" },
        },
        {
          label: "testimonial-cards storage bucket",
          detail: "Create bucket + public read policy",
          status: "config",
          nextSteps: [
            "Open Supabase Storage.",
            "Create a public bucket named testimonial-cards.",
            "Add a RLS policy: 'Public read' for SELECT on testimonial-cards.",
            "render-testimonial-card uploads to {user_id}/{candidate_id}.svg.",
          ],
          link: { href: SUPABASE_STORAGE_URL, label: "Supabase storage" },
        },
        {
          label: "Admin 'Ιστορίες πελατών' tab",
          status: "missing",
          nextSteps: [
            "Add a Testimonials tab in Admin.tsx.",
            "List testimonial_candidates with consent status + preview card.",
            "Buttons: request consent, regenerate card, approve + push to reels app, reject.",
            "Hard-disable push button unless consent_status='granted'.",
          ],
        },
        {
          label: "Cron schedule for detect-testimonials (weekly)",
          status: "missing",
          nextSteps: [
            "After enabling the function, schedule via pg_cron (see detect-testimonials item above).",
            "Verify: confirm one full cycle runs and candidates appear before launch.",
          ],
        },
      ],
    },
    {
      id: "reactivation",
      number: "10",
      title: "Reactivation on Payment Resume",
      goal: "past_due → active flips automatically; cancel → reactivate flow preserves intake.",
      description: "When a past-due card recovers, invoice.payment_succeeded restores access and sends a welcome-back email. If the member fully canceled and later re-subscribes, checkout.session.completed handles them as new — but their existing member_intakes and policy_signatures rows are preserved so they don't redo the intake. onboarding_progress.current_day is reset to 1 to give a fresh re-orientation.",
      triggers: ["invoice.payment_succeeded after past_due", "checkout.session.completed for a previously canceled customer"],
      icon: RefreshCw,
      status: "ready",
      items: [
        {
          label: "invoice.payment_succeeded after past_due restores enrollment",
          status: "ready",
          whatItDoes: "Webhook flips subscription_status back to active, removes the SubscriptionGate lockout on next nav.",
        },
        {
          label: "Welcome-back email sent on resume",
          status: "ready",
          whatItDoes: "Greek email + Σύμβουλος in-app message: 'χαίρομαι που γύρισες, ξεκινάμε από εκεί που σταματήσαμε'.",
        },
        {
          label: "checkout.session.completed reactivation preserves intake + policy_signatures",
          status: "ready",
          whatItDoes: "On re-subscribe after a full cancel, we never wipe member_intakes or policy_signatures. We do reset onboarding_progress.current_day=1 for a clean restart.",
        },
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

const StageCard = ({ stage, onOpen }: { stage: Stage; onOpen: () => void }) => {
  const Icon = stage.icon;
  const meta = STATUS_META[stage.status];
  const counts = useMemo(() => {
    const ready = stage.items.filter(i => i.status === "ready").length;
    return { ready, total: stage.items.length };
  }, [stage]);
  const pct = Math.round((counts.ready / counts.total) * 100);
  const open = stage.items.filter(i => i.status !== "ready").length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left transition-all hover:shadow-lg hover:ring-1 ${meta.ring} focus:outline-none focus:ring-2`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.cls}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Stage {stage.number}</p>
            <h3 className="font-serif text-base font-semibold text-foreground leading-tight truncate">{stage.title}</h3>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusPill status={stage.status} />
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      <p className="mt-3 font-sans text-xs leading-relaxed text-muted-foreground line-clamp-2">{stage.goal}</p>

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

      <div className="mt-4 flex flex-wrap gap-1.5">
        {stage.items.slice(0, 4).map((item, idx) => {
          const im = STATUS_META[item.status];
          return (
            <span key={idx} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-sans text-[10px] ${im.cls}`}>
              <im.Icon className={`h-2.5 w-2.5 ${item.status === "loading" ? "animate-spin" : ""}`} />
              <span className="truncate max-w-[160px]">{item.label.split("(")[0].trim()}</span>
            </span>
          );
        })}
        {stage.items.length > 4 && (
          <span className="inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
            +{stage.items.length - 4} more
          </span>
        )}
      </div>

      {open > 0 && (
        <div className="mt-3 flex items-center gap-1.5 font-sans text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Click to open</span>
          <span>·</span>
          <span>{open} item{open === 1 ? "" : "s"} need{open === 1 ? "s" : ""} attention</span>
        </div>
      )}
    </button>
  );
};

const StageDetailSheet = ({ stage, onClose }: { stage: Stage | null; onClose: () => void }) => {
  if (!stage) return null;
  const Icon = stage.icon;
  const meta = STATUS_META[stage.status];

  return (
    <Sheet open={!!stage} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${meta.cls}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="space-y-1 flex-1">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Stage {stage.number}</p>
              <SheetTitle className="font-serif text-xl leading-tight">{stage.title}</SheetTitle>
              <div className="pt-1"><StatusPill status={stage.status} /></div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Goal + description */}
          <section>
            <p className="font-sans text-xs font-semibold uppercase tracking-wider text-gold mb-2">Goal</p>
            <p className="font-sans text-sm leading-relaxed text-foreground">{stage.goal}</p>
            {stage.description && (
              <p className="font-sans text-sm leading-relaxed text-muted-foreground mt-3">{stage.description}</p>
            )}
          </section>

          {/* Triggers */}
          {stage.triggers && stage.triggers.length > 0 && (
            <section>
              <p className="font-sans text-xs font-semibold uppercase tracking-wider text-gold mb-2">Triggers</p>
              <ul className="space-y-1.5">
                {stage.triggers.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 font-sans text-sm text-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Items detailed */}
          <section className="space-y-3">
            <p className="font-sans text-xs font-semibold uppercase tracking-wider text-gold">Components ({stage.items.length})</p>
            {stage.items.map((item, idx) => {
              const im = STATUS_META[item.status];
              return (
                <div key={idx} className={`rounded-xl border bg-card p-4 ${item.status === "missing" ? "border-rose-500/30" : item.status === "config" ? "border-amber-500/30" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <im.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.status === "ready" ? "text-emerald-500" : item.status === "config" ? "text-amber-500" : item.status === "missing" ? "text-rose-500" : "text-muted-foreground animate-spin"}`} />
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-semibold text-foreground leading-snug">{item.label}</p>
                        {item.detail && <p className="font-sans text-xs text-muted-foreground leading-snug mt-0.5">{item.detail}</p>}
                      </div>
                    </div>
                    <StatusPill status={item.status} dense />
                  </div>

                  {item.ref && (
                    <p className="font-mono text-[11px] text-muted-foreground/80 mt-1 mb-2 truncate">{item.ref}</p>
                  )}

                  {item.whatItDoes && (
                    <div className="mt-2">
                      <p className="font-sans text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">What it does</p>
                      <p className="font-sans text-xs leading-relaxed text-foreground/90">{item.whatItDoes}</p>
                    </div>
                  )}

                  {item.verify && (
                    <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                      <p className="font-sans text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-1">How to verify</p>
                      <p className="font-sans text-xs leading-relaxed text-foreground/90">{item.verify}</p>
                    </div>
                  )}

                  {item.nextSteps && item.nextSteps.length > 0 && (
                    <div className={`mt-3 rounded-lg border p-2.5 ${item.status === "missing" ? "border-rose-500/20 bg-rose-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                      <p className={`font-sans text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${item.status === "missing" ? "text-rose-500" : "text-amber-500"}`}>
                        {item.status === "missing" ? "What's missing — to do" : "Manual config — to do"}
                      </p>
                      <ol className="space-y-1.5 list-decimal list-inside">
                        {item.nextSteps.map((s, i) => (
                          <li key={i} className="font-sans text-xs leading-relaxed text-foreground/90">{s}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {item.link && (
                    <a
                      href={item.link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {item.link.label}
                    </a>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const LaunchReadinessPanel = () => {
  const live = useLiveCounts();
  const stages = useMemo(() => buildStages(live).map(recomputeStageStatus), [live]);
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const openStage = stages.find(s => s.id === openStageId) ?? null;

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

  const blockers = stages.flatMap(s => s.items.filter(i => i.status === "missing").map(i => ({ stageId: s.id, stage: s.title, ...i })));
  const configItems = stages.flatMap(s => s.items.filter(i => i.status === "config").map(i => ({ stageId: s.id, stage: s.title, ...i })));

  return (
    <div className="space-y-6">
      {/* Hero summary */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">Launch Readiness</p>
            <h2 className="font-serif text-2xl font-semibold text-foreground">Μεταμόρφωση €47/mo Pipeline</h2>
            <p className="font-sans text-sm text-muted-foreground max-w-xl">
              The full A-to-Z lifecycle: Stripe purchase → Policy → Intake → Onboarding → Σύμβουλος → Weekly analysis → Feedback → Lockout → Reactivation → Testimonials. Click any stage to drill into details.
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
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setOpenStageId(b.stageId)}
                    className="w-full flex items-start gap-2 rounded-lg bg-background/40 px-2.5 py-1.5 text-left hover:bg-background/70 transition-colors"
                  >
                    <span className="font-sans text-[9px] uppercase tracking-wider text-rose-400/80 mt-0.5 shrink-0">{b.stage.split(" ")[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[12px] text-foreground leading-snug">{b.label}</p>
                      {b.detail && <p className="font-sans text-[10px] text-muted-foreground leading-snug mt-0.5">{b.detail}</p>}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  </button>
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
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setOpenStageId(c.stageId)}
                    className="w-full flex items-start gap-2 rounded-lg bg-background/40 px-2.5 py-1.5 text-left hover:bg-background/70 transition-colors"
                  >
                    <span className="font-sans text-[9px] uppercase tracking-wider text-amber-400/80 mt-0.5 shrink-0">{c.stage.split(" ")[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[12px] text-foreground leading-snug">{c.label}</p>
                      {c.detail && <p className="font-sans text-[10px] text-muted-foreground leading-snug mt-0.5">{c.detail}</p>}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  </button>
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
          <a href={SUPABASE_FN_URL} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <Server className="h-3 w-3" /> Edge Functions
          </a>
          <a href="https://supabase.com/dashboard/project/bowvosskzbtuxmrwatoj/database/tables" target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <Database className="h-3 w-3" /> Database
          </a>
          <a href={SUPABASE_SECRETS_URL} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <Sparkles className="h-3 w-3" /> Function secrets
          </a>
          <a href={STRIPE_WEBHOOKS_URL} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <CreditCard className="h-3 w-3" /> Stripe Webhooks
          </a>
          <a href={STRIPE_PORTAL_URL} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-[11px] text-foreground hover:bg-muted">
            <CreditCard className="h-3 w-3" /> Stripe Portal config
          </a>
        </div>
      </div>

      {/* Stage grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stages.map(stage => <StageCard key={stage.id} stage={stage} onOpen={() => setOpenStageId(stage.id)} />)}
      </div>

      <StageDetailSheet stage={openStage} onClose={() => setOpenStageId(null)} />
    </div>
  );
};

export default LaunchReadinessPanel;
