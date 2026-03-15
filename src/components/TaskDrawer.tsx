import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle2, Circle, Ruler, Camera, Video, FileText } from "lucide-react";

interface ClientTask {
  id: string;
  title: string;
  description: string;
  task_type: string;
  due_date: string;
  completed_at: string | null;
}

const TaskDrawer = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ClientTask[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("client_tasks" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("due_date" as any)
      .order("completed_at" as any, { nullsFirst: true })
      .limit(50)
      .then(({ data }) => { if (data) setTasks(data as any[]); });
  }, [open, user]);

  const completeTask = async (taskId: string) => {
    const { error } = await supabase
      .from("client_tasks" as any)
      .update({ completed_at: new Date().toISOString() } as any)
      .eq("id", taskId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "measurement": return <Ruler className="h-4 w-4" />;
      case "food_journal": return <Camera className="h-4 w-4" />;
      case "watch_video": return <Video className="h-4 w-4" />;
      case "sign_form": return <FileText className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const handleTaskAction = (task: ClientTask) => {
    if (task.task_type === "measurement") {
      navigate("/measurements");
      onOpenChange(false);
    } else if (task.task_type === "watch_video") {
      navigate("/learn");
      onOpenChange(false);
    } else if (task.task_type === "food_journal") {
      navigate("/measurements");
      onOpenChange(false);
    }
  };

  const pending = tasks.filter((t) => !t.completed_at);
  const completed = tasks.filter((t) => t.completed_at);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-base">Your Tasks</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 overflow-y-auto max-h-[calc(70vh-80px)]">
          {pending.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-sans text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending</h3>
              {pending.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <button onClick={() => completeTask(t.id)} className="text-muted-foreground hover:text-gold transition-colors">
                    <Circle className="h-5 w-5" />
                  </button>
                  <button onClick={() => handleTaskAction(t)} className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-gold">{getIcon(t.task_type)}</span>
                      <span className="font-sans text-sm font-medium text-foreground">{t.title}</span>
                    </div>
                    {t.description && <p className="font-sans text-[10px] text-muted-foreground mt-0.5">{t.description}</p>}
                    <p className="font-sans text-[10px] text-muted-foreground">Due: {new Date(t.due_date).toLocaleDateString()}</p>
                  </button>
                </div>
              ))}
            </div>
          )}
          {completed.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-sans text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed</h3>
              {completed.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3 opacity-60">
                  <CheckCircle2 className="h-5 w-5 text-gold" />
                  <div className="flex-1">
                    <span className="font-sans text-sm text-foreground line-through">{t.title}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tasks.length === 0 && (
            <p className="text-center font-sans text-sm text-muted-foreground py-8">No tasks yet.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TaskDrawer;
