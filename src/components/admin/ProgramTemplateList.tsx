import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Users, ChevronLeft, ChevronRight, Check, MessageCircle, Sparkles, CalendarIcon, Send, Copy } from "lucide-react";
import { format, differenceInWeeks, differenceInCalendarDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ProgramTemplateEditor from "./ProgramTemplateEditor";
import EnrollClientDialog from "./EnrollClientDialog";
import FeatureAccessPanel from "./FeatureAccessPanel";
import AiMessageGenerator from "./AiMessageGenerator";
import ProgramTimeline from "./ProgramTimeline";

interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  duration_weeks: number;
  created_at: string;
  feature_access?: Record<string, boolean>;
}

const RECURRENCE_OPTIONS = [
  { value: "none", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const STEPS = ["Basics", "Feature Access", "Welcome Messages", "Timeline"];

const ProgramTemplateList = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [enrollTemplate, setEnrollTemplate] = useState<ProgramTemplate | null>(null);

  // Wizard state
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(0);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDuration, setNewDuration] = useState(26);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [createdTemplateId, setCreatedTemplateId] = useState<string | null>(null);
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({});
  const [wizardMessages, setWizardMessages] = useState<any[]>([]);
  const [wizardTasks, setWizardTasks] = useState<any[]>([]);

  // New message form state
  const [msgContent, setMsgContent] = useState("");
  const [msgDayOffset, setMsgDayOffset] = useState(0);
  const [msgRecurrence, setMsgRecurrence] = useState("none");
  const [msgRecurrenceEnd, setMsgRecurrenceEnd] = useState("");

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("program_templates" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTemplates(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const resetWizard = () => {
    setStep(0);
    setNewName("");
    setNewDesc("");
    setNewDuration(26);
    setStartDate(new Date());
    setEndDate(undefined);
    setCreatedTemplateId(null);
    setFeatureAccess({});
    setWizardMessages([]);
    setWizardTasks([]);
    setMsgContent("");
    setMsgDayOffset(0);
    setMsgRecurrence("none");
    setMsgRecurrenceEnd("");
  };

  const handleOpenCreate = () => {
    resetWizard();
    setShowCreate(true);
  };

  const handleCloseCreate = (open: boolean) => {
    if (!open) {
      setShowCreate(false);
      if (createdTemplateId) fetchTemplates();
    }
  };

  // Step 1: Create template in DB
  const createTemplate = async () => {
    if (!newName.trim() || !endDate) return;
    const weeks = Math.max(1, differenceInWeeks(endDate, startDate));
    const { data, error } = await supabase
      .from("program_templates" as any)
      .insert({ name: newName, description: newDesc, duration_weeks: weeks, created_by: user!.id } as any)
      .select("*")
      .single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    const templateId = (data as any).id;
    setCreatedTemplateId(templateId);
    setFeatureAccess((data as any).feature_access || {});

    // Auto-insert default check-in messages
    const defaultMessages = [
      {
        program_template_id: templateId,
        message_content: `Καλωσόρισες! 🎉\nΕδώ ξεκινάει το ταξίδι σου, και είμαι ΠΟΛΥ ενθουσιασμένος που θα το κάνουμε μαζί!\nΘυμήσου, δεν χρειάζεται να βιαστείς, αυτό είναι ένας μαραθώνιος, όχι σπριντ. Πάρε το χρόνο σου να καταλάβεις όλα όσα χρειάζονται, και εγώ θα είμαι εδώ δίπλα σου σε κάθε βήμα! 💪🔥\n\nΔες σε παρακαλώ αυτό το βίντεο σήμερα για να δεις τι περιμένω από σένα: https://youtu.be/Our8s5om_bU`,
        day_offset: 0,
        recurrence: null,
        recurrence_end_day: null,
        sort_order: 0,
      },
      {
        program_template_id: templateId,
        message_content: `Σήμερα είναι η ημέρα για να καταγράψεις την πρόοδό σου!\nΠαρακαλώ βγάλε τις φωτογραφίες προόδου και καταγράψε τις μετρήσεις σου. Αυτή η εβδομαδιαία καταγραφή θα σε βοηθήσει να δεις τη διαφορά στην πορεία σου και να έχεις ένα ξεκάθαρο και μετρήσιμο αποτέλεσμα για να γνωρίζουμε αν συνεχίζουμε με την ίδια στρατηγική ή αν χρειάζεται κάποια προσαρμογή.\n\nΦρόντισε οι φωτογραφίες και οι μετρήσεις να είναι όσο το δυνατόν πιο ακριβείς και να ληφθούν στην ίδια θέση όπως την προηγούμενη εβδομάδα για να μπορέσεις να συγκρίνεις σωστά την πρόοδό σου.\nΗ πρόοδός σου είναι το κλειδί για την επιτυχία και θα σε βοηθήσει να κάνεις τις απαραίτητες προσαρμογές αν χρειάζεται.\n\nΣυνέχισε την εξαιρετική δουλειά και μπράβο για τις προσπάθειές σου! 💪📸\n\nΔες και αυτο το βίντεο για να έχεις την σωστή οπτική γωνία όταν βλέπεις της μετρήσεις σου:\nhttps://youtu.be/coP9HBTN1f4\nΚαλές μετρήσεις!`,
        day_offset: 7,
        recurrence: null,
        recurrence_end_day: null,
        sort_order: 1,
      },
      {
        program_template_id: templateId,
        message_content: `Καλημέρα {client_name}! Βγάλε σήμερα τις εβδομαδιαίες φωτογραφίες και μετρήσεις σου! Αυτό βοηθά να βλέπεις την πρόοδό σου και να ξέρουμε αν συνεχίζουμε ή χρειάζεται αλλαγή. Κάν' τες στην ίδια θέση για σωστή σύγκριση.`,
        day_offset: 14,
        recurrence: "weekly",
        recurrence_end_day: null,
        sort_order: 2,
      },
    ];

    for (const msg of defaultMessages) {
      await supabase.from("program_messages" as any).insert(msg as any);
    }

    toast({ title: "Template created with default check-in messages" });
    setStep(1);
  };

  // Load wizard data for steps 3+
  const loadWizardData = async () => {
    if (!createdTemplateId) return;
    const [msgs, tsks] = await Promise.all([
      supabase.from("program_messages" as any).select("*").eq("program_template_id", createdTemplateId).order("sort_order" as any),
      supabase.from("program_tasks" as any).select("*").eq("program_template_id", createdTemplateId).order("sort_order" as any),
    ]);
    if (msgs.data) setWizardMessages(msgs.data as any[]);
    if (tsks.data) setWizardTasks(tsks.data as any[]);
  };

  const handleNext = async () => {
    if (step === 0) {
      await createTemplate();
      return;
    }
    if (step < STEPS.length - 1) {
      if (step === 1) {
        // Moving to messages step - load data
        await loadWizardData();
      }
      if (step === 2) {
        // Moving to timeline - load data
        await loadWizardData();
      }
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = () => {
    setShowCreate(false);
    if (createdTemplateId) {
      setEditingTemplate(createdTemplateId);
      fetchTemplates();
    }
  };

  // Welcome message insert
  const insertWelcomeMessage = async (content: string, dayOffset?: number, recurrence?: string, recurrenceEndDay?: number) => {
    if (!createdTemplateId || !content.trim()) return;
    const { error } = await supabase
      .from("program_messages" as any)
      .insert({
        program_template_id: createdTemplateId,
        message_content: content,
        day_offset: dayOffset ?? msgDayOffset,
        recurrence: (recurrence ?? msgRecurrence) === "none" ? null : (recurrence ?? msgRecurrence),
        recurrence_end_day: recurrenceEndDay ?? (msgRecurrenceEnd ? parseInt(msgRecurrenceEnd) : null),
        sort_order: wizardMessages.length,
      } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Message added" });
      setMsgContent("");
      setMsgDayOffset(0);
      setMsgRecurrence("none");
      setMsgRecurrenceEnd("");
      await loadWizardData();
    }
  };

  // Timeline handlers
  const handleTimelineSaveMessage = async (data: any) => {
    if (!createdTemplateId) return;
    if (data.id) {
      await supabase.from("program_messages" as any).update({ message_content: data.message_content, day_offset: data.day_offset, recurrence: data.recurrence, recurrence_end_day: data.recurrence_end_day } as any).eq("id", data.id);
    } else {
      await supabase.from("program_messages" as any).insert({ program_template_id: createdTemplateId, message_content: data.message_content || "", day_offset: data.day_offset, recurrence: data.recurrence, recurrence_end_day: data.recurrence_end_day, sort_order: wizardMessages.length } as any);
    }
    await loadWizardData();
  };

  const handleTimelineSaveTask = async (data: any) => {
    if (!createdTemplateId) return;
    if (data.id) {
      await supabase.from("program_tasks" as any).update({ title: data.title, description: data.description, task_type: data.task_type, day_offset: data.day_offset, recurrence: data.recurrence, recurrence_end_day: data.recurrence_end_day } as any).eq("id", data.id);
    } else {
      await supabase.from("program_tasks" as any).insert({ program_template_id: createdTemplateId, title: data.title || "", task_type: data.task_type || "custom", day_offset: data.day_offset, recurrence: data.recurrence, recurrence_end_day: data.recurrence_end_day, sort_order: wizardTasks.length } as any);
    }
    await loadWizardData();
  };

  const handleTimelineDeleteMessage = async (id: string) => {
    await supabase.from("program_messages" as any).delete().eq("id", id);
    await loadWizardData();
  };

  const handleTimelineDeleteTask = async (id: string) => {
    await supabase.from("program_tasks" as any).delete().eq("id", id);
    await loadWizardData();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template and all its content?")) return;
    const { error } = await supabase.from("program_templates" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); fetchTemplates(); }
  };

  const duplicateTemplate = async (t: ProgramTemplate) => {
    const { data: newTemplate, error } = await supabase
      .from("program_templates" as any)
      .insert({
        name: `Copy ${t.name}`,
        description: t.description,
        duration_weeks: t.duration_weeks,
        feature_access: t.feature_access ?? {},
        created_by: user!.id,
      } as any)
      .select("*")
      .single();

    if (error || !newTemplate) {
      toast({ title: "Error duplicating", description: error?.message, variant: "destructive" });
      return;
    }

    const newId = (newTemplate as any).id;

    // Copy all related data in parallel
    const [msgs, tasks, videos, docs, forms] = await Promise.all([
      supabase.from("program_messages" as any).select("*").eq("program_template_id", t.id),
      supabase.from("program_tasks" as any).select("*").eq("program_template_id", t.id),
      supabase.from("program_videos" as any).select("*").eq("program_template_id", t.id),
      supabase.from("program_documents" as any).select("*").eq("program_template_id", t.id),
      supabase.from("program_forms" as any).select("*").eq("program_template_id", t.id),
    ]);

    const copyRows = (rows: any[] | null, table: string) => {
      if (!rows || rows.length === 0) return Promise.resolve();
      const cleaned = rows.map(({ id, ...rest }: any) => ({ ...rest, program_template_id: newId }));
      return supabase.from(table as any).insert(cleaned as any);
    };

    await Promise.all([
      copyRows(msgs.data as any, "program_messages"),
      copyRows(tasks.data as any, "program_tasks"),
      copyRows(videos.data as any, "program_videos"),
      copyRows(docs.data as any, "program_documents"),
      copyRows(forms.data as any, "program_forms"),
    ]);

    toast({ title: `Duplicated as "Copy ${t.name}"` });
    fetchTemplates();
  };

  if (editingTemplate) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setEditingTemplate(null); fetchTemplates(); }} className="text-xs font-sans text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Templates
        </button>
        <ProgramTemplateEditor templateId={editingTemplate} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={handleOpenCreate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 font-sans text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90">
        <Plus className="h-4 w-4" />
        Create Program Template
      </button>

      {loading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>
      ) : templates.length === 0 ? (
        <p className="text-center font-sans text-sm text-muted-foreground py-8">No program templates yet.</p>
      ) : (
        templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-sm font-semibold text-foreground">{t.name}</h3>
                <p className="font-sans text-[10px] text-muted-foreground">{t.duration_weeks} weeks · Created {new Date(t.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setEnrollTemplate(t)} className="rounded-lg bg-primary/10 p-2 text-primary hover:bg-primary/20 transition-colors" title="Enroll Client">
                   <Users className="h-4 w-4" />
                 </button>
                 <button onClick={() => setEditingTemplate(t.id)} className="rounded-lg bg-accent p-2 text-accent-foreground hover:bg-accent/80 transition-colors" title="Edit">
                   <Edit2 className="h-4 w-4" />
                 </button>
                 <button onClick={() => duplicateTemplate(t)} className="rounded-lg bg-accent p-2 text-accent-foreground hover:bg-accent/80 transition-colors" title="Duplicate">
                   <Copy className="h-4 w-4" />
                 </button>
                 <button onClick={() => deleteTemplate(t.id)} className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20 transition-colors" title="Delete">
                   <Trash2 className="h-4 w-4" />
                 </button>
              </div>
            </div>
            {t.description && <p className="font-sans text-xs text-muted-foreground">{t.description}</p>}
          </div>
        ))
      )}

      {/* Multi-step wizard sheet */}
      <Sheet open={showCreate} onOpenChange={handleCloseCreate}>
        <SheetContent side="bottom" className="h-[92vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 border-b border-border bg-background px-4 pb-3 pt-4 space-y-3">
            <SheetHeader className="p-0">
              <SheetTitle className="font-serif text-base">New Program Template</SheetTitle>
            </SheetHeader>

            {/* Step indicator */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-sans font-bold ${
                      i < step ? "bg-gold text-gold-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {i < step ? <Check className="h-3 w-3" /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-sans hidden sm:inline ${i === step ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{s}</span>
                  </div>
                ))}
              </div>
              <Progress value={((step + 1) / STEPS.length) * 100} className="h-1" />
            </div>
          </div>

          <div className="p-4 pb-24">
            {/* Step 0: Basics */}
            {step === 0 && (
              <div className="space-y-4 max-w-md mx-auto">
                <div>
                  <Label className="font-sans text-xs">Program Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. 6-Month Carnivore Transformation" className="mt-1" />
                </div>
                <div>
                  <Label className="font-sans text-xs">Description</Label>
                  <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Program description..." className="mt-1" />
                </div>
                <div>
                  <Label className="font-sans text-xs">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="font-sans text-xs">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(date) => date <= startDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                {endDate && (
                  <p className="text-[10px] font-sans text-muted-foreground">
                    Duration: {Math.max(1, differenceInWeeks(endDate, startDate))} weeks ({differenceInCalendarDays(endDate, startDate)} days)
                  </p>
                )}
              </div>
            )}

            {/* Step 1: Feature Access */}
            {step === 1 && createdTemplateId && (
              <div className="max-w-md mx-auto">
                <FeatureAccessPanel templateId={createdTemplateId} initialAccess={featureAccess} />
              </div>
            )}

            {/* Step 2: Messages */}
            {step === 2 && createdTemplateId && (
              <div className="space-y-4 max-w-lg mx-auto">
                {/* Custom message form */}
                <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <h3 className="text-xs font-sans font-semibold text-foreground flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-primary" />
                    Add Message
                  </h3>
                  <Textarea
                    value={msgContent}
                    onChange={(e) => setMsgContent(e.target.value)}
                    placeholder="Write your message... Use {client_name} for personalization."
                    className="text-xs min-h-[80px]"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="font-sans text-[10px] text-muted-foreground">Send on Day</Label>
                      <Input
                        type="number"
                        min={1}
                        value={msgDayOffset + 1}
                        onChange={(e) => setMsgDayOffset(Math.max(0, parseInt(e.target.value || "1") - 1))}
                        className="text-xs h-8 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-sans text-[10px] text-muted-foreground">Frequency</Label>
                      <Select value={msgRecurrence} onValueChange={setMsgRecurrence}>
                        <SelectTrigger className="text-xs h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECURRENCE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {msgRecurrence !== "none" && (
                      <div>
                        <Label className="font-sans text-[10px] text-muted-foreground">Until Day</Label>
                        <Input
                          type="number"
                          min={msgDayOffset + 2}
                          value={msgRecurrenceEnd}
                          onChange={(e) => setMsgRecurrenceEnd(e.target.value)}
                          placeholder="∞"
                          className="text-xs h-8 mt-1"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => insertWelcomeMessage(msgContent)}
                    disabled={!msgContent.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-sans font-semibold text-gold-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                    Add Message
                  </button>
                </div>

                {/* Show added messages */}
                {wizardMessages.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-sans font-semibold text-foreground">{wizardMessages.length} message(s) added</p>
                    {wizardMessages.map((m) => (
                      <div key={m.id} className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
                        <p className="text-[10px] font-sans text-foreground truncate">{m.message_content || "Empty message"}</p>
                        <span className="text-[9px] font-sans text-muted-foreground">
                          Day {m.day_offset + 1}
                          {m.recurrence ? ` · ${m.recurrence}` : ""}
                          {m.recurrence_end_day != null ? ` until Day ${m.recurrence_end_day + 1}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Generator */}
                <AiMessageGenerator onInsert={(content) => insertWelcomeMessage(content)} />
              </div>
            )}

            {/* Step 3: Timeline */}
            {step === 3 && createdTemplateId && (
              <div className="space-y-4">
                <p className="text-xs font-sans text-muted-foreground">Add messages and tasks to specific days. Scroll to navigate weeks.</p>
                <ProgramTimeline
                  messages={wizardMessages}
                  tasks={wizardTasks}
                  durationWeeks={endDate ? Math.max(1, differenceInWeeks(endDate, startDate)) : newDuration}
                  onSaveMessage={handleTimelineSaveMessage}
                  onSaveTask={handleTimelineSaveTask}
                  onDeleteMessage={handleTimelineDeleteMessage}
                  onDeleteTask={handleTimelineDeleteTask}
                />

                {/* Quick-add buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => insertWelcomeMessage("Hey {client_name}! Time for your weekly check-in. How are you feeling? Have you been following the plan? Log your meals and measurements if you haven't already!")}
                    className="rounded-full border border-border px-3 py-1.5 text-[10px] font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    + Weekly check-in message
                  </button>
                  <button
                    onClick={async () => {
                      if (!createdTemplateId) return;
                      await supabase.from("program_tasks" as any).insert({
                        program_template_id: createdTemplateId,
                        title: "Log measurements",
                        task_type: "measurement",
                        day_offset: 0,
                        recurrence: "weekly",
                        sort_order: wizardTasks.length,
                      } as any);
                      await loadWizardData();
                      toast({ title: "Weekly measurement task added" });
                    }}
                    className="rounded-full border border-border px-3 py-1.5 text-[10px] font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    + Weekly measurement task
                  </button>
                  <button
                    onClick={async () => {
                      if (!createdTemplateId) return;
                      await supabase.from("program_tasks" as any).insert({
                        program_template_id: createdTemplateId,
                        title: "Log your meals",
                        task_type: "food_journal",
                        day_offset: 0,
                        recurrence: "daily",
                        sort_order: wizardTasks.length,
                      } as any);
                      await loadWizardData();
                      toast({ title: "Daily food journal task added" });
                    }}
                    className="rounded-full border border-border px-3 py-1.5 text-[10px] font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    + Daily food journal task
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom nav */}
          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background px-4 py-3 flex items-center justify-between z-20">
            <button
              onClick={step === 0 ? () => setShowCreate(false) : handleBack}
              className="flex items-center gap-1 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {step === 0 ? "Cancel" : "Back"}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={step === 0 && (!newName.trim() || !endDate)}
                className="flex items-center gap-1 rounded-lg bg-gold px-4 py-2 text-xs font-sans font-semibold text-gold-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {step === 0 ? "Create & Continue" : "Next"}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex items-center gap-1 rounded-lg bg-gold px-4 py-2 text-xs font-sans font-semibold text-gold-foreground hover:opacity-90 transition-opacity"
              >
                <Check className="h-3.5 w-3.5" />
                Finish & Open Editor
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {enrollTemplate && (
        <EnrollClientDialog
          open={!!enrollTemplate}
          onOpenChange={(open) => !open && setEnrollTemplate(null)}
          template={enrollTemplate}
        />
      )}
    </div>
  );
};

export default ProgramTemplateList;
