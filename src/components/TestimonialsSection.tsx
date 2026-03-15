import { useLanguage } from "@/contexts/LanguageContext";
import { translations, t } from "@/lib/translations";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const testimonialImages = Array.from({ length: 9 }, (_, i) => ({
  src: `/images/testimonial-${i + 2}.jpg`,
  alt: `Client transformation ${i + 2}`,
}));

const graphImages = Array.from({ length: 6 }, (_, i) => ({
  src: `/images/graph-${i + 1}.jpg`,
  alt: `Weight loss graph ${i + 1}`,
}));

const allImages = [...testimonialImages, ...graphImages];

const TestimonialsSection = () => {
  const { lang } = useLanguage();
  const [selected, setSelected] = useState<{ src: string; alt: string } | null>(null);

  return (
    <section className="bg-background py-24">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-6 font-serif text-4xl font-bold text-foreground md:text-5xl">
            {t(translations.testimonials.title, lang)}
          </h2>
          <p className="mx-auto max-w-3xl font-sans text-xl font-light text-muted-foreground">
            {t(translations.testimonials.subtitle, lang)}
          </p>
        </div>

        {/* Unified Carousel */}
        <div className="mb-16">
          <Carousel
            className="mx-auto max-w-7xl"
            opts={{ align: "start", loop: true }}
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {allImages.map((image, i) => (
                <CarouselItem key={i} className="pl-2 md:basis-1/2 md:pl-4 lg:basis-1/3">
                  <div
                    className="h-[400px] cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-card shadow-gold-sm transition-all duration-300 hover:shadow-gold-md hover:border-gold/30"
                    onClick={() => setSelected(image)}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0" />
            <CarouselNext className="right-0" />
          </Carousel>
        </div>

        <div className="mt-20 text-center">
          <p className="mb-4 font-serif text-2xl text-foreground">
            {t(translations.testimonials.stat, lang)}{" "}
            <span className="text-3xl font-bold text-gold">{t(translations.testimonials.statHighlight, lang)}</span>{" "}
            {t(translations.testimonials.statEnd, lang)}
          </p>
          <p className="font-sans text-lg text-muted-foreground">
            {t(translations.testimonials.yourTurn, lang)}
          </p>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-hidden p-0">
          {selected && (
            <div className="flex items-center justify-center p-4">
              <img
                src={selected.src}
                alt={selected.alt}
                className="max-h-[90vh] max-w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default TestimonialsSection;
