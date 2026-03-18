import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { ListTodo, ChevronRight } from "lucide-react";
import TaskDrawer from "./TaskDrawer";

const TaskNotificationBanner = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [pendingCount, setPendingCount] = useState(0);
  const [latestTask, setLatestTask] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data, count } = await supabase
        .from("client_tasks" as any)
        .select("title", { count: "exact" })
        .eq("user_id", user.id)
        .is("completed_at", null)
        .order("due_date" as any)
        .limit(1);
      setPendingCount(count || 0);
      if (data && (data as any[]).length > 0) setLatestTask((data as any[])[0].title);
    };
    fetch();
  }, [user]);

  if (pendingCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="mb-4 flex w-full items-start gap-3 rounded-[1.5rem] border border-gold/20 bg-card/90 px-4 py-3 text-left shadow-sm transition-all hover:border-gold/35 hover:bg-gold/5"
      >
        <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gold/10 text-gold">
          <ListTodo className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            {lang === "el" ? "Σημερινές εκκρεμότητες" : "Today's follow-up"}
          </p>
          <p className="mt-1 font-serif text-base font-semibold text-foreground">
            {lang === "el"
              ? `${pendingCount} ${pendingCount === 1 ? "ενέργεια χρειάζεται" : "ενέργειες χρειάζονται"} προσοχή`
              : `${pendingCount} ${pendingCount === 1 ? "action needs" : "actions need"} attention`}
          </p>
          <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
            {latestTask
              ? latestTask
              : lang === "el"
                ? "Άνοιξε τη λίστα για να δεις τι πρέπει να κλείσει σήμερα."
                : "Open the task list to see what should be closed today."}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <TaskDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
};

export default TaskNotificationBanner;
