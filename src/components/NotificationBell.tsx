import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Sparkles, Loader2, Send } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { el, enUS } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isGreek = lang === "el";
  const [open, setOpen] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [messageTargetUserId, setMessageTargetUserId] = useState<string | null>(null);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["client-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("client_notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[]) as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Filter out personal messages — those belong in the Message icon only
  const filtered = notifications.filter((n) => n.type !== "new_message");
  const unreadCount = filtered.filter((n) => !n.read_at).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("client_notifications" as any)
        .update({ read_at: new Date().toISOString() } as any)
        .eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notifications", user?.id] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase
        .from("client_notifications" as any)
        .update({ read_at: new Date().toISOString() } as any)
        .eq("user_id", user.id)
        .is("read_at", null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notifications", user?.id] });
    },
  });

  const handleNotificationClick = (n: Notification) => {
    if (!n.read_at) {
      markReadMutation.mutate(n.id);
    }
    if (n.link) {
      setOpen(false);
      // Strip /data suffix to match actual routes
      const cleanLink = n.link.replace(/\/data(\?.*)?$/, "$1") || n.link;
      navigate(cleanLink);
    }
  };

  const extractUserIdFromLink = (link: string | null) => {
    if (!link) return null;
    const match = link.match(/\/admin\/client\/([^/]+)/);
    return match?.[1] || null;
  };

  const handleGenerateMotivation = async (n: Notification) => {
    const clientId = extractUserIdFromLink(n.link);
    if (!clientId) return;
    setGeneratingFor(n.id);
    try {
      const clientName = n.body?.split(" — ")[0] || "Client";
      const daysLate = n.body?.match(/(\d+) days/)?.[1] || "7";
      const { data, error } = await supabase.functions.invoke("generate-motivation", {
        body: {
          userId: clientId,
          missingItems: [`measurements (${daysLate} days overdue)`],
          clientName,
        },
      });
      if (error) throw error;
      setGeneratedMessage(data?.message || "");
      setMessageTargetUserId(clientId);
      setActiveNotificationId(n.id);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setGeneratingFor(null);
  };

  const handleSendMotivation = async () => {
    if (!messageTargetUserId || !user || !generatedMessage.trim()) return;
    setSending(true);
    try {
      // Send as in-app message
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: messageTargetUserId,
        content: generatedMessage.trim(),
        is_automated: true,
      } as any);
      if (error) throw error;

      // Also send as push notification
      await supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: messageTargetUserId,
          title: "Εχεις μηνυμα απο τον coach σου τον Αλεξανδρο",
          body: generatedMessage.trim().substring(0, 100),
          link: "/home",
          tag: "motivation",
        },
      });

      toast({ title: isGreek ? "Μήνυμα εστάλη!" : "Message sent!" });
      clearEditor();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const clearEditor = () => {
    setGeneratedMessage("");
    setMessageTargetUserId(null);
    setActiveNotificationId(null);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "task_reminder": return "📋";
      case "group_post": return "👥";
      case "group_comment": return "💬";
      case "measurement_comment": return "📏";
      case "new_message": return "💌";
      case "client_measurement": return "⚖️";
      case "client_photo": return "📸";
      case "client_late": return "⚠️";
      default: return "🔔";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex items-center justify-center rounded-lg p-1.5 transition-all hover:bg-muted/50 text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-sans font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-serif text-sm font-semibold text-foreground">
            {isGreek ? "Ειδοποιήσεις" : "Notifications"}
          </h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              className="h-7 text-xs gap-1 text-muted-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {isGreek ? "Όλα αναγνωσμένα" : "Mark all read"}
            </Button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-sans text-muted-foreground">
                  {isGreek ? "Δεν υπάρχουν ειδοποιήσεις" : "No notifications yet"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((n) => (
                  <div key={n.id}>
                    <div
                      className={cn(
                        "w-full text-left px-4 py-3 transition-colors hover:bg-muted/50",
                        !n.read_at && "bg-primary/5"
                      )}
                    >
                      <button
                        onClick={() => handleNotificationClick(n)}
                        className="w-full text-left"
                      >
                        <div className="flex gap-3">
                          <span className="text-base shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className={cn(
                              "text-sm font-sans leading-snug",
                              !n.read_at ? "font-semibold text-foreground" : "text-foreground/80"
                            )}>
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="text-xs font-sans text-muted-foreground line-clamp-2">{n.body}</p>
                            )}
                            <p className="text-[10px] font-sans text-muted-foreground">
                              {formatDistanceToNow(new Date(n.created_at), {
                                addSuffix: true,
                                locale: isGreek ? el : enUS,
                              })}
                            </p>
                          </div>
                          {!n.read_at && (
                            <div className="shrink-0 mt-1.5">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                          )}
                        </div>
                      </button>
                      {/* Generate motivation button for late notifications */}
                      {n.type === "client_late" && (
                        <div className="mt-2 pl-8">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleGenerateMotivation(n); }}
                            disabled={generatingFor === n.id}
                            className="gap-1 text-xs border-gold/30 text-gold hover:bg-gold/10 h-7"
                          >
                            {generatingFor === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Generate Motivation
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Inline motivation editor — renders right below the triggering notification */}
                    {activeNotificationId === n.id && generatedMessage && (
                      <div className="p-4 space-y-3 bg-gold/5 border-t border-border">
                        <p className="font-sans text-xs font-medium text-foreground">
                          {isGreek ? "Δημιουργημένο μήνυμα:" : "Generated motivation message:"}
                        </p>
                        <Textarea
                          value={generatedMessage}
                          onChange={(e) => setGeneratedMessage(e.target.value)}
                          rows={4}
                          className="text-sm"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={clearEditor}>
                            {isGreek ? "Ακύρωση" : "Cancel"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSendMotivation}
                            disabled={sending || !generatedMessage.trim()}
                            className="gap-1 bg-gold text-gold-foreground hover:bg-gold/90"
                          >
                            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            {isGreek ? "Αποστολή" : "Send"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
