import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, MessageCircle, ListTodo, Camera, Mail, Clock } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

const MESSAGE_TEMPLATES = [
  {
    label: "📏 Measurement & Photos Reminder",
    message_content: "Hey {client_name}! 🔔 Today is your measurement day — don't forget to log your body measurements and take your progress photos. Consistency is key!",
    recurrence: "weekly",
    recurrence_end_day: "",
  },
];

interface TimelineItemEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "message" | "task";
  item?: any;
  dayOffset: number;
  onSave: (data: any) => void;
  onDelete?: (id: string) => void;
}

const TimelineItemEditor = ({ open, onOpenChange, type, item, dayOffset, onSave, onDelete }: TimelineItemEditorProps) => {
  const isNew = !item;

  const [msgContent, setMsgContent] = useState(item?.message_content ?? "");
  const [recurrence, setRecurrence] = useState(item?.recurrence ?? "none");
  const [recurrenceEndDay, setRecurrenceEndDay] = useState<string>(item?.recurrence_end_day?.toString() ?? "");
  const [day, setDay] = useState(item?.day_offset ?? dayOffset);
  const [sendHour, setSendHour] = useState(item?.send_hour ?? 7);
  const [sendMinute, setSendMinute] = useState(item?.send_minute ?? 30);
  const [alsoSendEmail, setAlsoSendEmail] = useState(item?.also_send_email ?? false);

  // Task-specific
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [taskType, setTaskType] = useState(item?.task_type ?? "custom");

  const applyTemplate = (tpl: typeof MESSAGE_TEMPLATES[0]) => {
    setMsgContent(tpl.message_content);
    setRecurrence(tpl.recurrence);
    setRecurrenceEndDay(tpl.recurrence_end_day);
  };

  const handleSave = () => {
    if (type === "message") {
      onSave({
        id: item?.id,
        message_content: msgContent,
        day_offset: day,
        send_hour: sendHour,
        send_minute: sendMinute,
        also_send_email: alsoSendEmail,
        recurrence: recurrence === "none" ? null : recurrence,
        recurrence_end_day: recurrenceEndDay ? Number(recurrenceEndDay) : null,
      });
    } else {
      onSave({
        id: item?.id,
        title,
        description,
        task_type: taskType,
        day_offset: day,
        recurrence: recurrence === "none" ? null : recurrence,
        recurrence_end_day: recurrenceEndDay ? Number(recurrenceEndDay) : null,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-sans">
            {type === "message" ? (
              <><MessageCircle className="h-4 w-4 text-blue-500" />{isNew ? "New Message" : "Edit Message"}</>
            ) : (
              <><ListTodo className="h-4 w-4 text-emerald-500" />{isNew ? "New Task" : "Edit Task"}</>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Quick templates for new messages */}
          {type === "message" && isNew && (
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Quick Templates</Label>
              <div className="flex flex-wrap gap-1.5">
                {MESSAGE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => applyTemplate(tpl)}
                    className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/5 px-2.5 py-1 text-[10px] font-sans text-gold hover:bg-gold/10 transition-colors"
                  >
                    <Camera className="h-3 w-3" />
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Day</Label>
              <Input type="number" value={day} onChange={(e) => setDay(Number(e.target.value))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Recurrence</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">End Day</Label>
              <Input type="number" value={recurrenceEndDay} onChange={(e) => setRecurrenceEndDay(e.target.value)} className="h-8 text-xs" placeholder="∞" />
            </div>
          </div>

          {type === "task" && (
            <>
              <div>
                <Label className="text-[10px]">Task Type</Label>
                <Select value={taskType} onValueChange={setTaskType}>
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
              <div>
                <Label className="text-[10px]">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" placeholder="Task title" />
              </div>
              <div>
                <Label className="text-[10px]">Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="text-xs min-h-[60px]" placeholder="Task description..." />
              </div>
            </>
          )}

          {type === "message" && (
            <>
              <div>
                <Label className="text-[10px]">Message Content</Label>
                <Textarea value={msgContent} onChange={(e) => setMsgContent(e.target.value)} className="text-xs min-h-[80px]" placeholder="Message content... use {client_name} for personalization" />
              </div>
              <div>
                <Label className="text-[10px] flex items-center gap-1"><Clock className="h-3 w-3" /> Send Time</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Select value={String(sendHour)} onValueChange={(v) => setSendHour(Number(v))}>
                    <SelectTrigger className="h-8 text-xs w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">:</span>
                  <Select value={String(sendMinute)} onValueChange={(v) => setSendMinute(Number(v))}>
                    <SelectTrigger className="h-8 text-xs w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MINUTES.map((min) => (
                        <SelectItem key={min} value={String(min)}>{String(min).padStart(2, "0")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-sans">Also send as email</span>
                </div>
                <Switch checked={alsoSendEmail} onCheckedChange={setAlsoSendEmail} />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleSave} size="sm" className="flex-1">
              {isNew ? "Create" : "Save"}
            </Button>
            {!isNew && onDelete && (
              <Button variant="destructive" size="sm" onClick={() => { onDelete(item.id); onOpenChange(false); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimelineItemEditor;
