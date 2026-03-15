import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, Circle, AlertTriangle, Clock, ArrowUp, ArrowDown, Minus, User, Repeat, CalendarDays } from "lucide-react";

interface AdminTask {
  id: string;
  admin_id: string;
  client_id: string | null;
  title: string;
  description: string;
  priority: string;
  recurrence: string | null;
  source: string;
  source_call_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ClientProfile {
  id: string;
  email: string;
  display_name: string | null;
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  urgent: { label: "Urgent", icon: <AlertTriangle className="h-3 w-3" />, color: "text-destructive" },
  high: { label: "High", icon: <ArrowUp className="h-3 w-3" />, color: "text-orange-500" },
  medium: { label: "Medium", icon: <Minus className="h-3 w-3" />, color: "text-muted-foreground" },
  low: { label: "Low", icon: <ArrowDown className="h-3 w-3" />, color: "text-blue-400" },
};

interface AdminTodoPanelProps {
  clientFilter?: string | null;
  onClearFilter?: () => void;
}

const AdminTodoPanel = ({ clientFilter, onClearFilter }: AdminTodoPanelProps) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "urgent" | "high" | "medium" | "low">("all");

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newClientId, setNewClientId] = useState<string>("");
  const [newRecurrence, setNewRecurrence] = useState<string>("");
  const [newDueDate, setNewDueDate] = useState("");

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchClients();
    }
  }, [user]);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from("admin_tasks" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTasks(data as any[]);
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("approved", true)
      .order("email");
    if (data) setClients(data as ClientProfile[]);
  };

  const createTask = async () => {
    if (!newTitle.trim() || !user) return;
    const { error } = await supabase.from("admin_tasks" as any).insert({
      admin_id: user.id,
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      client_id: newClientId || null,
      recurrence: newRecurrence || null,
      due_date: newDueDate || null,
      source: "manual",
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task created" });
      setNewTitle(""); setNewDesc(""); setNewPriority("medium"); setNewClientId(""); setNewRecurrence(""); setNewDueDate("");
      setCreateOpen(false);
      fetchTasks();
    }
  };

  const toggleComplete = async (task: AdminTask) => {
    const newVal = task.completed_at ? null : new Date().toISOString();
    const { error } = await supabase
      .from("admin_tasks" as any)
      .update({ completed_at: newVal } as any)
      .eq("id", task.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed_at: newVal } : t));
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("admin_tasks" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setTasks(prev => prev.filter(t => t.id !== id));
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return null;
    const c = clients.find(p => p.id === clientId);
    return c ? (c.display_name || c.email) : null;
  };

  const filteredClientName = clientFilter ? getClientName(clientFilter) : null;

  const pending = tasks
    .filter(t => !t.completed_at)
    .filter(t => filter === "all" || t.priority === filter)
    .filter(t => !clientFilter || t.client_id === clientFilter)
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

  const completed = tasks.filter(t => t.completed_at).sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());

  const isOverdue = (d: string | null) => {
    if (!d) return false;
    return new Date(d) < new Date(new Date().toDateString());
  };

  return (
    <div className="space-y-4">
      {/* Client filter banner */}
      {clientFilter && filteredClientName && (
        <div className="flex items-center justify-between rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5">
          <span className="font-sans text-sm font-medium text-gold flex items-center gap-2">
            <User className="h-4 w-4" />
            Showing tasks for <strong>{filteredClientName}</strong>
          </span>
          <button onClick={onClearFilter} className="font-sans text-xs font-medium text-gold hover:text-gold/80 underline transition-colors">
            Show all
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-base font-semibold text-foreground">My To-Do List</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Task
        </Button>
      </div>

      {/* Priority filter */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "urgent", "high", "medium", "low"] as const).map(p => {
          const count = p === "all" ? pending.length : tasks.filter(t => !t.completed_at && t.priority === p).length;
          return (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`rounded-full px-3 py-1 font-sans text-[11px] font-medium transition-all ${filter === p ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {p === "all" ? "All" : PRIORITY_CONFIG[p].label} ({count})
            </button>
          );
        })}
      </div>

      {/* Pending tasks */}
      <div className="space-y-2">
        {pending.map(task => {
          const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
          const clientName = getClientName(task.client_id);
          const overdue = isOverdue(task.due_date);

          return (
            <div key={task.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 group">
              <button onClick={() => toggleComplete(task)} className="mt-0.5 text-muted-foreground hover:text-gold transition-colors">
                <Circle className="h-5 w-5" />
              </button>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`${pri.color}`}>{pri.icon}</span>
                  <span className="font-sans text-sm font-medium text-foreground">{task.title}</span>
                  {task.recurrence && (
                    <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-sans font-medium text-primary">
                      <Repeat className="h-2.5 w-2.5" />
                      {task.recurrence}
                    </span>
                  )}
                  {task.source === "call_transcript" && (
                    <span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[9px] font-sans font-medium text-gold">from call</span>
                  )}
                </div>
                {task.description && <p className="font-sans text-[10px] text-muted-foreground">{task.description}</p>}
                <div className="flex items-center gap-2 text-[10px] font-sans text-muted-foreground">
                  {clientName && (
                    <span className="flex items-center gap-0.5">
                      <User className="h-2.5 w-2.5" /> {clientName}
                    </span>
                  )}
                  {task.due_date && (
                    <span className={`flex items-center gap-0.5 ${overdue ? "text-destructive font-medium" : ""}`}>
                      <CalendarDays className="h-2.5 w-2.5" /> {new Date(task.due_date).toLocaleDateString()}
                      {overdue && " (overdue)"}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-all">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {pending.length === 0 && (
          <p className="text-center font-sans text-sm text-muted-foreground py-6">No pending tasks 🎉</p>
        )}
      </div>

      {/* Completed section */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowCompleted(!showCompleted)} className="font-sans text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
            Completed ({completed.length}) {showCompleted ? "▲" : "▼"}
          </button>
          {showCompleted && completed.map(task => (
            <div key={task.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-3 opacity-60 group">
              <button onClick={() => toggleComplete(task)} className="text-gold">
                <CheckCircle2 className="h-5 w-5" />
              </button>
              <span className="font-sans text-sm text-foreground line-through flex-1">{task.title}</span>
              <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-all">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create task dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px]">Title *</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What needs to be done?" className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-[10px]">Description</Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Details..." className="text-xs mt-1 min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px]">Priority</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger className="text-xs mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Recurrence</Label>
                <Select value={newRecurrence} onValueChange={setNewRecurrence}>
                  <SelectTrigger className="text-xs mt-1 h-9"><SelectValue placeholder="One-time" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">One-time</SelectItem>
                    <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                    <SelectItem value="biweekly" className="text-xs">Biweekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px]">Client (optional)</Label>
                <Select value={newClientId} onValueChange={setNewClientId}>
                  <SelectTrigger className="text-xs mt-1 h-9"><SelectValue placeholder="No client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">No client</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.display_name || c.email}
                        {c.display_name && c.email && <span className="text-muted-foreground ml-1">({c.email})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Due date</Label>
                <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="text-xs mt-1 h-9" />
              </div>
            </div>
            <Button onClick={createTask} disabled={!newTitle.trim()} className="w-full gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90 text-xs">
              <Plus className="h-3.5 w-3.5" /> Create Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTodoPanel;
