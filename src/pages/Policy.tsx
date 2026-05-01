import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const Policy = () => {
  const { lang, toggleLanguage } = useLanguage();
  const isGreek = lang === "el";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)] dark:[background-image:none]" />

      {/* Language toggle */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-0.5 rounded-xl border border-border/50 glass-card p-1 text-xs font-sans font-medium shadow-lg shadow-black/5">
          <button
            onClick={() => lang !== "en" && toggleLanguage()}
            className={cn(
              "rounded-md px-2 py-1 transition-all duration-200",
              lang === "en" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            EN
          </button>
          <button
            onClick={() => lang !== "el" && toggleLanguage()}
            className={cn(
              "rounded-md px-2 py-1 transition-all duration-200",
              lang === "el" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Ελ
          </button>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 pt-20 pb-24">
        <div className="text-center">
          <img src={logo} alt="The Greek Carnivore" className="mx-auto h-12 w-auto" />
          <p className="mt-6 text-[11px] font-sans uppercase tracking-[0.35em] text-gold font-semibold">
            {isGreek ? "Όροι & Πολιτική" : "Terms & Policy"}
          </p>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {isGreek ? "Διαφάνεια. Κανένα ψιλά γράμματα." : "Transparent. No fine print."}
          </h1>
        </div>

        <div className="mt-16 space-y-12 font-sans text-sm leading-relaxed text-muted-foreground">
          {/* Section: What this is */}
          <section>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              {isGreek ? "Τι είναι η Μεταμόρφωση" : "What Metamorphosis is"}
            </h2>
            <p className="mt-4">
              {isGreek
                ? "Η Μεταμόρφωση είναι πρόγραμμα lifestyle coaching και εκπαίδευσης γύρω από τον τρόπο διατροφής και ζωής που ακολουθώ εγώ ο ίδιος. Είναι καθοδήγηση βάσει της δικής μου εμπειρίας και αυτών που έχω δει με δεκάδες πελάτες."
                : "Metamorphosis is a lifestyle coaching and education program centered on the way of eating and living I follow myself. It is guidance grounded in my own experience and what I've seen with dozens of clients."}
            </p>
          </section>

          {/* Section: Medical disclaimer — the core legal protection */}
          <section>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              {isGreek ? "Δεν είναι ιατρική συμβουλή" : "Not medical advice"}
            </h2>
            <p className="mt-4">
              {isGreek
                ? "Δεν είμαι γιατρός ούτε διαιτολόγος. Η Μεταμόρφωση δεν αντικαθιστά ιατρική συμβουλή, διάγνωση ή θεραπεία. Δεν συνταγογραφώ διατροφή για ασθένειες, δεν θεραπεύω καταστάσεις, δεν δίνω ιατρικές οδηγίες. Είμαι coach — μοιράζομαι ένα πλαίσιο διαβίωσης που έχει δουλέψει για μένα και για τους ανθρώπους που έχω συνεργαστεί."
                : "I am not a physician or a registered dietitian. Metamorphosis does not replace medical advice, diagnosis or treatment. I do not prescribe diets for diseases, I do not treat conditions, I do not give medical instructions. I am a coach — I share a way of living that has worked for me and for the people I've worked with."}
            </p>
            <p className="mt-4">
              {isGreek
                ? "Πριν από οποιαδήποτε αλλαγή στη διατροφή ή στον τρόπο ζωής σου, συμβουλέψου τον γιατρό σου. Αυτό ισχύει διπλά αν λαμβάνεις φαρμακευτική αγωγή, έχεις χρόνια ή προϋπάρχουσα κατάσταση (π.χ. καρδιαγγειακή, μεταβολική, ορμονική, νεφρική, ηπατική, εγκυμοσύνη, διατροφική διαταραχή στο ιστορικό σου), ή έχεις παιδί κάτω των 18 ετών που σκέφτεσαι να εντάξεις."
                : "Before any change to your diet or lifestyle, consult your physician. This is doubly true if you are on medication, have a chronic or pre-existing condition (e.g. cardiovascular, metabolic, hormonal, kidney, liver, pregnancy, eating-disorder history) or have a child under 18 you are thinking of including."}
            </p>
            <p className="mt-4">
              {isGreek
                ? "Αν εντοπιστούν σήματα κρίσης (αυτοτραυματισμός, διατροφική διαταραχή, ιατρικό επείγον), η εφαρμογή σε κατευθύνει σε επαγγελματική γραμμή βοήθειας. Αυτό είναι το όριο — εκεί χρειάζεται γιατρός, όχι coach."
                : "If crisis signals are detected (self-harm, eating disorder, medical emergency), the app routes you to a professional helpline. That's the line — that needs a physician, not a coach."}
            </p>
          </section>

          {/* Section: Results guarantee — the new conditional refund */}
          <section>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              {isGreek ? "Εγγύηση αποτελέσματος" : "Results guarantee"}
            </h2>
            <p className="mt-4">
              {isGreek
                ? "Πιστεύω σ' αυτό που χτίζω. Γι' αυτό δίνω εγγύηση αποτελέσματος αντί για γενικευμένη επιστροφή χρημάτων. Είναι πιο τίμιο για σένα και για το πρόγραμμα."
                : "I believe in what I'm building. That's why I offer a results guarantee instead of a generic money-back. It's more honest — for you and for the program."}
            </p>
            <p className="mt-4 font-medium text-foreground">
              {isGreek
                ? "Αν ακολουθήσεις το πρόγραμμα όπως ορίζεται και δεν δεις αποτελέσματα στην απώλεια βάρους μετά από 60 ημέρες, σου επιστρέφω τα χρήματα."
                : "If you follow the program as defined and see no weight-loss results after 60 days, I refund you."}
            </p>
            <p className="mt-4">
              {isGreek
                ? "Τι θεωρείται «να ακολουθείς το πρόγραμμα» (η εφαρμογή το παρακολουθεί αυτόματα — δεν χρειάζεται καμία γραφειοκρατία από σένα):"
                : "What counts as \"following the program\" (the app tracks this automatically — no paperwork from you):"}
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>
                {isGreek
                  ? "Ημερήσιο logging γευμάτων τουλάχιστον στο 80% των ημερών"
                  : "Daily meal logging on at least 80% of days"}
              </li>
              <li>
                {isGreek
                  ? "Εβδομαδιαία ζυγαριά καταγεγραμμένη"
                  : "Weekly weigh-in recorded"}
              </li>
              <li>
                {isGreek
                  ? "Ενεργή χρήση του εβδομαδιαίου meal plan"
                  : "Active use of the weekly meal plan"}
              </li>
              <li>
                {isGreek
                  ? "Ανάγνωση τουλάχιστον των πρώτων κεφαλαίων του βιβλίου που είναι ενσωματωμένο στην εφαρμογή"
                  : "Reading at least the opening chapters of the book inside the app"}
              </li>
            </ul>
            <p className="mt-4">
              {isGreek
                ? "Αν πληρείς τα παραπάνω και δεν υπάρχει μεταβολή βάρους μετά από 60 ημέρες, στείλε μου μήνυμα μέσα από την εφαρμογή. Επιστρέφω το ποσό μέσω Stripe εντός 7 εργάσιμων ημερών."
                : "If you meet the above and there is no weight change after 60 days, message me through the app. I refund through Stripe within 7 business days."}
            </p>
            <p className="mt-4 text-xs text-muted-foreground/70">
              {isGreek
                ? "Σημείωση: η εγγύηση αναφέρεται στην απώλεια βάρους — όχι στην εξάλειψη οποιασδήποτε ιατρικής κατάστασης. Δες πιο πάνω «Δεν είναι ιατρική συμβουλή»."
                : "Note: the guarantee refers to weight loss — not to the elimination of any medical condition. See \"Not medical advice\" above."}
            </p>
          </section>

          {/* Section: Subscription */}
          <section>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              {isGreek ? "Συνδρομή & ακύρωση" : "Subscription & cancellation"}
            </h2>
            <p className="mt-4">
              {isGreek
                ? "Η συνδρομή είναι €47/μήνα και τιμολογείται μέσω Stripe. Μπορείς να ακυρώσεις τη συνδρομή σου οποιαδήποτε στιγμή μέσα από το προφίλ σου ή απευθείας στο Stripe. Η ακύρωση σταματά τη μελλοντική χρέωση — δεν επιστρέφει αυτόματα τον τρέχοντα μήνα παρά μόνο μέσω της εγγύησης αποτελέσματος παραπάνω."
                : "The subscription is €47/month, billed through Stripe. You can cancel your subscription any time from your profile or directly in Stripe. Cancellation stops future charges — it does not automatically refund the current month except through the results guarantee above."}
            </p>
          </section>

          {/* Section: Privacy */}
          <section>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              {isGreek ? "Προσωπικά δεδομένα" : "Personal data"}
            </h2>
            <p className="mt-4">
              {isGreek
                ? "Τα δεδομένα που μου εμπιστεύεσαι (μετρήσεις, σημειώσεις, ιστορικό, μηνύματα) χρησιμοποιούνται αποκλειστικά για την παροχή του προγράμματος. Δεν πωλούνται. Δεν μοιράζονται με τρίτους πέρα από τους απαραίτητους παρόχους υποδομής (Supabase για βάση δεδομένων, Stripe για πληρωμές, Anthropic/OpenAI για επεξεργασία κειμένου). Μπορείς να ζητήσεις διαγραφή του λογαριασμού σου οποτεδήποτε από τη σελίδα προφίλ."
                : "The data you entrust to me (measurements, notes, history, messages) is used solely to deliver the program. It is not sold. It is not shared with third parties beyond the infrastructure providers required (Supabase for the database, Stripe for payments, Anthropic/OpenAI for text processing). You can request deletion of your account at any time from the profile page."}
            </p>
          </section>

          {/* Section: Contact */}
          <section>
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              {isGreek ? "Επικοινωνία" : "Contact"}
            </h2>
            <p className="mt-4">
              {isGreek
                ? "Για οποιοδήποτε ερώτημα — εγγύηση, διαγραφή λογαριασμού, ή απλώς αν θες να μιλήσουμε — γράψε μου στο "
                : "For any question — guarantee, account deletion, or just to talk — write to me at "}
              <a href="mailto:info@thegreekcarnivore.com" className="underline hover:text-foreground">
                info@thegreekcarnivore.com
              </a>
              {isGreek ? "." : "."}
            </p>
          </section>

          {/* Last updated */}
          <p className="pt-8 text-center text-xs text-muted-foreground/60">
            {isGreek ? "Τελευταία ενημέρωση: 30 Απριλίου 2026" : "Last updated: 30 April 2026"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Policy;
