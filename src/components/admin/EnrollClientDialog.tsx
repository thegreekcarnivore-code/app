import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Users } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: { id: string; name: string; duration_weeks?: number };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const EnrollClientDialog = ({ open, onOpenChange, template }: Props) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<{ id: string; email: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [weeklyDay, setWeeklyDay] = useState("1");
  const [durationWeeks, setDurationWeeks] = useState(String(template.duration_weeks || 26));
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("id, email").eq("approved", true).then(({ data }) => {
      if (data) setClients(data as any[]);
    });
    supabase.from("groups").select("id, name").order("name").then(({ data }) => {
      if (data) setGroups(data);
    });
  }, [open]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const enroll = async () => {
    if (!selectedClient || !startDate) return;
    setSaving(true);
    const weeks = Number(durationWeeks);
    const templateWeeks = template.duration_weeks || 26;
    const { error } = await supabase.from("client_program_enrollments" as any).insert({
      user_id: selectedClient,
      program_template_id: template.id,
      start_date: startDate,
      weekly_day: Number(weeklyDay),
      created_by: user!.id,
      duration_weeks_override: weeks !== templateWeeks ? weeks : null,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Client enrolled successfully" });

      // Send day-0 messages immediately
      supabase.functions.invoke("send-day-zero-messages", {
        body: { user_id: selectedClient },
      }).catch((err) => console.error("Day-0 messages error:", err));

      // Add to selected groups
      if (selectedGroupIds.size > 0) {
        const rows = Array.from(selectedGroupIds).map(gid => ({ group_id: gid, user_id: selectedClient }));
        const { error: groupErr } = await supabase.from("group_members").insert(rows);
        if (groupErr) {
          console.error("Group assignment error:", groupErr);
        } else {
          toast({ title: `Added to ${selectedGroupIds.size} group(s)` });
        }
      }

      // Send welcome email in background
      const finalWeeks = weeks !== templateWeeks ? weeks : templateWeeks;
      supabase.functions.invoke("send-enrollment-welcome", {
        body: {
          client_id: selectedClient,
          program_name: template.name,
          duration_weeks: finalWeeks,
          start_date: startDate,
        },
      }).then(({ error: emailErr }) => {
        if (emailErr) console.error("Welcome email failed:", emailErr);
        else toast({ title: "Welcome email sent to client" });
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-serif">Enroll Client — {template.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="font-sans text-xs">Client</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Select a client..." /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-sans text-xs">Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs" />
          </div>
          <div>
            <Label className="font-sans text-xs">Duration (weeks)</Label>
            <Input type="number" min={1} value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} className="text-xs" />
          </div>
          <div>
            <Label className="font-sans text-xs">Weekly Task Day</Label>
            <Select value={weeklyDay} onValueChange={setWeeklyDay}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (<SelectItem key={i} value={String(i)}>{d}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {/* Community group assignment */}
          {groups.length > 0 && (
            <div className="rounded-lg border border-border bg-background px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="font-sans text-xs">Add to Community Group(s)</Label>
              </div>
              <div className="space-y-1.5">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedGroupIds.has(g.id)}
                      onCheckedChange={() => toggleGroup(g.id)}
                    />
                    <span className="text-xs font-sans text-foreground">{g.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button onClick={enroll} disabled={saving || !selectedClient} className="w-full rounded-xl bg-gold py-2.5 font-sans text-sm font-semibold text-gold-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? "Enrolling..." : "Enroll Client"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnrollClientDialog;
