import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { usePageActions } from "@/context/PageActionsContext";
import { motion } from "framer-motion";
import { addWeeks, differenceInCalendarDays, format } from "date-fns";
import { el, enUS } from "date-fns/locale";
import {
  UtensilsCrossed,
  BookOpen,
  HeartPulse,
  Camera,
  Ruler,
  ArrowRight,
  CalendarDays,
  MessageCircle,
} from "lucide-react";
import DailyTasksCard from "@/components/DailyTasksCard";
import ProgramProgressBar from "@/components/ProgramProgressBar";
import FoodEntryForm from "@/components/measurements/FoodEntryForm";
import MeasurementForm from "@/components/measurements/MeasurementForm";
import WellnessJournal from "@/components/measurements/WellnessJournal";

interface RecipeCategory {
  key: string;
  label_el: string;
  label_en: string;
  color_from: string;
  color_to: string;
  cover_image_url: string | null;
  sort_order: number;
}

interface ProgramSnapshot {
  start_date: string;
  weekly_day: number | null;
  duration_weeks_override: number | null;
  program_template: {
    name: string;
    duration_weeks: number;
  } | null;
}

interface WeeklyCheckInPreview {
  summary: string;
  coach_message: string;
  due_at: string;
  week_end: string;
}

interface CoachMessagePreview {
  content: string;
  created_at: string;
}

