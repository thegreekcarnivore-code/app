import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { useGuideHighlight } from "@/context/GuideHighlightContext";
import { useChatContext } from "@/context/ChatContext";
import { Send, Loader2, Sparkles, MapPin, X, ChevronLeft, MessageSquare } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import AiChatHistory from "./AiChatHistory";
import AssistantAudioInput from "./chat/AssistantAudioInput";

interface AiLocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface AssistantBubbleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClientEntry {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-help-chat`;

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

const Linkify = ({ children, className }: { children: string; className?: string }) => {
  const parts = children.split(URL_REGEX);
  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all hover:opacity-80">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
};

/** Self-chat with the assistant (used by both admin and clients) */
const AssistantChat = ({ onMinimize }: { onMinimize?: () => void }) => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { showHighlight } = useGuideHighlight();
  const { setPendingGuide, setAssistantOpen, setRequestTour } = useChatContext();
  const [aiMessages, setAiMessages] = useState<AiLocalMessage[]>([]);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [aiHistoryLoaded, setAiHistoryLoaded] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    if (!user || aiHistoryLoaded) return;
    const loadHistory = async () => {
      const { data } = await supabase
        .from("ai_chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data && data.length > 0) {
        setAiMessages(data.map((m: any) => ({
          id: m.id, role: m.role as "user" | "assistant", content: m.content, created_at: m.created_at,
        })));
        scrollToBottom();
      }
      setAiHistoryLoaded(true);
    };
    loadHistory();
  }, [user, aiHistoryLoaded, scrollToBottom]);

  // Persist the latest guide block into ChatContext so it survives chat close/reopen
  useEffect(() => {
    const lastAssistant = [...aiMessages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    const guideRegex = /```guide\s*\n?([\s\S]*?)```/g;
    let match;
    let latestSteps: Array<{ navigate?: string; highlight: string; label: string }> | null = null;
    while ((match = guideRegex.exec(lastAssistant.content)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        const steps = parsed.steps || [parsed];
        if (steps.length > 0) latestSteps = steps;
      } catch {}
    }
    setPendingGuide(latestSteps);
  }, [aiMessages, setPendingGuide]);

  const handleAiSend = async () => {
    if (!newMessage.trim() || !user || aiStreaming) return;
    const content = newMessage.trim();
    setNewMessage("");
    const userMsg: AiLocalMessage = { id: crypto.randomUUID(), role: "user", content, created_at: new Date().toISOString() };
    setAiMessages((prev) => [...prev, userMsg]);
    scrollToBottom();
    setAiStreaming(true);
    const allMsgs = [...aiMessages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    try {
      const resp = await fetch(AI_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMsgs, userId: user.id, sessionId, lang }),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); toast.error(err.error || "Failed to get assistant response"); setAiStreaming(false); return; }
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "", assistantContent = "";
      const assistantId = crypto.randomUUID();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setAiMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) return prev.map((m) => m.id === assistantId ? { ...m, content: assistantContent } : m);
                return [...prev, { id: assistantId, role: "assistant", content: assistantContent, created_at: new Date().toISOString() }];
              });
              scrollToBottom();
            }
          } catch { /* partial */ }
        }
      }
    } catch (e) { console.error("Assistant stream error:", e); toast.error("Failed to connect to assistant"); }
    setAiStreaming(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiSend(); } };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sticky tour button – launches the full onboarding tour */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-card/80">
        <button
          onClick={() => {
            setAssistantOpen(false);
            setRequestTour(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gold/15 border border-gold/30 px-3 py-1.5 text-xs font-sans font-semibold text-foreground transition-colors hover:bg-gold/25"
        >
          <MapPin className="h-3.5 w-3.5 text-gold" />
          {lang === "el" ? "🗺️ Ξενάγηση Εφαρμογής" : "🗺️ App Tour"}
        </button>
        <span className="text-[10px] text-muted-foreground font-sans">
          {lang === "el" ? "ή γράψε την ερώτησή σου παρακάτω" : "or type your question below"}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 px-3 py-3 min-h-0">
        {aiMessages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="h-8 w-8 text-accent-foreground/40 mx-auto mb-2" />
            <p className="font-sans text-xs text-muted-foreground">
              {lang === "el" ? "Ρώτησέ με οτιδήποτε σχετικά με τη χρήση της εφαρμογής! 🤖" : "Ask me anything about how to use the app! 🤖"}
            </p>
          </div>
        )}
        {aiMessages.map((msg) => {
          const guideRegex = /```guide\s*\n?([\s\S]*?)```/g;
          const textWithoutGuide = msg.role === "assistant" ? msg.content.replace(guideRegex, "").replace(/\*\*/g, "").trim() : msg.content;
          const guideBlocks: Array<{ navigate?: string; highlight: string; label: string; steps?: Array<{ navigate?: string; highlight: string; label: string }> }> = [];
          if (msg.role === "assistant") {
            let match;
            const re = /```guide\s*\n?([\s\S]*?)```/g;
            while ((match = re.exec(msg.content)) !== null) { try { guideBlocks.push(JSON.parse(match[1].trim())); } catch {} }
          }
          return (
            <div key={msg.id} className={cn("flex items-end gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center shrink-0 mb-1">
                  <Sparkles className="h-3 w-3 text-accent-foreground" />
                </div>
              )}
              <div className="max-w-[75%] flex flex-col gap-1.5">
                {textWithoutGuide && (
                  <div className={cn("rounded-2xl px-3 py-2 font-sans text-sm", msg.role === "user" ? "bg-gold text-gold-foreground rounded-br-md" : "bg-accent/30 border border-accent/50 text-foreground rounded-bl-md")}>
                    <Linkify>{textWithoutGuide}</Linkify>
                  </div>
                )}
                {guideBlocks.map((guide, gi) => {
                  const allSteps = guide.steps ? guide.steps : [{ navigate: guide.navigate, highlight: guide.highlight, label: guide.label }];
                  return (
                    <button key={gi} onClick={() => { setPendingGuide(null); showHighlight(allSteps); onMinimize?.(); }}
                      className="flex items-center gap-2 rounded-xl bg-gold/15 border border-gold/30 px-3 py-2 text-left transition-colors hover:bg-gold/25">
                      <MapPin className="h-4 w-4 text-gold shrink-0" />
                      <span className="font-sans text-xs font-semibold text-foreground">
                        {lang === "el" ? "Δείξε μου" : "Show Me"}
                        {allSteps.length > 1 && <span className="ml-1 text-muted-foreground font-normal">({allSteps.length} {lang === "el" ? "βήματα" : "steps"})</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {aiStreaming && aiMessages[aiMessages.length - 1]?.role !== "assistant" && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center shrink-0 mb-1"><Sparkles className="h-3 w-3 text-accent-foreground" /></div>
            <div className="rounded-2xl px-3 py-2 bg-accent/30 border border-accent/50 rounded-bl-md"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          </div>
        )}
      </div>
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <input ref={inputRef} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={lang === "el" ? "Ρώτησε για τις λειτουργίες…" : "Ask about app features…"}
            maxLength={2000} className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          <AssistantAudioInput
            hasText={!!newMessage.trim()}
            disabled={aiStreaming}
            lang={lang}
            onTranscript={(text) => {
              setNewMessage(prev => prev ? prev + " " + text : text);
              inputRef.current?.focus();
            }}
          />
          {newMessage.trim() && (
            <button onClick={handleAiSend} disabled={!newMessage.trim() || aiStreaming}
              className="rounded-full bg-gold p-2 text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
              {aiStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const AssistantBubble = ({ open, onOpenChange }: AssistantBubbleProps) => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  // Admin state
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [adminView, setAdminView] = useState<"my-chat" | "client-list" | "client-history">("my-chat");
  const [aiMsgCounts, setAiMsgCounts] = useState<Map<string, number>>(new Map());

  // Admin: fetch clients + AI message counts
  useEffect(() => {
    if (!isAdmin || !user || !open) return;
    supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .neq("id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setClients(data as ClientEntry[]); });

    supabase
      .from("ai_chat_messages")
      .select("user_id")
      .then(({ data }) => {
        if (data) {
          const map = new Map<string, number>();
          for (const row of data as any[]) {
            map.set(row.user_id, (map.get(row.user_id) || 0) + 1);
          }
          setAiMsgCounts(map);
        }
      });
  }, [isAdmin, user, open]);

  if (!user) return null;

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const getInitial = (name: string | null, email: string | null) =>
    (name?.charAt(0) || email?.charAt(0) || "?").toUpperCase();

  const handleClose = () => {
    onOpenChange(false);
    setSelectedClientId(null);
    if (isAdmin) setAdminView("my-chat");
  };

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    setAdminView("client-history");
  };

  const handleBack = () => {
    if (adminView === "client-history") {
      setSelectedClientId(null);
      setAdminView("client-list");
    } else {
      setAdminView("my-chat");
    }
  };

  // Sort clients by AI message count (most active first)
  const sortedClients = [...clients].sort((a, b) => {
    const countA = aiMsgCounts.get(a.id) || 0;
    const countB = aiMsgCounts.get(b.id) || 0;
    return countB - countA;
  });

  // Determine header title
  const getHeaderTitle = () => {
    if (!isAdmin) return lang === "el" ? "Βοηθός Εφαρμογής" : "Assistant";
    if (adminView === "client-history" && selectedClient)
      return selectedClient.display_name || selectedClient.email || (lang === "el" ? "Πελάτης" : "Client");
    if (adminView === "client-list") return lang === "el" ? "Ιστορικό Πελατών" : "Client History";
    return lang === "el" ? "Βοηθός Εφαρμογής" : "Assistant";
  };

  const getHeaderSub = () => {
    if (!isAdmin) return lang === "el" ? "Βοήθεια εφαρμογής" : "App Help";
    if (adminView === "client-history" && selectedClient) return lang === "el" ? "Ιστορικό βοηθού" : "Assistant history";
    if (adminView === "client-list") return lang === "el" ? "Συνομιλίες βοηθού" : "Assistant conversations";
    return lang === "el" ? "Η συνομιλία μου" : "My chat";
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={handleClose} />}
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
                {isAdmin && adminView !== "my-chat" && (
                  <button onClick={handleBack} className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-accent-foreground" />
                </div>
                <div>
                  <p className="font-serif text-sm font-semibold text-foreground">{getHeaderTitle()}</p>
                  <p className="font-sans text-[10px] text-muted-foreground">{getHeaderSub()}</p>
                </div>
              </div>
              <button onClick={handleClose} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Admin tabs: My Chat vs Client History */}
            {isAdmin && adminView !== "client-history" && (
              <div className="flex border-b border-border bg-card">
                <button
                  onClick={() => setAdminView("my-chat")}
                  className={cn("flex-1 py-2 font-sans text-xs font-medium transition-colors flex items-center justify-center gap-1",
                    adminView === "my-chat" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {lang === "el" ? "Η συνομιλία μου" : "My Chat"}
                </button>
                <button
                  onClick={() => setAdminView("client-list")}
                  className={cn("flex-1 py-2 font-sans text-xs font-medium transition-colors flex items-center justify-center gap-1",
                    adminView === "client-list" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="h-3 w-3" />
                  {lang === "el" ? "Πελάτες" : "Clients"}
                </button>
              </div>
            )}

            {/* Content */}
            {isAdmin && adminView === "client-list" ? (
              <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: "400px" }}>
                {clients.length === 0 ? (
                  <p className="text-center font-sans text-xs text-muted-foreground py-8">
                    {lang === "el" ? "Δεν υπάρχουν πελάτες ακόμα." : "No clients yet."}
                  </p>
                ) : (
                  <div>
                    {sortedClients.map((c) => {
                      const msgCount = aiMsgCounts.get(c.id) || 0;
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
                            <p className="font-sans text-sm truncate text-foreground">
                              {c.display_name || c.email || "Unknown"}
                            </p>
                            {c.display_name && c.email && (
                              <p className="font-sans text-[10px] text-muted-foreground truncate">{c.email}</p>
                            )}
                          </div>
                          {msgCount > 0 && (
                            <span className="flex items-center gap-1 shrink-0 text-muted-foreground">
                              <Sparkles className="h-3 w-3" />
                              <span className="font-sans text-[10px]">{msgCount}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : isAdmin && adminView === "client-history" && selectedClientId ? (
              <AiChatHistory userId={selectedClientId} className="flex-1 min-h-0" />
            ) : (
              <AssistantChat onMinimize={handleClose} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AssistantBubble;
