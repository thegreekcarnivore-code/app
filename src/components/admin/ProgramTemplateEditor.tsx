import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, ListTodo, Video, FileText, ScrollText, Plus, Trash2, Calendar, ToggleRight, Users, ChefHat, Pencil, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FeatureAccessPanel from "@/components/admin/FeatureAccessPanel";
import AiMessageGenerator from "@/components/admin/AiMessageGenerator";
import BulkMessageDistributor from "@/components/admin/BulkMessageDistributor";
import ProgramMessageBoard from "@/components/admin/ProgramMessageBoard";
import ProgramTimeline from "@/components/admin/ProgramTimeline";
import VideoModuleManager from "@/components/admin/VideoModuleManager";
import ProgramEnrollmentsTab from "@/components/admin/ProgramEnrollmentsTab";
import RecipeManager from "@/components/admin/RecipeManager";

const ProgramTemplateEditor = ({ templateId, enrollmentWeeksOverride }: { templateId: string; enrollmentWeeksOverride?: number | null }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [template, setTemplate] = useState<any>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeTab, setActiveTab] = useState("messages");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => { loadAll(); }, [templateId]);

  const loadAll = async () => {
    const [tpl, msgs, tsks, vids, docs, frms] = await Promise.all([
      supabase.from("program_templates" as any).select("*").eq("id", templateId).single(),
      supabase.from("program_messages" as any).select("*").eq("program_template_id", templateId).order("sort_order" as any),
      supabase.from("program_tasks" as any).select("*").eq("program_template_id", templateId).order("sort_order" as any),
      supabase.from("program_videos" as any).select("*").eq("program_template_id", templateId).order("sequence_order" as any),
      supabase.from("program_documents" as any).select("*").eq("program_template_id", templateId).order("sort_order" as any),
      supabase.from("program_forms" as any).select("*").eq("program_template_id", templateId).order("sort_order" as any),
    ]);
    if (tpl.data) setTemplate(tpl.data);
    if (msgs.data) setMessages(msgs.data as any[]);
    if (tsks.data) setTasks(tsks.data as any[]);
    if (vids.data) setVideos(vids.data as any[]);
    if (docs.data) setDocuments(docs.data as any[]);
    if (frms.data) setForms(frms.data as any[]);
  };

  const addItem = async (table: string, defaults: any) => {
    const { error } = await supabase.from(table as any).insert({ program_template_id: templateId, ...defaults } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const deleteItem = async (table: string, id: string) => {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const updateItem = async (table: string, id: string, updates: any) => {
    const { error } = await supabase.from(table as any).update(updates as any).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const handleAiInsert = (content: string) => {
    addItem("program_messages", { message_content: content, day_offset: 0, sort_order: messages.length });
  };

  const handleBulkInsert = async (items: { message_content: string; day_offset: number }[]) => {
    for (let i = 0; i < items.length; i++) {
      await supabase.from("program_messages" as any).insert({
        program_template_id: templateId,
        message_content: items[i].message_content,
        day_offset: items[i].day_offset,
        sort_order: messages.length + i,
      } as any);
    }
    loadAll();
  };

  const handleTimelineSaveMessage = async (data: any) => {
    if (data.id) {
      await updateItem("program_messages", data.id, {
        message_content: data.message_content,
        day_offset: data.day_offset,
        recurrence: data.recurrence,
        recurrence_end_day: data.recurrence_end_day,
        send_hour: data.send_hour ?? 7,
        send_minute: data.send_minute ?? 30,
        also_send_email: data.also_send_email ?? false,
      });
    } else {
      await addItem("program_messages", {
        message_content: data.message_content,
        day_offset: data.day_offset,
        recurrence: data.recurrence,
        recurrence_end_day: data.recurrence_end_day,
        send_hour: data.send_hour ?? 7,
        send_minute: data.send_minute ?? 30,
        also_send_email: data.also_send_email ?? false,
        sort_order: messages.length,
      });
    }
    loadAll();
  };

  const handleTimelineSaveTask = async (data: any) => {
    if (data.id) {
      await updateItem("program_tasks", data.id, { title: data.title, description: data.description, task_type: data.task_type, day_offset: data.day_offset, recurrence: data.recurrence, recurrence_end_day: data.recurrence_end_day });
    } else {
      await addItem("program_tasks", { title: data.title, description: data.description, task_type: data.task_type, day_offset: data.day_offset, recurrence: data.recurrence, recurrence_end_day: data.recurrence_end_day, sort_order: tasks.length });
    }
    loadAll();
  };

  if (!template) return <div className="flex justify-center py-8"><div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          {editingName ? (
            <>
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="font-serif text-lg font-semibold h-8"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const trimmed = nameDraft.trim();
                    if (trimmed) {
                      supabase.from("program_templates" as any).update({ name: trimmed } as any).eq("id", templateId).then(() => {
                        setTemplate({ ...template, name: trimmed });
                        toast({ title: "Program renamed" });
                      });
                    }
                    setEditingName(false);
                  } else if (e.key === "Escape") {
                    setEditingName(false);
                  }
                }}
              />
              <button
                onClick={() => {
                  const trimmed = nameDraft.trim();
                  if (trimmed) {
                    supabase.from("program_templates" as any).update({ name: trimmed } as any).eq("id", templateId).then(() => {
                      setTemplate({ ...template, name: trimmed });
                      toast({ title: "Program renamed" });
                    });
                  }
                  setEditingName(false);
                }}
                className="p-1 text-primary hover:bg-primary/10 rounded"
              >
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setEditingName(false)} className="p-1 text-muted-foreground hover:bg-muted rounded">
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <h2 className="font-serif text-lg font-semibold text-foreground">{template.name}</h2>
              <button
                onClick={() => { setNameDraft(template.name); setEditingName(true); }}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Rename program"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 font-sans text-xs text-muted-foreground">
          <span>{template.description}</span>
          <span>·</span>
          <div className="flex items-center gap-1">
            {enrollmentWeeksOverride != null ? (
              <>
                <span className="font-medium text-foreground">{enrollmentWeeksOverride}</span>
                <span>weeks (client override)</span>
              </>
            ) : (
              <>
                <Input
                  type="number"
                  min={1}
                  defaultValue={template.duration_weeks}
                  className="h-6 w-14 text-xs px-1.5 text-center"
                  onBlur={async (e) => {
                    const weeks = Math.max(1, Number(e.target.value));
                    await supabase.from("program_templates" as any).update({ duration_weeks: weeks } as any).eq("id", templateId);
                    setTemplate({ ...template, duration_weeks: weeks });
                  }}
                />
                <span>weeks</span>
              </>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <TabsList className="inline-flex w-auto min-w-full h-auto">
            <TabsTrigger value="timeline" className="text-[10px] gap-1 py-2 shrink-0"><Calendar className="h-3 w-3" />Timeline</TabsTrigger>
            <TabsTrigger value="messages" className="text-[10px] gap-1 py-2 shrink-0"><MessageCircle className="h-3 w-3" />Messages</TabsTrigger>
            <TabsTrigger value="tasks" className="text-[10px] gap-1 py-2 shrink-0"><ListTodo className="h-3 w-3" />Tasks</TabsTrigger>
            <TabsTrigger value="videos" className="text-[10px] gap-1 py-2 shrink-0"><Video className="h-3 w-3" />Videos</TabsTrigger>
            <TabsTrigger value="documents" className="text-[10px] gap-1 py-2 shrink-0"><FileText className="h-3 w-3" />Docs</TabsTrigger>
            <TabsTrigger value="forms" className="text-[10px] gap-1 py-2 shrink-0"><ScrollText className="h-3 w-3" />Forms</TabsTrigger>
            <TabsTrigger value="access" className="text-[10px] gap-1 py-2 shrink-0"><ToggleRight className="h-3 w-3" />Access</TabsTrigger>
            <TabsTrigger value="recipes" className="text-[10px] gap-1 py-2 shrink-0"><ChefHat className="h-3 w-3" />Recipes</TabsTrigger>
            <TabsTrigger value="clients" className="text-[10px] gap-1 py-2 shrink-0"><Users className="h-3 w-3" />Clients</TabsTrigger>
          </TabsList>
        </div>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="mt-4">
          <ProgramTimeline
            messages={messages}
            tasks={tasks}
            durationWeeks={template.duration_weeks || 26}
            onSaveMessage={handleTimelineSaveMessage}
            onSaveTask={handleTimelineSaveTask}
            onDeleteMessage={(id) => { deleteItem("program_messages", id); }}
            onDeleteTask={(id) => { deleteItem("program_tasks", id); }}
          />
        </TabsContent>

        {/* MESSAGES */}
        <TabsContent value="messages" className="mt-4">
          <ProgramMessageBoard
            messages={messages}
            templateId={templateId}
            durationWeeks={template.duration_weeks || 26}
            onReload={loadAll}
            onAiInsert={handleAiInsert}
            onBulkInsert={handleBulkInsert}
          />
        </TabsContent>

        {/* TASKS */}
        <TabsContent value="tasks" className="space-y-3 mt-4">
          <button onClick={() => addItem("program_tasks", { title: "", task_type: "custom", day_offset: 0, sort_order: tasks.length })} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
            <Plus className="h-3 w-3" /> Add Task
          </button>
          {tasks.map((t) => (
            <div key={t.id} ref={(el) => { if (el) taskRefs.current.set(t.id, el); }} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <div><Label className="text-[10px]">Type</Label>
                    <Select defaultValue={t.task_type} onValueChange={(v) => updateItem("program_tasks", t.id, { task_type: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="measurement">Measurement</SelectItem>
                        <SelectItem value="food_journal">Food Journal</SelectItem>
                        <SelectItem value="watch_video">Watch Video</SelectItem>
                        <SelectItem value="sign_form">Sign Form</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Day Offset</Label><Input type="number" defaultValue={t.day_offset} className="h-8 text-xs" onBlur={(e) => updateItem("program_tasks", t.id, { day_offset: Number(e.target.value) })} /></div>
                  <div><Label className="text-[10px]">Recurrence</Label>
                    <Select defaultValue={t.recurrence || "none"} onValueChange={(v) => updateItem("program_tasks", t.id, { recurrence: v === "none" ? null : v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">End Day</Label><Input type="number" defaultValue={t.recurrence_end_day || ""} className="h-8 text-xs" placeholder="∞" onBlur={(e) => updateItem("program_tasks", t.id, { recurrence_end_day: e.target.value ? Number(e.target.value) : null })} /></div>
                </div>
                <button onClick={() => deleteItem("program_tasks", t.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <Input defaultValue={t.title} placeholder="Task title" className="text-xs h-8" onBlur={(e) => updateItem("program_tasks", t.id, { title: e.target.value })} />
              <Textarea defaultValue={t.description} placeholder="Task description..." className="text-xs min-h-[40px]" onBlur={(e) => updateItem("program_tasks", t.id, { description: e.target.value })} />
            </div>
          ))}
        </TabsContent>

        {/* VIDEOS */}
        <TabsContent value="videos" className="space-y-3 mt-4">
          <VideoModuleManager templateId={templateId} />
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="space-y-3 mt-4">
          <button onClick={() => addItem("program_documents", { title: "", document_url: "", category: "general", sort_order: documents.length })} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
            <Plus className="h-3 w-3" /> Add Document
          </button>
          {documents.map((d) => (
            <div key={d.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">Category</Label>
                    <Select defaultValue={d.category} onValueChange={(val) => updateItem("program_documents", d.id, { category: val })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="recipes">Recipes</SelectItem>
                        <SelectItem value="guides">Guides</SelectItem>
                        <SelectItem value="legal">Legal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Order</Label><Input type="number" defaultValue={d.sort_order} className="h-8 text-xs" onBlur={(e) => updateItem("program_documents", d.id, { sort_order: Number(e.target.value) })} /></div>
                </div>
                <button onClick={() => deleteItem("program_documents", d.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <Input defaultValue={d.title} placeholder="Document title" className="text-xs h-8" onBlur={(e) => updateItem("program_documents", d.id, { title: e.target.value })} />
              <Input defaultValue={d.document_url} placeholder="Document URL" className="text-xs h-8" onBlur={(e) => updateItem("program_documents", d.id, { document_url: e.target.value })} />
              <Textarea defaultValue={d.description} placeholder="Description..." className="text-xs min-h-[40px]" onBlur={(e) => updateItem("program_documents", d.id, { description: e.target.value })} />
            </div>
          ))}
        </TabsContent>

        {/* FORMS */}
        <TabsContent value="forms" className="space-y-3 mt-4">
          <button onClick={() => addItem("program_forms", { title: "", content: "", sort_order: forms.length })} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
            <Plus className="h-3 w-3" /> Add Form
          </button>
          {forms.map((f) => (
            <div key={f.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Input defaultValue={f.title} placeholder="Form title (e.g. Πολιτικές & Διαδικασίες)" className="text-xs h-8 flex-1 mr-2" onBlur={(e) => updateItem("program_forms", f.id, { title: e.target.value })} />
                <button onClick={() => deleteItem("program_forms", f.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <Textarea defaultValue={f.content} placeholder="Form content (supports markdown)..." className="text-xs min-h-[120px] font-mono" onBlur={(e) => updateItem("program_forms", f.id, { content: e.target.value })} />
              <div className="flex items-center gap-2">
                <Label className="text-[10px]">Order</Label>
                <Input type="number" defaultValue={f.sort_order} className="h-8 text-xs w-20" onBlur={(e) => updateItem("program_forms", f.id, { sort_order: Number(e.target.value) })} />
              </div>
            </div>
          ))}
        </TabsContent>

        {/* FEATURE ACCESS */}
        <TabsContent value="access" className="mt-4">
          <FeatureAccessPanel templateId={templateId} initialAccess={template.feature_access} />
        </TabsContent>

        {/* RECIPES */}
        <TabsContent value="recipes" className="mt-4">
          <RecipeManager templateId={templateId} />
        </TabsContent>

        {/* CLIENTS / ENROLLMENTS */}
        <TabsContent value="clients" className="mt-4">
          <ProgramEnrollmentsTab templateId={templateId} templateName={template.name} durationWeeks={template.duration_weeks || 26} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProgramTemplateEditor;
