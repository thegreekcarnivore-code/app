import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import FeatureAccessPanel from "@/components/admin/FeatureAccessPanel";
import { Mail, Send, Globe, CalendarIcon, Users, Loader2 } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ProgramTemplate {
  id: string;
  name: string;
  duration_weeks: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientAdded?: () => void;
}

const AddClientDialog = ({ open, onOpenChange, onClientAdded }: Props) => {
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<"en" | "el">("el");
  const [assignProgram, setAssignProgram] = useState(false);
  const [programId, setProgramId] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [durationValue, setDurationValue] = useState("");
  const [durationUnit, setDurationUnit] = useState<"weeks" | "months">("months");
  const [measurementDay, setMeasurementDay] = useState("");
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({
    concierge: true, explore: true, delivery: true, shopping: true,
    travel: true, measurements: true, video_library: true, resources: true, community: true,
  });
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("program_templates").select("id, name, duration_weeks").order("name").then(({ data }) => {
      if (data) setTemplates(data);
    });
    supabase.from("groups").select("id, name").order("name").then(({ data }) => {
      if (data) setGroups(data);
    });
  }, [open]);

  // When a program is selected, pre-fill the duration
  useEffect(() => {
    if (programId) {
      const tmpl = templates.find(t => t.id === programId);
      if (tmpl) {
        setDurationValue(String(tmpl.duration_weeks));
        setDurationUnit("weeks");
      }
    }
  }, [programId, templates]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!email.trim()) return;
    if (assignProgram && !programId) {
      toast({ title: "Select a program", variant: "destructive" });
      return;
    }
    setSending(true);

    // Calculate final duration in weeks
    let finalDurationWeeks: number | null = null;
    if (assignProgram && durationValue) {
      const val = Number(durationValue);
      finalDurationWeeks = durationUnit === "months" ? Math.round(val * 4.33) : val;
    }

    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: {
        email: email.trim().toLowerCase(),
        language,
        feature_access: featureAccess,
        program_template_id: assignProgram ? programId : null,
        start_date: assignProgram && startDate ? format(startDate, "yyyy-MM-dd") : null,
        measurement_day: assignProgram && measurementDay ? Number(measurementDay) : null,
        group_id: selectedGroupIds.size > 0 ? Array.from(selectedGroupIds)[0] : null,
      },
    });

    setSending(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data?.error) {
      toast({ title: "Error", description: data.error, variant: "destructive" });
    } else {
      toast({ title: "Access granted!", description: `A direct-entry link was sent to ${email}` });
      // Reset form
      setEmail("");
      setAssignProgram(false);
      setProgramId("");
      setDurationValue("");
      setSelectedGroupIds(new Set());
      onClientAdded?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Add Client & Grant Access</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email */}
          <div>
            <Label className="font-sans text-xs">Client Email</Label>
            <div className="flex items-center gap-2 mt-1">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="text-xs"
              />
            </div>
          </div>

          {/* Language */}
          <div>
            <Label className="font-sans text-xs">Email Language</Label>
            <div className="flex gap-1 mt-1 rounded-lg border border-border bg-background p-1">
              <button
                onClick={() => setLanguage("en")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-sans font-medium transition-all ${language === "en" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Globe className="h-3 w-3" />
                English
              </button>
              <button
                onClick={() => setLanguage("el")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-sans font-medium transition-all ${language === "el" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Globe className="h-3 w-3" />
                Ελληνικά
              </button>
            </div>
          </div>

          {/* Feature Access */}
          <div>
            <Label className="font-sans text-xs mb-2 block">Feature Access</Label>
            <FeatureAccessPanel
              initialAccess={featureAccess}
              onChanged={setFeatureAccess}
            />
          </div>

          {/* Program assignment */}
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-sans text-xs cursor-pointer">Assign Program</Label>
              <Switch checked={assignProgram} onCheckedChange={setAssignProgram} />
            </div>

            {assignProgram && (
              <div className="space-y-3 pt-1">
                <div>
                  <Label className="font-sans text-[10px] text-muted-foreground">Program Template</Label>
                  <Select value={programId} onValueChange={setProgramId}>
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue placeholder="Select program..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-sans text-[10px] text-muted-foreground">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left text-xs font-normal mt-1",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="h-3 w-3 mr-1.5" />
                          {startDate ? format(startDate, "PP") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label className="font-sans text-[10px] text-muted-foreground">Duration</Label>
                    <div className="flex gap-1.5 mt-1">
                      <Input
                        type="number"
                        min={1}
                        value={durationValue}
                        onChange={(e) => setDurationValue(e.target.value)}
                        placeholder="e.g. 6"
                        className="text-xs flex-1"
                      />
                      <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as "weeks" | "months")}>
                        <SelectTrigger className="text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weeks">Weeks</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="font-sans text-[10px] text-muted-foreground">Measurement Reminder Day</Label>
                  <Select value={measurementDay} onValueChange={setMeasurementDay}>
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Community groups */}
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

          <div className="rounded-lg border border-gold/25 bg-gold/10 px-3 py-2.5">
            <p className="font-sans text-[11px] font-medium text-foreground">
              The email we send from here approves the client immediately and gives them a direct-entry link to the app.
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={sending || !email.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 font-sans text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Granting Access..." : "Add Client & Send Direct Access"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientDialog;
