import { useLanguage } from "@/contexts/LanguageContext";
import { translations, t } from "@/lib/translations";
import { Target, TrendingDown, Zap, Heart } from "lucide-react";

const icons = [TrendingDown, Zap, Target, Heart];

const Benefits = () => {
  const { lang } = useLanguage();

  return (
    <section className="bg-background py-24">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-6 font-serif text-4xl font-bold text-foreground md:text-5xl">
            {t(translations.benefits.title, lang)}
          </h2>
          <p className="mx-auto max-w-2xl font-sans text-xl font-light text-muted-foreground">
            {t(translations.benefits.subtitle, lang)}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {translations.benefits.items.map((item, i) => {
            const Icon = icons[i];
            return (
              <div
                key={i}
                className="card-lift rounded-2xl border border-border/50 bg-card p-8 text-center"
              >
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
                  <Icon className="h-8 w-8 text-gold" />
                </div>
                <h3 className="mb-3 font-serif text-xl font-semibold text-foreground">
                  {t(item.title, lang)}
                </h3>
                <p className="font-sans text-sm text-muted-foreground">{t(item.desc, lang)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Benefits;
