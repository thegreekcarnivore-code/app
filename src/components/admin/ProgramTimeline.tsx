import { useState, useMemo, useCallback } from "react";
import { MessageCircle, ListTodo, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TimelineItemEditor from "@/components/admin/TimelineItemEditor";

interface TimelineMessage {
  id: string;
  day_offset: number;
  message_content: string;
  recurrence?: string | null;
  recurrence_end_day?: number | null;
}

interface TimelineTask {
  id: string;
  day_offset: number;
  title: string;
  task_type: string;
  description?: string;
  recurrence?: string | null;
  recurrence_end_day?: number | null;
}

interface Props {
  messages: TimelineMessage[];
  tasks: TimelineTask[];
  durationWeeks: number;
  onSaveMessage: (data: any) => void;
  onSaveTask: (data: any) => void;
  onDeleteMessage: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

const VIEW_OPTIONS = [1, 2, 4] as const;

const ProgramTimeline = ({ messages, tasks, durationWeeks, onSaveMessage, onSaveTask, onDeleteMessage, onDeleteTask }: Props) => {
  const [viewWeeks, setViewWeeks] = useState<number>(4);
  const [pageStart, setPageStart] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorType, setEditorType] = useState<"message" | "task">("message");
  const [editorItem, setEditorItem] = useState<any>(null);
  const [editorDay, setEditorDay] = useState(0);

  const totalWeeks = durationWeeks;
  const visibleWeeks = Math.min(viewWeeks, totalWeeks);
  const maxPage = Math.max(0, totalWeeks - visibleWeeks);
  const currentPage = Math.min(pageStart, maxPage);
  const weekStart = currentPage;
  const weekEnd = Math.min(currentPage + visibleWeeks, totalWeeks);

  const dayItems = useMemo(() => {
    const totalDays = totalWeeks * 7;
    const map = new Map<number, { messages: TimelineMessage[]; tasks: TimelineTask[] }>();
    for (let d = 0; d < totalDays; d++) map.set(d, { messages: [], tasks: [] });

    const expandRecurrence = <T extends { day_offset: number; recurrence?: string | null; recurrence_end_day?: number | null }>(
      items: T[],
      pushTo: (day: number, item: T) => void
    ) => {
      items.forEach(item => {
        pushTo(item.day_offset, item);
        if (item.recurrence === "daily") {
          const end = item.recurrence_end_day ?? totalDays - 1;
          for (let d = item.day_offset + 1; d <= Math.min(end, totalDays - 1); d++) {
            pushTo(d, item);
          }
        } else if (item.recurrence === "weekly") {
          const end = item.recurrence_end_day ?? totalDays - 1;
          for (let d = item.day_offset + 7; d <= Math.min(end, totalDays - 1); d += 7) {
            pushTo(d, item);
          }
        }
      });
    };

    expandRecurrence(messages, (d, m) => { const e = map.get(d); if (e) e.messages.push(m); });
    expandRecurrence(tasks, (d, t) => { const e = map.get(d); if (e) e.tasks.push(t); });
    return map;
  }, [messages, tasks, totalWeeks]);

  const handlePrev = useCallback(() => setPageStart(p => Math.max(0, p - 1)), []);
  const handleNext = useCallback(() => setPageStart(p => Math.min(maxPage, p + 1)), [maxPage]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.deltaY > 0) setPageStart(p => Math.min(maxPage, p + 1));
    else if (e.deltaY < 0) setPageStart(p => Math.max(0, p - 1));
  }, [maxPage]);

  const openEditor = (type: "message" | "task", item: any | null, day: number) => {
    setEditorType(type);
    setEditorItem(item);
    setEditorDay(day);
    setEditorOpen(true);
  };

  const handleEditorSave = (data: any) => {
    if (editorType === "message") onSaveMessage(data);
    else onSaveTask(data);
  };

  const handleEditorDelete = (id: string) => {
    if (editorType === "message") onDeleteMessage(id);
    else onDeleteTask(id);
  };

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} disabled={currentPage === 0} className="p-1 rounded-md hover:bg-accent disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <span className="text-xs font-sans font-semibold text-foreground">
            Week {weekStart + 1} – {weekEnd} of {totalWeeks}
          </span>
          <button onClick={handleNext} disabled={currentPage >= maxPage} className="p-1 rounded-md hover:bg-accent disabled:opacity-30 transition-colors">
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        </div>
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {VIEW_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => { setViewWeeks(opt); setPageStart(0); }}
              className={`px-3 py-1 text-[10px] font-sans font-semibold transition-colors ${
                viewWeeks === opt ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt} Week{opt > 1 ? "" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }} onWheel={handleWheel}>
        {Array.from({ length: weekEnd - weekStart }, (_, wi) => {
          const weekIdx = weekStart + wi;
          return (
            <div key={weekIdx} className="flex">
              <div className="flex-shrink-0 w-10 flex items-start justify-center pt-3">
                <span className="text-[9px] font-sans font-bold text-muted-foreground [writing-mode:vertical-lr] rotate-180 tracking-widest uppercase">
                  Week {weekIdx + 1}
                </span>
              </div>
              <div className="flex-1 grid grid-cols-7 gap-px">
                {Array.from({ length: 7 }, (_, di) => {
                  const dayOffset = weekIdx * 7 + di;
                  const items = dayItems.get(dayOffset);
                  const msgCount = items?.messages.length ?? 0;
                  const taskCount = items?.tasks.length ?? 0;
                  const hasContent = msgCount > 0 || taskCount > 0;

                  return (
                    <Popover key={dayOffset}>
                      <PopoverTrigger asChild>
                        <button
                          className={`relative flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-colors min-h-[80px] ${
                            hasContent
                              ? "border-border bg-card hover:border-primary/40"
                              : "border-transparent bg-muted/40 hover:bg-muted/70"
                          }`}
                        >
                          <span className="text-[10px] font-sans font-semibold text-muted-foreground uppercase">Day {dayOffset + 1}</span>
                          {items?.messages.slice(0, 1).map(m => (
                            <div key={m.id} className="flex items-center gap-1 w-full">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-primary flex-shrink-0">
                                <MessageCircle className="h-2.5 w-2.5" />
                              </span>
                              <span className="text-[9px] font-sans text-foreground truncate">
                                {m.message_content?.slice(0, 20) || "Message"}...
                              </span>
                            </div>
                          ))}
                          {items?.tasks.slice(0, 1).map(t => (
                            <div key={t.id} className="flex items-center gap-1 w-full">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground flex-shrink-0">
                                <ListTodo className="h-2.5 w-2.5" />
                              </span>
                              <span className="text-[9px] font-sans text-foreground truncate">
                                {t.title || t.task_type}
                              </span>
                            </div>
                          ))}
                          {(msgCount + taskCount > 2) && (
                            <span className="text-[9px] font-sans text-muted-foreground">+ {msgCount + taskCount - 2} more</span>
                          )}
                          {!hasContent && (
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>

                      <PopoverContent className="w-56 p-2 space-y-1.5" side="bottom" align="center">
                        <p className="text-[10px] font-sans font-semibold text-foreground">Day {dayOffset + 1} — Week {weekIdx + 1}</p>
                        {items?.messages.map(m => (
                          <button
                            key={m.id}
                            onClick={() => openEditor("message", m, dayOffset)}
                            className="w-full text-left rounded-md bg-primary/10 px-2 py-1 text-[10px] font-sans text-foreground hover:bg-primary/20 transition-colors truncate"
                          >
                            <MessageCircle className="h-2.5 w-2.5 inline mr-1 text-primary" />
                            {m.message_content?.slice(0, 40) || "Message"}...
                          </button>
                        ))}
                        {items?.tasks.map(t => (
                          <button
                            key={t.id}
                            onClick={() => openEditor("task", t, dayOffset)}
                            className="w-full text-left rounded-md bg-accent/50 px-2 py-1 text-[10px] font-sans text-foreground hover:bg-accent transition-colors truncate"
                          >
                            <ListTodo className="h-2.5 w-2.5 inline mr-1 text-accent-foreground" />
                            {t.title || t.task_type}
                          </button>
                        ))}
                        <div className="flex gap-1 pt-1 border-t border-border">
                          <button
                            onClick={() => openEditor("message", null, dayOffset)}
                            className="flex-1 flex items-center justify-center gap-1 rounded-md border border-dashed border-border py-1 text-[9px] font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                          >
                            <Plus className="h-2.5 w-2.5" /> Message
                          </button>
                          <button
                            onClick={() => openEditor("task", null, dayOffset)}
                            className="flex-1 flex items-center justify-center gap-1 rounded-md border border-dashed border-border py-1 text-[9px] font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                          >
                            <Plus className="h-2.5 w-2.5" /> Task
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline editor dialog */}
      <TimelineItemEditor
        key={editorItem?.id ?? `new-${editorType}-${editorDay}`}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        type={editorType}
        item={editorItem}
        dayOffset={editorDay}
        onSave={handleEditorSave}
        onDelete={handleEditorDelete}
      />
    </div>
  );
};

export default ProgramTimeline;
