import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Phone, MapPin, Wallet, Wine, Crown, Ruler } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RestaurantCard from "@/components/RestaurantCard";
import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/context/LanguageContext";
import { usePageActions } from "@/context/PageActionsContext";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
}

interface ParsedRestaurant {
  name: string;
  cuisine: string;
  distance: string;
  rating: number;
  reviewCount?: number;
  averagePrice?: string;
  walkingTime?: string;
  drivingTime?: string;
  whyThisPlace: string;
  whatToOrder?: string;
  mealOptions?: { dish: string; englishName?: string; isRecommended: boolean; lowCarbTip?: string; pricePerKg?: string }[];
  orderingPhrase: string;
  kitchenHours?: string;
  address?: string;
  photoQuery?: string;
  verificationNote?: string;
  googleMapsUrl?: string;
  appleMapsUrl?: string;
  websiteUrl?: string;
  deliveryTime?: string;
  orderingMethod?: string;
  dietBadges?: string[];
  directionHint?: string;
  photoReference?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/concierge-chat`;

function parseContentWithRestaurants(content: string): Array<{ type: "text"; value: string } | { type: "restaurant"; data: ParsedRestaurant }> {
  const parts: Array<{ type: "text"; value: string } | { type: "restaurant"; data: ParsedRestaurant }> = [];
  const regex = /```restaurant\s*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    try {
      const data = JSON.parse(match[1].trim());
      parts.push({ type: "restaurant", data });
    } catch {
      parts.push({ type: "text", value: match[0] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return parts;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

const Concierge = () => {
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);

  // Initialize greeting when lang changes
  useEffect(() => {
    setMessages([{ id: "1", content: t("conciergeGreeting"), role: "assistant" }]);
  }, [lang]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [priceTier, setPriceTier] = useState("");
  const [maxDistance, setMaxDistance] = useState(80);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { registerActions, clearActions } = usePageActions();

  useEffect(() => {
    registerActions({ featureKey: "concierge", featureLabel: "Concierge" });
    return () => clearActions();
  }, [registerActions, clearActions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const shareLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        toast({ title: "Location shared", description: "Your concierge now knows where you are." });
      },
      () => toast({ title: "Location access denied", variant: "destructive" })
    );
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), content: text, role: "user" };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const allMessages: Array<{ role: string; content: string }> = [...messages.filter(m => m.id !== "1"), userMsg].map(({ role, content }) => ({ role, content }));

    // Inject user preferences as system context
    const prefParts: string[] = [];
    if (priceTier) prefParts.push(`price preference: ${priceTier.replace("_", " ")}`);
    if (maxDistance < 80) prefParts.push(`max distance: ${maxDistance}km`);
    if (prefParts.length > 0) {
      allMessages.unshift({ role: "system", content: `User preferences: ${prefParts.join(", ")}. Tailor recommendations accordingly.` });
    }

    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: allMessages, location, lang }),
      });

      if (resp.status === 401) { toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" }); setIsLoading(false); return; }
      if (resp.status === 429) { toast({ title: "Service busy", description: "Please try again in a moment.", variant: "destructive" }); setIsLoading(false); return; }
      if (resp.status === 402) { toast({ title: "Service unavailable", variant: "destructive" }); setIsLoading(false); return; }
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
          return [...prev, { id: "stream-" + Date.now(), content, role: "assistant" }];
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
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const renderAssistantContent = (content: string) => {
    const parts = parseContentWithRestaurants(content);
    return (
      <div className="space-y-3">
        {parts.map((part, i) => {
          if (part.type === "restaurant") {
            return (
              <RestaurantCard
                key={`rest-${i}`}
                restaurant={{
                  id: String(i),
                  ...part.data,
                  powerPhrase: part.data.orderingPhrase,
                }}
                index={i}
                city={part.data.address || "Nearby"}
              />
            );
          }
          const text = part.value.trim();
          if (!text) return null;
          return (
            <div key={`text-${i}`} className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="px-6 pt-14 pb-4 space-y-1">
        <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">{t("directLine")}</p>
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-semibold text-foreground">{t("concierge")}</h1>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 space-y-3 pb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[85%] rounded-xl px-4 py-3 font-sans text-sm leading-relaxed ${
              msg.role === "user"
                ? "ml-auto bg-gold text-gold-foreground"
                : "bg-card border border-border text-foreground/80"
            }`}
          >
            {msg.role === "assistant" ? renderAssistantContent(msg.content) : msg.content}
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

      <div className="px-6 pb-2 flex gap-2">
        <button
          onClick={shareLocation}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 font-sans text-xs font-medium transition-colors ${
            location ? "border-gold/40 bg-gold/10 text-gold" : "border-border bg-card text-muted-foreground hover:border-gold/30"
          }`}
        >
          <MapPin className="h-3 w-3" />
          {location ? t("locationSharedLabel") : t("shareLocationShort")}
        </button>
        <button className="flex items-center justify-center gap-1.5 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2.5 font-sans text-xs font-medium text-gold hover:bg-gold/10">
          <Phone className="h-3 w-3" />
          {t("humanAssistance")}
        </button>
      </div>

      {/* Preferences row */}
      <div className="px-6 pt-1 pb-1 space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {([
            { id: "good_deal", icon: Wallet, label: t("goodDeal") },
            { id: "high_end", icon: Wine, label: t("highEnd") },
            { id: "most_exclusive", icon: Crown, label: t("mostExclusive") },
          ] as const).map((tier) => (
            <button
              key={tier.id}
              onClick={() => setPriceTier(prev => prev === tier.id ? "" : tier.id)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-sans font-medium transition-all border ${
                priceTier === tier.id
                  ? "bg-gold/15 text-gold border-gold/40"
                  : "bg-muted text-muted-foreground border-border hover:border-gold/30"
              }`}
            >
              <tier.icon className="h-2.5 w-2.5" />
              {tier.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Ruler className="h-3 w-3 text-gold shrink-0" />
          <Slider min={1} max={80} step={1} value={[maxDistance]} onValueChange={([v]) => setMaxDistance(v)} className="flex-1 [&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:border-gold [&_[role=slider]]:bg-gold [&_[data-orientation=horizontal]>[data-orientation=horizontal]]:bg-gold" />
          <span className="text-[10px] font-sans text-muted-foreground w-8 text-right">{maxDistance >= 80 ? "80+" : maxDistance}km</span>
        </div>
      </div>

      <div className="px-6 pb-4 pt-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={t("askConcierge")}
            className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={isLoading}
          />
          <button onClick={sendMessage} disabled={isLoading} className="text-gold hover:opacity-80 transition-opacity disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default Concierge;
