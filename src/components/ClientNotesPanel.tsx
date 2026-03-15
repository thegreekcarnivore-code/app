import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, Pencil, X, AlertTriangle, Heart, Target, MessageSquare, Tag, Check, Save, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ClientNotesPanelProps {
  userId: string;
}

type NoteCategory = "allergy" | "preference" | "goal" | "meeting_note" | "restriction" | "general";

interface ClientNote {
  id: string;
  user_id: string;
  created_by: string;
  category: NoteCategory;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const SECTION_NOTES_TITLE = "_section_notes";

const CATEGORY_CONFIG: Record<NoteCategory, { icon: typeof AlertTriangle; label: { en: string; el: string }; color: string }> = {
  allergy: { icon: AlertTriangle, label: { en: "Allergy", el: "Αλλεργία" }, color: "bg-destructive/10 text-destructive border-destructive/20" },
  restriction: { icon: X, label: { en: "Restriction", el: "Περιορισμός" }, color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  preference: { icon: Heart, label: { en: "Preference", el: "Προτίμηση" }, color: "bg-primary/10 text-primary border-primary/20" },
  goal: { icon: Target, label: { en: "Goal", el: "Στόχος" }, color: "bg-green-500/10 text-green-700 border-green-500/20" },
  meeting_note: { icon: MessageSquare, label: { en: "Meeting Note", el: "Σημείωση Συνάντησης" }, color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  general: { icon: Tag, label: { en: "General", el: "Γενικά" }, color: "bg-muted text-muted-foreground border-border" },
};

const QUICK_ALLERGIES = ["Gluten", "Dairy", "Nuts", "Shellfish", "Soy", "Eggs", "Fish", "Peanuts"];
const QUICK_PREFERENCES = ["Japanese", "Italian", "French", "Greek", "Mediterranean", "Steakhouse", "Seafood", "Mexican"];
const QUICK_GOALS = ["Weight Loss", "Muscle Gain", "Energy", "Recovery", "Fat Loss", "Strength"];

const ClientNotesPanel = ({ userId }: ClientNotesPanelProps) => {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [editingNote, setEditingNote] = useState<ClientNote | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formCategory, setFormCategory] = useState<NoteCategory>("general");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  // Section notes state
  const [allergyNotes, setAllergyNotes] = useState("");
  const [prefNotes, setPrefNotes] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [allergyNotesId, setAllergyNotesId] = useState<string | null>(null);
  const [prefNotesId, setPrefNotesId] = useState<string | null>(null);
  const [goalNotesId, setGoalNotesId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["client-notes", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClientNote[];
    },
  });

  // Populate section notes from fetched data
  useEffect(() => {
    const findSection = (cat: string) => notes.find(n => n.title === SECTION_NOTES_TITLE && n.category === cat);
    const an = findSection("allergy");
    const pn = findSection("preference");
    const gn = findSection("goal");
    setAllergyNotes(an?.content || "");
    setAllergyNotesId(an?.id || null);
    setPrefNotes(pn?.content || "");
    setPrefNotesId(pn?.id || null);
    setGoalNotes(gn?.content || "");
    setGoalNotesId(gn?.id || null);
  }, [notes]);

  const upsertSectionNote = useCallback(async (category: string, content: string, existingId: string | null) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    if (existingId) {
      await supabase.from("client_notes").update({ content }).eq("id", existingId);
    } else if (content.trim()) {
      await supabase.from("client_notes").insert({
        user_id: userId,
        created_by: userData.user.id,
        category,
        title: SECTION_NOTES_TITLE,
        content,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["client-notes", userId] });
  }, [userId, queryClient]);

  const addNote = useMutation({
    mutationFn: async (note: { category: NoteCategory; title: string; content: string }) => {
      if (note.title.length > 200) throw new Error("Title too long (max 200 chars)");
      if (note.content.length > 5000) throw new Error("Content too long (max 5000 chars)");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("client_notes").insert({
        user_id: userId,
        created_by: userData.user!.id,
        category: note.category,
        title: note.title,
        content: note.content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notes", userId] });
      resetForm();
      toast.success(lang === "en" ? "Note added" : "Η σημείωση προστέθηκε");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateNote = useMutation({
    mutationFn: async (note: { id: string; category: NoteCategory; title: string; content: string }) => {
      if (note.title.length > 200) throw new Error("Title too long (max 200 chars)");
      if (note.content.length > 5000) throw new Error("Content too long (max 5000 chars)");
      const { error } = await supabase.from("client_notes").update({
        category: note.category,
        title: note.title,
        content: note.content,
      }).eq("id", note.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notes", userId] });
      resetForm();
      toast.success(lang === "en" ? "Note updated" : "Η σημείωση ενημερώθηκε");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("client_notes").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-notes", userId] }),
  });

  const resetForm = () => {
    setEditingNote(null);
    setFormCategory("general");
    setFormTitle("");
    setFormContent("");
  };

  const startEdit = (note: ClientNote) => {
    setEditingNote(note);
    setFormCategory(note.category as NoteCategory);
    setFormTitle(note.title);
    setFormContent(note.content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = () => {
    if (!formTitle.trim()) return;
    if (editingNote) {
      updateNote.mutate({ id: editingNote.id, category: formCategory, title: formTitle.trim(), content: formContent.trim() });
    } else {
      addNote.mutate({ category: formCategory, title: formTitle.trim(), content: formContent.trim() });
    }
  };

  const toggleQuickTag = (category: NoteCategory, title: string) => {
    const existing = notes.find(n => n.category === category && n.title.toLowerCase() === title.toLowerCase() && n.is_active);
    if (existing) {
      toggleActive.mutate({ id: existing.id, is_active: false });
    } else {
      // Check if there's an archived one to reactivate
      const archived = notes.find(n => n.category === category && n.title.toLowerCase() === title.toLowerCase() && !n.is_active);
      if (archived) {
        toggleActive.mutate({ id: archived.id, is_active: true });
      } else {
        addNote.mutate({ category, title, content: "" });
      }
    }
  };

  // Filter out section notes from display lists
  const displayNotes = notes.filter(n => n.title !== SECTION_NOTES_TITLE);
  const activeNotes = displayNotes.filter(n => n.is_active);
  const archivedNotes = displayNotes.filter(n => !n.is_active);

  const allActiveNotes = notes.filter(n => n.is_active && n.title !== SECTION_NOTES_TITLE);
  const existingAllergies = new Set(allActiveNotes.filter(n => n.category === "allergy").map(n => n.title.toLowerCase()));
  const existingPrefs = new Set(allActiveNotes.filter(n => n.category === "preference").map(n => n.title.toLowerCase()));
  const existingGoals = new Set(allActiveNotes.filter(n => n.category === "goal").map(n => n.title.toLowerCase()));

  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">{lang === "en" ? "Loading..." : "Φόρτωση..."}</div>;

  return (
    <div className="space-y-6">
      {/* Always-visible Add/Edit Note Form */}
      <Card className="p-4 space-y-3 border-border/50 bg-card/50">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {editingNote ? (lang === "en" ? "Edit Note" : "Επεξεργασια Σημειωσης") : (lang === "en" ? "New Note" : "Νεα Σημειωση")}
          </h3>
          {editingNote && (
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Select value={formCategory} onValueChange={(v) => setFormCategory(v as NoteCategory)}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  {lang === "en" ? cfg.label.en : cfg.label.el}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 flex-1">
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={lang === "en" ? "Title..." : "Τίτλος..."}
              maxLength={200}
              className="flex-1 h-9 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!formContent.trim() || isGeneratingTitle}
              onClick={async () => {
                setIsGeneratingTitle(true);
                try {
                  const { data, error } = await supabase.functions.invoke("generate-note-title", {
                    body: { content: formContent.trim(), category: formCategory },
                  });
                  if (error) throw error;
                  if (data?.title) setFormTitle(data.title);
                } catch (e: any) {
                  toast.error(lang === "en" ? "Failed to generate title" : "Αποτυχία δημιουργίας τίτλου");
                } finally {
                  setIsGeneratingTitle(false);
                }
              }}
              title={lang === "en" ? "Auto-generate title from content" : "Αυτόματη δημιουργία τίτλου"}
            >
              {isGeneratingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Textarea
          value={formContent}
          onChange={(e) => setFormContent(e.target.value)}
          placeholder={lang === "en" ? "Details, meeting notes, context..." : "Λεπτομέρειες, σημειώσεις..."}
          maxLength={5000}
          rows={2}
          className="text-sm resize-none"
        />

        <div className="flex justify-end gap-2">
          {editingNote && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              {lang === "en" ? "Cancel" : "Ακύρωση"}
            </Button>
          )}
          <Button size="sm" onClick={handleSubmit} disabled={!formTitle.trim() || addNote.isPending || updateNote.isPending}>
            {editingNote ? (lang === "en" ? "Update" : "Ενημέρωση") : (lang === "en" ? "Add" : "Προσθήκη")}
          </Button>
        </div>
      </Card>

      {/* Allergies Section */}
      <div>
        <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {lang === "en" ? "Allergies" : "Αλλεργιες"}
        </h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_ALLERGIES.map(a => (
            <button
              key={a}
              onClick={() => toggleQuickTag("allergy", a)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-sans font-medium border transition-all",
                existingAllergies.has(a.toLowerCase())
                   ? "bg-destructive/10 text-destructive border-destructive/30 cursor-pointer"
                  : "bg-card text-muted-foreground border-border hover:border-destructive/50 hover:text-destructive"
              )}
            >
              {existingAllergies.has(a.toLowerCase()) && <Check className="inline h-3 w-3 mr-1" />}
              {a}
            </button>
          ))}
        </div>
        <Textarea
          value={allergyNotes}
          onChange={(e) => setAllergyNotes(e.target.value)}
          onBlur={() => upsertSectionNote("allergy", allergyNotes, allergyNotesId)}
          placeholder={lang === "en" ? "Additional allergy notes..." : "Επιπλέον σημειώσεις αλλεργιών..."}
          rows={2}
          className="mt-2 text-xs resize-none"
        />
      </div>

      {/* Cuisine Preferences Section */}
      <div>
        <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {lang === "en" ? "Cuisine Preferences" : "Προτιμησεις Κουζινας"}
        </h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_PREFERENCES.map(p => (
            <button
              key={p}
              onClick={() => toggleQuickTag("preference", p)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-sans font-medium border transition-all",
                existingPrefs.has(p.toLowerCase())
                   ? "bg-primary/10 text-primary border-primary/30 cursor-pointer"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
              )}
            >
              {existingPrefs.has(p.toLowerCase()) && <Check className="inline h-3 w-3 mr-1" />}
              {p}
            </button>
          ))}
        </div>
        <Textarea
          value={prefNotes}
          onChange={(e) => setPrefNotes(e.target.value)}
          onBlur={() => upsertSectionNote("preference", prefNotes, prefNotesId)}
          placeholder={lang === "en" ? "Additional preference notes..." : "Επιπλέον σημειώσεις προτιμήσεων..."}
          rows={2}
          className="mt-2 text-xs resize-none"
        />
      </div>

      {/* Goals Section */}
      <div>
        <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {lang === "en" ? "Goals" : "Στοχοι"}
        </h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_GOALS.map(g => (
            <button
              key={g}
              onClick={() => toggleQuickTag("goal", g)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-sans font-medium border transition-all",
                existingGoals.has(g.toLowerCase())
                   ? "bg-green-500/10 text-green-700 border-green-500/30 cursor-pointer"
                  : "bg-card text-muted-foreground border-border hover:border-green-500/50 hover:text-green-700"
              )}
            >
              {existingGoals.has(g.toLowerCase()) && <Check className="inline h-3 w-3 mr-1" />}
              {g}
            </button>
          ))}
        </div>
        <Textarea
          value={goalNotes}
          onChange={(e) => setGoalNotes(e.target.value)}
          onBlur={() => upsertSectionNote("goal", goalNotes, goalNotesId)}
          placeholder={lang === "en" ? "Additional goal notes..." : "Επιπλέον σημειώσεις στόχων..."}
          rows={2}
          className="mt-2 text-xs resize-none"
        />
      </div>

      {/* Active Notes */}
      <div className="space-y-3">
        {activeNotes.map(note => {
          const cfg = CATEGORY_CONFIG[note.category as NoteCategory] || CATEGORY_CONFIG.general;
          const Icon = cfg.icon;
          return (
            <Card key={note.id} className="p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1", cfg.color)}>
                      <Icon className="h-3 w-3" />
                      {lang === "en" ? cfg.label.en : cfg.label.el}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-sans">
                      {format(new Date(note.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                  <p className="font-sans text-sm font-medium text-foreground">{note.title}</p>
                  {note.content && (
                    <p className="font-sans text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{note.content}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(note)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => toggleActive.mutate({ id: note.id, is_active: false })} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Archived Notes Toggle */}
      {archivedNotes.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
          >
            {showArchived
              ? (lang === "en" ? "Hide archived" : "Απόκρυψη αρχειοθετημένων")
              : (lang === "en" ? `Show ${archivedNotes.length} archived` : `Εμφάνιση ${archivedNotes.length} αρχειοθετημένων`)}
          </button>
          {showArchived && (
            <div className="space-y-3 mt-3 opacity-60">
              {archivedNotes.map(note => {
                const cfg = CATEGORY_CONFIG[note.category as NoteCategory] || CATEGORY_CONFIG.general;
                const Icon = cfg.icon;
                return (
                  <Card key={note.id} className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1", cfg.color)}>
                            <Icon className="h-3 w-3" />
                            {lang === "en" ? cfg.label.en : cfg.label.el}
                          </Badge>
                        </div>
                        <p className="font-sans text-sm font-medium text-foreground line-through">{note.title}</p>
                      </div>
                      <button
                        onClick={() => toggleActive.mutate({ id: note.id, is_active: true })}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-sans"
                      >
                        {lang === "en" ? "Restore" : "Επαναφορά"}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeNotes.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-6 font-sans">
          {lang === "en" ? "No notes yet. Add allergies, preferences, or meeting notes." : "Δεν υπάρχουν σημειώσεις. Προσθέστε αλλεργίες, προτιμήσεις ή σημειώσεις συναντήσεων."}
        </p>
      )}
    </div>
  );
};

export default ClientNotesPanel;
