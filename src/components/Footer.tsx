import { useLanguage } from "@/contexts/LanguageContext";
import { translations, t } from "@/lib/translations";

const Footer = () => {
  const { lang } = useLanguage();

  return (
    <footer className="border-t border-border/50 bg-charcoal py-16">
      <div className="container mx-auto px-4">
        <div className="mb-10 grid gap-10 md:grid-cols-3">
          <div>
            <h3 className="mb-4 font-serif text-2xl font-semibold text-foreground">The Greek Carnivore</h3>
            <p className="font-sans text-sm leading-relaxed text-muted-foreground">
              {t(translations.footer.desc, lang)}
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-sans text-[10px] font-medium uppercase tracking-[0.25em] text-gold">{t(translations.footer.quickLinks, lang)}</h4>
            <ul className="space-y-2">
              <li>
                <a href="#contact" className="font-sans text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {t(translations.contact.title, lang)}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-sans text-[10px] font-medium uppercase tracking-[0.25em] text-gold">{t(translations.footer.contactTitle, lang)}</h4>
            <p className="font-sans text-sm text-muted-foreground">
              Email: info@greekcarnivore.gr
            </p>
          </div>
        </div>

        <div className="border-t border-border/30 pt-8 text-center">
          <p className="font-sans text-xs text-muted-foreground">
            © {new Date().getFullYear()} Alexandros The Greek Carnivore. {t(translations.footer.rights, lang)}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
