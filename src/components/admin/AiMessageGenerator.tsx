import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Save, Trash2, Loader2 } from "lucide-react";

const PRESET_PROMPTS = [
  { label: "Welcome message", prompt: "Write a warm, personal welcome message for a new nutrition coaching client. Use {client_name} for personalization. Keep it encouraging and professional." },
  { label: "Weekly check-in", prompt: "Write a friendly weekly check-in message asking the client how they're feeling, if they've been following the plan, and encouraging them to log their meals and measurements." },
  { label: "Motivational boost", prompt: "Write a short motivational message to keep a nutrition coaching client on track. Be specific about healthy habits and mindset." },
  { label: "Measurement reminder", prompt: "Write a gentle reminder message asking the client to take their weekly body measurements and log them in the app." },
  { label: "Program milestone", prompt: "Write a congratulatory message for a client reaching a milestone in their program. Celebrate their dedication and progress." },
];

interface SavedPrompt {
  id: string;
  label: string;
  prompt: string;
  category: string;
}

interface Props {
  onInsert: (content: string) => void;
}

const AiMessageGenerator = ({ onInsert }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<"en" | "el">("en");
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [saveLabel, setSaveLabel] = useState("");
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    loadSavedPrompts();
  }, []);

  const loadSavedPrompts = async () => {
    const { data } = await supabase
      .from("saved_ai_prompts" as any)
      .select("*")
      .order("created_at" as any);
    if (data) setSavedPrompts(data as any[]);
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const langInstruction = language === "el"
        ? " IMPORTANT: Write the ENTIRE message in Greek (Ελληνικά). Do NOT write in English."
        : " Write in English.";
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/concierge-chat`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `You are a nutrition coaching assistant. Generate messages for automated program delivery. Write in a warm, professional tone. Always keep messages concise (2-4 sentences). Use {client_name} as placeholder for the client's name.${langInstruction}` },
            { role: "user", content: prompt },
          ],
          skipHistory: true,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setResult(accumulated);
            }
          } catch { /* skip non-JSON lines */ }
        }
      }

      if (!accumulated) setResult("");
    } catch (e: any) {
      toast({ title: "Error generating", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async () => {
    if (!saveLabel.trim() || !prompt.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("saved_ai_prompts" as any)
      .insert({ label: saveLabel, prompt, created_by: user.id } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Prompt saved" });
      setSaveLabel("");
      setShowSave(false);
      loadSavedPrompts();
    }
  };

  const deleteSaved = async (id: string) => {
    await supabase.from("saved_ai_prompts" as any).delete().eq("id", id);
    loadSavedPrompts();
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-xs font-sans font-semibold text-foreground">
        <Sparkles className="h-3.5 w-3.5 text-gold" />
        AI Message Generator
      </h3>

      {/* Preset templates */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_PROMPTS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPrompt(p.prompt)}
            className="rounded-full border border-border px-2.5 py-1 text-[10px] font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            {p.label}
          </button>
        ))}
        {savedPrompts.map((p) => (
          <div key={p.id} className="flex items-center gap-0.5">
            <button
              onClick={() => setPrompt(p.prompt)}
              className="rounded-full border border-gold/30 bg-gold/5 px-2.5 py-1 text-[10px] font-sans text-gold hover:bg-gold/10 transition-colors"
            >
              {p.label}
            </button>
            <button onClick={() => deleteSaved(p.id)} className="p-0.5 text-destructive/50 hover:text-destructive">
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Prompt input */}
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the message you want to generate, e.g. 'Write a check-in message for week 3'..."
        className="text-xs min-h-[60px]"
      />

      <div className="flex items-center gap-2">
        <div className="w-28">
          <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "el")}>
            <SelectTrigger className="text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en" className="text-xs">🇬🇧 English</SelectItem>
              <SelectItem value="el" className="text-xs">🇬🇷 Ελληνικά</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-sans font-semibold text-gold-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Generate
          </button>
          <button
            onClick={() => setShowSave(!showSave)}
            className="text-[10px] font-sans text-muted-foreground hover:text-foreground transition-colors"
          >
            Save prompt
          </button>
          {showSave && (
            <div className="flex items-center gap-1">
              <Input
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder="Name..."
                className="text-xs h-7 w-24"
              />
              <button onClick={savePrompt} className="p-1 text-gold hover:bg-gold/10 rounded-md">
                <Save className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Inline result box */}
        {result ? (
          <div className="flex-1 rounded-lg border border-gold/20 bg-gold/5 p-2.5 space-y-1.5">
            <p className="text-xs font-sans text-foreground whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{result}</p>
            <button
              onClick={() => onInsert(result)}
              className="rounded-md bg-gold px-2.5 py-0.5 text-[10px] font-sans font-semibold text-gold-foreground hover:opacity-90 transition-opacity"
            >
              Use this message
            </button>
          </div>
        ) : (
          <div className="flex-1 rounded-lg border border-dashed border-border p-2.5 flex items-center justify-center min-h-[3rem]">
            <span className="text-[10px] text-muted-foreground font-sans">Generated message will appear here</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiMessageGenerator;
