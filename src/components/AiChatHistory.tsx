import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AiMessage {
  id: string;
  user_id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface AiChatHistoryProps {
  userId: string;
  className?: string;
}

const AiChatHistory = ({ userId, className }: AiChatHistoryProps) => {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("ai_chat_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (data) setMessages(data as unknown as AiMessage[]);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <p className="font-sans text-xs text-muted-foreground">No AI conversations yet.</p>
      </div>
    );
  }

  // Group by session
  const sessions: { sessionId: string; msgs: AiMessage[] }[] = [];
  const sessionMap = new Map<string, AiMessage[]>();
  for (const msg of messages) {
    if (!sessionMap.has(msg.session_id)) sessionMap.set(msg.session_id, []);
    sessionMap.get(msg.session_id)!.push(msg);
  }
  for (const [sessionId, msgs] of sessionMap) {
    sessions.push({ sessionId, msgs });
  }

  return (
    <div className={cn("flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0", className)}>
      {sessions.map((session) => (
        <div key={session.sessionId} className="space-y-1">
          <div className="text-center my-2">
            <span className="font-sans text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {format(new Date(session.msgs[0].created_at), "MMM d, yyyy · h:mm a")}
            </span>
          </div>
          {session.msgs.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="h-3 w-3 text-accent-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 font-sans text-sm",
                  msg.role === "user"
                    ? "bg-muted text-foreground rounded-br-md"
                    : "bg-accent/30 border border-accent/50 text-foreground rounded-bl-md"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className="text-[9px] mt-1 text-muted-foreground">
                  {format(new Date(msg.created_at), "h:mm a")}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default AiChatHistory;
