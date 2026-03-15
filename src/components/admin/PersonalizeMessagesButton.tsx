import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserRound, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  clientUserId: string;
  messages: any[];
  onApply: (personalized: { id: string; message_content: string }[]) => void;
}

const PersonalizeMessagesButton = ({ clientUserId, messages, onApply }: Props) => {
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<"en" | "el">("en");
  const [preview, setPreview] = useState<{ id: string; message_content: string }[] | null>(null);

  const personalize = async () => {
    if (messages.length === 0) {
      toast({ title: "No messages to personalize", variant: "destructive" });
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/personalize-messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientUserId,
          messages: messages.map(m => ({ id: m.id, day_offset: m.day_offset, message_content: m.message_content })),
          language,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { personalized } = await resp.json();
      setPreview(personalized);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confirmApply = () => {
    if (!preview) return;
    onApply(preview);
    setPreview(null);
    toast({ title: `${preview.length} messages personalized!` });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-xs font-sans font-semibold text-foreground">
        <UserRound className="h-3.5 w-3.5 text-gold" />
        Personalize Messages for Client
      </h3>
      <p className="text-[10px] font-sans text-muted-foreground">
        AI will rewrite all {messages.length} template messages using the client's profile, notes, measurements, food journal and program progress.
      </p>

      <div className="flex items-center gap-2">
        <div className="w-28">
          <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "el")}>
            <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en" className="text-xs">🇬🇧 English</SelectItem>
              <SelectItem value="el" className="text-xs">🇬🇷 Ελληνικά</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <button
          onClick={personalize}
          disabled={loading || messages.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-sans font-semibold text-gold-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserRound className="h-3 w-3" />}
          Personalize All Messages
        </button>
      </div>

      {preview && (
        <div className="space-y-2 rounded-lg border border-gold/20 bg-gold/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-sans font-semibold text-foreground">
              Preview — {preview.length} personalized messages
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={confirmApply}
                className="flex items-center gap-1 rounded-md bg-gold px-2.5 py-1 text-[10px] font-sans font-semibold text-gold-foreground hover:opacity-90"
              >
                <Check className="h-3 w-3" /> Apply All
              </button>
              <button
                onClick={() => setPreview(null)}
                className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[10px] font-sans text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {preview.map((item, i) => (
              <div key={i} className="text-[10px] font-sans text-foreground border-b border-border/50 pb-1">
                {item.message_content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalizeMessagesButton;
