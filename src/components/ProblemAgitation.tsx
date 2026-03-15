import { useLanguage } from "@/contexts/LanguageContext";
import { translations, t } from "@/lib/translations";
import { X } from "lucide-react";

const ProblemAgitation = () => {
  const { lang } = useLanguage();

  const renderBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-primary">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <section className="bg-charcoal py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-gold md:text-base">
            {t(translations.problemAgitation.preTitle, lang)}
          </p>

          <h2 className="mb-16 font-serif text-4xl font-bold leading-tight text-foreground md:text-5xl">
            {t(translations.problemAgitation.title, lang)}{" "}
            <span className="text-gold">{t(translations.problemAgitation.titleHighlight, lang)}</span>
          </h2>

          <div className="mb-16 rounded-2xl border border-border/50 bg-card p-8 shadow-2xl md:p-12">
            <h3 className="mb-8 font-serif text-3xl font-semibold text-foreground">
              {t(translations.problemAgitation.cardTitle, lang)}
            </h3>
            <div className="space-y-4">
              {translations.problemAgitation.problems.map((problem, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-xl border border-border/30 bg-background/50 p-5 text-left transition-colors hover:border-gold/30"
                >
                  <X className="mt-1 h-5 w-5 flex-shrink-0 text-gold" strokeWidth={2} />
                  <p className="font-sans text-lg text-foreground/90">{t(problem, lang)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-8 md:p-12">
            <p className="font-sans text-xl font-light leading-relaxed text-foreground md:text-2xl">
              {renderBoldText(t(translations.problemAgitation.motivation, lang))}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemAgitation;
