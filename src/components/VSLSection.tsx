import { useLanguage } from "@/contexts/LanguageContext";
import { translations, t } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Users, TrendingDown, Clock } from "lucide-react";
import { useState, useEffect } from "react";

const VSLSection = () => {
  const { lang } = useLanguage();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isOfferActive, setIsOfferActive] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const referenceDate = new Date('2025-01-01T00:00:00');
      const now = new Date();
      const diffMs = now.getTime() - referenceDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const cyclePosition = diffDays % 14;
      const offerActive = cyclePosition < 7;
      setIsOfferActive(offerActive);

      const nextPhaseDate = new Date(referenceDate);
      nextPhaseDate.setDate(
        referenceDate.getDate() + Math.floor(diffDays / 14) * 14 + (offerActive ? 7 : 14)
      );
      const timeRemaining = nextPhaseDate.getTime() - now.getTime();
      setTimeLeft({
        days: Math.floor(timeRemaining / (1000 * 60 * 60 * 24)),
        hours: Math.floor(timeRemaining % (1000 * 60 * 60 * 24) / (1000 * 60 * 60)),
        minutes: Math.floor(timeRemaining % (1000 * 60 * 60) / (1000 * 60)),
        seconds: Math.floor(timeRemaining % (1000 * 60) / 1000)
      });
    };
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  const trustIndicators = [
  { icon: Users, label: translations.vsl.trust1Label, sub: translations.vsl.trust1Sub },
  { icon: TrendingDown, label: translations.vsl.trust2Label, sub: translations.vsl.trust2Sub },
  { icon: Clock, label: translations.vsl.trust3Label, sub: translations.vsl.trust3Sub }];


  return (
    <section className="relative flex min-h-screen items-center justify-center bg-background px-4 py-20">
      <div className="mx-auto max-w-6xl">
        {/* Pre-headline */}
        <div className="mb-10 animate-fade-in text-center">
          <h1 className="mb-6 font-serif text-4xl font-bold leading-tight text-foreground md:text-6xl">
            {t(translations.vsl.title, lang)}<br />
            <span className="text-gold">{t(translations.vsl.titleHighlight, lang)}</span>
          </h1>
          <p className="mx-auto max-w-3xl font-sans text-xl font-light text-muted-foreground md:text-2xl">
            {t(translations.vsl.subtitle, lang)}
          </p>
        </div>

        {/* VSL Video Placeholder */}
        <div className="relative mx-auto mb-12 max-w-4xl animate-scale-in">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/50 bg-charcoal-light shadow-2xl">
            <iframe
              className="absolute inset-0 h-full w-full"
              src="https://www.youtube.com/embed/KTQV0Ul3sQ0?rel=0&v=3"
              title="TV Interview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="absolute -inset-2 -z-10 rounded-2xl bg-gold/20 blur-2xl"></div>
        </div>

        {/* Trust Indicators */}
        <div className="mx-auto mb-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
          {trustIndicators.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm transition-all duration-300 hover:border-gold/30 hover:bg-card">
              <item.icon className="h-8 w-8 text-gold" />
              <span className="font-serif text-2xl font-semibold text-foreground">{t(item.label, lang)}</span>
              <span className="font-sans text-sm text-muted-foreground">{t(item.sub, lang)}</span>
            </div>
          ))}
        </div>

        {/* Key Benefits */}
        <div className="mx-auto mb-12 max-w-2xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {translations.vsl.benefits.map((benefit, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-gold" />
                <span className="font-sans font-medium text-foreground/90">{t(benefit, lang)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="mx-auto mb-8 max-w-md animate-fade-in">
          {isOfferActive ? (
            <div className="rounded-2xl border border-gold/20 bg-gold/5 p-8">
              <p className="mb-4 text-center font-sans text-sm font-medium uppercase tracking-widest text-gold">
                {t(translations.vsl.timerLabel, lang)}
              </p>
              <div className="flex justify-center gap-3">
                {timeLeft.days > 0 && (
                  <div className="min-w-[70px] rounded-xl border border-border/50 bg-card p-3 shadow-gold-sm">
                    <div className="text-center font-serif text-3xl font-bold text-foreground">{String(timeLeft.days).padStart(2, '0')}</div>
                    <div className="text-center font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{t(translations.vsl.timerDays, lang)}</div>
                  </div>
                )}
                <div className="min-w-[70px] rounded-xl border border-border/50 bg-card p-3 shadow-gold-sm">
                  <div className="text-center font-serif text-3xl font-bold text-foreground">{String(timeLeft.hours).padStart(2, '0')}</div>
                  <div className="text-center font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{t(translations.vsl.timerHours, lang)}</div>
                </div>
                <div className="min-w-[70px] rounded-xl border border-border/50 bg-card p-3 shadow-gold-sm">
                  <div className="text-center font-serif text-3xl font-bold text-foreground">{String(timeLeft.minutes).padStart(2, '0')}</div>
                  <div className="text-center font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{t(translations.vsl.timerMinutes, lang)}</div>
                </div>
                <div className="min-w-[70px] rounded-xl border border-border/50 bg-card p-3 shadow-gold-sm">
                  <div className="text-center font-serif text-3xl font-bold text-foreground">{String(timeLeft.seconds).padStart(2, '0')}</div>
                  <div className="text-center font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{t(translations.vsl.timerSeconds, lang)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="opacity-0">
              <p className="text-xs text-muted-foreground">
                {t(translations.vsl.timerNextIn, lang)} {timeLeft.days} {t(translations.vsl.daysLabel, lang)}, {timeLeft.hours} {t(translations.vsl.hoursLabel, lang)}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );

};

export default VSLSection;