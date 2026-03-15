import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  onLocation: (coords: { lat: number; lng: number }, name: string) => void;
}

const LocationInput = ({ onLocation }: Props) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const { t, tUp } = useLanguage();

  const handleSubmit = async () => {
    const address = text.trim();
    if (!address) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode", {
        body: { address },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: t("locationNotFound"), variant: "destructive" });
        return;
      }
      if (data?.lat && data?.lng) {
        onLocation({ lat: data.lat, lng: data.lng }, data.formattedAddress || address);
      }
    } catch (e) {
      console.error("Geocode error:", e);
      toast({ title: t("locationNotFound"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2" data-guide="location-input">
      <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-muted-foreground text-center font-medium">{tUp("orEnterLocation")}</p>
      <div className="flex items-center rounded-2xl border border-border bg-card transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-gold-sm overflow-hidden">
        <div className="flex flex-1 items-center gap-2 px-4 py-3">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={t("enterAddress")}
            className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={loading}
          />
        </div>
        <div className="w-px h-8 bg-border/60" />
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="px-5 py-3 font-sans text-sm font-semibold text-gold transition-all duration-200 hover:bg-gold/5 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("go")}
        </button>
      </div>
    </div>
  );
};

export default LocationInput;
