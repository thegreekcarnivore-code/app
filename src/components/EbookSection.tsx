import { useLanguage } from "@/contexts/LanguageContext";
import { translations, t } from "@/lib/translations";
import alexandrosBook from "@/assets/ebook-cover.png";

interface EbookSectionProps {
  onCtaClick: () => void;
}

const EbookSection = ({ onCtaClick }: EbookSectionProps) => {
  const { lang } = useLanguage();

  return (
    <section className="bg-charcoal px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center gap-12 md:flex-row">
          {/* Book Image */}
          <div className="flex-shrink-0">
            <img
              src={alexandrosBook}
              alt="Το Μυστικό - The Greek Carnivore"
              className="h-auto w-64 drop-shadow-2xl md:w-80"
            />
          </div>

          {/* Text Content */}
          <div className="text-center md:text-left">
            <p className="mb-4 font-serif text-3xl font-bold tracking-wide text-gold drop-shadow-sm md:text-4xl">🎁 Δωρεάν Βιβλίο</p>
            <h2 className="mb-4 font-serif text-3xl font-bold text-foreground sm:text-4xl">
              {t(translations.ebook.title, lang)}
            </h2>
            <p className="mb-4 font-sans text-lg font-medium text-foreground/90">
              {t(translations.ebook.subtitle, lang)}
            </p>
            <p className="mb-10 font-sans text-muted-foreground leading-relaxed">
              {t(translations.ebook.desc, lang)}
            </p>
            <button
              onClick={onCtaClick}
              className="shimmer-gold gold-glow rounded-2xl bg-gold px-10 py-4 font-sans text-base font-semibold text-gold-foreground shadow-gold-md transition-all duration-200 hover:opacity-90"
            >
              {t(translations.ebook.cta, lang)}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EbookSection;
