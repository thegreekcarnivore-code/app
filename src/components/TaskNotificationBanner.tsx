import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ListTodo, ChevronRight } from "lucide-react";
import TaskDrawer from "./TaskDrawer";

const TaskNotificationBanner = () => {
  const { user } = useAuth();
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
        className="w-full flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 mb-4 transition-colors hover:bg-gold/20"
      >
        <ListTodo className="h-4 w-4 text-gold flex-shrink-0" />
        <div className="flex-1 text-left">
          <p className="font-sans text-xs font-medium text-foreground">
            {pendingCount} pending task{pendingCount !== 1 ? "s" : ""}
          </p>
          {latestTask && <p className="font-sans text-[10px] text-muted-foreground truncate">{latestTask}</p>}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <TaskDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
};

export default TaskNotificationBanner;
