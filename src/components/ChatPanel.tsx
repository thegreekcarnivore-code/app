import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { Send, Loader2 } from "lucide-react";
import MessageCheckmarks from "@/components/chat/MessageCheckmarks";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import AudioRecorder from "@/components/chat/AudioRecorder";
import AudioMessageBubble from "@/components/chat/AudioMessageBubble";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import logo from "@/assets/logo.png";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  audio_url: string | null;
  transcript: string | null;
  message_type: string;
}

interface ChatPanelProps {
  otherUserId: string;
  otherUserName?: string;
  className?: string;
  onMinimize?: () => void;
}

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

const ChatPanel = ({ otherUserId, otherUserName, className, onMinimize }: ChatPanelProps) => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otherProfile, setOtherProfile] = useState<{ display_name: string | null; avatar_url: string | null; email: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  // Fetch other user's profile
  useEffect(() => {
    supabase
      .from("profiles")
      .select("display_name, avatar_url, email")
      .eq("id", otherUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setOtherProfile(data as any);
      });
  }, [otherUserId]);

  // Fetch messages
  useEffect(() => {
    if (!user) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) {
        setMessages(data as unknown as Message[]);
        scrollToBottom();
      }
      setLoading(false);
    };
    fetchMessages();
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", otherUserId)
      .eq("receiver_id", user.id)
      .is("read_at", null)
      .then();
  }, [user, otherUserId, scrollToBottom]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`messages-${user.id}-${otherUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as unknown as Message;
          if (
            (msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === user.id)
          ) {
            setMessages((prev) => [...prev, msg]);
            scrollToBottom();
            if (msg.sender_id === otherUserId) {
              supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id).then();
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, otherUserId, scrollToBottom]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;
    const content = newMessage.trim();
    if (content.length > 2000) return;
    setSending(true);
    setNewMessage("");
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: otherUserId,
      content,
    } as any);
    if (error) {
      setNewMessage(content);
      console.error("Failed to send message:", error);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-5 w-5 text-gold animate-spin" />
      </div>
    );
  }

  const otherInitial = (otherProfile?.display_name?.charAt(0) || otherProfile?.email?.charAt(0) || "?").toUpperCase();
  const otherIsAdmin = !isAdmin;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 px-3 py-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="font-sans text-xs text-muted-foreground">
              {lang === "el" ? "Δεν υπάρχουν μηνύματα ακόμα. Πες ένα γεια! 👋" : "No messages yet. Say hello! 👋"}
            </p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          const showDate =
            i === 0 ||
            format(new Date(msg.created_at), "yyyy-MM-dd") !==
              format(new Date(messages[i - 1].created_at), "yyyy-MM-dd");
          const isLastInGroup =
            i === messages.length - 1 || messages[i + 1].sender_id !== msg.sender_id;
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center my-3">
                  <span className="font-sans text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {format(new Date(msg.created_at), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              <div className={cn("flex items-end gap-2", isMe ? "justify-end" : "justify-start")}>
                {!isMe && isLastInGroup ? (
                  <Avatar className="h-6 w-6 shrink-0 mb-1">
                    {otherIsAdmin ? (
                      <AvatarImage src={logo} alt="Alexandros" />
                    ) : otherProfile?.avatar_url ? (
                      <AvatarImage src={otherProfile.avatar_url} alt="" />
                    ) : null}
                    <AvatarFallback className="text-[9px] font-serif bg-primary/10 text-primary">
                      {otherIsAdmin ? "A" : otherInitial}
                    </AvatarFallback>
                  </Avatar>
                ) : !isMe ? (
                  <div className="w-6 shrink-0" />
                ) : null}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 font-sans text-sm",
                    isMe
                      ? "bg-gold text-gold-foreground rounded-br-md"
                      : "bg-card border border-border text-foreground rounded-bl-md"
                  )}
                >
                  {msg.message_type === "audio" && msg.audio_url ? (
                    <AudioMessageBubble
                      messageId={msg.id}
                      audioUrl={msg.audio_url}
                      transcript={msg.transcript}
                      isMe={isMe}
                    />
                  ) : (
                    <Linkify>{msg.content}</Linkify>
                  )}
                  <p className={cn("text-[9px] mt-1", isMe ? "text-gold-foreground/60" : "text-muted-foreground")}>
                    {format(new Date(msg.created_at), "h:mm a")}
                    {isMe && <MessageCheckmarks isRead={!!msg.read_at} className={isMe ? "text-gold-foreground/60" : ""} />}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lang === "el" ? "Γράψε ένα μήνυμα…" : "Type a message…"}
            maxLength={2000}
            className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {newMessage.trim() ? (
            <button
              onClick={handleSend}
              disabled={sending}
              className="rounded-full bg-gold p-2 text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          ) : null}
          {user && (
            <AudioRecorder
              userId={user.id}
              otherUserId={otherUserId}
              onSent={() => inputRef.current?.focus()}
              hasText={!!newMessage.trim()}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
