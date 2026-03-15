import { useState, useEffect } from "react";
import { X, ChevronLeft, Sparkles } from "lucide-react";
import MessageCheckmarks from "@/components/chat/MessageCheckmarks";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import ChatPanel from "./ChatPanel";
import AiChatHistory from "./AiChatHistory";
import logo from "@/assets/logo.png";

interface ClientEntry {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface LastMessage {
  content: string;
  created_at: string;
  sender_id: string;
  read_at: string | null;
}

interface ChatBubbleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialClientId?: string | null;
}

const ChatBubble = ({ open, onOpenChange, initialClientId }: ChatBubbleProps) => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [adminUnreadMap, setAdminUnreadMap] = useState<Map<string, number>>(new Map());
  const [lastMessageMap, setLastMessageMap] = useState<Map<string, LastMessage>>(new Map());
  // Admin tab state: "chat" | "ai-history"
  const [adminTab, setAdminTab] = useState<"chat" | "ai-history">("chat");

  // --- Client: fetch admin ID ---
  useEffect(() => {
    if (isAdmin || !user) return;
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setAdminId(data[0].user_id);
      });
  }, [user, isAdmin]);

  // --- Client: fetch unread count ---
  useEffect(() => {
    if (!user || !adminId || isAdmin) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("sender_id", adminId)
        .eq("receiver_id", user.id)
        .is("read_at", null);
      setUnreadCount(count ?? 0);
    };
    fetchUnread();
    const channel = supabase
      .channel("chat-bubble-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, adminId, isAdmin]);

  // --- Admin: fetch clients ---
  useEffect(() => {
    if (!isAdmin || !user) return;
    supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setClients(data as ClientEntry[]);
      });
  }, [isAdmin, user]);

  // --- Admin: fetch unread counts + last messages ---
  useEffect(() => {
    if (!isAdmin || !user) return;
    const fetchAdminData = async () => {
      const { data: unreadData } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", user.id)
        .is("read_at", null);
      if (unreadData) {
        const map = new Map<string, number>();
        let total = 0;
        for (const row of unreadData) {
          map.set(row.sender_id, (map.get(row.sender_id) || 0) + 1);
          total++;
        }
        setAdminUnreadMap(map);
        setUnreadCount(total);
      }
      const { data: msgData } = await supabase
        .from("messages")
        .select("sender_id, receiver_id, content, created_at, read_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (msgData) {
        const map = new Map<string, LastMessage>();
        for (const msg of msgData as any[]) {
          const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          if (!map.has(otherId)) {
            map.set(otherId, { content: msg.content, created_at: msg.created_at, sender_id: msg.sender_id, read_at: msg.read_at });
          }
        }
        setLastMessageMap(map);
      }
    };
    fetchAdminData();
    const channel = supabase
      .channel("admin-bubble-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchAdminData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, user]);

  const setOpen = onOpenChange;

  // Auto-select client when initialClientId changes
  useEffect(() => {
    if (initialClientId && open && isAdmin) {
      setSelectedClientId(initialClientId);
      setAdminTab("chat");
    }
  }, [initialClientId, open, isAdmin]);

  useEffect(() => {
    if (open && !isAdmin) setUnreadCount(0);
  }, [open, isAdmin]);

  if (!user) return null;
  if (!isAdmin && !adminId) return null;

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const sortedClients = [...clients].sort((a, b) => {
    const msgA = lastMessageMap.get(a.id);
    const msgB = lastMessageMap.get(b.id);
    const unreadA = adminUnreadMap.get(a.id) || 0;
    const unreadB = adminUnreadMap.get(b.id) || 0;
    if (unreadA > 0 && unreadB === 0) return -1;
    if (unreadB > 0 && unreadA === 0) return 1;
    if (msgA && msgB) return new Date(msgB.created_at).getTime() - new Date(msgA.created_at).getTime();
    if (msgA) return -1;
    if (msgB) return 1;
    return 0;
  });

  const getInitial = (name: string | null, email: string | null) =>
    (name?.charAt(0) || email?.charAt(0) || "?").toUpperCase();

  const formatLastTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    setAdminTab("chat");
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); }} />
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-14 right-4 left-4 sm:left-auto sm:w-[360px] z-50 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: "min(70vh, 500px)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                {isAdmin && selectedClientId && (
                  <button
                    onClick={() => { setSelectedClientId(null); setAdminTab("chat"); }}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                {/* Header avatar */}
                {isAdmin && selectedClient ? (
                  <Avatar className="h-8 w-8">
                    {selectedClient.avatar_url && <AvatarImage src={selectedClient.avatar_url} alt="" />}
                    <AvatarFallback className="text-xs font-serif bg-primary/10 text-primary">
                      {getInitial(selectedClient.display_name, selectedClient.email)}
                    </AvatarFallback>
                  </Avatar>
                ) : !isAdmin ? (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={logo} alt="The Greek Carnivore" />
                    <AvatarFallback className="text-xs font-serif bg-primary/10 text-primary">A</AvatarFallback>
                  </Avatar>
                ) : null}
                <div>
                  <p className="font-serif text-sm font-semibold text-foreground">
                    {isAdmin
                      ? selectedClient
                        ? selectedClient.display_name || selectedClient.email || (lang === "el" ? "Πελάτης" : "Client")
                        : (lang === "el" ? "Μηνύματα" : "Messages")
                      : "Alexandros"}
                  </p>
                  {!isAdmin && (
                    <p className="font-sans text-[10px] text-muted-foreground">The Greek Carnivore</p>
                  )}
                  {isAdmin && selectedClient && (
                    <p className="font-sans text-[10px] text-muted-foreground">{selectedClient.email}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setOpen(false); setSelectedClientId(null); }}
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Admin tabs when client selected */}
            {isAdmin && selectedClientId && (
              <div className="flex border-b border-border bg-card">
                <button
                  onClick={() => setAdminTab("chat")}
                  className={cn(
                    "flex-1 py-2 font-sans text-xs font-medium transition-colors",
                    adminTab === "chat"
                      ? "text-foreground border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Chat
                </button>
                <button
                  onClick={() => setAdminTab("ai-history")}
                  className={cn(
                    "flex-1 py-2 font-sans text-xs font-medium transition-colors flex items-center justify-center gap-1",
                    adminTab === "ai-history"
                      ? "text-foreground border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {lang === "el" ? "Ιστορικό Βοηθού" : "Assistant History"}
                </button>
              </div>
            )}

            {/* Content */}
            {isAdmin && !selectedClientId ? (
              <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: "400px" }}>
                {clients.length === 0 ? (
                  <p className="text-center font-sans text-xs text-muted-foreground py-8">{lang === "el" ? "Δεν υπάρχουν πελάτες ακόμα." : "No clients yet."}</p>
                ) : (
                  <div>
                    {sortedClients.map((c) => {
                      const unread = adminUnreadMap.get(c.id) || 0;
                      const lastMsg = lastMessageMap.get(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleSelectClient(c.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 text-left"
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            {c.avatar_url && <AvatarImage src={c.avatar_url} alt="" />}
                            <AvatarFallback className="text-sm font-serif bg-primary/10 text-primary">
                              {getInitial(c.display_name, c.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`font-sans text-sm truncate ${unread > 0 ? "font-semibold text-foreground" : "text-foreground"}`}>
                                {c.display_name || c.email || "Unknown"}
                              </p>
                              {lastMsg && (
                                <span className="font-sans text-[10px] text-muted-foreground shrink-0">
                                  {formatLastTime(lastMsg.created_at)}
                                </span>
                              )}
                            </div>
                            {lastMsg ? (
                              <p className={`font-sans text-xs truncate mt-0.5 ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                {lastMsg.sender_id === user!.id && (
                                  <>
                                    <MessageCheckmarks isRead={!!lastMsg.read_at} />
                                    {" "}
                                  </>
                                )}
                                {lastMsg.content}
                              </p>
                            ) : (
                              <p className="font-sans text-xs text-muted-foreground/50 mt-0.5">{lang === "el" ? "Δεν υπάρχουν μηνύματα ακόμα" : "No messages yet"}</p>
                            )}
                          </div>
                          {unread > 0 && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                              {unread > 9 ? "9+" : unread}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : isAdmin && adminTab === "ai-history" ? (
              <AiChatHistory userId={selectedClientId!} className="flex-1 min-h-0" />
            ) : (
              <ChatPanel
                otherUserId={isAdmin ? selectedClientId! : adminId!}
                className="flex-1 min-h-0"
                onMinimize={() => { setOpen(false); }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatBubble;
