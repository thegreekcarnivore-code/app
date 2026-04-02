import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, UtensilsCrossed, Sparkles, Send, Loader2, ClipboardCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ClientCompliance {
  userId: string;
  displayName: string;
  email: string;
  weeklyDay: number;
  hasMeasurements: boolean;
  hasPhotos: boolean;
  foodDaysLogged: number;
  enrollmentStartDate: string;
  lastLoginAt: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
    ok ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
  }`}>
    {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    {label}
  </span>
);

const ClientAccountabilityPanel = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientCompliance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientCompliance | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<string>("");
  const [messageTarget, setMessageTarget] = useState<ClientCompliance | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCompliance();
      setSelectedClient(null);
      setMessageTarget(null);
      setGeneratedMessage("");
    }
  }, [open]);

  const fetchCompliance = async () => {
    setLoading(true);
    try {
      const { data: enrollments } = await supabase
        .from("client_program_enrollments")
        .select("user_id, weekly_day, start_date")
        .eq("status", "active");

      if (!enrollments || enrollments.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const userIds = enrollments.map(e => e.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email, last_login_at")
        .in("id", userIds) as any;

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekStartStr = weekStart.toISOString().split("T")[0];

      const { data: measurements } = await supabase
        .from("measurements")
        .select("user_id, measured_at")
        .in("user_id", userIds)
        .gte("measured_at", weekStartStr);

      const measuredUsers = new Set((measurements || []).map(m => m.user_id));

      const { data: photos } = await supabase
        .from("progress_photos")
        .select("user_id, taken_at")
        .in("user_id", userIds)
        .gte("taken_at", weekStartStr);

      const photoUsers = new Set((photos || []).map(p => p.user_id));

      const { data: foodEntries } = await supabase
        .from("food_journal")
        .select("user_id, entry_date")
        .in("user_id", userIds)
        .gte("entry_date", weekStartStr);

      const foodDaysMap = new Map<string, Set<string>>();
      (foodEntries || []).forEach(f => {
        if (!foodDaysMap.has(f.user_id)) foodDaysMap.set(f.user_id, new Set());
        foodDaysMap.get(f.user_id)!.add(f.entry_date);
      });

      const result: ClientCompliance[] = enrollments.map(e => {
        const profile = profileMap.get(e.user_id) as any;
        return {
          userId: e.user_id,
          displayName: profile?.display_name || "",
          email: profile?.email || "",
          weeklyDay: e.weekly_day,
          hasMeasurements: measuredUsers.has(e.user_id),
          hasPhotos: photoUsers.has(e.user_id),
          foodDaysLogged: foodDaysMap.get(e.user_id)?.size || 0,
          enrollmentStartDate: e.start_date,
          lastLoginAt: profile?.last_login_at || null,
        };
      });

      setClients(result);
    } catch (err) {
      console.error("Error fetching compliance:", err);
    }
    setLoading(false);
  };

  const handleGenerate = async (client: ClientCompliance) => {
    setGeneratingFor(client.userId);
    setMessageTarget(client);
    try {
      const missing: string[] = [];
      if (!client.hasMeasurements) missing.push("weekly measurements");
      if (!client.hasPhotos) missing.push("weekly progress photos");
      if (client.foodDaysLogged < 5) missing.push(`food journal (only ${client.foodDaysLogged}/7 days)`);

      const { data, error } = await supabase.functions.invoke("generate-motivation", {
        body: {
          userId: client.userId,
          missingItems: missing,
          clientName: client.displayName || client.email?.split("@")[0] || "there",
        },
      });
      if (error) throw error;
      setGeneratedMessage(data?.message || "");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setGeneratingFor(null);
  };

  const handleSend = async () => {
    if (!messageTarget || !user || !generatedMessage.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: messageTarget.userId,
        content: generatedMessage.trim(),
        is_automated: true,
      } as any);
      if (error) throw error;

      // Also send email notification
      supabase.functions.invoke("send-message-email", {
        body: {
          receiver_id: messageTarget.userId,
          sender_id: user.id,
          is_automated: true,
        },
      }).catch((emailErr) => {
        console.error("Email notification failed:", emailErr);
      });

      toast({ title: "Message sent + email notification!" });
      setGeneratedMessage("");
      setMessageTarget(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const todayDow = new Date().getDay();

  const grouped = clients.reduce<Record<number, ClientCompliance[]>>((acc, c) => {
    (acc[c.weeklyDay] ??= []).push(c);
    return acc;
  }, {});

  Object.values(grouped).forEach(group =>
    group.sort((a, b) => {
      const aTime = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
      const bTime = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      return aTime - bTime;
    })
  );

  const complianceScore = (c: ClientCompliance) => {
    let s = 0;
    if (c.hasMeasurements) s++;
    if (c.hasPhotos) s++;
    if (c.foodDaysLogged >= 5) s++;
    return s;
  };

  const ringColor = (score: number) => {
    if (score === 3) return "ring-emerald-500";
    if (score === 2) return "ring-amber-500";
    return "ring-destructive";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-base flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-gold" />
            Client Accountability Tracker
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : clients.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No active enrolled clients.</p>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Horizontal calendar strip */}
            <ScrollArea className="w-full">
              <div className="grid grid-cols-7 gap-1.5 min-w-[560px]">
                {DAY_ORDER.map(dayIdx => {
                  const isToday = dayIdx === todayDow;
                  const dayClients = grouped[dayIdx] || [];

                  return (
                    <div
                      key={dayIdx}
                      className={`rounded-xl border p-2 min-h-[100px] transition-colors ${
                        isToday ? "border-gold/40 bg-gold/5" : "border-border bg-card/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[11px] font-semibold font-serif ${
                          isToday ? "text-gold" : "text-muted-foreground"
                        }`}>
                          {DAY_SHORT[dayIdx]}
                        </span>
                        {dayClients.length > 0 && (
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                            {dayClients.length}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-1.5">
                        {dayClients.length === 0 ? (
                          <span className="text-[9px] text-muted-foreground/50 mt-4">—</span>
                        ) : (
                          dayClients.map(client => {
                            const name = client.displayName || client.email?.split("@")[0] || "Client";
                            const initial = name.charAt(0).toUpperCase();
                            const score = complianceScore(client);
                            const isSelected = selectedClient?.userId === client.userId;

                            return (
                              <Tooltip key={client.userId}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setSelectedClient(isSelected ? null : client)}
                                    className="flex flex-col items-center gap-0.5 group transition-transform hover:scale-105"
                                  >
                                    <Avatar className={`h-8 w-8 ring-2 ring-offset-1 ring-offset-background transition-all ${
                                      ringColor(score)
                                    } ${isSelected ? "scale-110 shadow-md" : ""}`}>
                                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-serif">
                                        {initial}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className={`text-[9px] leading-tight text-center max-w-[60px] truncate ${
                                      isSelected ? "text-primary font-medium" : "text-muted-foreground"
                                    }`}>
                                      {name.split(" ")[0]}
                                    </span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                  <p className="font-medium">{name}</p>
                                  <p className="text-muted-foreground">
                                    {client.hasMeasurements ? "✓" : "✗"} Measurements ·{" "}
                                    {client.hasPhotos ? "✓" : "✗"} Photos ·{" "}
                                    Food {client.foodDaysLogged}/7
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Selected client detail card */}
            <AnimatePresence mode="wait">
              {selectedClient && (
                <motion.div
                  key={selectedClient.userId}
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-border bg-card p-4 space-y-3 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-serif">
                          {(selectedClient.displayName || selectedClient.email?.split("@")[0] || "C").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <button
                          onClick={() => { onOpenChange(false); navigate(`/admin/client/${selectedClient.userId}`); }}
                          className="font-sans text-sm font-medium text-foreground hover:text-primary hover:underline cursor-pointer transition-colors text-left"
                        >
                          {selectedClient.displayName || selectedClient.email?.split("@")[0] || "Client"}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{selectedClient.email}</span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {selectedClient.lastLoginAt
                              ? new Date(selectedClient.lastLoginAt).toLocaleDateString()
                              : "Never"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerate(selectedClient)}
                      disabled={generatingFor === selectedClient.userId}
                      className="gap-1 text-xs border-gold/30 text-gold hover:bg-gold/10"
                    >
                      {generatingFor === selectedClient.userId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Generate
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge ok={selectedClient.hasMeasurements} label={selectedClient.hasMeasurements ? "Measurements ✓" : "Measurements missing"} />
                    <StatusBadge ok={selectedClient.hasPhotos} label={selectedClient.hasPhotos ? "Photos ✓" : "Photos missing"} />
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      selectedClient.foodDaysLogged >= 5
                        ? "bg-emerald-500/10 text-emerald-600"
                        : selectedClient.foodDaysLogged >= 3
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      <UtensilsCrossed className="h-3 w-3" />
                      Food: {selectedClient.foodDaysLogged}/7 days
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generated message editor */}
            <AnimatePresence>
              {messageTarget && generatedMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="rounded-xl border border-gold/20 bg-gold/5 p-4 space-y-3"
                >
                  <p className="font-sans text-xs font-medium text-foreground">
                    Message for {messageTarget.displayName || messageTarget.email}
                  </p>
                  <Textarea
                    value={generatedMessage}
                    onChange={(e) => setGeneratedMessage(e.target.value)}
                    rows={5}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setGeneratedMessage(""); setMessageTarget(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSend}
                      disabled={sending || !generatedMessage.trim()}
                      className="gap-1 bg-gold text-gold-foreground hover:bg-gold/90"
                    >
                      {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Send Message
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClientAccountabilityPanel;