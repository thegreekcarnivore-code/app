import { MessageCircle, Sparkles } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import { useChatUnread } from "@/hooks/useChatUnread";
import { useLanguage } from "@/context/LanguageContext";

const ChatTrigger = () => {
  const { setChatOpen, setAssistantOpen } = useChatContext();
  const unreadCount = useChatUnread();
  const { lang } = useLanguage();

  return (
    <div className="flex items-center gap-1">
      {/* Personal message button */}
      <button
        data-guide="chat-bubble"
        onClick={() => setChatOpen(true)}
        className="relative inline-flex items-center gap-1 rounded-lg px-2 py-1.5 transition-all hover:bg-muted/50 text-foreground"
        aria-label="Messages"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="text-[10px] font-sans font-medium text-muted-foreground">
          {lang === "el" ? "Μήνυμα" : "Message"}
        </span>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Assistant button */}
      <button
        data-guide="assistant-trigger"
        onClick={() => setAssistantOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 transition-all hover:bg-muted/50 text-foreground"
        aria-label={lang === "el" ? "Βοηθός Εφαρμογής" : "Assistant"}
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-[10px] font-sans font-medium text-muted-foreground">
          {lang === "el" ? "Βοηθός Εφαρμογής" : "Assistant"}
        </span>
      </button>
    </div>
  );
};

export default ChatTrigger;
