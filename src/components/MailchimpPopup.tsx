import { useState, useRef } from "react";
import ebookCover from "@/assets/ebook-cover.png";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { X, CheckCircle, Mail, User } from "lucide-react";

interface MailchimpPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAILCHIMP_ACTION =
  "https://mc.us11.list-manage.com/subscribe/post?u=0aa29d0bbc126eac72dcf2030&id=3ef5803914";

const MailchimpPopup = ({ open, onOpenChange }: MailchimpPopupProps) => {
  const { lang } = useLanguage();
  const [fname, setFname] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ fname?: string; email?: string }>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isGr = lang === "gr";

  const validate = () => {
    const errs: { fname?: string; email?: string } = {};
    if (!fname.trim()) errs.fname = isGr ? "Το όνομα είναι υποχρεωτικό" : "Name is required";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = isGr ? "Μη έγκυρη διεύθυνση email" : "Invalid email address";
    return errs;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      e.preventDefault();
      setErrors(errs);
      return;
    }
    setErrors({});
    // Let the form POST to Mailchimp via the hidden iframe target
    // The iframe load event fires after submission
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.onload = () => setSubmitted(true);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      setSubmitted(false);
      setFname("");
      setEmail("");
      setErrors({});
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        hideClose
        className="p-0 overflow-hidden border-0 shadow-2xl
          w-[92vw] max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto"
      >
        {/* Hidden iframe to receive Mailchimp POST response */}
        <iframe
          ref={iframeRef}
          name="mailchimp-hidden"
          title="mailchimp-hidden"
          className="hidden"
          aria-hidden="true"
        />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 bg-background/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors"
          aria-label={isGr ? "Κλείσιμο" : "Close"}
        >
          <X className="h-4 w-4 text-foreground" />
        </button>

        {submitted ? (
          /* ── Success State ── */
          <div className="flex flex-col items-center justify-center text-center px-8 py-16 gap-6 bg-card h-full sm:h-auto">
            <div className="rounded-full bg-gold/10 p-5">
              <CheckCircle className="h-12 w-12 text-gold" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-2xl font-bold text-foreground">
                {isGr ? "Τέλεια! 🎉" : "Awesome! 🎉"}
              </h2>
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                {isGr
                  ? "Σε ευχαριστώ πάρα πολύ που ζήτησες το βιβλίο μου!\nΣε λίγο θα λάβεις το δωρεάν ebook στο email σου. Ρίξε μια ματιά και στα spam μήπως πήγε εκεί. Ελπίζω να το απολαύσεις!\n\nΑν παρ' όλα αυτά δεν έχεις λάβει κανένα email στο inbox σου, στείλε ένα μήνυμα στο info@thegreekcarnivore.com και γράψε στο κείμενο \"Μυστικό βιβλίο παρακαλώ\" για να λάβεις το αντίτυπό σου."
                  : "You'll receive the free ebook in your inbox shortly."}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="shimmer-gold mt-2 rounded-xl bg-gold px-8 py-3 font-sans text-sm font-semibold text-gold-foreground transition-all hover:opacity-90"
            >
              {isGr ? "Κλείσιμο" : "Close"}
            </button>
          </div>
        ) : (
          /* ── Form State ── */
          <div className="flex flex-col bg-card h-full sm:h-auto overflow-y-auto">
            {/* Header */}
            <div className="bg-gold px-6 pt-6 pb-5 text-gold-foreground text-center">
            <img
                src={ebookCover}
                alt="Το Μυστικό - The Greek Carnivore"
                className="h-32 w-auto mx-auto mb-2 drop-shadow-xl rounded-sm"
              />
              <h2 className="font-serif text-2xl font-bold leading-tight mb-2">
                {isGr ? "«Το Μυστικό»" : '"The Secret"'}
              </h2>
              <p className="font-sans text-gold-foreground/80 text-sm leading-relaxed">
                {isGr
                  ? "Λάβε δωρεάν τον πλήρη οδηγό για απώλεια βάρους"
                  : "Get the complete weight loss guide for free"}
              </p>
            </div>

            {/* Form */}
            <form
              action={MAILCHIMP_ACTION}
              method="POST"
              target="mailchimp-hidden"
              onSubmit={handleSubmit}
              className="flex flex-col gap-5 px-6 py-8 flex-1 sm:flex-auto"
              noValidate
            >
              {/* FNAME */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mc-FNAME"
                  className="font-sans text-sm font-semibold text-foreground/80"
                >
                  {isGr ? "Όνομα" : "First Name"}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="mc-FNAME"
                    type="text"
                    name="FNAME"
                    autoComplete="given-name"
                    value={fname}
                    onChange={(e) => {
                      setFname(e.target.value);
                      if (errors.fname) setErrors((p) => ({ ...p, fname: undefined }));
                    }}
                    placeholder={isGr ? "π.χ. Αλέξανδρος" : "e.g. John"}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-background font-sans text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
                      errors.fname ? "border-destructive" : "border-input"
                    }`}
                  />
                </div>
                {errors.fname && (
                  <p className="font-sans text-destructive text-xs">{errors.fname}</p>
                )}
              </div>

              {/* EMAIL */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mc-EMAIL"
                  className="font-sans text-sm font-semibold text-foreground/80"
                >
                  {isGr ? "Διεύθυνση email" : "Email Address"}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="mc-EMAIL"
                    type="email"
                    name="EMAIL"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                    }}
                    placeholder={isGr ? "π.χ. email@gmail.com" : "e.g. email@gmail.com"}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-background font-sans text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
                      errors.email ? "border-destructive" : "border-input"
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="font-sans text-destructive text-xs">{errors.email}</p>
                )}
              </div>

              {/* Honeypot — must stay hidden */}
              <div style={{ position: "absolute", left: "-5000px" }} aria-hidden="true">
                <input
                  type="text"
                  name="b_0aa29d0bbc126eac72dcf2030_729213"
                  tabIndex={-1}
                  defaultValue=""
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="shimmer-gold w-full rounded-xl bg-gold py-4 font-sans text-base font-semibold text-gold-foreground shadow-gold-sm hover:opacity-90 active:scale-[0.98] transition-all mt-1"
              >
                {isGr ? "Λάβε τώρα το βιβλίο 📩" : "Get the book now 📩"}
              </button>

              <p className="text-center font-sans text-xs text-muted-foreground leading-relaxed">
                {isGr
                  ? "🔒 Τα στοιχεία σου είναι ασφαλή. Χωρίς spam, ποτέ."
                  : "🔒 Your info is safe. No spam, ever."}
              </p>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MailchimpPopup;

