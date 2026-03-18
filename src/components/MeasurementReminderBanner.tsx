import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { Scale, Camera, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MeasurementReminderBanner = () => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkMeasurements();
  }, [user]);

  const checkMeasurements = async () => {
    if (!user || isAdmin) return;

    // Get active enrollment with weekly_day
    const { data: enrollments } = await supabase
      .from("client_program_enrollments" as any)
      .select("id, start_date, weekly_day")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (!enrollments || (enrollments as any[]).length === 0) return;

    const enrollment = (enrollments as any[])[0];
    const startDate = new Date(enrollment.start_date);
    const today = new Date();
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Only show after the first week
    if (daysSinceStart < 7) return;

    // Calculate the start of the current measurement week
    // weekly_day is 0=Sun, 1=Mon, etc.
    const todayDow = today.getDay();
    const weeklyDay = enrollment.weekly_day ?? 1;

    // Calculate days since last measurement day
    let daysSinceLastMeasDay = (todayDow - weeklyDay + 7) % 7;
    // If today IS the measurement day, daysSinceLastMeasDay = 0

    // Only show reminder from measurement day until end of that period (within 3 days)
    if (daysSinceLastMeasDay > 3) return;

    // Check if they've submitted measurements in the current week window
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysSinceLastMeasDay);
    weekStart.setHours(0, 0, 0, 0);

    const { data: measurements } = await supabase
      .from("measurements")
      .select("id")
      .eq("user_id", user.id)
      .gte("measured_at", weekStart.toISOString())
      .limit(1);

    const hasMeasurements = measurements && measurements.length > 0;

    // Also check progress photos
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const { data: photos } = await supabase
      .from("progress_photos")
      .select("id")
      .eq("user_id", user.id)
      .gte("taken_at", weekStartStr)
      .limit(1);

    const hasPhotos = photos && photos.length > 0;

    // Show if either is missing
    if (!hasMeasurements || !hasPhotos) {
      setShow(true);
    }
  };

  const handleGoToMeasurements = () => {
    setDismissed(true);
    navigate("/measurements");
  };

  if (!show || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        className="relative mb-4 overflow-hidden rounded-[1.5rem] border border-gold/25 bg-[linear-gradient(135deg,hsl(var(--beige))_0%,hsl(var(--background))_100%)] p-4 shadow-sm"
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1 mt-0.5">
            <Scale className="h-5 w-5 text-gold" />
            <Camera className="h-4 w-4 text-gold/70" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              {lang === "el"
                ? "Εβδομαδιαία υπενθύμιση"
                : "Weekly reminder"}
            </p>
            <p className="font-serif text-base font-semibold text-foreground leading-snug">
              {lang === "el"
                ? "Κράτα το check-in σου στην ώρα του"
                : "Keep your check-in on rhythm"}
            </p>
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              {lang === "el"
                ? "Οι μετρήσεις και οι φωτογραφίες της εβδομάδας δίνουν στον coach καθαρή εικόνα για το τι αλλάζει και πού χρειάζεται προσαρμογή."
                : "Your weekly measurements and photos give your coach a clearer read on what is changing and what needs adjustment."}
            </p>
            <button
              onClick={handleGoToMeasurements}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3 py-2 font-sans text-xs font-semibold text-gold-foreground transition-all hover:opacity-90 hover:shadow-md shadow-sm"
            >
              {lang === "el" ? "Άνοιγμα μετρήσεων" : "Open measurements"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MeasurementReminderBanner;
