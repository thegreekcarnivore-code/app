import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, MessageCircle, Mail, Clock, Pencil, X, Check, ChevronDown, ChevronRight } from "lucide-react";
import AiMessageGenerator from "@/components/admin/AiMessageGenerator";
import BulkMessageDistributor from "@/components/admin/BulkMessageDistributor";

interface ProgramMessageBoardProps {
  messages: any[];
  templateId: string;
  durationWeeks: number;
  onReload: () => void;
  onAiInsert: (content: string) => void;
  onBulkInsert: (items: { message_content: string; day_offset: number }[]) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

const ProgramMessageBoard = ({
  messages,
  templateId,
  durationWeeks,
  onReload,
  onAiInsert,
  onBulkInsert,
}: ProgramMessageBoardProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());

  // Group messages by day_offset
  const grouped = useMemo(() => {
    const map = new Map<number, any[]>();
    const sorted = [...messages].sort((a, b) => a.day_offset - b.day_offset || a.sort_order - b.sort_order);
    for (const m of sorted) {
      const day = m.day_offset ?? 0;
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [messages]);

  const updateItem = async (id: string, updates: any) => {
    const { error } = await supabase.from("program_messages" as any).update(updates as any).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("program_messages" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else onReload();
  };

  const addMessage = async () => {
    const { error } = await supabase.from("program_messages" as any).insert({
      program_template_id: templateId,
      message_content: "",
      day_offset: 0,
      sort_order: messages.length,
      send_hour: 7,
      send_minute: 30,
      also_send_email: false,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else onReload();
  };

  const toggleDay = (day: number) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const getRecurrenceLabel = (m: any) => {
    if (!m.recurrence) return "Once";
    if (m.recurrence === "daily") return m.recurrence_end_day ? `Daily → Day ${m.recurrence_end_day}` : "Daily";
    if (m.recurrence === "weekly") return m.recurrence_end_day ? `Weekly → Day ${m.recurrence_end_day}` : "Weekly";
    return m.recurrence;
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <AiMessageGenerator onInsert={onAiInsert} />
        <BulkMessageDistributor
          durationWeeks={durationWeeks}
          existingMessages={messages}
          onInsertAll={onBulkInsert}
        />
      </div>

      <button
        onClick={addMessage}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add Message
      </button>

      {/* Messages grouped by day */}
      {grouped.map(([day, dayMessages]) => {
        const isCollapsed = collapsedDays.has(day);
        return (
          <div key={day} className="space-y-2">
            {/* Day header */}
            <button
              onClick={() => toggleDay(day)}
              className="flex items-center gap-2 text-xs font-sans font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span className="uppercase tracking-wider">Day {day}</span>
              <div className="flex-1 border-t border-border" />
              <span className="text-[10px] font-normal">{dayMessages.length} message{dayMessages.length !== 1 ? "s" : ""}</span>
            </button>

            {!isCollapsed &&
              dayMessages.map((m: any) => {
                const isEditing = editingId === m.id;
                return (
                  <MessageCard
                    key={m.id}
                    message={m}
                    isEditing={isEditing}
                    onEdit={() => setEditingId(m.id)}
                    onCancel={() => setEditingId(null)}
                    onSave={async (updates) => {
                      await updateItem(m.id, updates);
                      setEditingId(null);
                      onReload();
                    }}
                    onDelete={() => deleteItem(m.id)}
                    recurrenceLabel={getRecurrenceLabel(m)}
                  />
                );
              })}
          </div>
        );
      })}

      {messages.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground font-sans">
          No messages yet. Add one above or use AI to generate messages.
        </div>
      )}
    </div>
  );
};

/* ─── Individual Message Card ─── */
interface MessageCardProps {
  message: any;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: any) => Promise<void>;
  onDelete: () => void;
  recurrenceLabel: string;
}

const MessageCard = ({ message: m, isEditing, onEdit, onCancel, onSave, onDelete, recurrenceLabel }: MessageCardProps) => {
  const [draft, setDraft] = useState({
    message_content: m.message_content || "",
    day_offset: m.day_offset ?? 0,
    send_hour: m.send_hour ?? 7,
    send_minute: m.send_minute ?? 30,
    recurrence: m.recurrence || "none",
    recurrence_end_day: m.recurrence_end_day?.toString() || "",
    also_send_email: m.also_send_email ?? false,
  });

  // Reset draft when entering edit mode
  const handleEdit = () => {
    setDraft({
      message_content: m.message_content || "",
      day_offset: m.day_offset ?? 0,
      send_hour: m.send_hour ?? 7,
      send_minute: m.send_minute ?? 30,
      recurrence: m.recurrence || "none",
      recurrence_end_day: m.recurrence_end_day?.toString() || "",
      also_send_email: m.also_send_email ?? false,
    });
    onEdit();
  };

  const handleSave = () => {
    onSave({
      message_content: draft.message_content,
      day_offset: draft.day_offset,
      send_hour: draft.send_hour,
      send_minute: draft.send_minute,
      recurrence: draft.recurrence === "none" ? null : draft.recurrence,
      recurrence_end_day: draft.recurrence_end_day ? Number(draft.recurrence_end_day) : null,
      also_send_email: draft.also_send_email,
    });
  };

  const timeStr = `${String(m.send_hour ?? 7).padStart(2, "0")}:${String(m.send_minute ?? 30).padStart(2, "0")}`;

  if (isEditing) {
    return (
      <div className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-3 ml-4">
        {/* Content */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Message Content</Label>
          <Textarea
            value={draft.message_content}
            onChange={(e) => setDraft({ ...draft, message_content: e.target.value })}
            placeholder="Message content... use {client_name} for personalization"
            className="text-sm min-h-[100px] mt-1"
            autoFocus
          />
        </div>

        {/* Controls grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Day</Label>
            <Input
              type="number"
              value={draft.day_offset}
              onChange={(e) => setDraft({ ...draft, day_offset: Number(e.target.value) })}
              className="h-8 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Send Time</Label>
            <div className="flex items-center gap-1 mt-1">
              <Select value={String(draft.send_hour)} onValueChange={(v) => setDraft({ ...draft, send_hour: Number(v) })}>
                <SelectTrigger className="h-8 text-xs w-16"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">:</span>
              <Select value={String(draft.send_minute)} onValueChange={(v) => setDraft({ ...draft, send_minute: Number(v) })}>
                <SelectTrigger className="h-8 text-xs w-16"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MINUTES.map((min) => (
                    <SelectItem key={min} value={String(min)}>{String(min).padStart(2, "0")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Recurrence</Label>
            <Select value={draft.recurrence} onValueChange={(v) => setDraft({ ...draft, recurrence: v })}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">End Day</Label>
            <Input
              type="number"
              value={draft.recurrence_end_day}
              onChange={(e) => setDraft({ ...draft, recurrence_end_day: e.target.value })}
              className="h-8 text-xs mt-1"
              placeholder="∞"
            />
          </div>
        </div>

        {/* Email toggle */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-sans text-foreground">Also send as email</span>
          </div>
          <Switch
            checked={draft.also_send_email}
            onCheckedChange={(v) => setDraft({ ...draft, also_send_email: v })}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-sans font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Check className="h-3 w-3" /> Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
          <div className="flex-1" />
          <button
            onClick={onDelete}
            className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Preview mode
  return (
    <div
      className="group rounded-xl border border-border bg-card hover:border-primary/20 transition-colors ml-4 cursor-pointer"
      onDoubleClick={handleEdit}
    >
      {/* Chat bubble preview */}
      <div className="p-3 pb-2">
        <div className="flex items-start gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs font-sans text-foreground leading-relaxed line-clamp-3 flex-1">
            {m.message_content || <span className="italic text-muted-foreground">Empty message</span>}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); handleEdit(); }}
            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground rounded transition-all"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Footer badges */}
      <div className="flex items-center gap-2 px-3 pb-2.5 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-sans text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {timeStr}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-sans text-muted-foreground">
          {recurrenceLabel}
        </span>
        {m.also_send_email && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-sans font-medium">
            <Mail className="h-2.5 w-2.5" />
            Email
          </span>
        )}
      </div>
    </div>
  );
};

export default ProgramMessageBoard;
