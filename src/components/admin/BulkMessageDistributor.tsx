import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2, Check, X, Pencil, RefreshCw, Trash2 } from "lucide-react";

interface PreviewItem {
  message_content: string;
  day_offset: number;
}

interface Props {
  durationWeeks: number;
  existingMessages: any[];
  onInsertAll: (items: PreviewItem[]) => void;
}

const BulkMessageDistributor = ({ durationWeeks, existingMessages, onInsertAll }: Props) => {
  const [rawText, setRawText] = useState("");
  const [language, setLanguage] = useState<"en" | "el">("en");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editDay, setEditDay] = useState(0);

  const distribute = async () => {
    const lines = rawText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      toast({ title: "No messages", description: "Paste at least one message per line.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setPreview(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/distribute-messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: lines,
          durationWeeks,
          language,
          existingMessages: existingMessages.map(m => ({ day_offset: m.day_offset, message_content: m.message_content })),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { distributed } = await resp.json();
      let items: PreviewItem[] = distributed.map((d: any) => ({
        message_content: d.message_content,
        day_offset: d.day_offset,
      }));

      // Enforce max 1 message per day — shift duplicates
      items.sort((a: PreviewItem, b: PreviewItem) => a.day_offset - b.day_offset);
      const usedDays = new Set(existingMessages.map(m => m.day_offset));
      const totalDays = durationWeeks * 7;
      const deduped: PreviewItem[] = [];
      for (const item of items) {
        let day = item.day_offset;
        while (usedDays.has(day) && day < totalDays) day++;
        if (day >= totalDays) {
          // Find any free day from start
          for (let d = 0; d < totalDays; d++) {
            if (!usedDays.has(d)) { day = d; break; }
          }
        }
        usedDays.add(day);
        deduped.push({ ...item, day_offset: day });
      }
      deduped.sort((a, b) => a.day_offset - b.day_offset);

      setPreview(deduped);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confirmInsert = () => {
    if (!preview) return;
    onInsertAll(preview);
    setPreview(null);
    setRawText("");
    toast({ title: `${preview.length} messages distributed!` });
  };

  const startEdit = (idx: number) => {
    if (!preview) return;
    setEditingIdx(idx);
    setEditText(preview[idx].message_content);
    setEditDay(preview[idx].day_offset);
  };

  const saveEdit = () => {
    if (!preview || editingIdx === null) return;
    const updated = [...preview];
    updated[editingIdx] = { message_content: editText, day_offset: editDay };
    updated.sort((a, b) => a.day_offset - b.day_offset);
    setPreview(updated);
    setEditingIdx(null);
  };

  const cancelEdit = () => setEditingIdx(null);

  const removeItem = (idx: number) => {
    if (!preview) return;
    const updated = preview.filter((_, i) => i !== idx);
    setPreview(updated.length > 0 ? updated : null);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-xs font-sans font-semibold text-foreground">
        <Wand2 className="h-3.5 w-3.5 text-gold" />
        Bulk Message Distributor
      </h3>
      <p className="text-[10px] font-sans text-muted-foreground">
        Paste one message per line. AI will spread them across the {durationWeeks}-week program (max 1 per day).
      </p>

      <Textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={"Welcome to the program, {client_name}!\nHow are you feeling this week?\nRemember to log your meals today!\nYou're doing great, keep it up!\nTime for your weekly measurements!"}
        className="text-xs min-h-[100px] font-mono"
      />

      <div className="flex items-center gap-2">
        <div className="w-28">
          <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "el")}>
            <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en" className="text-xs">🇬🇧 English</SelectItem>
              <SelectItem value="el" className="text-xs">🇬🇷 Ελληνικά</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-[10px] font-sans text-muted-foreground">
          {rawText.split("\n").filter(l => l.trim()).length} messages
        </span>
        <div className="flex-1" />
        {preview && (
          <button
            onClick={distribute}
            disabled={loading || !rawText.trim()}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-sans text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Remake
          </button>
        )}
        <button
          onClick={distribute}
          disabled={loading || !rawText.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-sans font-semibold text-gold-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          Distribute
        </button>
      </div>

      {/* Preview with edit/delete */}
      {preview && (
        <div className="space-y-2 rounded-lg border border-gold/20 bg-gold/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-sans font-semibold text-foreground">
              Preview — {preview.length} messages
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={confirmInsert}
                className="flex items-center gap-1 rounded-md bg-gold px-2.5 py-1 text-[10px] font-sans font-semibold text-gold-foreground hover:opacity-90"
              >
                <Check className="h-3 w-3" /> Add All
              </button>
              <button
                onClick={() => setPreview(null)}
                className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[10px] font-sans text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {preview.map((item, i) => (
              <div key={i} className="group rounded-md border border-transparent hover:border-border p-1.5 transition-colors">
                {editingIdx === i ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-sans text-muted-foreground shrink-0">Day</span>
                      <Input
                        type="number"
                        value={editDay + 1}
                        onChange={(e) => setEditDay(Math.max(0, Number(e.target.value) - 1))}
                        className="h-6 w-16 text-[10px] px-1.5"
                        min={1}
                        max={durationWeeks * 7}
                      />
                    </div>
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="text-[10px] min-h-[50px]"
                    />
                    <div className="flex items-center gap-1">
                      <button onClick={saveEdit} className="rounded-md bg-gold px-2 py-0.5 text-[9px] font-semibold text-gold-foreground">Save</button>
                      <button onClick={cancelEdit} className="rounded-md border border-border px-2 py-0.5 text-[9px] text-muted-foreground">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-[10px] font-sans">
                    <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-primary font-semibold">
                      D{item.day_offset + 1}
                    </span>
                    <span className="text-foreground flex-1">{item.message_content}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => startEdit(i)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeItem(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkMessageDistributor;
