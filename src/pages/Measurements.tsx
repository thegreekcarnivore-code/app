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
  CalendarDays,
  Camera,
  ChevronRight,
  HeartPulse,
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
import { Button } from "@/components/ui/button";
import MeasurementForm from "@/components/measurements/MeasurementForm";
import BodyDashboard from "@/components/measurements/BodyDashboard";
import FoodDashboard from "@/components/measurements/FoodDashboard";
import PhotosDashboard from "@/components/measurements/PhotosDashboard";

interface MeasurementsProps {
  userId?: string;
}

type MeasurementTabKey = "body" | "food" | "photos";

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
  { key: "photos", icon: Camera, en: "Photos", el: "Φωτογραφίες" },
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
  value === "body" || value === "food" || value === "photos";

const Measurements = ({ userId }: MeasurementsProps) => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<MeasurementTabKey>(isTabKey(initialTab) ? initialTab : "body");
  const { registerActions, clearActions } = usePageActions();
  const [formOpen, setFormOpen] = useState(false);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(searchParams.get("checkIn"));
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
      ? "Χωρίς wellness score"
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
      ? "Οι εβδομαδιαίες φωτογραφίες δίνουν οπτικό feedback."
      : "Weekly photos give you visual feedback that numbers miss.";

  const tabHeader = tabDescriptions[activeTab];
  const trackingGuides = [
    {
      key: "body" as const,
      title: isGreek ? "Σώμα" : "Body",
      status: bodySummaryTitle,
      detail: isGreek
        ? "Μέτρηση βάρους, μέσης και wellness scores."
        : "Weight, waist, and wellness score tracking.",
      action: isGreek ? "Νέα μέτρηση" : "Log body check-in",
    },
    {
      key: "food" as const,
      title: isGreek ? "Φαγητό" : "Food",
      status: nutritionSummaryTitle,
      detail: isGreek
        ? "Συνέπεια γευμάτων και καθημερινό nutrition context."
        : "Meal consistency and daily nutrition context.",
      action: isGreek ? "Άνοιγμα καρτέλας φαγητού" : "Open food tab",
    },
    {
      key: "photos" as const,
      title: isGreek ? "Φωτογραφίες" : "Photos",
      status: photosSummaryTitle,
      detail: isGreek
        ? "Οπτικό feedback που συμπληρώνει τους αριθμούς."
        : "Visual feedback that complements the numbers.",
      action: isGreek ? "Άνοιγμα καρτέλας φωτογραφιών" : "Open photo tab",
    },
  ];

  return (
    <div className="px-4 pt-6 pb-24 space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--beige))_0%,hsl(var(--background))_100%)] p-5 shadow-sm">
        <div className="space-y-5">
          <div
            data-guide="measurements-weekly-checkin"
            onClick={() => {
              if (selectedWeeklyCheckIn) {
                setSelectedCheckInId(selectedWeeklyCheckIn.id);
                setCheckInDialogOpen(true);
              }
            }}
            className={cn(
              "rounded-[1.75rem] border border-gold/25 bg-background/85 p-4 md:p-5",
              selectedWeeklyCheckIn && "cursor-pointer transition-all hover:border-gold/40 hover:shadow-sm",
            )}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-sans font-semibold uppercase tracking-[0.24em] text-gold">
                  {isGreek ? "Εβδομαδιαίο check-in" : "Weekly Check-in"}
                </p>
                <h2 className="font-serif text-xl font-semibold text-foreground">
                  {latestWeeklyCheckIn
                    ? isGreek
                      ? "Το εβδομαδιαίο check-in σου είναι έτοιμο"
                      : "Your weekly check-in is ready"
                    : isGreek
                      ? "Προετοίμασε την επόμενη εβδομαδιαία αξιολόγηση"
                      : "Prepare your next weekly review"}
                </h2>
                <p className="max-w-3xl text-sm font-sans leading-relaxed text-muted-foreground">
                  {weeklyCheckInLoading
                    ? isGreek
                      ? "Φορτώνουμε το τελευταίο σου εβδομαδιαίο check-in..."
                      : "Loading your latest weekly check-in..."
                    : latestWeeklyCheckIn
                    ? latestWeeklyCheckIn.summary
                    : nextCheckInLabel
                      ? isGreek
                        ? `Μέχρι ${nextCheckInLabel} χρειάζεται να συμπληρώσεις σώμα, φαγητό και φωτογραφίες ώστε η εβδομαδιαία αξιολόγηση να βγει ολοκληρωμένη και χρήσιμη.`
                        : `Before ${nextCheckInLabel}, make sure body data, food logs, and progress photos are up to date so the weekly review is accurate and useful.`
                      : isGreek
                        ? "Η εβδομαδιαία ροή δεν έχει ενεργοποιηθεί ακόμη. Μόλις οριστεί η πρώτη προθεσμία, εδώ θα δεις τι πρέπει να συμπληρώσεις."
                        : "Your weekly flow is not active yet. As soon as the first deadline is scheduled, you will see exactly what needs to be completed here."}
                </p>
                {(latestWeeklyCheckIn || nextCheckInLabel || nextCheckInCountdownLabel) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs font-sans text-muted-foreground">
                    {latestWeeklyCheckIn && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1">
                        <CalendarDays className="h-3.5 w-3.5 text-gold" />
                        {isGreek
                          ? `Αφορά την εβδομάδα έως ${latestCheckInDateLabel}`
                          : `Covers the week ending ${latestCheckInDateLabel}`}
                      </span>
                    )}
                    {nextCheckInLabel && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1">
                        <CalendarDays className="h-3.5 w-3.5 text-gold" />
                        {isGreek
                          ? `Προθεσμία: ${nextCheckInLabel}`
                          : `Deadline: ${nextCheckInLabel}`}
                      </span>
                    )}
                    {nextCheckInCountdownLabel && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-gold" />
                        {nextCheckInCountdownLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (selectedWeeklyCheckIn) {
                      setSelectedCheckInId(selectedWeeklyCheckIn.id);
                      setCheckInDialogOpen(true);
                    } else {
                      setActiveTab("body");
                      setFormOpen(true);
                    }
                  }}
                  disabled={weeklyCheckInLoading}
                  className="rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-gold-foreground hover:bg-gold/90"
                >
                  {selectedWeeklyCheckIn
                    ? (isGreek ? "Άνοιγμα ανάλυσης" : "Open analysis")
                    : (isGreek ? "Νέα μέτρηση σώματος" : "Add body check-in")}
                </Button>
                {selectedWeeklyCheckIn?.coach_message ? (
                  <p className="max-w-xs rounded-2xl border border-border/70 bg-background/80 px-3 py-2 text-xs font-sans leading-relaxed text-muted-foreground">
                    {selectedWeeklyCheckIn.coach_message}
                  </p>
                ) : nextCheckInLabel ? (
                  <div className="max-w-xs rounded-2xl border border-border/70 bg-background/80 px-3 py-3 text-xs font-sans text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      {isGreek ? "Για να εμφανιστεί η αξιολόγηση:" : "To unlock the review:"}
                    </p>
                    <div className="mt-2 space-y-2">
                      {weeklyPrepChecklist.map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gold" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-sans font-semibold uppercase tracking-[0.24em] text-gold">
              {isGreek ? "Κέντρο προόδου" : "Progress center"}
            </p>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <h1 className="font-serif text-3xl font-semibold text-foreground">
                  {isGreek ? "Μετρήσεις & Ερμηνεία" : "Measurements & Coaching Insight"}
                </h1>
                <p className="max-w-2xl text-sm font-sans leading-relaxed text-muted-foreground">
                  {isGreek
                    ? "Όχι μόνο καταγραφή. Εδώ βλέπεις τι αλλάζει, τι χρειάζεται προσοχή και ποιο είναι το επόμενο καλύτερο βήμα."
                    : "Not just logging. This is where your data starts to show what is changing, what needs attention, and what to do next."}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-background/80 px-3 py-2 text-xs font-sans font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                {overviewLoading
                  ? isGreek ? "Ανάλυση..." : "Analyzing..."
                  : insightState.latestMeasurement
                    ? isGreek
                      ? `Τελευταία καταγραφή ${insightState.formatRelativeDays(insightState.lastMeasurementDays, { en: "today", el: "σήμερα" })}`
                      : `Last measurement ${insightState.formatRelativeDays(insightState.lastMeasurementDays, { en: "today", el: "today" })}`
                    : isGreek
                      ? "Βάλε την πρώτη σου μέτρηση για να ξεκινήσει η ανάλυση"
                      : "Log your first measurement so the analysis can start"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                key: "body",
                icon: Scale,
                title: isGreek ? "Καταγραφή Σώματος" : "Body Check-In",
                headline: bodySummaryTitle,
                detail: bodySummaryDetail,
              },
              {
                key: "wellness",
                icon: HeartPulse,
                title: isGreek ? "Εικόνα Ευεξίας" : "Wellness Snapshot",
                headline: wellnessSummaryTitle,
                detail: wellnessSummaryDetail,
              },
              {
                key: "food",
                icon: Apple,
                title: isGreek ? "Ρυθμός Διατροφής" : "Nutrition Rhythm",
                headline: nutritionSummaryTitle,
                detail: nutritionSummaryDetail,
              },
              {
                key: "photos",
                icon: Camera,
                title: isGreek ? "Ρυθμός Φωτογραφιών" : "Photo Cadence",
                headline: photosSummaryTitle,
                detail: photosSummaryDetail,
              },
            ].map(({ key, icon: Icon, title, headline, detail }) => (
              <div key={key} className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {title}
                </p>
                <p className="mt-2 font-serif text-lg font-semibold text-foreground">
                  {headline}
                </p>
                <p className="mt-1 text-sm font-sans leading-relaxed text-muted-foreground">
                  {detail}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-[1.75rem] border border-gold/25 bg-background/80 p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-sans font-semibold uppercase tracking-[0.24em] text-gold">
                  {isGreek ? "Σημερινή καθοδήγηση" : "Coaching focus"}
                </p>
                <h2 className="font-serif text-xl font-semibold text-foreground">
                  {insightState.focus.title}
                </h2>
                <p className="max-w-2xl text-sm font-sans leading-relaxed text-muted-foreground">
                  {insightState.focus.body}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveTab(insightState.focus.tab);
                  if (insightState.focus.tab === "body") setFormOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gold px-4 py-3 text-sm font-sans font-semibold text-gold-foreground transition-all hover:opacity-90"
              >
                {insightState.focus.action}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {isGreek ? "Ένα σύστημα προόδου" : "One progress system"}
          </h2>
          <p className="text-sm font-sans text-muted-foreground">
            {isGreek
              ? "Το σώμα, το φαγητό και οι φωτογραφίες δεν είναι ξεχωριστά εργαλεία. Μαζί δίνουν το πιο καθαρό coaching context."
              : "Body, food, and photos are not separate tools. Together they create the clearest coaching context."}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {trackingGuides.map((guide) => (
            <button
              key={guide.key}
              onClick={() => {
                setActiveTab(guide.key);
                if (guide.key === "body") setFormOpen(true);
              }}
              className={cn(
                "rounded-[1.5rem] border p-4 text-left transition-all",
                activeTab === guide.key
                  ? "border-gold/40 bg-gold/10 shadow-sm"
                  : "border-border bg-card hover:border-border/80 hover:shadow-sm",
              )}
            >
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                {guide.title}
              </p>
              <p className="mt-2 font-serif text-lg font-semibold text-foreground">{guide.status}</p>
              <p className="mt-1 text-sm font-sans leading-relaxed text-muted-foreground">{guide.detail}</p>
              <span className="mt-4 inline-flex items-center gap-1 font-sans text-xs font-semibold text-gold">
                {guide.action}
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {tabs.map(({ key, icon: Icon, en, el }) => (
            <button
              key={key}
              data-guide={`measurements-${key}`}
              onClick={() => setActiveTab(key)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 font-sans text-sm font-medium transition-all",
                activeTab === key
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {lang === "en" ? en : el}
            </button>
          ))}
        </div>

        <div className="rounded-[1.5rem] border border-border/70 bg-card p-4">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            {isGreek ? "Τρέχον focus" : "Current focus"}
          </p>
          <h3 className="mt-2 font-serif text-xl font-semibold text-foreground">{tabHeader[lang]}</h3>
          <p className="mt-1 text-sm font-sans leading-relaxed text-muted-foreground">
            {activeTab === "body"
              ? (isGreek ? "Πρόσθεσε ή ανανέωσε τη μέτρηση όταν χρειάζεται πιο καθαρή εικόνα σε βάρος, μέση και ευεξία." : "Add or refresh a body check-in when you need a cleaner read on weight, waist, and wellness.")
              : activeTab === "food"
                ? (isGreek ? "Χρησιμοποίησε το food log για να δεις αν η καθημερινή εκτέλεση στηρίζει όντως το αποτέλεσμα." : "Use the food log to see whether daily execution is actually supporting the result.")
                : (isGreek ? "Οι φωτογραφίες κρατούν οπτική λογοδοσία και δείχνουν αλλαγές που οι αριθμοί συχνά κρύβουν." : "Photos keep visual accountability high and reveal changes that numbers often hide.")}
          </p>
        </div>
      </section>

      {activeTab === "body" && (
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border border-border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-sans font-semibold uppercase tracking-[0.22em] text-gold">
                  {isGreek ? "Ερμηνεία σώματος" : "Body intelligence"}
                </p>
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  {isGreek ? "Δες την πρόοδο πέρα από τον αριθμό" : "See the trend behind the number"}
                </h3>
                <p className="text-sm font-sans leading-relaxed text-muted-foreground">
                  {isGreek
                    ? "Οι βασικές μετρήσεις, οι περιφέρειες και τα scores ευεξίας συγκεντρώνονται εδώ για γρήγορη ανάγνωση."
                    : "Core body stats, circumferences, and wellness scores come together here for a quicker read of your progress."}
                </p>
              </div>
              <button
                onClick={() => setFormOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-sans font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                {isGreek ? "Νέα μέτρηση" : "New measurement"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-background px-4 py-3">
                <p className="text-xs font-sans text-muted-foreground">
                  {isGreek ? "Τελευταίο βάρος" : "Latest weight"}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold text-foreground">
                  {insightState.latestMeasurement?.weight_kg !== null && insightState.latestMeasurement?.weight_kg !== undefined
                    ? `${insightState.latestMeasurement.weight_kg.toFixed(1)}kg`
                    : "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <p className="text-xs font-sans text-muted-foreground">
                  {isGreek ? "Περίμετρος μέσης" : "Latest waist"}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold text-foreground">
                  {insightState.latestMeasurement?.waist_cm !== null && insightState.latestMeasurement?.waist_cm !== undefined
                    ? `${insightState.latestMeasurement.waist_cm.toFixed(1)}cm`
                    : "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <p className="text-xs font-sans text-muted-foreground">
                  {isGreek ? "Μέση ευεξία" : "Wellness average"}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold text-foreground">
                  {insightState.wellnessAverage !== null ? `${insightState.wellnessAverage.toFixed(1)}/10` : "—"}
                </p>
              </div>
            </div>
          </div>
          <BodyDashboard userId={userId} />
        </section>
      )}

      {activeTab === "food" && (
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                <Apple className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  {isGreek ? "Συνέπεια φαγητού και context" : "Food consistency and context"}
                </h3>
                <p className="text-sm font-sans leading-relaxed text-muted-foreground">
                  {isGreek
                    ? "Όσο πιο σταθερά γράφεις τα γεύματά σου, τόσο πιο εύκολο είναι να φανεί τι λειτουργεί και πού χρειάζεται προσαρμογή."
                    : "The more consistently you log meals, the easier it becomes to see what is working and where adjustment is needed."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-sans text-foreground">
                    {isGreek
                      ? `${insightState.foodDaysLogged}/7 ημέρες με logs`
                      : `${insightState.foodDaysLogged}/7 logged days`}
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-sans text-foreground">
                    {isGreek
                      ? `${insightState.todayFoodCount} εγγραφές σήμερα`
                      : `${insightState.todayFoodCount} entries today`}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <FoodDashboard userId={userId} />
        </section>
      )}

      {activeTab === "photos" && (
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                <Camera className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  {isGreek ? "Οπτική πρόοδος χωρίς θόρυβο" : "Visual progress without noise"}
                </h3>
                <p className="text-sm font-sans leading-relaxed text-muted-foreground">
                  {isGreek
                    ? "Οι σωστές φωτογραφίες σε ίδιο φως και ίδιες γωνίες δείχνουν αλλαγές που οι μετρήσεις πολλές φορές κρύβουν."
                    : "Consistent photos in the same light and angles reveal changes that body numbers often hide."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-sans text-foreground">
                    {insightState.latestPhoto
                      ? isGreek
                        ? `Τελευταία λήψη ${insightState.formatShortDate(insightState.latestPhoto.taken_at)}`
                        : `Last upload ${insightState.formatShortDate(insightState.latestPhoto.taken_at)}`
                      : isGreek
                        ? "Καμία φωτογραφία ακόμα"
                        : "No photos yet"}
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-sans text-foreground">
                    {isGreek
                      ? `${insightState.recentPhotoCount} φωτογραφίες / 7 ημέρες`
                      : `${insightState.recentPhotoCount} photos / 7 days`}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <PhotosDashboard userId={userId} />
        </section>
      )}

      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
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
            <div className="space-y-4 overflow-y-auto pr-1">
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
