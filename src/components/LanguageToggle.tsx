import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const LanguageToggle = () => {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-muted p-1">
      <button
        onClick={() => setLang("gr")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-bold transition-all",
          lang === "gr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        GR
      </button>
      <button
        onClick={() => setLang("en")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-bold transition-all",
          lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageToggle;
