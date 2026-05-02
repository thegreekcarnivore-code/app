import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/concierge-chat`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

const CoachChat = () => {
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const greeting: Message = {
      id: "greeting",
      role: "assistant",
      content: isGreek
        ? "Είμαι ο Σύμβουλος — ο προσωπικός σου καθοδηγητής 24/7 μέσα στο πρόγραμμα Μεταμόρφωση. Ξέρω το intake σου, τις μετρήσεις, τις φωτογραφίες και τις προηγούμενες κουβέντες σου. Ρώτα με ό,τι χρειάζεσαι — διατροφή, ηλεκτρολύτες, plateau, weekend protocol, ορμόνες, ύπνο, ενέργεια."
        : "I'm the Σύμβουλος — your 24/7 personal guide inside the Metamorphosis program. I know your intake, measurements, photos and prior conversations. Ask me anything — nutrition, electrolytes, plateaus, weekend protocol, hormones, sleep, energy.",
    };
    setMessages([greeting]);
  }, [isGreek]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const allMessages = [...messages.filter((m) => m.id !== "greeting"), userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: allMessages, lang, mode: "coach" }),
      });

      if (resp.status === 401) {
        toast({ title: isGreek ? "Λήξη συνεδρίας" : "Session expired", description: isGreek ? "Συνδέσου ξανά." : "Please sign in again.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (resp.status === 429) {
        toast({ title: isGreek ? "Πολλά αιτήματα" : "Service busy", description: isGreek ? "Δοκίμασε σε λίγο." : "Try again shortly.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantSoFar = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        const content = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id.startsWith("stream-")) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { id: "stream-" + Date.now(), role: "assistant", content }];
        });
      };

      let done = false;
      while (!done) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({
        title: isGreek ? "Κάτι πήγε στραβά" : "Something went wrong",
        description: isGreek ? "Δοκίμασε ξανά." : "Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="px-6 pt-14 pb-4 space-y-1">
        <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">
          {isGreek ? "Σύμβουλος · Μεταμόρφωση" : "Σύμβουλος · Metamorphosis"}
        </p>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {isGreek ? "Ο Σύμβουλος" : "The Σύμβουλος"}
        </h1>
        <p className="font-sans text-xs text-muted-foreground">
          {isGreek ? "Ο προσωπικός σου καθοδηγητής 24/7 μέσα στην εφαρμογή." : "Your 24/7 personal guide inside the app."}
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 space-y-3 pb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[85%] rounded-xl px-4 py-3 font-sans text-sm leading-relaxed ${
              msg.role === "user"
                ? "ml-auto bg-gold text-gold-foreground"
                : "bg-card border border-border text-foreground/85"
            }`}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="max-w-[85%] rounded-xl px-4 py-3 bg-card border border-border">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-gold/50 animate-pulse" />
              <span className="h-2 w-2 rounded-full bg-gold/50 animate-pulse" style={{ animationDelay: "0.2s" }} />
              <span className="h-2 w-2 rounded-full bg-gold/50 animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        )}
      </div>

      <div className="px-6 pb-6 pt-2 flex gap-2 border-t border-border/40 bg-background/80 backdrop-blur">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isGreek ? "Ρώτα τον Αλέξανδρο..." : "Ask Alex..."}
          disabled={isLoading}
          className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-60"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-gold-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={isGreek ? "Αποστολή" : "Send"}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
};

export default CoachChat;
