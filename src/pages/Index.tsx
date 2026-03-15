import { useState, useEffect } from "react";
import LanguageToggle from "@/components/LanguageToggle";
import VSLSection from "@/components/VSLSection";
import HeroSection from "@/components/HeroSection";
import ProblemAgitation from "@/components/ProblemAgitation";
import TestimonialsSection from "@/components/TestimonialsSection";
import Solution from "@/components/Solution";
import StatsBar from "@/components/StatsBar";
import Benefits from "@/components/Benefits";
import EbookSection from "@/components/EbookSection";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import MailchimpPopup from "@/components/MailchimpPopup";
import AIChatBubble from "@/components/AIChatBubble";

const Index = () => {
  const [mailchimpOpen, setMailchimpOpen] = useState(false);
  const openMailchimp = () => setMailchimpOpen(true);

  useEffect(() => {
    const timer = setTimeout(() => setMailchimpOpen(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-xl">
        <span className="font-serif text-lg font-bold tracking-wide text-foreground sm:text-xl">
          ALEXANDROS <span className="text-gold">THE GREEK CARNIVORE</span>
        </span>
        <LanguageToggle />
      </header>

      <VSLSection />
      <HeroSection />
      <StatsBar />
      <ProblemAgitation />
      <TestimonialsSection />
      <Solution />
      <Benefits />
      <EbookSection onCtaClick={openMailchimp} />
      <ContactForm />
      <Footer />

      <MailchimpPopup open={mailchimpOpen} onOpenChange={setMailchimpOpen} />
      <AIChatBubble />
    </div>
  );
};

export default Index;
