import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { el, enUS } from "date-fns/locale";
import { Send, Edit2, Check, X, CalendarClock } from "lucide-react";

interface WellnessJournalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface JournalEntry {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const WellnessJournal = ({ open, onOpenChange, userId }: WellnessJournalProps) => {
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const queryClient = useQueryClient();
  const [newContent, setNewContent] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newTime, setNewTime] = useState(format(new Date(), "HH:mm"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["wellness-journal", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_journal" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as JournalEntry[];
    },
    enabled: !!userId && open,
  });

  const addMutation = useMutation({
    mutationFn: async ({ content, dateTime }: { content: string; dateTime: string }) => {
      const { error } = await supabase
        .from("wellness_journal" as any)
        .insert({ user_id: userId, content, created_at: dateTime, updated_at: dateTime } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellness-journal", userId] });
      setNewContent("");
      setNewDate(format(new Date(), "yyyy-MM-dd"));
      setNewTime(format(new Date(), "HH:mm"));
      toast({ title: isGreek ? "Καταχωρήθηκε!" : "Entry saved!" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content, dateTime }: { id: string; content: string; dateTime: string }) => {
      const { error } = await supabase
        .from("wellness_journal" as any)
        .update({ content, created_at: dateTime, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wellness-journal", userId] });
      setEditingId(null);
      toast({ title: isGreek ? "Ενημερώθηκε!" : "Updated!" });
    },
  });

  const handleSubmit = () => {
    if (!newContent.trim()) return;
    const dateTime = new Date(`${newDate}T${newTime}`).toISOString();
    addMutation.mutate({ content: newContent.trim(), dateTime });
  };

  const handleSaveEdit = () => {
    if (!editingId || !editContent.trim()) return;
    const dateTime = new Date(`${editDate}T${editTime}`).toISOString();
    updateMutation.mutate({ id: editingId, content: editContent.trim(), dateTime });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle className="font-serif text-xl">
            {isGreek ? "Πώς Νιώθεις;" : "How Are You Feeling?"}
          </SheetTitle>
          <SheetDescription className="font-sans text-sm text-muted-foreground">
            {isGreek
              ? "Σημείωσε αντιδράσεις, συμπτώματα, ή οτιδήποτε θέλεις να θυμάσαι"
              : "Note down reactions, symptoms, or anything you want to remember"}
          </SheetDescription>
        </SheetHeader>

        {/* New entry input */}
        <div className="px-5 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <CalendarClock className="h-4 w-4 text-primary flex-shrink-0" />
            </div>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-8 text-xs font-sans flex-1"
            />
            <Input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="h-8 text-xs font-sans w-28"
            />
          </div>
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={isGreek ? "Πώς νιώθεις σήμερα; Παρενέργειες, συμπτώματα..." : "How are you feeling today? Side effects, symptoms..."}
            className="min-h-[80px] resize-none font-sans text-sm"
          />
          <Button
            onClick={handleSubmit}
            disabled={!newContent.trim() || addMutation.isPending}
            className="w-full gap-2"
            size="sm"
          >
            <Send className="h-4 w-4" />
            {isGreek ? "Αποθήκευση" : "Save Entry"}
          </Button>
        </div>

        {/* Timeline */}
        <ScrollArea className="flex-1 px-5 pb-5">
          <div className="space-y-3">
            {isLoading && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {isGreek ? "Φόρτωση..." : "Loading..."}
              </p>
            )}
            {!isLoading && entries.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {isGreek ? "Δεν υπάρχουν καταχωρήσεις ακόμα" : "No entries yet"}
              </p>
            )}
            {entries.map((entry) => {
              const date = new Date(entry.created_at);
              const isEditing = editingId === entry.id;
              return (
                <Card key={entry.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-sans font-medium text-muted-foreground">
                        {format(date, "d MMM yyyy, HH:mm", { locale: isGreek ? el : enUS })}
                      </p>
                      {!isEditing && (
                        <button
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditContent(entry.content);
                            setEditDate(format(date, "yyyy-MM-dd"));
                            setEditTime(format(date, "HH:mm"));
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                        <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                            <CalendarClock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          </div>
                          <Input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="h-7 text-xs font-sans flex-1"
                          />
                          <Input
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            className="h-7 text-xs font-sans w-28"
                          />
                        </div>
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[60px] resize-none font-sans text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="gap-1">
                            <X className="h-3 w-3" /> {isGreek ? "Ακύρωση" : "Cancel"}
                          </Button>
                          <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} className="gap-1">
                            <Check className="h-3 w-3" /> {isGreek ? "Αποθήκευση" : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed">
                        {entry.content}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default WellnessJournal;
