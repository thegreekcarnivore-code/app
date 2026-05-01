import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { usePageActions } from "@/context/PageActionsContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  Apple,
  BookOpen,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronRight,
  HeartPulse,
  LayoutPanelLeft,
  Plus,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import MeasurementForm from "@/components/measurements/MeasurementForm";
import BodyDashboard from "@/components/measurements/BodyDashboard";
import FoodDashboard from "@/components/measurements/FoodDashboard";
import PhotosDashboard from "@/components/measurements/PhotosDashboard";
import WellnessJournal from "@/components/measurements/WellnessJournal";

interface MeasurementsProps {
  userId?: string;
}

type MeasurementTabKey = "body" | "food" | "photos" | "journal";

interface MeasurementEntry {
  measured_at: string;
  weight_kg: number | null;
  waist_cm: number | null;
  energy: number | null;
  digestion: number | null;
  skin_health: number | null;
  mood: number | null;
  stress: number | null;
  cravings: number | null;
  breathing_health: number | null;
  mental_health: number | null;
  pain: number | null;
}

interface FoodEntry {
  entry_date: string;
  created_at: string;
}

interface PhotoEntry {
  taken_at: string;
  angle: string | null;
}

interface JournalEntry {
  created_at: string;
}

interface WeeklyCheckInRecord {
  id: string;
  week_start: string;
  week_end: string;
  due_at: string;
  generated_at: string;
  language: "en" | "el";
  status: "generated" | "reminder";
  summary: string;
  report_content: string;
  coach_message: string;
}

interface WeeklyCheckInOverview {
  enrollment: {
    id: string;
    weekly_day: number;
    start_date: string;
  } | null;
  profile: {
    timezone: string | null;
    language: "en" | "el" | null;
  } | null;
  checkIns: WeeklyCheckInRecord[];
}

const tabs = [
  { key: "body", icon: Scale, en: "Body", el: "Σώμα" },
  { key: "food", icon: Apple, en: "Food", el: "Φαγητό" },
  { key: "photos", icon: Camera, en: "Photos", el: "Φωτό" },
  { key: "journal", icon: BookOpen, en: "Journal", el: "Ημερολόγιο" },
] as const;

const wellnessKeys = [
  "energy",
  "digestion",
  "skin_health",
  "mood",
  "stress",
  "cravings",
  "breathing_health",
  "mental_health",
  "pain",
] as const;

const wellnessLabels = {
  energy: { en: "Energy", el: "Ενέργεια" },
  digestion: { en: "Digestion", el: "Πέψη" },
  skin_health: { en: "Skin", el: "Δέρμα" },
  mood: { en: "Mood", el: "Διάθεση" },
  stress: { en: "Stress", el: "Στρες" },
  cravings: { en: "Cravings", el: "Λιγούρες" },
  breathing_health: { en: "Breathing", el: "Αναπνοή" },
  mental_health: { en: "Mental", el: "Ψυχική Υγεία" },
  pain: { en: "Pain", el: "Πόνος" },
} satisfies Record<(typeof wellnessKeys)[number], { en: string; el: string }>;

const WEEKLY_CHECK_IN_HOUR = 20;
const WEEKLY_CHECK_IN_MINUTE = 0;

const tabDescriptions: Record<MeasurementTabKey, { en: string; el: string }> = {
  body: {
    en: "Body composition, wellness signals, and trend interpretation.",
    el: "Σύσταση σώματος, δείκτες ευεξίας και ερμηνεία τάσεων.",
  },
  food: {
    en: "Food entries, meal consistency, and nutrition logging rhythm.",
    el: "Καταγραφές φαγητού, συνέπεια γευμάτων και ρυθμός διατροφής.",
  },
  photos: {
    en: "Progress photos, comparison cadence, and visual accountability.",
    el: "Φωτογραφίες προόδου, ρυθμός σύγκρισης και οπτική συνέπεια.",
  },
  journal: {
    en: "Wellness journal entries — daily reflections and notes.",
    el: "Καταγραφές ημερολογίου ευεξίας — καθημερινές σκέψεις και σημειώσεις.",
  },
};

const toDayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const differenceInDays = (from: Date, to: Date) => {
  const fromStart = toDayStart(from).getTime();
  const toStart = toDayStart(to).getTime();
  return Math.round((toStart - fromStart) / 86400000);
};

