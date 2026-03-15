import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { format, differenceInWeeks, differenceInDays, addWeeks } from "date-fns";
import { el, enUS } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

interface EnrollmentWithProgram {
  id: string;
  start_date: string;
  duration_weeks_override: number | null;
  status: string;
  program_template: {
    name: string;
    duration_weeks: number;
  };
}

const ProgramProgressBar = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [enrollment, setEnrollment] = useState<EnrollmentWithProgram | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("client_program_enrollments")
      .select("id, start_date, duration_weeks_override, status, program_template:program_templates(name, duration_weeks)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data && !error) {
          // Flatten joined data
          const tmpl = Array.isArray(data.program_template)
            ? data.program_template[0]
            : data.program_template;
          // Guard: only set enrollment if template data is present and valid
          if (tmpl && typeof tmpl === "object" && "name" in tmpl && "duration_weeks" in tmpl) {
            const totalWeeks = (data as any).duration_weeks_override ?? tmpl.duration_weeks;
            if (typeof totalWeeks === "number" && totalWeeks > 0 && isFinite(totalWeeks)) {
              setEnrollment({
                ...data,
                program_template: tmpl as any,
              } as EnrollmentWithProgram);
            }
          }
        }
        setLoading(false);
      });
  }, [user]);

  if (loading || !enrollment) return null;

  const startDate = new Date(enrollment.start_date);
  const totalWeeks = enrollment.duration_weeks_override ?? enrollment.program_template.duration_weeks;
  const endDate = addWeeks(startDate, totalWeeks);
  const now = new Date();

  const currentWeek = Math.max(1, Math.min(totalWeeks, differenceInWeeks(now, startDate) + 1));
  const daysRemaining = Math.max(0, differenceInDays(endDate, now));
  const progressValue = Math.min(100, (currentWeek / totalWeeks) * 100);

  const locale = isGreek ? el : enUS;
  const startStr = format(startDate, "d MMM yyyy", { locale });
  const endStr = format(endDate, "d MMM yyyy", { locale });

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="h-4 w-4 text-gold flex-shrink-0" />
            <h3 className="font-serif text-sm font-semibold text-foreground truncate">
              {enrollment.program_template.name}
            </h3>
          </div>
          <span className="font-sans text-[11px] text-muted-foreground whitespace-nowrap ml-2">
            {isGreek ? `Εβδομάδα ${currentWeek} / ${totalWeeks}` : `Week ${currentWeek} of ${totalWeeks}`}
          </span>
        </div>

        <Progress value={progressValue} className="h-2" />

        <div className="flex items-center justify-between">
          <span className="font-sans text-[10px] text-muted-foreground">{startStr}</span>
          <span className="font-sans text-[10px] text-muted-foreground">
            {daysRemaining > 0
              ? isGreek
                ? `${daysRemaining} ημέρες απομένουν`
                : `${daysRemaining} days remaining`
              : isGreek
                ? "Ολοκληρώθηκε"
                : "Completed"}
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">{endStr}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgramProgressBar;
