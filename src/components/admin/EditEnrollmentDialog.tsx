import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Settings, ToggleRight, BookOpen, UserRound } from "lucide-react";
import FeatureAccessPanel from "./FeatureAccessPanel";
import ProgramTemplateEditor from "./ProgramTemplateEditor";
import PersonalizeMessagesButton from "./PersonalizeMessagesButton";

interface EditEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  onSaved: () => void;
}

interface Enrollment {
  id: string;
  program_template_id: string;
  start_date: string;
  status: string;
  weekly_day: number;
  feature_access_override: Record<string, boolean> | null;
  duration_weeks_override: number | null;
}

interface ProgramTemplate {
  id: string;
  name: string;
  duration_weeks: number;
  feature_access: Record<string, boolean>;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const EditEnrollmentDialog = ({ open, onOpenChange, userId, userEmail, onSaved }: EditEnrollmentDialogProps) => {
  const { lang } = useLanguage();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [programMessages, setProgramMessages] = useState<any[]>([]);

  // Form state
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [status, setStatus] = useState("active");
  const [weeklyDay, setWeeklyDay] = useState(1);
  const [durationOverride, setDurationOverride] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, userId]);

  const fetchData = async () => {
    setLoading(true);
    const [enrollRes, templatesRes] = await Promise.all([
      supabase
        .from("client_program_enrollments")
        .select("id, program_template_id, start_date, status, weekly_day, feature_access_override, duration_weeks_override")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("program_templates")
        .select("id, name, duration_weeks, feature_access")
        .order("name"),
    ]);

    if (templatesRes.data) setTemplates(templatesRes.data as any);

    if (enrollRes.data) {
      const e = enrollRes.data as any;
      setEnrollment(e);
      setTemplateId(e.program_template_id);
      setStartDate(e.start_date);
      setStatus(e.status);
      setWeeklyDay(e.weekly_day);
      setDurationOverride(e.duration_weeks_override ?? null);
    } else {
      setEnrollment(null);
      setTemplateId("");
      setStartDate(new Date().toISOString().slice(0, 10));
      setStatus("active");
      setWeeklyDay(1);
    }
    setLoading(false);

    // Load program messages for personalization
    if (enrollRes.data) {
      const tid = (enrollRes.data as any).program_template_id;
      const { data: msgs } = await supabase
        .from("program_messages" as any)
        .select("*")
        .eq("program_template_id", tid)
        .order("sort_order" as any);
      if (msgs) setProgramMessages(msgs as any[]);
    }
  };

  const handleSave = async () => {
    if (!templateId) {
      toast({ title: lang === "en" ? "Select a program" : "Επιλέξτε πρόγραμμα", variant: "destructive" });
      return;
    }
    setSaving(true);

    if (enrollment) {
      const { error } = await supabase
        .from("client_program_enrollments")
        .update({
          program_template_id: templateId,
          start_date: startDate,
          status,
          weekly_day: weeklyDay,
          duration_weeks_override: durationOverride,
        } as any)
        .eq("id", enrollment.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        // Clean up client_tasks that fall outside the new program window
        if (durationOverride) {
          const newEndDate = new Date(new Date(startDate).getTime() + durationOverride * 7 * 86400000);
          const endDateStr = newEndDate.toISOString().split("T")[0];
          await supabase
            .from("client_tasks")
            .delete()
            .eq("enrollment_id", enrollment.id)
            .eq("user_id", userId)
            .is("completed_at", null)
            .gt("due_date", endDateStr);
        }
        toast({ title: lang === "en" ? "Enrollment updated" : "Ενημερώθηκε" });
        onSaved();
        onOpenChange(false);
      }
    } else {
      // Get current user for created_by
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from("client_program_enrollments")
        .insert({
          user_id: userId,
          program_template_id: templateId,
          start_date: startDate,
          status,
          weekly_day: weeklyDay,
          created_by: currentUser.id,
        });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: lang === "en" ? "Enrollment created" : "Δημιουργήθηκε" });
        // Send day-zero messages + tasks
        supabase.functions.invoke("send-day-zero-messages", {
          body: { user_id: userId },
        }).then(({ error: dzErr }) => {
          if (dzErr) console.error("Day-zero messages failed:", dzErr);
        });
        // Send welcome email
        if (selectedTemplate) {
          supabase.functions.invoke("send-enrollment-welcome", {
            body: {
              client_id: userId,
              program_name: selectedTemplate.name,
              duration_weeks: durationOverride ?? selectedTemplate.duration_weeks,
              start_date: startDate,
            },
          }).then(({ error: emailErr }) => {
            if (emailErr) console.error("Welcome email failed:", emailErr);
          });
        }
        onSaved();
        onOpenChange(false);
      }
    }
    setSaving(false);
  };

  const handleRemove = async () => {
    if (!enrollment) return;
    const { error } = await supabase
      .from("client_program_enrollments")
      .update({ status: "completed" })
      .eq("id", enrollment.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: lang === "en" ? "Enrollment deactivated" : "Απενεργοποιήθηκε" });
      onSaved();
      onOpenChange(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === templateId);
  const effectiveWeeks = durationOverride ?? selectedTemplate?.duration_weeks ?? 0;
  const daysIn = enrollment ? Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)) : 0;
  const totalDays = effectiveWeeks * 7;
  const endDate = startDate && effectiveWeeks > 0 ? new Date(new Date(startDate).getTime() + effectiveWeeks * 7 * 86400000) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">
            {lang === "en" ? "Program Enrollment" : "Εγγραφή Προγράμματος"} — {userEmail}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : (
          <Tabs defaultValue="settings" className="w-full">
            <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <TabsList className="inline-flex w-auto min-w-full h-auto">
                <TabsTrigger value="settings" className="text-[10px] gap-1 py-2 shrink-0">
                  <Settings className="h-3 w-3" />
                  {lang === "en" ? "Settings" : "Ρυθμίσεις"}
                </TabsTrigger>
                <TabsTrigger value="features" className="text-[10px] gap-1 py-2 shrink-0">
                  <ToggleRight className="h-3 w-3" />
                  {lang === "en" ? "Access" : "Πρόσβαση"}
                </TabsTrigger>
                {enrollment && templateId && (
                  <TabsTrigger value="content" className="text-[10px] gap-1 py-2 shrink-0">
                    <BookOpen className="h-3 w-3" />
                    {lang === "en" ? "Program Content" : "Περιεχόμενο"}
                  </TabsTrigger>
                )}
                {enrollment && templateId && programMessages.length > 0 && (
                  <TabsTrigger value="personalize" className="text-[10px] gap-1 py-2 shrink-0">
                    <UserRound className="h-3 w-3" />
                    {lang === "en" ? "Personalize" : "Εξατομίκευση"}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="settings" className="mt-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">{lang === "en" ? "Program" : "Πρόγραμμα"}</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder={lang === "en" ? "Select program..." : "Επιλέξτε..."} /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.duration_weeks}w)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{lang === "en" ? "Start Date" : "Ημ. Έναρξης"}</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">{lang === "en" ? "Weekly Check-in Day" : "Ημέρα Check-in"}</Label>
                    <Select value={String(weeklyDay)} onValueChange={v => setWeeklyDay(Number(v))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d, i) => (
                          <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{lang === "en" ? "Status" : "Κατάσταση"}</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{lang === "en" ? "Active" : "Ενεργό"}</SelectItem>
                        <SelectItem value="paused">{lang === "en" ? "Paused" : "Παύση"}</SelectItem>
                        <SelectItem value="completed">{lang === "en" ? "Completed" : "Ολοκληρωμένο"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{lang === "en" ? "Duration (weeks)" : "Διάρκεια (εβδομάδες)"}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={effectiveWeeks}
                      onChange={e => {
                        const w = Math.max(1, Number(e.target.value));
                        setDurationOverride(w);
                      }}
                      className="mt-1"
                    />
                  </div>
                </div>

                {selectedTemplate && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs font-sans text-muted-foreground space-y-1">
                    <div>{selectedTemplate.name} · {daysIn} of {totalDays} days · {effectiveWeeks} weeks</div>
                    {endDate && (
                      <div>{lang === "en" ? "End date" : "Λήξη"}: {endDate.toLocaleDateString()}</div>
                    )}
                    {durationOverride && durationOverride !== selectedTemplate.duration_weeks && (
                      <div className="text-primary text-[10px]">
                        ⚠ Custom duration (template default: {selectedTemplate.duration_weeks} weeks)
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1" size="sm">
                    {saving ? "..." : enrollment
                      ? (lang === "en" ? "Update" : "Ενημέρωση")
                      : (lang === "en" ? "Assign Program" : "Ανάθεση")}
                  </Button>
                  {enrollment && (
                    <Button variant="destructive" size="sm" onClick={handleRemove} className="gap-1">
                      <Trash2 className="h-3.5 w-3.5" />
                      {lang === "en" ? "Remove" : "Αφαίρεση"}
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="features" className="mt-4">
              {enrollment ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-sans text-muted-foreground">
                    {lang === "en"
                      ? "Override feature access for this client only. Changes won't affect the program template."
                      : "Αλλαγή πρόσβασης μόνο για αυτόν τον πελάτη."}
                  </p>
                  <FeatureAccessPanel
                    enrollmentId={enrollment.id}
                    initialAccess={
                      enrollment.feature_access_override ||
                      selectedTemplate?.feature_access ||
                      undefined
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {lang === "en" ? "Assign a program first to configure features." : "Αναθέστε πρώτα ένα πρόγραμμα."}
                </p>
              )}
            </TabsContent>

            {enrollment && templateId && (
              <TabsContent value="content" className="mt-4">
                <ProgramTemplateEditor templateId={templateId} enrollmentWeeksOverride={durationOverride} />
              </TabsContent>
            )}

            {enrollment && templateId && programMessages.length > 0 && (
              <TabsContent value="personalize" className="mt-4">
                <PersonalizeMessagesButton
                  clientUserId={userId}
                  messages={programMessages}
                  onApply={async (personalized) => {
                    for (const p of personalized) {
                      await supabase
                        .from("program_messages" as any)
                        .update({ message_content: p.message_content } as any)
                        .eq("id", p.id);
                    }
                    // Reload messages
                    const { data: msgs } = await supabase
                      .from("program_messages" as any)
                      .select("*")
                      .eq("program_template_id", templateId)
                      .order("sort_order" as any);
                    if (msgs) setProgramMessages(msgs as any[]);
                  }}
                />
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditEnrollmentDialog;
