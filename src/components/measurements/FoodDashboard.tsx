import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { format, isToday, isYesterday } from "date-fns";
import { Plus, Trash2, Edit2, Clock, ChevronDown, ChevronRight, Coffee, Sun, Moon, Cookie, Wine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import FoodEntryForm from "./FoodEntryForm";
import { getSignedUrl } from "@/lib/storage";

interface FoodDashboardProps {
  userId?: string;
}

const FoodDashboard = ({ userId }: FoodDashboardProps) => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;

  // Fetch user's feature_access to check food_photo_ai
  const { data: featureAccess } = useQuery({
    queryKey: ["feature_access", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;
      // Check enrollment override first, then profile
      const { data: enrollment } = await supabase
        .from("client_program_enrollments")
        .select("feature_access_override")
        .eq("user_id", targetUserId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (enrollment?.feature_access_override) {
        return enrollment.feature_access_override as Record<string, boolean>;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("feature_access")
        .eq("id", targetUserId)
        .maybeSingle();
      return (profile?.feature_access as Record<string, boolean>) || null;
    },
    enabled: !!targetUserId,
  });

  const foodPhotoAiEnabled = !!(featureAccess as any)?.food_photo_ai;

  const [formOpen, setFormOpen] = useState(false);
  const [formMealType, setFormMealType] = useState("breakfast");
  const [editEntry, setEditEntry] = useState<any>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  // Fetch ALL entries for this user, grouped by date
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["food_journal_all", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const { data, error } = await supabase
        .from("food_journal")
        .select("*")
        .eq("user_id", targetUserId)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("food_journal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food_journal_all", targetUserId] });
      toast({ title: lang === "en" ? "Entry deleted" : "Η εγγραφή διαγράφηκε" });
    },
  });

  // Group entries by date
  const grouped = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
    const date = entry.entry_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Generate signed URLs for food photos
  useEffect(() => {
    const photosToSign = entries.filter(e => e.photo_url && !signedUrls[e.id]);
    if (photosToSign.length === 0) return;
    
    Promise.all(
      photosToSign.map(async (entry) => {
        const url = await getSignedUrl("food-photos", entry.photo_url!);
        return { id: entry.id, url };
      })
    ).then(results => {
      setSignedUrls(prev => {
        const next = { ...prev };
        for (const { id, url } of results) {
          if (url) next[id] = url;
        }
        return next;
      });
    });
  }, [entries]);

  // Auto-expand today
  const isDayExpanded = (dateStr: string) => {
    if (expandedDays[dateStr] !== undefined) return expandedDays[dateStr];
    return isToday(new Date(dateStr + "T00:00:00"));
  };

  const toggleDay = (dateStr: string) => {
    setExpandedDays(prev => ({ ...prev, [dateStr]: !isDayExpanded(dateStr) }));
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    if (isToday(date)) return { main: format(date, "MMM d"), sub: lang === "en" ? "TODAY" : "ΣΗΜΕΡΑ" };
    if (isYesterday(date)) return { main: format(date, "MMM d"), sub: lang === "en" ? "YESTERDAY" : "ΧΘΕΣ" };
    return { main: format(date, "MMM d"), sub: null };
  };

  const mealLabel = (type: string) => {
    const map: Record<string, { en: string; el: string; icon: typeof Coffee }> = {
      breakfast: { en: "Breakfast", el: "Πρωινό", icon: Coffee },
      lunch: { en: "Lunch", el: "Μεσημεριανό", icon: Sun },
      dinner: { en: "Dinner", el: "Βραδινό", icon: Moon },
      snack: { en: "Snack", el: "Σνακ", icon: Cookie },
      drinks: { en: "Drinks", el: "Ποτά", icon: Wine },
    };
    return map[type] || { en: type, el: type, icon: Coffee };
  };

  const openAddForm = () => {
    setEditEntry(null);
    setFormMealType("breakfast");
    setFormOpen(true);
  };

  return (
    <div className="relative space-y-0 pb-20">
      {/* Add Entry Button */}
      <button
        data-guide="add-food-entry"
        onClick={openAddForm}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-sans text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 mb-5"
      >
        <Plus className="h-5 w-5" />
        {lang === "en" ? "Add Entry" : "Νέα Καταχώρηση"}
      </button>

      {isLoading && (
        <p className="text-center text-base font-sans text-muted-foreground py-8">
          {lang === "en" ? "Loading..." : "Φόρτωση..."}
        </p>
      )}

      {!isLoading && sortedDates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg font-sans text-muted-foreground">
            {lang === "en" ? "No entries yet" : "Δεν υπάρχουν καταχωρήσεις"}
          </p>
          <p className="text-base font-sans text-muted-foreground mt-1">
            {lang === "en" ? "Tap the button above to add your first meal" : "Πατήστε το κουμπί παραπάνω για την πρώτη καταχώρηση"}
          </p>
        </div>
      )}

      {/* Timeline */}
      {sortedDates.map((dateStr, dateIdx) => {
        const { main, sub } = formatDateLabel(dateStr);
        const dayEntries = grouped[dateStr];
        const isCurrentDay = isToday(new Date(dateStr + "T00:00:00"));
        const expanded = isDayExpanded(dateStr);

        return (
          <div key={dateStr} className="flex gap-3">
            {/* Timeline column */}
            <div className="flex flex-col items-center w-14 shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${isCurrentDay ? "bg-primary" : "bg-muted-foreground/40"}`} />
              {dateIdx < sortedDates.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1" />
              )}
            </div>

            {/* Date label + entries */}
            <div className="flex-1 pb-5 min-w-0">
              <button
                onClick={() => toggleDay(dateStr)}
                className="flex items-center gap-2 mb-2 w-full text-left group"
              >
                <div className="flex-1">
                  <p className="text-base font-serif font-semibold text-foreground leading-tight">{main}</p>
                  {sub && <p className="text-xs font-sans font-medium text-primary">{sub}</p>}
                </div>
                <span className="text-xs font-sans text-muted-foreground mr-1">
                  {dayEntries.length} {dayEntries.length === 1 ? (lang === "en" ? "entry" : "εγγραφή") : (lang === "en" ? "entries" : "εγγραφές")}
                </span>
                {expanded
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
                }
              </button>

              {expanded && (
                <div className="space-y-1.5">
                  {dayEntries.map((entry) => (
                    <Card key={entry.id} className="border border-border">
                      <CardContent className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {entry.photo_url && signedUrls[entry.id] && (
                            <button
                              onClick={() => setLightboxUrl(signedUrls[entry.id])}
                              className="shrink-0 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <img
                                src={signedUrls[entry.id]}
                                alt=""
                                className="h-10 w-10 rounded-md object-cover"
                              />
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-sans text-foreground leading-snug line-clamp-1">{entry.description}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {(() => {
                                const ml = mealLabel(entry.meal_type);
                                const MealIcon = ml.icon;
                                return (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-sans font-medium">
                                    <MealIcon className="h-2.5 w-2.5" />
                                    {lang === "en" ? ml.en : ml.el}
                                  </Badge>
                                );
                              })()}
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-sans text-muted-foreground">
                                {format(new Date(entry.created_at), "h:mm a")}
                              </span>
                              {entry.notes && (
                                <span className="text-xs font-sans text-muted-foreground truncate ml-1">· {entry.notes}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => { setEditEntry(entry); setFormMealType(entry.meal_type); setFormOpen(true); }}
                              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(entry.id)}
                              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <FoodEntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editEntry={editEntry}
        mealType={formMealType}
        userId={targetUserId || ""}
        date={format(new Date(), "yyyy-MM-dd")}
        foodPhotoAiEnabled={foodPhotoAiEnabled}
      />

      {/* Photo Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-background/95 backdrop-blur-sm border-border">
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt=""
              className="w-full h-full max-h-[80vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FoodDashboard;
