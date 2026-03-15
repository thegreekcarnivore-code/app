import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { format, differenceInDays, differenceInWeeks, startOfWeek, addDays } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Video,
  Ruler,
  UtensilsCrossed,
  BookOpen,
  ChevronRight,
  Target,
  ExternalLink,
  Calendar,
  AlertTriangle,
  Camera,
} from "lucide-react";

interface ClientTask {
  id: string;
  title: string;
  description: string;
  task_type: string;
  completed_at: string | null;
  due_date: string;
  linked_content_id: string | null;
}

interface UpcomingCall {
  id: string;
  title: string;
  meeting_url: string;
  scheduled_at: string;
  duration_minutes: number;
}

interface MeasurementStatus {
  isDueToday: boolean;
  isUpToDate: boolean;
  daysBehind: number;
}

interface PhotoStatus {
  isDueToday: boolean;
  isUpToDate: boolean;
  daysBehind: number;
}

interface DailyTasksCardProps {
  onOpenFoodForm?: () => void;
  onOpenMeasurements?: () => void;
  onOpenPhotos?: () => void;
}

const TASK_TYPE_CONFIG: Record<string, { icon: typeof ClipboardList; route: string }> = {
  measurement: { icon: Ruler, route: "/measurements" },
  video: { icon: Video, route: "/videos" },
  recipe: { icon: UtensilsCrossed, route: "/resources" },
  food_journal: { icon: UtensilsCrossed, route: "/measurements" },
  reading: { icon: BookOpen, route: "/resources" },
  custom: { icon: ClipboardList, route: "/home" },
};

