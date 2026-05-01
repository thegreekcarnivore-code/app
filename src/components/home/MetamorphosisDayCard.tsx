import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Lock, Sparkles, ArrowRight, Camera, Ruler } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";

type DayCard = {
  day_number: number;
  title_el: string;
  body_el: string;
  cta_label_el: string;
  cta_route: string;
  required_action: string | null;
  unlock_video_tag: string | null;
  helper_note_el: string | null;
};

type OnboardingProgress = {
  user_id: string;
  current_day: number;
  started_at: string;
  completed_at: string | null;
  day_completions: Record<string, string>;
};

const REQUIRED_ANGLES = ["front", "side", "back", "face"];

export default function MetamorphosisDayCard() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const isGreek = lang === "el";
  const [cards, setCards] = useState<DayCard[]>([]);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [baselineReady, setBaselineReady] = useState({ measurements: false, photos: 0 });
  const [busy, setBusy] = useState(false);
  const [enrollmentStart, setEnrollmentStart] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [cardsRes, progRes, enrollRes] = await Promise.all([
        (supabase.from as any)("metamorphosis_day_cards")
          .select("*")
          .order("day_number", { ascending: true }),
        (supabase.from as any)("onboarding_progress")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("client_program_enrollments")
          .select("start_date, status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (cardsRes.data) setCards(cardsRes.data as DayCard[]);
      if (progRes.data) {
        setProgress(progRes.data as OnboardingProgress);
      } else if (enrollRes.data) {
        const { data: created } = await (supabase.from as any)("onboarding_progress")
          .insert({ user_id: user.id, current_day: 1 })
          .select()
          .maybeSingle();
        if (!cancelled && created) setProgress(created as OnboardingProgress);
      }
      if (enrollRes.data?.start_date) setEnrollmentStart(enrollRes.data.start_date as string);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || !enrollmentStart) return;
    let cancelled = false;
    (async () => {
      const since = new Date(enrollmentStart);
      since.setUTCHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();
      const sinceDate = since.toISOString().slice(0, 10);

      const [{ data: meas }, { data: photos }] = await Promise.all([
        supabase
          .from("measurements")
          .select("id, weight_kg, measured_at")
          .eq("user_id", user.id)
          .gte("measured_at", sinceIso)
          .not("weight_kg", "is", null)
          .limit(1),
        supabase
          .from("progress_photos")
          .select("angle, taken_at")
          .eq("user_id", user.id)
          .gte("taken_at", sinceDate),
      ]);
      if (cancelled) return;
      const angles = new Set((photos ?? []).map((p: any) => (p.angle || "").toLowerCase()));
      const matched = REQUIRED_ANGLES.filter((a) => angles.has(a)).length;
      setBaselineReady({ measurements: (meas ?? []).length > 0, photos: matched });
    })();
    return () => { cancelled = true; };
  }, [user, enrollmentStart, progress]);

  if (!user || !progress || cards.length === 0) return null;

  const currentDay = progress.current_day || 1;
  const card = cards.find((c) => c.day_number === currentDay) ?? cards[0];
  const completed = !!progress.day_completions?.[String(card.day_number)];
  const allDone = currentDay > 7;

  const baselineComplete = baselineReady.measurements && baselineReady.photos >= 4;

  const completeDay = async () => {
    if (!user) return;
    if (card.required_action === "baseline" && !baselineComplete) return;
    setBusy(true);
    const next = Math.min(8, currentDay + 1);
    const completions = {
      ...(progress.day_completions || {}),
      [String(card.day_number)]: new Date().toISOString(),
    };
    const { data } = await (supabase.from as any)("onboarding_progress")
      .update({
        current_day: next,
        day_completions: completions,
        completed_at: next > 7 ? new Date().toISOString() : null,
      })
      .eq("user_id", user.id)
      .select()
      .maybeSingle();
    if (data) setProgress(data as OnboardingProgress);
    setBusy(false);
  };

  if (allDone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.75rem] border border-emerald-300/40 bg-emerald-50/40 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            {isGreek ? "Πρώτη εβδομάδα ολοκληρωμένη" : "Week one complete"}
          </p>
        </div>
        <h2 className="mt-2 font-serif text-xl font-semibold text-foreground">
          {isGreek ? "Συγχαρητήρια — μπήκες στον ρυθμό." : "You hit your stride."}
        </h2>
        <p className="mt-1 font-sans text-sm leading-relaxed text-muted-foreground">
          {isGreek
            ? "Από εδώ και πέρα, η εβδομαδιαία ανάλυση και οι μετρήσεις δίνουν τον τόνο. Ο Σύμβουλος είναι πάντα διαθέσιμος."
            : "From here on, weekly analysis and measurements set the rhythm. The Σύμβουλος is always available."}
        </p>
      </motion.div>
    );
  }

  const ctaDisabled = card.required_action === "baseline" && !baselineComplete;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.75rem] border border-gold/30 bg-[linear-gradient(140deg,hsl(var(--gold)/0.08),hsl(var(--background)))] p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gold/15 px-2.5 py-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            {isGreek ? `Ημέρα ${card.day_number} / 7` : `Day ${card.day_number} / 7`}
          </span>
          {completed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <Check className="h-3 w-3" /> {isGreek ? "ολοκληρωμένη" : "done"}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => {
            const done = !!progress.day_completions?.[String(n)];
            const isCurrent = n === currentDay;
            return (
              <span
                key={n}
                className={`h-1.5 w-5 rounded-full ${
                  done
                    ? "bg-gold"
                    : isCurrent
                      ? "bg-gold/40"
                      : "bg-border"
                }`}
              />
            );
          })}
        </div>
      </div>

      <h2 className="mt-3 font-serif text-xl font-semibold leading-tight text-foreground">
        {card.title_el}
      </h2>
      <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
        {card.body_el}
      </p>

      {card.required_action === "baseline" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-sans ${
              baselineReady.measurements
                ? "border-emerald-300/50 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-border bg-background/60 text-muted-foreground"
            }`}
          >
            {baselineReady.measurements ? <Check className="h-3.5 w-3.5" /> : <Ruler className="h-3.5 w-3.5" />}
            {isGreek ? "Βάρος + μέτρα" : "Weight + measures"}
          </div>
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-sans ${
              baselineReady.photos >= 4
                ? "border-emerald-300/50 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-border bg-background/60 text-muted-foreground"
            }`}
          >
            {baselineReady.photos >= 4 ? <Check className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
            {isGreek
              ? `Φωτογραφίες ${baselineReady.photos}/4`
              : `Photos ${baselineReady.photos}/4`}
          </div>
        </div>
      )}

      {card.helper_note_el && (
        <p className="mt-2 font-sans text-[11px] italic leading-relaxed text-muted-foreground/80">
          {card.helper_note_el}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          onClick={() => navigate(card.cta_route)}
          className="bg-gold text-gold-foreground hover:bg-gold/90"
        >
          {card.cta_label_el}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
        {!completed && (
          <Button
            variant="outline"
            disabled={ctaDisabled || busy}
            onClick={completeDay}
            title={ctaDisabled ? (isGreek ? "Χρειάζεται μέτρηση και 4 φωτογραφίες πρώτα" : "Need measurement + 4 photos first") : ""}
          >
            {ctaDisabled ? <Lock className="mr-1.5 h-3.5 w-3.5" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {isGreek ? "Σήμανε ως ολοκληρωμένη" : "Mark as done"}
          </Button>
        )}
      </div>
    </motion.section>
  );
}