const Home = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const isGreek = lang === "el";
  const [displayName, setDisplayName] = useState("");
  const [vocativeName, setVocativeName] = useState("");
  const [recipeBooks, setRecipeBooks] = useState<RecipeCategory[]>([]);
  const [recipeCounts, setRecipeCounts] = useState<Record<string, number>>({});
  const [programSnapshot, setProgramSnapshot] = useState<ProgramSnapshot | null>(null);
  const [weeklyPreview, setWeeklyPreview] = useState<WeeklyCheckInPreview | null>(null);
  const [coachMessage, setCoachMessage] = useState<CoachMessagePreview | null>(null);
  const [foodFormOpen, setFoodFormOpen] = useState(false);
  const [measurementFormOpen, setMeasurementFormOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const { registerActions, clearActions } = usePageActions();

  useEffect(() => {
    registerActions({ featureKey: "home", featureLabel: "Home" });
    return () => clearActions();
  }, [registerActions, clearActions]);

  useEffect(() => {
    if (!user) return;

    const loadHomeData = async () => {
      const [
        profileRes,
        categoriesRes,
        recipeRes,
        enrollmentRes,
        weeklyRes,
        messageRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, vocative_name_el")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("recipe_categories")
          .select("*")
          .order("sort_order"),
        supabase
          .from("recipes" as any)
          .select("category"),
        supabase
          .from("client_program_enrollments")
          .select("start_date, weekly_day, duration_weeks_override, program_template:program_templates(name, duration_weeks)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("weekly_check_ins" as any)
          .select("summary, coach_message, due_at, week_end")
          .eq("user_id", user.id)
          .order("due_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("content, created_at")
          .eq("receiver_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const profileData = profileRes.data;
      if (profileData?.display_name) setDisplayName(profileData.display_name);
      if ((profileData as any)?.vocative_name_el) {
        setVocativeName((profileData as any).vocative_name_el);
      } else if (profileData?.display_name) {
        const firstName = profileData.display_name.split(" ")[0];
        supabase.functions.invoke("get-vocative-name", {
          body: { name: firstName },
        }).then(({ data: vocData }) => {
          if (vocData?.vocative) {
            setVocativeName(vocData.vocative);
            supabase.from("profiles").update({ vocative_name_el: vocData.vocative } as any).eq("id", user.id).then();
          }
        });
      }

      if (categoriesRes.data) {
        setRecipeBooks(categoriesRes.data as any[]);
      }

      if (recipeRes.data) {
        const counts: Record<string, number> = {};
        (recipeRes.data as any[]).forEach((r) => {
          const cat = r.category || "carnivore";
          counts[cat] = (counts[cat] || 0) + 1;
        });
        setRecipeCounts(counts);
      }

      if (enrollmentRes.data) {
        const rawEnrollment = enrollmentRes.data as any;
        const template = Array.isArray(rawEnrollment.program_template)
          ? rawEnrollment.program_template[0]
          : rawEnrollment.program_template;

        setProgramSnapshot({
          start_date: rawEnrollment.start_date,
          weekly_day: rawEnrollment.weekly_day ?? null,
          duration_weeks_override: rawEnrollment.duration_weeks_override ?? null,
          program_template: template && typeof template === "object" ? template : null,
        });
      } else {
        setProgramSnapshot(null);
      }

      setWeeklyPreview((weeklyRes.data as WeeklyCheckInPreview | null) ?? null);
      setCoachMessage((messageRes.data as CoachMessagePreview | null) ?? null);
    };

    loadHomeData();
  }, [user]);

  const today = new Date();
  const dateStr = format(today, "EEEE, d MMMM", { locale: isGreek ? el : enUS });
  const firstName = displayName?.split(" ")[0] || "";
  const totalWeeks = programSnapshot
    ? programSnapshot.duration_weeks_override ?? programSnapshot.program_template?.duration_weeks ?? null
    : null;
  const currentWeek = programSnapshot && totalWeeks
    ? Math.max(1, Math.min(totalWeeks, Math.floor(differenceInCalendarDays(today, new Date(programSnapshot.start_date)) / 7) + 1))
    : null;
  const programEndDate = programSnapshot && totalWeeks
    ? addWeeks(new Date(programSnapshot.start_date), totalWeeks)
    : null;
  const nextCheckInDate = programSnapshot?.weekly_day === null || programSnapshot?.weekly_day === undefined
    ? null
    : (() => {
        const next = new Date(today);
        next.setHours(20, 0, 0, 0);
        let delta = (programSnapshot.weekly_day - today.getDay() + 7) % 7;
        if (delta === 0 && next.getTime() <= today.getTime()) delta = 7;
        next.setDate(today.getDate() + delta);
        return next;
      })();
  const nextCheckInLabel = nextCheckInDate
    ? format(nextCheckInDate, "EEEE, d MMM", { locale: isGreek ? el : enUS })
    : null;
  const latestCoachGuidance = coachMessage?.content || weeklyPreview?.coach_message || weeklyPreview?.summary || "";
  const coachGuidanceDate = coachMessage?.created_at || weeklyPreview?.due_at || null;
  const quickActions = [
    {
      key: "food",
      icon: UtensilsCrossed,
      label: isGreek ? "Καταγραφή Φαγητού" : "Log Food",
      hint: isGreek ? "Πρόσθεσε το σημερινό σου γεύμα" : "Add today's meal entry",
      onClick: () => setFoodFormOpen(true),
    },
    {
      key: "measurement",
      icon: Ruler,
      label: isGreek ? "Νέα Μέτρηση" : "New Measurement",
      hint: isGreek ? "Ενημέρωσε πρόοδο και στατιστικά" : "Update progress and stats",
      onClick: () => setMeasurementFormOpen(true),
    },
    {
      key: "photos",
      icon: Camera,
      label: isGreek ? "Φωτογραφίες Προόδου" : "Progress Photos",
      hint: isGreek ? "Άνοιξε το φωτογραφικό check-in" : "Open the photo check-in",
      onClick: () => navigate("/measurements?tab=photos"),
    },
    {
      key: "journal",
      icon: HeartPulse,
      label: isGreek ? "Ημερήσιο Check-In" : "Daily Check-In",
      hint: isGreek
        ? "Κατέγραψε συμπτώματα, ενέργεια, σκέψεις και αντιδράσεις."
        : "Record symptoms, energy, thoughts, and reactions.",
      onClick: () => setJournalOpen(true),
    },
  ];

  const resolveThemeColor = (value: string) => {
    if (!value) return "hsl(var(--muted))";
    if (value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl") || value.startsWith("var(")) {
      return value;
    }
    return `hsl(var(--${value}))`;
  };

  return (
    <div className="px-4 pb-20 pt-10 md:px-5 md:pt-12 space-y-4 md:space-y-5">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[2rem] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--beige))_0%,hsl(var(--background))_100%)] p-4 md:p-5 shadow-sm"
      >
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[0.9fr,1.1fr] lg:items-start">
            <div className="space-y-1.5">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.24em] text-gold">
                {isGreek ? "Το coaching dashboard σου" : "Your coaching dashboard"}
              </p>
              <h1 className="font-serif text-3xl font-semibold text-foreground">
                {isGreek ? `Γεια σου ${vocativeName || firstName}` : `Hello, ${firstName}`}!
              </h1>
              <p className="font-sans text-sm text-muted-foreground capitalize">{dateStr}</p>
              <p className="max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
                {isGreek
                  ? "Ξεκίνα από τις σημερινές σου προτεραιότητες, κράτα καθαρή εικόνα του προγράμματος και δες την τελευταία καθοδήγηση χωρίς να ψάχνεις μέσα στην εφαρμογή."
                  : "Start from today's priorities, keep the program state clear, and see the latest guidance without hunting through the app."}
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-border/70 bg-background/85 p-4 shadow-sm">
              <div className="space-y-1">
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  {isGreek ? "Σημερινή Εστίαση" : "Today's Focus"}
                </h2>
                <p className="font-sans text-sm text-muted-foreground">
                  {isGreek
                    ? "Ολοκλήρωσε πρώτα τα βασικά βήματα που κρατούν το πρόγραμμα σε ρυθμό."
                    : "Clear the core actions first so your coaching rhythm stays intact."}
                </p>
              </div>
              <div className="mt-3">
                <DailyTasksCard
                  onOpenFoodForm={() => setFoodFormOpen(true)}
                  onOpenMeasurements={() => setMeasurementFormOpen(true)}
                  onOpenPhotos={() => navigate("/measurements?tab=photos")}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.05fr,0.95fr] lg:items-start">
            <div className="rounded-[1.75rem] border border-gold/20 bg-background/85 p-4 h-fit">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                {isGreek ? "Τρέχουσα φάση" : "Current phase"}
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground">
                {programSnapshot?.program_template?.name || (isGreek ? "Το πρόγραμμά σου" : "Your coaching plan")}
              </h2>
              <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
                {currentWeek && totalWeeks
                  ? isGreek
                    ? `Βρίσκεσαι στην εβδομάδα ${currentWeek} από ${totalWeeks}. Η συνέπεια αυτής της εβδομάδας θα καθορίσει πόσο χρήσιμο θα είναι το επόμενο review.`
                    : `You are in week ${currentWeek} of ${totalWeeks}. The consistency of this week will shape how useful the next review becomes.`
                  : isGreek
                    ? "Το πρόγραμμα, οι καθημερινές ενέργειες και οι μετρήσεις σου συγκεντρώνονται εδώ."
                    : "Your program, daily actions, and progress tracking come together here."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {currentWeek && totalWeeks && (
                  <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-sans font-medium text-foreground">
                    {isGreek ? `Εβδομάδα ${currentWeek}/${totalWeeks}` : `Week ${currentWeek}/${totalWeeks}`}
                  </span>
                )}
                {programEndDate && (
                  <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-sans font-medium text-foreground">
                    {isGreek ? `Έως ${format(programEndDate, "d MMM", { locale: el })}` : `Through ${format(programEndDate, "d MMM", { locale: enUS })}`}
                  </span>
                )}
                {nextCheckInLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-sans font-medium text-foreground">
                    <CalendarDays className="h-3.5 w-3.5 text-gold" />
                    {nextCheckInLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-border/70 bg-card/80 p-4 h-fit">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                {isGreek ? "Γρήγορες κινήσεις" : "Quick actions"}
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {quickActions.map(({ key, icon: Icon, label, hint, onClick }) => (
                  <button
                    key={key}
                    onClick={onClick}
                    className="rounded-2xl border border-border/70 bg-background/80 p-3.5 text-left transition-all hover:border-gold/40 hover:shadow-sm"
                  >
                    <div className="mb-2.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-sans text-sm font-semibold text-foreground">{label}</p>
                    <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">{hint}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <ProgramProgressBar />
      </motion.div>

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="grid gap-3 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-[1.75rem] border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gold/10 text-gold">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                {isGreek ? "Τελευταία καθοδήγηση" : "Latest coach guidance"}
              </p>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                {latestCoachGuidance
                  ? (isGreek ? "Τι κρατάμε τώρα" : "What to keep in focus")
                  : (isGreek ? "Η καθοδήγησή σου θα εμφανιστεί εδώ" : "Your coach guidance will appear here")}
              </h2>
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                {latestCoachGuidance
                  ? latestCoachGuidance
                  : isGreek
                    ? "Μόλις φτάσει νέο μήνυμα ή εβδομαδιαίο check-in, θα εμφανιστεί εδώ πρώτο για να μην το ψάχνεις μέσα στην εφαρμογή."
                    : "As soon as a new coach message or weekly review arrives, it will appear here first so you do not have to search for it."}
              </p>
              {coachGuidanceDate && (
                <p className="font-sans text-xs text-muted-foreground">
                  {isGreek ? "Τελευταία ενημέρωση:" : "Last update:"} {format(new Date(coachGuidanceDate), "d MMM yyyy", { locale: isGreek ? el : enUS })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-gold/20 bg-background/80 p-4">
          <div className="space-y-2">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              {isGreek ? "Επόμενο accountability step" : "Next accountability step"}
            </p>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              {nextCheckInLabel
                ? (isGreek ? "Κράτα έτοιμο το εβδομαδιαίο σου review" : "Keep your next weekly review ready")
                : (isGreek ? "Μην αφήσεις κενά στα δεδομένα σου" : "Do not let your data go cold")}
            </h2>
            <p className="font-sans text-sm leading-relaxed text-muted-foreground">
              {nextCheckInLabel
                ? isGreek
                  ? `Το επόμενο check-in αναμένεται ${nextCheckInLabel}. Βάλε μετρήσεις, φωτογραφίες και food logs πριν από τότε για πιο ουσιαστικό feedback.`
                  : `Your next check-in is expected ${nextCheckInLabel}. Add measurements, photos, and food logs before then for stronger feedback.`
                : isGreek
                  ? "Άνοιξε τις μετρήσεις και κράτα σώμα, φαγητό και φωτογραφίες ενημερωμένα για να έχει νόημα το coaching review."
                  : "Open measurements and keep body, food, and photos updated so your coaching review stays meaningful."}
            </p>
            <button
              onClick={() => navigate("/measurements")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3 py-2 font-sans text-xs font-semibold text-gold-foreground transition-all hover:opacity-90"
            >
              {isGreek ? "Άνοιγμα μετρήσεων" : "Open measurements"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="space-y-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-base font-semibold text-foreground">
              {isGreek ? "Βιβλία Συνταγών" : "Recipe Books"}
            </h2>
          </div>
          <p className="font-sans text-sm text-muted-foreground">
            {isGreek ? "Άνοιξε γρήγορα το σωστό βιβλίο για το επόμενο γεύμα ή για πιο εύκολη εκτέλεση μέσα στην εβδομάδα." : "Jump into the right recipe collection for the next meal or to make the week easier to execute."}
          </p>
        </div>
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          {recipeBooks.map((book, i) => {
            const count = recipeCounts[book.key] || 0;
            return (
              <motion.button
                key={book.key}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                onClick={() => navigate(`/resources?category=${book.key}`)}
                className="flex-shrink-0 w-36 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow"
              >
                {book.cover_image_url ? (
                  <div className="relative h-44">
                    <img src={book.cover_image_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-left space-y-1">
                      <p className="font-serif text-sm font-semibold leading-tight">
                        {isGreek ? book.label_el : book.label_en}
                      </p>
                      <p className="font-sans text-[10px] opacity-80">
                        {count} {isGreek ? "συνταγές" : "recipes"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex h-44 flex-col justify-between p-4 text-white"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${resolveThemeColor(book.color_from)}, ${resolveThemeColor(book.color_to)})`,
                    }}
                  >
                    <div className="text-left space-y-1">
                      <p className="font-serif text-sm font-semibold leading-tight">
                        {isGreek ? book.label_el : book.label_en}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-sans text-[10px] opacity-80">
                        {count} {isGreek ? "συνταγές" : "recipes"}
                      </p>
                    </div>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      </motion.section>

      <FoodEntryForm
        open={foodFormOpen}
        onOpenChange={setFoodFormOpen}
        editEntry={null}
        mealType="breakfast"
        userId={user?.id || ""}
        date={format(today, "yyyy-MM-dd")}
        foodPhotoAiEnabled={false}
      />

      <MeasurementForm
        open={measurementFormOpen}
        onOpenChange={setMeasurementFormOpen}
        editEntry={null}
        userId={user?.id || ""}
      />

      <WellnessJournal
        open={journalOpen}
        onOpenChange={setJournalOpen}
        userId={user?.id || ""}
      />
    </div>
  );
};

export default Home;