const DailyTasksCard = ({ onOpenFoodForm, onOpenMeasurements, onOpenPhotos }: DailyTasksCardProps) => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const isGreek = lang === "el";
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [todayHasFood, setTodayHasFood] = useState(false);
  const [upcomingCalls, setUpcomingCalls] = useState<UpcomingCall[]>([]);
  const [measurementStatus, setMeasurementStatus] = useState<MeasurementStatus | null>(null);
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      // Fetch DB tasks, food journal, calls, enrollment, and latest measurement in parallel
      const [tasksRes, foodRes, participationsRes, enrollmentRes, latestMeasurementRes, latestPhotoRes] = await Promise.all([
        supabase
          .from("client_tasks" as any)
          .select("id, title, description, task_type, completed_at, due_date, linked_content_id")
          .eq("user_id", user.id)
          .eq("due_date", today)
          .order("completed_at" as any, { nullsFirst: true }),
        supabase
          .from("food_journal")
          .select("id")
          .eq("user_id", user.id)
          .eq("entry_date", today)
          .limit(1),
        supabase
          .from("video_call_participants" as any)
          .select("video_call_id")
          .eq("user_id", user.id),
        supabase
          .from("client_program_enrollments")
          .select("weekly_day, start_date")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("measurements")
          .select("measured_at")
          .eq("user_id", user.id)
          .order("measured_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("progress_photos")
          .select("taken_at")
          .eq("user_id", user.id)
          .order("taken_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data as any as ClientTask[]);
      setTodayHasFood((foodRes.data?.length ?? 0) > 0);

      // Calculate measurement status
      if (enrollmentRes.data) {
        const weeklyDay = enrollmentRes.data.weekly_day; // 0=Sun..6=Sat
        const now = new Date();
        const todayDow = now.getDay(); // 0=Sun..6=Sat
        const isDueToday = todayDow === weeklyDay;

        // Find the most recent expected measurement date
        const weekStart = startOfWeek(now, { weekStartsOn: 0 });
        let expectedDate = addDays(weekStart, weeklyDay);
        // If the expected day this week hasn't come yet, use last week's
        if (expectedDate > now) {
          expectedDate = addDays(expectedDate, -7);
        }

        const lastMeasuredAt = latestMeasurementRes.data?.measured_at
          ? new Date(latestMeasurementRes.data.measured_at)
          : null;

        // Up to date if they measured on or after the most recent expected date
        const isUpToDate = lastMeasuredAt ? lastMeasuredAt >= expectedDate : false;

        let daysBehind = 0;
        if (!isUpToDate) {
          daysBehind = lastMeasuredAt
            ? differenceInDays(now, lastMeasuredAt)
            : differenceInDays(now, new Date(enrollmentRes.data.start_date));
        }

        setMeasurementStatus({ isDueToday, isUpToDate, daysBehind });

        // Calculate photo status (same weekly schedule as measurements)
        const lastPhotoAt = latestPhotoRes.data?.taken_at
          ? new Date(latestPhotoRes.data.taken_at)
          : null;
        const photoUpToDate = lastPhotoAt ? lastPhotoAt >= expectedDate : false;
        let photoDaysBehind = 0;
        if (!photoUpToDate) {
          photoDaysBehind = lastPhotoAt
            ? differenceInDays(now, lastPhotoAt)
            : differenceInDays(now, new Date(enrollmentRes.data.start_date));
        }
        setPhotoStatus({ isDueToday, isUpToDate: photoUpToDate, daysBehind: photoDaysBehind });
      }

      // Fetch upcoming calls
      if (participationsRes.data && participationsRes.data.length > 0) {
        const callIds = (participationsRes.data as any[]).map((p: any) => p.video_call_id);
        const { data: callsData } = await supabase
          .from("video_calls" as any)
          .select("id, title, meeting_url, scheduled_at, duration_minutes")
          .in("id", callIds)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(3);
        if (callsData) setUpcomingCalls(callsData as any);
      }

      setLoading(false);
    };

    fetchAll();
  }, [user, today]);

  const toggleComplete = useCallback(
    async (task: ClientTask) => {
      const newValue = task.completed_at ? null : new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed_at: newValue } : t))
      );
      await supabase
        .from("client_tasks" as any)
        .update({ completed_at: newValue } as any)
        .eq("id", task.id);
    },
    []
  );

  const navigateToTask = (task: ClientTask) => {
    const config = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.custom;
    navigate(config.route);
  };

  if (loading) return null;

  // Progress: DB tasks + food diary + measurement + photos (if enrolled) + upcoming calls
  const hasMeasurement = measurementStatus !== null;
  const hasPhotos = photoStatus !== null;
  const completedDbTasks = tasks.filter((t) => t.completed_at).length;
  const totalCount = tasks.length + 1 + (hasMeasurement ? 1 : 0) + (hasPhotos ? 1 : 0) + upcomingCalls.length;
  const completedCount =
    completedDbTasks +
    (todayHasFood ? 1 : 0) +
    (hasMeasurement && measurementStatus.isUpToDate ? 1 : 0) +
    (hasPhotos && photoStatus.isUpToDate ? 1 : 0);
  const progressValue = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Build overdue label
  const getOverdueLabel = (status: MeasurementStatus | PhotoStatus | null) => {
    if (!status || status.isUpToDate) return null;
    const { daysBehind } = status;
    if (daysBehind <= 0) return null;
    const weeks = differenceInWeeks(new Date(), new Date(Date.now() - daysBehind * 86400000));
    if (weeks >= 2) {
      return isGreek ? `${weeks} εβδομάδες καθυστέρηση` : `${weeks} weeks overdue`;
    }
    return isGreek ? `${daysBehind} ημέρες καθυστέρηση` : `${daysBehind} days overdue`;
  };

  const overdueLabel = getOverdueLabel(measurementStatus);
  const photoOverdueLabel = getOverdueLabel(photoStatus);

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="pb-3 pt-4 px-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-gold" />
            <h3 className="font-serif text-sm font-semibold text-foreground">
              {isGreek ? "Σημερινές Εργασίες" : "Today's Tasks"}
            </h3>
          </div>
          <span className="font-sans text-[11px] text-muted-foreground">
            {completedCount}/{totalCount} {isGreek ? "ολοκληρώθηκαν" : "done"}
          </span>
        </div>
        <Progress value={progressValue} className="h-2" />
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-1">
        {/* Permanent Food Diary task */}
        <div className="flex items-start gap-3 rounded-xl p-2.5 -mx-1 hover:bg-muted/50 transition-colors">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!todayHasFood && onOpenFoodForm) onOpenFoodForm();
            }}
            className="mt-0.5 flex-shrink-0"
          >
            {todayHasFood ? (
              <CheckCircle2 className="h-5 w-5 text-gold" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => onOpenFoodForm?.()}
            className="flex-1 text-left min-w-0"
          >
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <p
                className={`font-sans text-sm leading-tight ${
                  todayHasFood
                    ? "line-through text-muted-foreground"
                    : "text-foreground font-medium"
                }`}
              >
                {isGreek ? "Ημερολόγιο Διατροφής" : "Food Diary"}
              </p>
            </div>
            <p className="font-sans text-[11px] text-muted-foreground mt-0.5 ml-5.5 line-clamp-2">
              {isGreek ? "Καταγράψτε τι φάγατε σήμερα" : "Log what you ate today"}
            </p>
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        </div>

        {/* Measurement task */}
        {hasMeasurement && (
          <div
            className="flex items-start gap-3 rounded-xl p-2.5 -mx-1 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => onOpenMeasurements?.()}
          >
            <div className="mt-0.5 flex-shrink-0">
              {measurementStatus.isUpToDate ? (
                <CheckCircle2 className="h-5 w-5 text-gold" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Ruler className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <p
                  className={`font-sans text-sm leading-tight ${
                    measurementStatus.isUpToDate
                      ? "line-through text-muted-foreground"
                      : "text-foreground font-medium"
                  }`}
                >
                  {isGreek ? "Μετρήσεις" : "Measurements"}
                </p>
              </div>
              {measurementStatus.isUpToDate ? (
                <p className="font-sans text-[11px] text-muted-foreground mt-0.5 ml-5.5">
                  {isGreek ? "Ενημερωμένες ✓" : "Up to date ✓"}
                </p>
              ) : overdueLabel ? (
                <div className="flex items-center gap-1.5 mt-0.5 ml-5.5">
                  <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                  <p className="font-sans text-[11px] text-destructive font-medium">
                    {overdueLabel}
                  </p>
                </div>
              ) : (
                <p className="font-sans text-[11px] text-muted-foreground mt-0.5 ml-5.5">
                  {measurementStatus.isDueToday
                    ? isGreek ? "Σήμερα είναι η μέρα μετρήσεων" : "Today is measurement day"
                    : isGreek ? "Καταγράψτε τις μετρήσεις σας" : "Log your measurements"}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          </div>
        )}

        {/* Progress Photos task */}
        {hasPhotos && (
          <div
            className="flex items-start gap-3 rounded-xl p-2.5 -mx-1 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => onOpenPhotos?.()}
          >
            <div className="mt-0.5 flex-shrink-0">
              {photoStatus.isUpToDate ? (
                <CheckCircle2 className="h-5 w-5 text-gold" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Camera className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <p
                  className={`font-sans text-sm leading-tight ${
                    photoStatus.isUpToDate
                      ? "line-through text-muted-foreground"
                      : "text-foreground font-medium"
                  }`}
                >
                  {isGreek ? "Φωτογραφίες Προόδου" : "Progress Photos"}
                </p>
              </div>
              {photoStatus.isUpToDate ? (
                <p className="font-sans text-[11px] text-muted-foreground mt-0.5 ml-5.5">
                  {isGreek ? "Ενημερωμένες ✓" : "Up to date ✓"}
                </p>
              ) : photoOverdueLabel ? (
                <div className="flex items-center gap-1.5 mt-0.5 ml-5.5">
                  <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                  <p className="font-sans text-[11px] text-destructive font-medium">
                    {photoOverdueLabel}
                  </p>
                </div>
              ) : (
                <p className="font-sans text-[11px] text-muted-foreground mt-0.5 ml-5.5">
                  {photoStatus.isDueToday
                    ? isGreek ? "Σήμερα είναι η μέρα φωτογραφιών" : "Today is photo day"
                    : isGreek ? "Τραβήξτε τις φωτογραφίες προόδου" : "Take your progress photos"}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          </div>
        )}

        {/* DB tasks */}
        {tasks.map((task) => {
          const isDone = !!task.completed_at;
          const config = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.custom;
          const Icon = config.icon;

          return (
            <div
              key={task.id}
              className="flex items-start gap-3 rounded-xl p-2.5 -mx-1 hover:bg-muted/50 transition-colors"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleComplete(task);
                }}
                className="mt-0.5 flex-shrink-0"
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-gold" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={() => navigateToTask(task)}
                className="flex-1 text-left min-w-0"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <p
                    className={`font-sans text-sm leading-tight ${
                      isDone
                        ? "line-through text-muted-foreground"
                        : "text-foreground font-medium"
                    }`}
                  >
                    {task.title}
                  </p>
                </div>
                {task.description && (
                  <p className="font-sans text-[11px] text-muted-foreground mt-0.5 ml-5.5 line-clamp-2">
                    {task.description}
                  </p>
                )}
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            </div>
          );
        })}

        {/* Upcoming calls */}
        {upcomingCalls.map((call) => (
          <a
            key={call.id}
            href={call.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 rounded-xl p-2.5 -mx-1 hover:bg-muted/50 transition-colors"
          >
            <div className="mt-0.5 flex-shrink-0">
              <Video className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <p className="font-sans text-sm leading-tight text-foreground font-medium truncate">
                  {call.title}
                </p>
              </div>
              <p className="font-sans text-[11px] text-muted-foreground mt-0.5 ml-5.5">
                {format(new Date(call.scheduled_at), "EEE, d MMM · HH:mm")} · {call.duration_minutes} min
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          </a>
        ))}
      </CardContent>
    </Card>
  );
};

export default DailyTasksCard;
