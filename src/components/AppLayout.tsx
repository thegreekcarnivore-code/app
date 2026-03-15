import { Outlet, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import ChatBubble from "./ChatBubble";
import AssistantBubble from "./AssistantBubble";
import ChatTrigger from "./ChatTrigger";
import { useLanguage } from "@/context/LanguageContext";
import { useGuideHighlight } from "@/context/GuideHighlightContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChatContext } from "@/context/ChatContext";
import { usePageActions } from "@/context/PageActionsContext";
import TaskNotificationBanner from "./TaskNotificationBanner";
import MeasurementReminderBanner from "./MeasurementReminderBanner";
import FormSigningFlow from "./onboarding/FormSigningFlow";
import OnboardingTour from "./onboarding/OnboardingTour";
import FeatureAccessDropdown from "@/components/admin/FeatureAccessDropdown";
import NotificationBell from "@/components/NotificationBell";
import { Bookmark, Clock, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const AppLayout = () => {
  const { lang, toggleLanguage } = useLanguage();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [tourCompleted, setTourCompleted] = useState(true);
  const [manualTour, setManualTour] = useState(false);
  const { chatOpen, setChatOpen, assistantOpen, setAssistantOpen, pendingGuide, setPendingGuide, requestTour, setRequestTour } = useChatContext();
  const { actions } = usePageActions();
  const { showHighlight, state: guideState } = useGuideHighlight();
  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?";
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: pushSubscribe } = usePushNotifications();

  // Auto-subscribe non-admin clients to push notifications on first load
  useEffect(() => {
    if (!user || isAdmin || !pushSupported || pushSubscribed) return;
    // Small delay so the page renders first
    const timer = setTimeout(() => {
      pushSubscribe();
    }, 3000);
    return () => clearTimeout(timer);
  }, [user, isAdmin, pushSupported, pushSubscribed, pushSubscribe]);
  // Clear floating "Show Me" button when guide finishes or is dismissed
  useEffect(() => {
    if (!guideState.active && pendingGuide === null) return;
    // If guide just became inactive and there's no pending guide steps left, clear it
    if (!guideState.active && guideState.totalSteps === 0 && pendingGuide) {
      setPendingGuide(null);
    }
  }, [guideState.active, guideState.totalSteps, pendingGuide, setPendingGuide]);

  // Listen for tour request from assistant
  useEffect(() => {
    if (requestTour) {
      setRequestTour(false);
      setManualTour(true);
    }
  }, [requestTour, setRequestTour]);

  // Onboarding gate state
  const [onboardingEnrollment, setOnboardingEnrollment] = useState<{ id: string; program_template_id: string } | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url, onboarding_tour_completed, timezone" as any)
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl((data as any).avatar_url ?? null);
          setTourCompleted((data as any).onboarding_tour_completed ?? true);
          // Auto-detect timezone on first load
          if (!(data as any).timezone) {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            supabase.from("profiles").update({ timezone: tz } as any).eq("id", user.id).then(() => {});
          }
        }
      });

    checkOnboarding();
  }, [user]);

  const checkOnboarding = async () => {
    if (!user) return;
    const { data: enrollments } = await supabase
      .from("client_program_enrollments" as any)
      .select("id, program_template_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (!enrollments || (enrollments as any[]).length === 0) {
      setOnboardingComplete(true);
      return;
    }

    const enrollment = (enrollments as any[])[0];

    const { data: forms } = await supabase
      .from("program_forms" as any)
      .select("id")
      .eq("program_template_id", enrollment.program_template_id);

    if (!forms || (forms as any[]).length === 0) {
      setOnboardingComplete(true);
      // Only trigger day-0 messages on first login (tour not yet completed)
      if (!tourCompleted) {
        supabase.functions.invoke("send-day-zero-messages", {
          body: { user_id: user.id },
        }).catch((err) => console.error("Day-0 messages error:", err));
      }
      return;
    }

    const { data: signatures } = await supabase
      .from("client_form_signatures" as any)
      .select("form_id")
      .eq("enrollment_id", enrollment.id)
      .eq("user_id", user.id);

    const signedIds = new Set((signatures as any[] || []).map((s: any) => s.form_id));
    const allSigned = (forms as any[]).every((f: any) => signedIds.has(f.id));

    if (!allSigned) {
      setOnboardingEnrollment(enrollment);
      setOnboardingComplete(false);
    } else {
      setOnboardingComplete(true);
    }
  };

  if (!onboardingComplete && onboardingEnrollment) {
    return (
      <FormSigningFlow
        enrollmentId={onboardingEnrollment.id}
        templateId={onboardingEnrollment.program_template_id}
        onComplete={() => {
          setOnboardingComplete(true);
          // Send day-0 program messages immediately after onboarding
          if (user) {
            supabase.functions.invoke("send-day-zero-messages", {
              body: { user_id: user.id },
            }).catch((err) => console.error("Day-0 messages error:", err));
          }
        }}
      />
    );
  }

  // Tour is now rendered as an overlay inside the layout below

  return (
    <div className="min-h-screen bg-background">
      {/* Right pill – actions, profile & language */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-1.5 rounded-xl border border-border/50 glass-card p-1 text-xs font-sans font-medium shadow-lg shadow-black/5">
          {/* Page-level action buttons */}
          {actions.hasHistory && actions.onOpenHistory && (
            <button
              onClick={actions.onOpenHistory}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 transition-all hover:bg-muted/50 text-foreground"
              aria-label="History"
            >
              <Clock className="h-4 w-4" />
              <span className="text-[10px] font-sans font-medium text-muted-foreground">
                {lang === "el" ? "Ιστορικό" : "History"}
              </span>
            </button>
          )}
          {actions.hasSaved && actions.onOpenSaved && (
            <button
              onClick={actions.onOpenSaved}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 transition-all hover:bg-muted/50 text-foreground"
              aria-label="Saved"
            >
              <Bookmark className="h-4 w-4" />
              <span className="text-[10px] font-sans font-medium text-muted-foreground">
                {lang === "el" ? "Αποθηκ." : "Saved"}
              </span>
            </button>
          )}
          {isAdmin && actions.featureKey && actions.featureLabel && (
            <FeatureAccessDropdown featureKey={actions.featureKey} label={actions.featureLabel} />
          )}
          <ChatTrigger />
          <NotificationBell />
          <button data-guide="profile-button" onClick={() => navigate("/profile")} className="rounded-full transition-all hover:opacity-80 hover:ring-2 hover:ring-gold/30">
            <Avatar className="h-7 w-7">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" /> : null}
              <AvatarFallback className="text-xs font-serif bg-primary/10 text-primary">{userInitial}</AvatarFallback>
            </Avatar>
          </button>
          <button
            onClick={() => lang !== "en" && toggleLanguage()}
            className={cn(
              "rounded-md px-2 py-1 transition-all duration-200",
              lang === "en" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            EN
          </button>
          <button
            onClick={() => lang !== "el" && toggleLanguage()}
            className={cn(
              "rounded-md px-2 py-1 transition-all duration-200",
              lang === "el" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Ελ
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-3 sm:px-4 pt-14 pb-24">
        <TaskNotificationBanner />
        <MeasurementReminderBanner />
        <Outlet />
      </main>
      <BottomNav />

      {/* Floating guide button – persists when assistant chat is closed */}
      <AnimatePresence>
        {!assistantOpen && pendingGuide && pendingGuide.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={() => { setPendingGuide(null); showHighlight(pendingGuide); }}
            className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 shadow-lg shadow-gold/20 text-gold-foreground transition-all hover:shadow-xl hover:shadow-gold/30 hover:scale-105"
          >
            <MapPin className="h-4 w-4" />
            <span className="font-sans text-xs font-semibold">
              {lang === "el" ? "Δείξε μου" : "Show Me"}
              {pendingGuide.length > 1 && (
                <span className="ml-1 opacity-70 font-normal">({pendingGuide.length} {lang === "el" ? "βήματα" : "steps"})</span>
              )}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Onboarding tour overlay — renders ON TOP of the actual pages */}
      {(manualTour || (onboardingComplete && !tourCompleted && !isAdmin)) && (
        <OnboardingTour onComplete={() => { setTourCompleted(true); setManualTour(false); }} />
      )}

      <ChatBubble open={chatOpen} onOpenChange={setChatOpen} />
      <AssistantBubble open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  );
};

export default AppLayout;
