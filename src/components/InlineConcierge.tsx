import { useState, useRef, useEffect } from "react";
import { Send, MapPin, Paperclip, X, Wallet, Wine, Crown, Ruler } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RestaurantCard from "@/components/RestaurantCard";
import { Slider } from "@/components/ui/slider";
import type { SavedSource } from "@/context/SavedRestaurantsContext";
import { useLanguage } from "@/context/LanguageContext";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  imagePreview?: string; // base64 data URL for display only
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
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

function parseContentWithRestaurants(content: string): Array<{ type: "text"; value: string } | { type: "restaurant"; data: ParsedRestaurant }> {
  const parts: Array<{ type: "text"; value: string } | { type: "restaurant"; data: ParsedRestaurant }> = [];
  const regex = /```restaurant\s*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    try { const data = JSON.parse(match[1].trim()); parts.push({ type: "restaurant", data }); } catch { parts.push({ type: "text", value: match[0] }); }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) parts.push({ type: "text", value: content.slice(lastIndex) });
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface InlineConciergeProps {
  mode?: "delivery" | "shopping" | "general";
}

const InlineConcierge = ({ mode }: InlineConciergeProps = {}) => {
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", content: "", role: "assistant" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [priceTier, setPriceTier] = useState("");
  const [maxDistance, setMaxDistance] = useState(80);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages(prev => prev.map(m => m.id === "1" ? { ...m, content: t("conciergeGreeting") } : m));
  }, [t]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const shareLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        toast({ title: t("locationShared"), description: t("conciergeKnows") });
      },
      () => toast({ title: t("locationDenied"), variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: t("unsupportedFile"), variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: t("fileTooLarge"), variant: "destructive" });
      return;
    }

    const base64 = await fileToBase64(file);
    setAttachedImage(base64);
    toast({ title: t("attachedImage") });
  };

  const removeAttachment = () => setAttachedImage(null);

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && !attachedImage) || isLoading) return;

    const imageForMessage = attachedImage;
    const userMsg: Message = {
      id: Date.now().toString(),
      content: text || (imageForMessage ? t("attachedImage") : ""),
      role: "user",
      imagePreview: imageForMessage || undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedImage(null);
    setIsLoading(true);

    // Build message history for API
    const apiMessages: Array<{ role: string; content: unknown }> = [...messages.filter((m) => m.id !== "1"), userMsg].map(({ role, content, imagePreview }) => {
      if (role === "user" && imagePreview) {
        const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
        if (content && content !== t("attachedImage")) {
          parts.push({ type: "text", text: content });
        }
        parts.push({ type: "image_url", image_url: { url: imagePreview } });
        return { role, content: parts };
      }
      return { role, content };
    });

    // Inject user preferences as system context
    const prefParts: string[] = [];
    if (priceTier) prefParts.push(`price preference: ${priceTier.replace("_", " ")}`);
    if (mode !== "delivery" && maxDistance < 80) prefParts.push(`max distance: ${maxDistance}km`);
    if (prefParts.length > 0) {
      apiMessages.unshift({ role: "system", content: `User preferences: ${prefParts.join(", ")}. Tailor recommendations accordingly.` });
    }

    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(CHAT_URL, { method: "POST", headers, body: JSON.stringify({ messages: apiMessages, location, lang, mode }) });
      if (resp.status === 401) { toast({ title: "Session expired", variant: "destructive" }); setIsLoading(false); return; }
      if (resp.status === 429) { toast({ title: "Service busy", variant: "destructive" }); setIsLoading(false); return; }
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
          if (last?.role === "assistant" && last.id.startsWith("stream-")) return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
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
          try { const parsed = JSON.parse(jsonStr); const c = parsed.choices?.[0]?.delta?.content; if (c) upsert(c); } catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Something went wrong", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const renderAssistantContent = (content: string) => {
    const parts = parseContentWithRestaurants(content);
    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (part.type === "restaurant") {
            const modeSource = mode === "delivery" ? "delivery" as const : mode === "shopping" ? "shopping" as const : "restaurant" as const;
            return <RestaurantCard key={`rest-${i}`} restaurant={{ id: String(i), ...part.data, powerPhrase: part.data.orderingPhrase }} index={i} city={part.data.address || "Nearby"} source={modeSource} />;
          }
          const text = part.value.trim();
          if (!text) return null;
          return <div key={`text-${i}`} className="prose prose-xs prose-invert max-w-none [&_p]:my-0.5 [&_ul]:my-0.5"><ReactMarkdown>{text}</ReactMarkdown></div>;
        })}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-border bg-card overflow-hidden card-inset">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gold/15">
        <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-gold font-medium">{t("concierge")}</p>
        <button onClick={shareLocation} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-sans font-medium transition-colors ${location ? "text-gold bg-gold/10" : "text-muted-foreground hover:text-gold"}`}>
          <MapPin className="h-2.5 w-2.5" />
          {location ? t("located") : t("shareLocationShort")}
        </button>
      </div>
      <div ref={scrollRef} className="max-h-96 overflow-y-auto px-4 py-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`rounded-2xl px-4 py-2.5 font-sans text-xs leading-relaxed ${msg.role === "user" ? "ml-auto max-w-[85%] bg-gradient-to-br from-gold to-gold/90 text-gold-foreground shadow-gold-sm" : "bg-muted text-foreground/80"}`}>
            {msg.role === "user" && msg.imagePreview && (
              <img src={msg.imagePreview} alt="" className="rounded mb-1.5 max-h-32 w-auto object-cover" />
            )}
            {msg.role === "assistant" ? renderAssistantContent(msg.content) : msg.content}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-gold/50 animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-gold/50 animate-pulse" style={{ animationDelay: "0.2s" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-gold/50 animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        )}
      </div>

      {/* Attachment preview */}
      {attachedImage && (
        <div className="px-3 pt-1">
          <div className="relative inline-block">
            <img src={attachedImage} alt="" className="h-16 w-auto rounded border border-border object-cover" />
            <button onClick={removeAttachment} className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5">
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      )}

      {/* Preferences row */}
      <div className="px-3 pt-1 space-y-1.5">
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
        {mode !== "delivery" && (
          <div className="flex items-center gap-2">
            <Ruler className="h-3 w-3 text-gold shrink-0" />
            <Slider min={1} max={80} step={1} value={[maxDistance]} onValueChange={([v]) => setMaxDistance(v)} className="flex-1 [&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:border-gold [&_[role=slider]]:bg-gold [&_[data-orientation=horizontal]>[data-orientation=horizontal]]:bg-gold" />
            <span className="text-[10px] font-sans text-muted-foreground w-8 text-right">{maxDistance >= 80 ? "80+" : maxDistance}km</span>
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-2">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 transition-all duration-300 focus-within:border-gold/40 focus-within:shadow-gold-sm">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder={t("askAnything")} className="flex-1 bg-transparent font-sans text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" disabled={isLoading} />
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className={`transition-opacity disabled:opacity-40 ${attachedImage ? "text-gold" : "text-muted-foreground hover:text-gold"}`} title={t("attachFile")}>
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <button onClick={sendMessage} disabled={isLoading} className="text-gold hover:opacity-80 transition-opacity disabled:opacity-40">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default InlineConcierge;