const getNextWeeklyCheckInAt = (weeklyDay: number) => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(WEEKLY_CHECK_IN_HOUR, WEEKLY_CHECK_IN_MINUTE, 0, 0);

  let dayDelta = (weeklyDay - now.getDay() + 7) % 7;
  if (dayDelta === 0 && now.getTime() >= next.getTime()) {
    dayDelta = 7;
  }

  next.setDate(now.getDate() + dayDelta);
  next.setHours(WEEKLY_CHECK_IN_HOUR, WEEKLY_CHECK_IN_MINUTE, 0, 0);
  return next;
};

const formatCheckInCountdown = (target: Date | null, isGreek: boolean) => {
  if (!target) return null;

  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) {
    return isGreek ? "Η προθεσμία λήγει τώρα" : "The deadline is due now";
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return isGreek
      ? `Τελευταία ευκαιρία σε ${days} ημέρες και ${hours} ώρες`
      : `Last chance in ${days} day${days === 1 ? "" : "s"} and ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  if (hours > 0) {
    return isGreek
      ? `Τελευταία ευκαιρία σε ${hours} ώρες`
      : `Last chance in ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return isGreek
    ? `Τελευταία ευκαιρία σε ${minutes} λεπτά`
    : `Last chance in ${minutes} minute${minutes === 1 ? "" : "s"}`;
};

const isTabKey = (value: string | null): value is MeasurementTabKey =>
  value === "body" || value === "food" || value === "photos" || value === "journal";

