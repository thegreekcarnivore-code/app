import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Calendar, UserPlus } from "lucide-react";
import { addDays, addWeeks, format } from "date-fns";

interface Props {
  templateId: string;
  templateName?: string;
  durationWeeks: number;
}

interface Enrollment {
  id: string;
  user_id: string;
  start_date: string;
  status: string;
  weekly_day: number;
  email?: string;
  display_name?: string;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ProgramEnrollmentsTab = ({ templateId, templateName, durationWeeks }: Props) => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [clients, setClients] = useState<{ id: string; email: string; display_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Add form
  const [selectedClient, setSelectedClient] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [weeklyDay, setWeeklyDay] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEnrollments();
    loadClients();
  }, [templateId]);

  const loadEnrollments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_program_enrollments" as any)
      .select("id, user_id, start_date, status, weekly_day")
      .eq("program_template_id", templateId)
      .order("created_at", { ascending: false });

    if (data && (data as any[]).length > 0) {
      // Fetch profile info for each enrolled user
      const userIds = (data as any[]).map((e: any) => e.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);

      const profileMap = new Map((profiles as any[] || []).map((p: any) => [p.id, p]));
      setEnrollments(
        (data as any[]).map((e: any) => ({
          ...e,
          email: profileMap.get(e.user_id)?.email || "Unknown",
          display_name: profileMap.get(e.user_id)?.display_name || null,
        }))
      );
    } else {
      setEnrollments([]);
    }
    setLoading(false);
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("approved", true)
      .order("email");
    if (data) setClients(data as any[]);
  };

  const getEndDate = (start: string) => {
    return format(addWeeks(new Date(start), durationWeeks), "yyyy-MM-dd");
  };

  const handleEnroll = async () => {
    if (!selectedClient || !startDate) return;
    setSaving(true);
    const { error } = await supabase.from("client_program_enrollments" as any).insert({
      user_id: selectedClient,
      program_template_id: templateId,
      start_date: startDate,
      weekly_day: Number(weeklyDay),
      created_by: user!.id,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Client enrolled" });
      // Send welcome email in Greek
      supabase.functions.invoke("send-enrollment-welcome", {
        body: {
          client_id: selectedClient,
          program_name: templateName || "Program",
          duration_weeks: durationWeeks,
          start_date: startDate,
        },
      }).then(({ error: emailErr }) => {
        if (emailErr) console.error("Welcome email failed:", emailErr);
        else toast({ title: "Welcome email sent to client" });
      });
      setShowAdd(false);
      setSelectedClient("");
      setStartDate(new Date().toISOString().slice(0, 10));
      loadEnrollments();
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this enrollment?")) return;
    const { error } = await supabase
      .from("client_program_enrollments" as any)
      .update({ status: "completed" } as any)
      .eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Enrollment removed" }); loadEnrollments(); }
  };

  const enrolledUserIds = new Set(enrollments.filter(e => e.status === "active").map(e => e.user_id));
  const availableClients = clients.filter(c => !enrolledUserIds.has(c.id));

  return (
    <div className="space-y-4">
      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <UserPlus className="h-3 w-3" /> Enroll Client
        </button>
      )}

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-sans font-semibold text-foreground flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5 text-primary" />
            Enroll Client
          </h3>
          <div>
            <Label className="text-[10px]">Client</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="mt-1 text-xs">
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent>
                {availableClients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.display_name || c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px]">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-[10px]">End Date (auto)</Label>
              <Input
                type="date"
                value={getEndDate(startDate)}
                disabled
                className="mt-1 text-xs h-8 bg-muted"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Weekly Check-in Day</Label>
            <Select value={weeklyDay} onValueChange={setWeeklyDay}>
              <SelectTrigger className="mt-1 text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d, i) => (
                  <SelectItem key={i} value={String(i)} className="text-xs">{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleEnroll} disabled={saving || !selectedClient} size="sm" className="flex-1">
              {saving ? "Enrolling..." : "Enroll"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
      ) : enrollments.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">No clients enrolled yet.</p>
      ) : (
        enrollments.map((e) => {
          const endDate = getEndDate(e.start_date);
          const daysIn = Math.max(0, Math.floor((Date.now() - new Date(e.start_date).getTime()) / 86400000));
          const totalDays = durationWeeks * 7;
          const progress = Math.min(100, Math.round((daysIn / totalDays) * 100));

          return (
            <div key={e.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-sans font-semibold text-foreground">
                    {e.display_name || e.email}
                  </p>
                  {e.display_name && (
                    <p className="text-[10px] font-sans text-muted-foreground">{e.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    e.status === "active" ? "bg-emerald-500/10 text-emerald-500" :
                    e.status === "paused" ? "bg-amber-500/10 text-amber-500" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {e.status}
                  </span>
                  {e.status === "active" && (
                    <button
                      onClick={() => handleRemove(e.id)}
                      className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-sans text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {e.start_date} → {endDate}
                </span>
                <span>Day {daysIn}/{totalDays}</span>
                <span>{WEEKDAYS[e.weekly_day]}</span>
              </div>
              {e.status === "active" && (
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default ProgramEnrollmentsTab;
