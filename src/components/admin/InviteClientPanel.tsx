import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import FeatureAccessPanel from "@/components/admin/FeatureAccessPanel";
import { Mail, Send, Clock, CheckCircle, Globe, CalendarIcon, Users } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ProgramTemplate {
  id: string;
  name: string;
}

interface Invitation {
  id: string;
  email: string;
  language: string;
  status: string;
  created_at: string;
  program_template_id: string | null;
}

const InviteClientPanel = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<"en" | "el">("en");
  const [assignProgram, setAssignProgram] = useState(false);
  const [programId, setProgramId] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [measurementDay, setMeasurementDay] = useState("");
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({
    concierge: true, explore: true, delivery: true, shopping: true,
    travel: true, measurements: true, video_library: true, resources: true, community: true,
  });
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  useEffect(() => {
    fetchTemplates();
    fetchInvitations();
    supabase.from("groups").select("id, name").order("name").then(({ data }) => {
      if (data) setGroups(data);
    });
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase.from("program_templates").select("id, name").order("name");
    if (data) setTemplates(data);
  };

  const fetchInvitations = async () => {
    const { data } = await supabase
      .from("email_invitations" as any)
      .select("id, email, language, status, created_at, program_template_id")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setInvitations(data as any);
  };

  const sendInvite = async () => {
    if (!email.trim()) return;
    if (assignProgram && !programId) {
      toast({ title: "Select a program", description: "Please assign a program template.", variant: "destructive" });
      return;
    }
    setSending(true);

    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: {
        email: email.trim().toLowerCase(),
        language,
        feature_access: featureAccess,
        program_template_id: assignProgram ? programId : null,
        start_date: assignProgram && startDate ? format(startDate, "yyyy-MM-dd") : null,
        measurement_day: assignProgram && measurementDay ? Number(measurementDay) : null,
        group_id: selectedGroupId || null,
      },
    });

    setSending(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data?.error) {
      toast({ title: "Error", description: data.error, variant: "destructive" });
    } else {
      toast({ title: "Invitation sent", description: `Email sent to ${email}` });
      setEmail("");
      fetchInvitations();
    }
  };

  const templateName = (id: string | null) => templates.find(t => t.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="font-serif text-sm font-semibold text-foreground">Send Invitation</h3>

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

        {/* Language selector */}
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

        {/* Program assignment toggle */}
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
                  <Label className="font-sans text-[10px] text-muted-foreground">Program Start Date</Label>
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
            </div>
          )}
        </div>

        {/* Community group assignment */}
        {groups.length > 0 && (
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label className="font-sans text-xs">Add to Community Group</Label>
            </div>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="None (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Feature access */}
        <div>
          <Label className="font-sans text-xs mb-2 block">Feature Access</Label>
          <FeatureAccessPanel
            initialAccess={featureAccess}
            onChanged={setFeatureAccess}
          />
        </div>

        <button
          onClick={sendInvite}
          disabled={sending || !email.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 font-sans text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending..." : "Send Invitation"}
        </button>
      </div>

      {/* Invitation history */}
      {invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-serif text-sm font-semibold text-foreground">Recent Invitations</h3>
          {invitations.map((inv) => (
            <div key={inv.id} className="rounded-xl border border-border bg-card px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs text-foreground">{inv.email}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-sans text-[10px] text-muted-foreground uppercase">{inv.language}</span>
                  {inv.status === "used" ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-sans text-muted-foreground">
                <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                <span>·</span>
                <span>{templateName(inv.program_template_id)}</span>
                <span>·</span>
                <span className={inv.status === "used" ? "text-emerald-500" : "text-gold"}>{inv.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InviteClientPanel;
