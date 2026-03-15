import { useLanguage } from "@/contexts/LanguageContext";
import { translations, t } from "@/lib/translations";

const HeroSection = () => {
  const { lang } = useLanguage();

  return (
    <section className="relative flex min-h-[95vh] items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-charcoal-light via-background to-background" />
      <div className="relative z-10 mx-auto px-4 py-20 text-center">
        <h2 className="mb-8 animate-fade-in font-serif text-5xl font-bold leading-tight text-foreground md:text-7xl">
          {t(translations.hero.title, lang)}
        </h2>
        <p className="mx-auto mb-6 max-w-4xl font-sans text-2xl font-light text-foreground/90 md:text-4xl">
          {t(translations.hero.subtitle, lang)}
        </p>
        <p className="mx-auto mb-10 max-w-3xl font-sans text-lg text-muted-foreground md:text-2xl">
          {t(translations.hero.benefits, lang)}
        </p>
      </div>
    </section>
  );
};

export default HeroSection;
