import { useLanguage } from "@/contexts/LanguageContext";
import { translations, t } from "@/lib/translations";
import { Check } from "lucide-react";

const Solution = () => {
  const { lang } = useLanguage();

  const renderText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-gold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <section className="bg-charcoal py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="font-serif text-4xl font-bold text-foreground md:text-5xl">
              {t(translations.solution.title, lang)}
            </h2>
          </div>

          <div className="mb-16 grid gap-6 md:grid-cols-2">
            {translations.solution.benefits.map((benefit, i) => (
              <div
                key={i}
                className="card-lift flex items-start gap-4 rounded-2xl border border-border/50 bg-card p-6"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold/10">
                  <Check className="h-5 w-5 text-gold" strokeWidth={3} />
                </div>
                <p className="font-sans text-lg leading-relaxed text-foreground/90">
                  {renderText(t(benefit, lang))}
                </p>
              </div>
            ))}
          </div>

          <div className="shimmer-gold rounded-2xl bg-gold p-10 text-center shadow-gold-lg md:p-16">
            <h3 className="mb-6 font-serif text-3xl font-bold text-gold-foreground md:text-4xl">
              {t(translations.solution.methodTitle, lang)}
            </h3>
            <p className="mb-8 font-sans text-xl font-light leading-relaxed text-gold-foreground/90">
              {t(translations.solution.methodDesc, lang)}
            </p>
            <div className="flex flex-wrap justify-center gap-4 font-sans text-lg font-medium text-gold-foreground/90">
              {translations.solution.methodTags.map((tag, i) => (
                <span key={i} className="rounded-full bg-gold-foreground/10 px-6 py-3 backdrop-blur-sm">
                  {t(tag, lang)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Solution;
