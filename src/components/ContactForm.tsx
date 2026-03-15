import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations, t } from "@/lib/translations";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, User } from "lucide-react";
import { z } from "zod";

type ContactFormData = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

const ContactForm = () => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});

  const getSchema = () =>
    z.object({
      name: z.string().trim().min(1, t(translations.contact.errors.nameRequired, lang)).max(100, t(translations.contact.errors.nameMax, lang)),
      email: z.string().trim().email(t(translations.contact.errors.emailInvalid, lang)).max(255, t(translations.contact.errors.emailMax, lang)),
      phone: z.string().trim().regex(/^[0-9+\s()-]{7,20}$/, t(translations.contact.errors.phoneInvalid, lang)).optional().or(z.literal("")),
      message: z.string().trim().min(10, t(translations.contact.errors.messageMin, lang)).max(2000, t(translations.contact.errors.messageMax, lang)),
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      getSchema().parse(formData);
      toast({
        title: t(translations.contact.successTitle, lang),
        description: t(translations.contact.successDesc, lang),
      });
      setFormData({ name: "", email: "", phone: "", message: "" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof ContactFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast({
          title: t(translations.contact.errorTitle, lang),
          description: t(translations.contact.errorDesc, lang),
          variant: "destructive",
        });
      }
    }
  };

  return (
    <section id="contact" className="bg-background py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-serif text-4xl font-bold text-foreground md:text-5xl">
              {t(translations.contact.title, lang)}
            </h2>
            <p className="font-sans text-xl font-light text-muted-foreground">
              {t(translations.contact.subtitle, lang)}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border/50 bg-card p-8 shadow-gold-md">
            <div>
              <Label htmlFor="name" className="mb-2 flex items-center gap-2 font-sans text-sm font-medium text-foreground/80">
                <User className="h-4 w-4 text-gold" />
                {t(translations.contact.name, lang)}
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={100}
                required
                className="border-border/50 bg-background font-sans text-foreground focus-visible:ring-gold"
              />
              {errors.name && <p className="mt-1 font-sans text-sm text-destructive">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="email" className="mb-2 flex items-center gap-2 font-sans text-sm font-medium text-foreground/80">
                <Mail className="h-4 w-4 text-gold" />
                {t(translations.contact.email, lang)}
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                maxLength={255}
                required
                className="border-border/50 bg-background font-sans text-foreground focus-visible:ring-gold"
              />
              {errors.email && <p className="mt-1 font-sans text-sm text-destructive">{errors.email}</p>}
            </div>

            <div>
              <Label htmlFor="phone" className="mb-2 flex items-center gap-2 font-sans text-sm font-medium text-foreground/80">
                <Phone className="h-4 w-4 text-gold" />
                {t(translations.contact.phone, lang)}
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                maxLength={20}
                className="border-border/50 bg-background font-sans text-foreground focus-visible:ring-gold"
              />
              {errors.phone && <p className="mt-1 font-sans text-sm text-destructive">{errors.phone}</p>}
            </div>

            <div>
              <Label htmlFor="message" className="mb-2 block font-sans text-sm font-medium text-foreground/80">
                {t(translations.contact.message, lang)}
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                maxLength={2000}
                required
                rows={5}
                className="border-border/50 bg-background font-sans text-foreground focus-visible:ring-gold"
                placeholder={t(translations.contact.placeholder, lang)}
              />
              {errors.message && <p className="mt-1 font-sans text-sm text-destructive">{errors.message}</p>}
            </div>

            <button
              type="submit"
              className="shimmer-gold gold-glow w-full rounded-xl bg-gold py-4 font-sans text-base font-semibold text-gold-foreground shadow-gold-sm transition-all duration-200 hover:opacity-90"
            >
              {t(translations.contact.submit, lang)}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