const Measurements = ({ userId }: MeasurementsProps) => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<MeasurementTabKey>(isTabKey(initialTab) ? initialTab : "body");
  const [topView, setTopView] = useState<"measurements" | "analysis">(
    searchParams.get("view") === "analysis" ? "analysis" : "measurements",
  );
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const { registerActions, clearActions } = usePageActions();
  const [formOpen, setFormOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(searchParams.get("checkIn"));
  // Controls the mobile-only left-slide Sheet that shows the insight sidebar.
  // Desktop (lg+) always shows it inline, so this state is only read on mobile.
  const [insightsSheetOpen, setInsightsSheetOpen] = useState(false);
  const targetUserId = userId || user?.id;
  const isGreek = lang === "el";

  useEffect(() => {
    registerActions({ featureKey: "measurements", featureLabel: "Measurements" });
    return () => clearActions();
  }, [registerActions, clearActions]);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (isTabKey(nextTab)) setActiveTab(nextTab);
  }, [searchParams]);

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ["measurements-overview", targetUserId],
    queryFn: async () => {
      if (!targetUserId) {
        return {
          measurements: [] as MeasurementEntry[],
          foodEntries: [] as FoodEntry[],
          photos: [] as PhotoEntry[],
          journalEntries: [] as JournalEntry[],
        };
      }

      const [measurementsRes, foodRes, photosRes, journalRes] = await Promise.all([
        supabase
          .from("measurements")
          .select("measured_at, weight_kg, waist_cm, energy, digestion, skin_health, mood, stress, cravings, breathing_health, mental_health, pain")
          .eq("user_id", targetUserId)
          .order("measured_at", { ascending: false }),
        supabase
          .from("food_journal")
          .select("entry_date, created_at")
          .eq("user_id", targetUserId)
          .order("entry_date", { ascending: false }),
        supabase
          .from("progress_photos")
          .select("taken_at, angle")
          .eq("user_id", targetUserId)
          .order("taken_at", { ascending: false }),
        supabase
          .from("wellness_journal" as any)
          .select("created_at")
          .eq("user_id", targetUserId)
          .order("created_at", { ascending: false }),
      ]);

      if (measurementsRes.error) throw measurementsRes.error;
      if (foodRes.error) throw foodRes.error;
      if (photosRes.error) throw photosRes.error;
      if (journalRes.error) throw journalRes.error;

      return {
        measurements: (measurementsRes.data || []) as MeasurementEntry[],
        foodEntries: (foodRes.data || []) as FoodEntry[],
        photos: (photosRes.data || []) as PhotoEntry[],
        journalEntries: (journalRes.data || []) as JournalEntry[],
      };
    },
    enabled: !!targetUserId,
  });

  const { data: weeklyCheckInOverview, isLoading: weeklyCheckInLoading } = useQuery({
    queryKey: ["weekly-check-ins", targetUserId],
    queryFn: async () => {
      if (!targetUserId) {
        return {
          enrollment: null,
          profile: null,
          checkIns: [],
        } satisfies WeeklyCheckInOverview;
      }

      const [enrollmentRes, profileRes, checkInsRes] = await Promise.all([
        supabase
          .from("client_program_enrollments")
          .select("id, weekly_day, start_date")
          .eq("user_id", targetUserId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("timezone, language")
          .eq("id", targetUserId)
          .maybeSingle(),
        supabase
          .from("weekly_check_ins" as any)
          .select("id, week_start, week_end, due_at, generated_at, language, status, summary, report_content, coach_message")
          .eq("user_id", targetUserId)
          .order("due_at", { ascending: false })
          .limit(12),
      ]);

      if (enrollmentRes.error) throw enrollmentRes.error;
      if (profileRes.error) throw profileRes.error;
      if (checkInsRes.error) throw checkInsRes.error;

      return {
        enrollment: enrollmentRes.data as WeeklyCheckInOverview["enrollment"],
        profile: profileRes.data as WeeklyCheckInOverview["profile"],
        checkIns: (checkInsRes.data || []) as WeeklyCheckInRecord[],
      } satisfies WeeklyCheckInOverview;
    },
    enabled: !!targetUserId,
  });

  useEffect(() => {
    const requestedCheckInId = searchParams.get("checkIn");
    if (!requestedCheckInId || !weeklyCheckInOverview?.checkIns?.length) return;

    const exists = weeklyCheckInOverview.checkIns.some((checkIn) => checkIn.id === requestedCheckInId);
    if (exists) {
      setSelectedCheckInId(requestedCheckInId);
      setCheckInDialogOpen(true);
    }
  }, [searchParams, weeklyCheckInOverview]);

  const insightState = useMemo(() => {
    const measurements = overviewData?.measurements || [];
    const foodEntries = overviewData?.foodEntries || [];
    const photos = overviewData?.photos || [];
    const journalEntries = overviewData?.journalEntries || [];
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const latestMeasurement = measurements[0] || null;
    const previousMeasurement = measurements[1] || null;
    const latestPhoto = photos[0] || null;
    const latestJournal = journalEntries[0] || null;

    const lastMeasurementDays = latestMeasurement ? differenceInDays(new Date(latestMeasurement.measured_at), today) : null;
    const lastPhotoDays = latestPhoto ? differenceInDays(new Date(latestPhoto.taken_at), today) : null;
    const lastJournalDays = latestJournal ? differenceInDays(new Date(latestJournal.created_at), today) : null;

    const wellnessPairs = wellnessKeys
      .map((key) => ({ key, value: latestMeasurement?.[key] ?? null }))
      .filter((item): item is { key: (typeof wellnessKeys)[number]; value: number } => item.value !== null);

    const wellnessAverage = wellnessPairs.length
      ? wellnessPairs.reduce((sum, item) => sum + item.value, 0) / wellnessPairs.length
      : null;

    const strongestSignal = wellnessPairs.length
      ? [...wellnessPairs].sort((a, b) => b.value - a.value)[0]
      : null;

    const lowestSignal = wellnessPairs.length
      ? [...wellnessPairs].sort((a, b) => a.value - b.value)[0]
      : null;

    const weightDelta = latestMeasurement?.weight_kg !== null &&
      latestMeasurement?.weight_kg !== undefined &&
      previousMeasurement?.weight_kg !== null &&
      previousMeasurement?.weight_kg !== undefined
      ? latestMeasurement.weight_kg - previousMeasurement.weight_kg
      : null;

    const waistDelta = latestMeasurement?.waist_cm !== null &&
      latestMeasurement?.waist_cm !== undefined &&
      previousMeasurement?.waist_cm !== null &&
      previousMeasurement?.waist_cm !== undefined
      ? latestMeasurement.waist_cm - previousMeasurement.waist_cm
      : null;

    const recentFoodEntries = foodEntries.filter((entry) => {
      const entryDate = new Date(`${entry.entry_date}T00:00:00`);
      return entryDate >= toDayStart(sevenDaysAgo) && entryDate <= toDayStart(today);
    });

    const foodDaysLogged = new Set(recentFoodEntries.map((entry) => entry.entry_date)).size;
    const todayFoodCount = foodEntries.filter((entry) => entry.entry_date === today.toISOString().slice(0, 10)).length;
    const recentPhotoCount = photos.filter((photo) => {
      const photoDate = new Date(`${photo.taken_at}T00:00:00`);
      return photoDate >= toDayStart(sevenDaysAgo) && photoDate <= toDayStart(today);
    }).length;

    const formatShortDate = (value: string) =>
      new Intl.DateTimeFormat(isGreek ? "el-GR" : "en-GB", {
        day: "numeric",
        month: "short",
      }).format(new Date(value));

    const formatRelativeDays = (days: number | null, sameDayLabel: { en: string; el: string }) => {
      if (days === null) return isGreek ? "Χωρίς δεδομένα" : "No data yet";
      if (days === 0) return isGreek ? sameDayLabel.el : sameDayLabel.en;
      if (days === 1) return isGreek ? "Χθες" : "Yesterday";
      return isGreek ? `Πριν από ${days} ημέρες` : `${days} days ago`;
    };

    let focus: {
      tab: MeasurementTabKey;
      title: string;
      body: string;
      action: string;
    };

    if (!latestMeasurement) {
      focus = {
        tab: "body",
        title: isGreek ? "Χτίσε τη βάση σου" : "Build your baseline",
        body: isGreek
          ? "Δεν υπάρχει ακόμα μέτρηση σώματος. Κατέγραψε το πρώτο πλήρες check-in για να ξεκινήσει η πραγματική ερμηνεία της προόδου σου."
          : "There is no body check-in yet. Add your first full measurement so the app can start interpreting real progress.",
        action: isGreek ? "Νέα μέτρηση" : "Add measurement",
      };
    } else if ((lastMeasurementDays ?? 0) >= 10) {
      focus = {
        tab: "body",
        title: isGreek ? "Χρειάζεται ανανέωση δεδομένων" : "Your body data needs a refresh",
        body: isGreek
          ? "Η τελευταία μέτρηση απέχει αρκετές ημέρες. Μία νέα καταγραφή θα δώσει πιο καθαρή εικόνα για βάρος, περίμετρο μέσης και ευεξία."
          : "Your last body check-in is getting old. A new entry will sharpen the picture on weight, waist, and wellness.",
        action: isGreek ? "Ανανέωση σώματος" : "Refresh body data",
      };
    } else if (wellnessAverage !== null && wellnessAverage <= 4.5) {
      focus = {
        tab: "body",
        title: isGreek ? "Δώσε προτεραιότητα στην αποκατάσταση" : "Prioritize recovery",
        body: isGreek
          ? `Οι δείκτες ευεξίας είναι χαμηλοί, με μεγαλύτερη προσοχή στο ${wellnessLabels[lowestSignal?.key || "energy"].el.toLowerCase()}. Κατέγραψε νέο check-in και σημείωσε πώς νιώθεις σήμερα.`
          : `Wellness is running low, especially around ${wellnessLabels[lowestSignal?.key || "energy"].en.toLowerCase()}. Log a fresh check-in and add context on how you feel today.`,
        action: isGreek ? "Άνοιγμα σώματος" : "Open body tab",
      };
    } else if (foodDaysLogged <= 3) {
      focus = {
        tab: "food",
        title: isGreek ? "Χρειάζεται περισσότερη συνέπεια στο φαγητό" : "Food logging needs more consistency",
        body: isGreek
          ? "Υπάρχουν λίγες ημέρες καταγραφής αυτή την εβδομάδα. Λίγα σωστά logs αρκούν για να φανεί τι σε βοηθά και τι σε ρίχνει."
          : "There are too few logged days this week. A handful of accurate entries is enough to reveal what is helping and what is dragging you down.",
        action: isGreek ? "Καταγραφή φαγητού" : "Log food",
      };
    } else if (lastPhotoDays === null || lastPhotoDays >= 14) {
      focus = {
        tab: "photos",
        title: isGreek ? "Ώρα για νέο οπτικό check-in" : "It is time for a new visual check-in",
        body: isGreek
          ? "Οι φωτογραφίες προόδου λείπουν ή έχουν καθυστερήσει. Οι σωστές φωτογραφίες δείχνουν αλλαγές που οι αριθμοί συχνά δεν δείχνουν."
          : "Progress photos are missing or overdue. Consistent photos reveal changes that numbers often miss.",
        action: isGreek ? "Άνοιγμα φωτογραφιών" : "Open photos",
      };
    } else {
      focus = {
        tab: "body",
        title: isGreek ? "Η ορμή είναι καλή" : "Momentum looks steady",
        body: isGreek
          ? "Τα βασικά δεδομένα ανανεώνονται. Κράτα τον ίδιο ρυθμό και χρησιμοποίησε το σημερινό check-in για να δώσεις λίγο παραπάνω context."
          : "Your core tracking is staying fresh. Keep the same rhythm and use today’s check-in to add a little more context.",
        action: isGreek ? "Συνέχισε" : "Keep going",
      };
    }

    return {
      latestMeasurement,
      latestPhoto,
      latestJournal,
      lastMeasurementDays,
      lastPhotoDays,
      lastJournalDays,
      wellnessAverage,
      strongestSignal,
      lowestSignal,
      weightDelta,
      foodDaysLogged,
      todayFoodCount,
      recentPhotoCount,
      formatShortDate,
      formatRelativeDays,
      focus,
    };
  }, [overviewData, isGreek]);

  const latestWeeklyCheckIn = weeklyCheckInOverview?.checkIns?.[0] || null;
  const selectedWeeklyCheckIn =
    weeklyCheckInOverview?.checkIns?.find((checkIn) => checkIn.id === selectedCheckInId) ||
    latestWeeklyCheckIn;
  const nextWeeklyCheckInAt = weeklyCheckInOverview?.enrollment
    ? getNextWeeklyCheckInAt(weeklyCheckInOverview.enrollment.weekly_day)
    : null;

  const formatScheduledCheckIn = (value: Date | null) => {
    if (!value) return null;
    return new Intl.DateTimeFormat(isGreek ? "el-GR" : "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  };

  const latestCheckInDateLabel = latestWeeklyCheckIn
    ? new Intl.DateTimeFormat(isGreek ? "el-GR" : "en-GB", {
        day: "numeric",
        month: "short",
      }).format(new Date(latestWeeklyCheckIn.week_end))
    : null;

  const nextCheckInLabel = formatScheduledCheckIn(nextWeeklyCheckInAt);
  const nextCheckInCountdownLabel = formatCheckInCountdown(nextWeeklyCheckInAt, isGreek);
  const weeklyPrepChecklist = isGreek
    ? [
        "Πέρασε νέα μέτρηση σώματος πριν κλείσει η εβδομάδα.",
        "Βάλε food logs από τις τελευταίες ημέρες για σωστό nutrition context.",
        "Ανανέωσε τις φωτογραφίες προόδου αν έχουν καθυστερήσει.",
      ]
    : [
        "Add a fresh body check-in before the week closes.",
        "Log the last few days of food so the nutrition context is accurate.",
        "Refresh your progress photos if they are overdue.",
      ];

  const bodySummaryTitle = insightState.latestMeasurement
    ? insightState.formatRelativeDays(insightState.lastMeasurementDays, {
        en: "Checked in today",
        el: "Καταγραφή σήμερα",
      })
    : isGreek
      ? "Καμία μέτρηση ακόμα"
      : "No body check-in yet";

  const bodySummaryDetail = insightState.latestMeasurement
    ? insightState.weightDelta !== null
      ? isGreek
        ? `Βάρος ${insightState.weightDelta > 0 ? "+" : ""}${insightState.weightDelta.toFixed(1)}kg από την προηγούμενη μέτρηση`
        : `Weight ${insightState.weightDelta > 0 ? "+" : ""}${insightState.weightDelta.toFixed(1)}kg since the previous check-in`
      : isGreek
        ? `Τελευταία μέτρηση ${insightState.formatShortDate(insightState.latestMeasurement.measured_at)}`
        : `Last measurement ${insightState.formatShortDate(insightState.latestMeasurement.measured_at)}`
    : isGreek
      ? "Κατέγραψε βάρος, περιφέρειες και δείκτες ευεξίας."
      : "Start by logging weight, body circumferences, and wellness.";

  const wellnessSummaryTitle = insightState.wellnessAverage !== null
    ? `${insightState.wellnessAverage.toFixed(1)}/10`
    : isGreek
      ? "Χωρίς βαθμολογία ευεξίας"
      : "No wellness score";

  const wellnessSummaryDetail = insightState.wellnessAverage !== null
    ? isGreek
      ? `Ισχυρότερο: ${wellnessLabels[insightState.strongestSignal?.key || "energy"].el} • Προσοχή: ${wellnessLabels[insightState.lowestSignal?.key || "energy"].el}`
      : `Strongest: ${wellnessLabels[insightState.strongestSignal?.key || "energy"].en} • Watch: ${wellnessLabels[insightState.lowestSignal?.key || "energy"].en}`
    : isGreek
      ? "Οι βαθμολογίες ευεξίας θα εμφανιστούν μετά την πρώτη μέτρηση."
      : "Wellness averages will appear after your first body check-in.";

  const nutritionSummaryTitle = `${insightState.foodDaysLogged}/7 ${isGreek ? "ημέρες" : "days"}`;
  const nutritionSummaryDetail = isGreek
    ? `Σήμερα: ${insightState.todayFoodCount} εγγραφές φαγητού`
    : `Today: ${insightState.todayFoodCount} food entries`;

  const photosSummaryTitle = insightState.latestPhoto
    ? insightState.formatRelativeDays(insightState.lastPhotoDays, {
        en: "Photo logged today",
        el: "Φωτογραφία σήμερα",
      })
    : isGreek
      ? "Χωρίς φωτογραφίες"
      : "No progress photos";

  const photosSummaryDetail = insightState.latestPhoto
    ? isGreek
      ? `${insightState.recentPhotoCount} φωτογραφίες τις τελευταίες 7 ημέρες`
      : `${insightState.recentPhotoCount} photos in the last 7 days`
    : isGreek
      ? "Οι εβδομαδιαίες φωτογραφίες δίνουν οπτική εικόνα της προόδου."
      : "Weekly photos give you visual proof of progress.";


  // ---------------------------------------------------------------------------
  // LAYOUT: measurements-first, insights in a left sidebar.
  //
  // Why: users came here to LOG a measurement or READ their latest numbers.
  // Previously the 4 summary cards + coaching-focus hero + tracking guides
  // pushed the actual dashboards (BodyDashboard / FoodDashboard / PhotosDashboard)
  // well below the fold. Now:
  //   - A compact weekly check-in banner stays at the top (action card, not hero)
  //   - Tab switcher is immediately below
  //   - Active tab content (the real measurements UI) fills the main column
  //   - All the "insight / summary" cards go into a LEFT SIDEBAR visible on
  //     desktop (lg+). On mobile, a single "Insights" button opens them in a
  //     left-slide Sheet so everything is still one tap away.
  // ---------------------------------------------------------------------------

  // The insight sidebar content is rendered twice (desktop aside + mobile sheet)
  // so we build the JSX once and reuse it. Keep `key` attributes stable so React
  // doesn't thrash when remounting between the two containers.
  const summaryTiles = [
    {
      key: "body",
      icon: Scale,
      title: isGreek ? "Σώμα" : "Body",
      headline: bodySummaryTitle,
      detail: bodySummaryDetail,
    },
    {
      key: "wellness",
      icon: HeartPulse,
      title: isGreek ? "Ευεξία" : "Wellness",
      headline: wellnessSummaryTitle,
      detail: wellnessSummaryDetail,
    },
    {
      key: "food",
      icon: Apple,
      title: isGreek ? "Διατροφή" : "Nutrition",
      headline: nutritionSummaryTitle,
      detail: nutritionSummaryDetail,
    },
    {
      key: "photos",
      icon: Camera,
      title: isGreek ? "Φωτογραφίες" : "Photos",
      headline: photosSummaryTitle,
      detail: photosSummaryDetail,
    },
  ];

  const checkIns = weeklyCheckInOverview?.checkIns || [];
  const visibleCheckIns = historyExpanded ? checkIns.slice(0, 6) : checkIns.slice(0, 1);

  // Lean Analysis view — coaching focus first, compact stat grid, collapsible
  // history. No duplicate navigation (the top-level toggle already does that).
  const insightSidebarBlock = (
    <div className="space-y-4">
      {/* Today's coaching focus — the single most actionable next step. */}
      <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
        <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.22em] text-gold">
          {isGreek ? "Σημερινή καθοδήγηση" : "Today's focus"}
        </p>
        <h3 className="mt-2 font-serif text-base font-semibold text-foreground">
          {insightState.focus.title}
        </h3>
        <p className="mt-1 text-xs font-sans leading-relaxed text-muted-foreground">
          {insightState.focus.body}
        </p>
        <button
          onClick={() => {
            setTopView("measurements");
            setActiveTab(insightState.focus.tab);
            if (insightState.focus.tab === "body") setFormOpen(true);
            setInsightsSheetOpen(false);
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-3 py-2 text-xs font-sans font-semibold text-gold-foreground transition-all hover:opacity-90"
        >
          {insightState.focus.action}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Compact 2x2 stat grid — icon + title + number only. Tap to drill into
          the matching dashboard tab. The detail line is hidden by default to
          keep the page calm; expand button below shows it. */}
      <div className="grid grid-cols-2 gap-2">
        {summaryTiles.map(({ key, icon: Icon, title, headline }) => {
          const targetTab = key === "wellness" ? "body" : (key as MeasurementTabKey);
          return (
            <button
              key={key}
              onClick={() => {
                setTopView("measurements");
                setActiveTab(targetTab);
                setInsightsSheetOpen(false);
              }}
              className="group flex flex-col items-start rounded-xl border border-border/70 bg-background/80 p-3 text-left shadow-sm transition-all hover:border-gold/40 hover:bg-gold/5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold">
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-2 text-[10px] font-sans font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {title}
              </p>
              <p className="mt-0.5 font-serif text-sm font-semibold text-foreground leading-tight">
                {headline}
              </p>
            </button>
          );
        })}
      </div>

      {/* Optional detail expansion — keeps the page lean by default. */}
      <details className="group rounded-xl border border-border/70 bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[11px] font-sans font-medium text-muted-foreground hover:text-foreground">
          {isGreek ? "Λεπτομέρειες" : "Details"}
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 px-3 pb-3">
          {summaryTiles.map(({ key, title, detail }) => (
            <div key={key} className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
              <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.18em] text-gold">
                {title}
              </p>
              <p className="mt-0.5 text-[11px] font-sans leading-snug text-muted-foreground">
                {detail}
              </p>
            </div>
          ))}
        </div>
      </details>

      {/* Check-in history — collapsed by default, shows latest only. Click
          "see all" to reveal the rest. */}
      {checkIns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.22em] text-gold">
              {isGreek ? "Ιστορικό αναλύσεων" : "Check-in history"}
            </p>
            {checkIns.length > 1 && (
              <button
                type="button"
                onClick={() => setHistoryExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-muted-foreground hover:text-foreground"
              >
                {historyExpanded
                  ? (isGreek ? "Λιγότερα" : "Less")
                  : (isGreek ? `Όλα (${checkIns.length})` : `All (${checkIns.length})`)}
                <ChevronDown className={cn("h-3 w-3 transition-transform", historyExpanded && "rotate-180")} />
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {visibleCheckIns.map((checkIn) => (
              <button
                key={checkIn.id}
                onClick={() => {
                  setSelectedCheckInId(checkIn.id);
                  setCheckInDialogOpen(true);
                  setInsightsSheetOpen(false);
                }}
                className="w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-gold/40 hover:bg-gold/5"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-gold" />
                  <p className="text-[11px] font-sans font-semibold text-foreground">
                    {new Intl.DateTimeFormat(isGreek ? "el-GR" : "en-GB", {
                      day: "numeric",
                      month: "short",
                    }).format(new Date(checkIn.week_end))}
                  </p>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] font-sans leading-snug text-muted-foreground">
                  {checkIn.summary}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      {/* TOP-LEVEL TOGGLE — measurements (raw data only) vs analysis (insights,
          coaching focus, weekly check-in). Two strictly separate views so the
          measurements view never gets cluttered with summary text. */}
      <div className="inline-flex w-full rounded-full bg-muted p-1">
        <button
          type="button"
          onClick={() => setTopView("measurements")}
          className={cn(
            "flex-1 rounded-full px-4 py-2 font-sans text-xs font-semibold transition-all",
            topView === "measurements"
              ? "bg-gold text-gold-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {isGreek ? "Μετρήσεις" : "Measurements"}
        </button>
        <button
          type="button"
          onClick={() => setTopView("analysis")}
          className={cn(
            "flex-1 rounded-full px-4 py-2 font-sans text-xs font-semibold transition-all",
            topView === "analysis"
              ? "bg-gold text-gold-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {isGreek ? "Ανάλυση" : "Analysis"}
        </button>
      </div>

      {topView === "measurements" && (
        <>
          {/* Sub-tabs (Body / Food / Photos / Journal) + quick "+ Νέα μέτρηση". */}
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-2">
              {tabs.map(({ key, icon: Icon, en, el }) => (
                <button
                  key={key}
                  data-guide={`measurements-${key}`}
                  onClick={() => {
                    if (key === "journal") {
                      setJournalOpen(true);
                    } else {
                      setActiveTab(key);
                    }
                  }}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 font-sans text-xs font-medium transition-all",
                    (activeTab === key || (key === "journal" && journalOpen))
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{isGreek ? el : en}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gold px-3 py-2.5 font-sans text-xs font-semibold text-gold-foreground shadow-sm transition-opacity hover:opacity-90"
              aria-label={isGreek ? "Νέα μέτρηση" : "New measurement"}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{isGreek ? "Νέα" : "New"}</span>
            </button>
          </div>

          {/* DASHBOARDS only — graphs, charts, history, real client data. */}
          <div className="space-y-4 min-w-0">
            {activeTab === "body" && <BodyDashboard userId={userId} />}
            {activeTab === "food" && <FoodDashboard userId={userId} />}
            {activeTab === "photos" && <PhotosDashboard userId={userId} />}
          </div>
        </>
      )}

      {topView === "analysis" && (
        <div className="space-y-4">
          {/* Compact weekly check-in chip — opens full analysis dialog */}
          <button
            type="button"
            data-guide="measurements-weekly-checkin"
            onClick={() => {
              if (selectedWeeklyCheckIn) {
                setSelectedCheckInId(selectedWeeklyCheckIn.id);
                setCheckInDialogOpen(true);
              } else {
                setTopView("measurements");
                setActiveTab("body");
                setFormOpen(true);
              }
            }}
            disabled={weeklyCheckInLoading}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/5 px-4 py-3 text-left transition-colors hover:border-gold/40 disabled:opacity-60"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.22em] text-gold">
                {isGreek ? "Εβδομαδιαίο check-in" : "Weekly check-in"}
              </p>
              <p className="mt-0.5 truncate text-xs font-sans text-foreground">
                {weeklyCheckInLoading
                  ? isGreek ? "Φόρτωση..." : "Loading..."
                  : selectedWeeklyCheckIn
                    ? selectedWeeklyCheckIn.summary
                    : nextCheckInCountdownLabel || (isGreek ? "Συνέχισε να καταγράφεις" : "Keep logging")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gold" />
          </button>

          {/* Coaching focus, summary cards, navigation, history. */}
          {insightSidebarBlock}
        </div>
      )}

      <WellnessJournal
        open={journalOpen}
        onOpenChange={(open) => {
          setJournalOpen(open);
          if (!open && activeTab === "journal") setActiveTab("body");
        }}
        userId={targetUserId || ""}
      />

      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        {/* Simpler: scroll the whole content. Nested flex+min-h-0 was fragile and
            broke on some viewports because the base DialogContent uses `grid`. */}
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle className="font-serif text-2xl">
              {isGreek ? "Το 7ήμερο check-in σου" : "Your 7-day check-in"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {selectedWeeklyCheckIn
                ? isGreek
                  ? `Ανάλυση για την εβδομάδα έως ${new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "long" }).format(new Date(selectedWeeklyCheckIn.week_end))}`
                  : `Analysis for the week ending ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(selectedWeeklyCheckIn.week_end))}`
                : isGreek
                  ? "Δεν υπάρχει διαθέσιμο check-in ακόμα."
                  : "There is no check-in available yet."}
            </DialogDescription>
          </DialogHeader>

          {selectedWeeklyCheckIn ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
                <p className="text-xs font-sans font-semibold uppercase tracking-[0.2em] text-gold">
                  {isGreek ? "Σύντομη εικόνα" : "Quick summary"}
                </p>
                <p className="mt-2 font-serif text-lg font-semibold text-foreground">
                  {selectedWeeklyCheckIn.summary}
                </p>
                {selectedWeeklyCheckIn.coach_message && (
                  <p className="mt-3 text-sm font-sans leading-relaxed text-muted-foreground">
                    {selectedWeeklyCheckIn.coach_message}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="prose prose-sm max-w-none dark:prose-invert font-sans">
                  <ReactMarkdown>{selectedWeeklyCheckIn.report_content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm font-sans text-muted-foreground">
              {isGreek
                ? "Μόλις δημιουργηθεί το πρώτο εβδομαδιαίο check-in, θα ανοίγει εδώ με όλη την ανάλυση."
                : "As soon as the first weekly check-in is generated, it will open here with the full analysis."}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MeasurementForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editEntry={null}
        userId={targetUserId || ""}
      />
    </div>
  );
};

export default Measurements;
