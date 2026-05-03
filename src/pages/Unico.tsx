import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import EmbeddedMetamorphosisCheckout from "@/components/checkout/EmbeddedMetamorphosisCheckout";
import {
  BookOpen,
  Camera,
  Check,
  ChefHat,
  Clock,
  Flame,
  Library,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";

// ─── Phone mockup primitives ────────────────────────────────────────
// Lightweight CSS-only iPhone-style frame containing simulated app screens.
// Built with the app's own Tailwind tokens so the mockups visually match
// the real product. Swap each Screen* body for a real screenshot later.

type PhoneFrameProps = {
  children: React.ReactNode;
  caption: string;
  className?: string;
};

const PhoneFrame = ({ children, caption, className }: PhoneFrameProps) => (
  <div className={cn("flex flex-col items-center", className)}>
    <div className="relative w-[280px] rounded-[2.5rem] border-[10px] border-foreground/85 bg-foreground/85 p-0 shadow-2xl shadow-black/20">
      {/* Notch */}
      <div className="absolute left-1/2 top-1.5 z-20 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-foreground/85" />
      {/* Screen */}
      <div className="relative h-[560px] overflow-hidden rounded-[1.75rem] bg-background">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-sans font-semibold text-foreground">
          <span>9:41</span>
          <span>•••</span>
        </div>
        {/* App content */}
        <div className="h-[calc(100%-28px)] overflow-hidden px-4 pt-2">{children}</div>
      </div>
    </div>
    <p className="mt-4 text-center font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">
      {caption}
    </p>
  </div>
);

// Screen 1 — Today (Σήμερα): the daily home view
const ScreenToday = ({ isGreek }: { isGreek: boolean }) => (
  <div className="flex h-full flex-col">
    <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">
      {isGreek ? "ΣΉΜΕΡΑ · ΗΜΈΡΑ 23" : "TODAY · DAY 23"}
    </p>
    <h3 className="mt-1 font-serif text-xl font-semibold text-foreground">
      {isGreek ? "Καλημέρα, Νίκο" : "Morning, Nick"}
    </h3>
    <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
          {isGreek ? "Τα γεύματα σήμερα" : "Today's meals"}
        </p>
        <span className="text-[10px] font-sans text-gold">3/3</span>
      </div>
      <div className="mt-2 space-y-1.5 text-xs font-sans">
        <div className="flex items-center gap-2 text-foreground">
          <Check className="h-3 w-3 text-gold" />
          <span className="line-through opacity-60">{isGreek ? "Πρωινό · Αυγά + βούτυρο" : "Breakfast · Eggs + butter"}</span>
        </div>
        <div className="flex items-center gap-2 text-foreground">
          <Check className="h-3 w-3 text-gold" />
          <span className="line-through opacity-60">{isGreek ? "Μεσημέρι · Ribeye 250γρ" : "Lunch · Ribeye 250g"}</span>
        </div>
        <div className="flex items-center gap-2 text-foreground">
          <div className="h-3 w-3 rounded-full border border-gold/50" />
          <span>{isGreek ? "Βράδυ · Σαρδέλες + αυγό" : "Dinner · Sardines + egg"}</span>
        </div>
      </div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-border/60 bg-card p-3">
        <Camera className="h-4 w-4 text-gold" />
        <p className="mt-1 text-[10px] font-sans font-semibold text-foreground">
          {isGreek ? "Ανέβασε γεύμα" : "Log a meal"}
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-3">
        <MessageCircle className="h-4 w-4 text-gold" />
        <p className="mt-1 text-[10px] font-sans font-semibold text-foreground">
          {isGreek ? "Ρώτα τον Σύμβουλο" : "Ask the Σύμβουλος"}
        </p>
      </div>
    </div>
    <div className="mt-3 rounded-xl border border-border/60 bg-card p-3">
      <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
        {isGreek ? "Ζυγαριά αυτή την εβδομάδα" : "This week's weigh-in"}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-serif text-xl font-semibold text-foreground">−1,4</span>
        <span className="text-[10px] font-sans text-gold">{isGreek ? "κιλά" : "kg"}</span>
      </div>
    </div>
  </div>
);

// Screen 2 — Σύμβουλος chat: in-app advisor, available 24/7
const ScreenChat = ({ isGreek }: { isGreek: boolean }) => (
  <div className="flex h-full flex-col">
    <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">
      {isGreek ? "ΣΎΜΒΟΥΛΟΣ" : "ΣΥΜΒΟΥΛΟΣ"}
    </p>
    <h3 className="mt-1 font-serif text-xl font-semibold text-foreground">
      {isGreek ? "Ο Σύμβουλος του Αλέξανδρου" : "Alex's Σύμβουλος"}
    </h3>
    <div className="mt-4 flex-1 space-y-2 overflow-hidden">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-gold/15 px-3 py-2">
        <p className="text-[11px] font-sans text-foreground">
          {isGreek
            ? "Ξενύχτησα και θέλω να φάω ψωμί. Τι κάνω;"
            : "I'm up late and I want bread. What do I do?"}
        </p>
      </div>
      <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 ring-1 ring-border/60">
        <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-gold">
          {isGreek ? "Σύμβουλος" : "Σύμβουλος"}
        </p>
        <p className="mt-1 text-[11px] font-sans leading-relaxed text-foreground">
          {isGreek
            ? "Δεν είναι πείνα — είναι κούραση. Φάε δύο αυγά με βούτυρο. Σε 8 λεπτά θα ξεχάσεις το ψωμί."
            : "It's not hunger — it's tiredness. Have two eggs with butter. In 8 minutes you'll forget the bread."}
        </p>
      </div>
      <div className="mr-auto max-w-[60%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 ring-1 ring-border/60">
        <p className="text-[11px] font-sans text-muted-foreground">
          {isGreek ? "Θες να σου πω γιατί;" : "Want me to tell you why?"}
        </p>
      </div>
    </div>
    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2">
      <span className="text-[11px] font-sans text-muted-foreground">
        {isGreek ? "Γράψε..." : "Type..."}
      </span>
    </div>
  </div>
);

// Screen 3 — Photo analysis: snap and verdict
const ScreenPhoto = ({ isGreek }: { isGreek: boolean }) => (
  <div className="flex h-full flex-col">
    <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">
      {isGreek ? "ΑΝΆΛΥΣΗ ΓΕΎΜΑΤΟΣ" : "MEAL CHECK"}
    </p>
    <h3 className="mt-1 font-serif text-xl font-semibold text-foreground">
      {isGreek ? "Είναι μέσα στα όριά σου;" : "Does it fit?"}
    </h3>
    {/* Faux meal photo */}
    <div className="mt-4 aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-amber-700 via-amber-900 to-stone-900 ring-1 ring-border/40">
      <div className="flex h-full w-full items-center justify-center">
        <Flame className="h-16 w-16 text-amber-200/40" />
      </div>
    </div>
    <div className="mt-3 rounded-2xl border border-gold/40 bg-gold/10 p-3">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-gold" />
        <p className="text-xs font-sans font-semibold text-foreground">
          {isGreek ? "Μέσα στα όριά σου" : "Inside your limits"}
        </p>
      </div>
      <p className="mt-1 text-[11px] font-sans leading-relaxed text-muted-foreground">
        {isGreek
          ? "Ribeye + βούτυρο. Καλή επιλογή για το βράδυ — μην προσθέσεις σάλτσα."
          : "Ribeye + butter. Good evening choice — skip the sauce."}
      </p>
    </div>
    <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px] font-sans">
      <div className="rounded-lg bg-card py-1.5 ring-1 ring-border/60">
        <p className="text-muted-foreground">{isGreek ? "Πρωτεΐνη" : "Protein"}</p>
        <p className="font-semibold text-foreground">52γρ</p>
      </div>
      <div className="rounded-lg bg-card py-1.5 ring-1 ring-border/60">
        <p className="text-muted-foreground">{isGreek ? "Λίπη" : "Fat"}</p>
        <p className="font-semibold text-foreground">38γρ</p>
      </div>
      <div className="rounded-lg bg-card py-1.5 ring-1 ring-border/60">
        <p className="text-muted-foreground">{isGreek ? "Υδ/κες" : "Carbs"}</p>
        <p className="font-semibold text-foreground">0γρ</p>
      </div>
    </div>
  </div>
);

// Screen 4 — Weekly rhythm: Mon/Wed/Fri/Sun cadence
const ScreenRhythm = ({ isGreek }: { isGreek: boolean }) => {
  const daysEl = ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"];
  const daysEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = isGreek ? daysEl : daysEn;
  const checkpoints = [0, 2, 4, 6]; // Mon, Wed, Fri, Sun
  return (
    <div className="flex h-full flex-col">
      <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">
        {isGreek ? "ΡΥΘΜΌΣ" : "RHYTHM"}
      </p>
      <h3 className="mt-1 font-serif text-xl font-semibold text-foreground">
        {isGreek ? "Εβδομάδα 4" : "Week 4"}
      </h3>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const isCheck = checkpoints.includes(i);
          const isDone = i < 4;
          return (
            <div key={d} className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-sans uppercase tracking-wider text-muted-foreground">{d}</span>
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-sans font-semibold",
                  isCheck && isDone && "bg-gold text-gold-foreground",
                  isCheck && !isDone && "border-2 border-gold/40 text-gold",
                  !isCheck && "border border-border/60 text-muted-foreground/40",
                )}
              >
                {isCheck && isDone ? <Check className="h-3.5 w-3.5" /> : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-2xl border border-border/60 bg-card p-3">
        <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
          {isGreek ? "Αναφορά Παρασκευής" : "Friday report"}
        </p>
        <p className="mt-1 text-[11px] font-sans leading-relaxed text-foreground">
          {isGreek
            ? "Συνέπεια 92%. Βάρος −1,4 κιλά. Ενέργεια ↑. Συνέχισε όπως πας."
            : "Compliance 92%. Weight −1.4kg. Energy ↑. Stay the course."}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-gold/30 bg-gold/5 p-3">
        <Sparkles className="h-4 w-4 text-gold" />
        <p className="text-[11px] font-sans text-foreground">
          {isGreek ? "Ορόσημο 30 ημερών — βίντεο από εμένα" : "Day-30 milestone — video from me"}
        </p>
      </div>
    </div>
  );
};

const FEATURES = [
  {
    icon: MessageCircle,
    el: { title: "Απάντηση όποτε τη χρειάζεσαι", body: "Στις 11 το βράδυ της Παρασκευής. Στο διάλειμμα δουλειάς. Όταν η όρεξη φεύγει. Ο Σύμβουλος του Αλέξανδρου σου απαντάει στη στιγμή — με βάση τη μέθοδό του και ό,τι έχεις καταγράψει στην εφαρμογή." },
    en: { title: "An answer the moment you need it", body: "11pm on a Friday. The lunch break. When motivation slips. Alex's Σύμβουλος answers instantly — drawing on his method and everything you've logged in the app." },
  },
  {
    icon: Video,
    el: { title: "Όλα τα βίντεο του Αλέξανδρου, ξεκλείδωτα", body: "Κάθε φάση, κάθε ορόσημο, κάθε δύσκολη στιγμή του προγράμματος. Τα βίντεο που έχει γυρίσει ο Αλέξανδρος, οργανωμένα ώστε να βρίσκεις αυτό που χρειάζεσαι σε ένα κλικ." },
    en: { title: "Every Alex video, unlocked", body: "Every phase, every milestone, every hard moment of the program. Alex's recorded videos, organised so you find what you need in one tap." },
  },
  {
    icon: BookOpen,
    el: { title: "Διαβάζεις, σημειώνεις, εφαρμόζεις", body: "Όλο το βιβλίο μέσα στην εφαρμογή. Οι σημειώσεις σου συνδέονται με τα εργαλεία σου. Τίποτα δεν χάνεται." },
    en: { title: "Read, note, apply — all in one place", body: "The full book inside the app. Your notes link straight to your tools. Nothing slips." },
  },
  {
    icon: ChefHat,
    el: { title: "Ξέρεις τι θα φας κάθε μέρα", body: "Κάθε Κυριακή, ένα πλάνο φτιαγμένο για σένα — με βάση τους στόχους σου, τις αλλεργίες, και τι έφαγες ήδη. Δεν χρειάζεται να το σκέφτεσαι." },
    en: { title: "You know what you're eating, every day", body: "Every Sunday, a plan built for you — your goals, your allergies, what you've eaten. You don't think about it." },
  },
  {
    icon: Camera,
    el: { title: "Πάρε ένα 'σωστά' σε δευτερόλεπτα", body: "Στείλε μια φωτογραφία γεύματος. Ξέρεις αμέσως αν είναι μέσα στα όριά σου ή τι να αλλάξεις. Όσες φορές θέλεις." },
    en: { title: "Get a 'yes' or 'change this' in seconds", body: "Snap a meal photo. Know instantly if it fits, or what to swap. As often as you want." },
  },
  {
    icon: Library,
    el: { title: "Δεν μένεις ποτέ χωρίς απάντηση — ούτε στο εξωτερικό", body: "Συνταγές, λίστες αγορών, εστιατόρια κοντά σου, οδηγοί ταξιδιού. Όπου κι αν είσαι, ξέρεις πού να φας σωστά." },
    en: { title: "Never stuck — not even abroad", body: "Recipes, shopping lists, restaurants near you, travel guides. Wherever you are, you know where to eat right." },
  },
  {
    icon: Clock,
    el: { title: "Ένας ρυθμός που σε κρατά", body: "Δευτέρα–Τετάρτη–Παρασκευή–Κυριακή. Σύντομες αναφορές που σε κρατούν συνεπή χωρίς να σε κουράζουν." },
    en: { title: "A rhythm that holds you", body: "Mon–Wed–Fri–Sun. Short check-ins that keep you consistent without burning you out." },
  },
  {
    icon: Sparkles,
    el: { title: "Με βλέπεις στις δύσκολες στιγμές", body: "Πλατό, σαββατοκύριακο, ορόσημο 30 ημερών. Σου στέλνω ένα κοντό βίντεο όταν το χρειάζεσαι περισσότερο." },
    en: { title: "I show up at the hard moments", body: "Plateau, weekend, day-30 milestone. You get a short video from me right when you need it most." },
  },
];

const PHILOSOPHY = {
  el: [
    "Δεν χρειάζεσαι ένα ακόμα πρόγραμμα. Χρειάζεσαι ένα σύστημα που σε κρατά συνεπή όταν η όρεξη φεύγει.",
    "Αυτή είναι η μόνη μου προσφορά. Ένα πρόγραμμα. Όλα μέσα. Δεν περιμένεις.",
    "Ξέρεις τι να φας. Αυτό που σου λείπει είναι ο ρυθμός — και κάποιος που να σε καταλαβαίνει στις 11 το βράδυ της Παρασκευής.",
  ],
  en: [
    "You don't need another program. You need a system that keeps you consistent when motivation fades.",
    "This is my only offer. One program. Everything inside. You don't wait.",
    "You already know what to eat. What you lack is rhythm — and someone who gets it at 11pm on a Friday.",
  ],
};

const FAQ = {
  el: [
    {
      q: "Πώς παίρνω απάντηση όταν τη χρειάζομαι;",
      a: "Όποτε γράψεις, παίρνεις απάντηση από τον Σύμβουλο μέσα στην εφαρμογή — διαθέσιμο 24/7, στηριγμένο στη μέθοδο του Αλέξανδρου και στο intake σου. Τα εβδομαδιαία πλάνα, οι αναφορές και τα prompts ξεκινούν μόνα τους. Δεν είναι 1-on-1 με τον Αλέξανδρο — είναι ο Σύμβουλος που έχει χτίσει για να σε υποστηρίζει χωρίς αναμονή.",
    },
    {
      q: "Έχει εγγύηση;",
      a: "Ναι, εγγύηση αποτελέσματος. Αν ακολουθήσεις το πρόγραμμα όπως ορίζεται και δεν δεις αποτελέσματα στην απώλεια βάρους μετά από 60 ημέρες, σου επιστρέφω τα χρήματα. Η συμμόρφωση τεκμηριώνεται μέσα από την εφαρμογή — δεν χρειάζεται γραφειοκρατία. Δες τους πλήρεις όρους στη σελίδα Όροι & Πολιτική.",
    },
    {
      q: "Έχω ήδη κάποιο πρόγραμμά σου. Τι γίνεται με αυτό;",
      a: "Συνεχίζει κανονικά μέχρι να αποφασίσεις να μεταφερθείς στη Μεταμόρφωση. Δεν χάνεις τίποτα — όταν θες αλλαγή, σου επιστρέφω την αναλογία που έχεις πληρώσει επιπλέον.",
    },
    {
      q: "Ξέρει τη δική μου περίπτωση;",
      a: "Ναι. Στο intake λες τον στόχο σου, τη μεγαλύτερη δυσκολία, τους περιορισμούς (αλλεργίες, τι δεν τρως), το επίπεδο μαγειρικής, ακόμα και τι σε φοβίζει. Ο Σύμβουλος αυτό το διαβάζει σε κάθε σου ερώτηση και απαντάει στοχευμένα — με τα δικά σου δεδομένα. Δεν παίρνεις γενικές οδηγίες.",
    },
    {
      q: "Άκυρο όποτε θες;",
      a: "Ναι. Ακυρώνεις από τη σελίδα Χρεώσεις μέσα στην εφαρμογή ή απευθείας στο Stripe — χωρίς ποινή, χωρίς διαπραγμάτευση. Η ακύρωση τερματίζει την επόμενη ημέρα ανανέωσης. Παράλληλα έχεις και την εγγύηση 60 ημερών αν τηρήσεις πιστά το πρόγραμμα.",
    },
  ],
  en: [
    {
      q: "How do I get an answer when I need one?",
      a: "Whenever you write, the Σύμβουλος inside the app responds — available 24/7, grounded in Alex's method and your intake. Weekly meal plans, reports and prompts run on their own. It's not 1-on-1 with Alex — it's the Σύμβουλος he built so you don't have to wait.",
    },
    {
      q: "Is there a guarantee?",
      a: "Yes — a results guarantee. If you follow the program as defined and see no weight-loss results after 60 days, I refund you. Compliance is tracked through the app — no paperwork. See full terms on the Terms & Policy page.",
    },
    {
      q: "I already have one of your programs. What happens to it?",
      a: "It keeps running as normal until you decide to move to Metamorphosis. When you switch, I'll refund the pro-rated difference of what you've already paid.",
    },
    {
      q: "Does it know my specific case?",
      a: "Yes. At intake you share your goal, biggest struggle, restrictions (allergies, what you don't eat), cooking skill, even what scares you. The Σύμβουλος reads that on every question and answers with your data. You don't get generic advice.",
    },
    {
      q: "Cancel anytime?",
      a: "Yes. Cancel from the Billing page inside the app or directly in Stripe — no penalty, no negotiation. Cancellation ends at the next renewal date. The 60-day results guarantee runs alongside it if you've followed the program.",
    },
  ],
};

const Unico = () => {
  const navigate = useNavigate();
  const { lang, toggleLanguage } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const isGreek = lang === "el";
  const wasCanceled = searchParams.get("canceled") === "1";

  const handleCheckout = () => {
    setError(null);
    setCheckoutOpen(true);
  };

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

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-24">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <img src={logo} alt="The Greek Carnivore" className="mx-auto h-16 w-auto" />
          <p className="mt-6 text-[11px] font-sans uppercase tracking-[0.35em] text-gold font-semibold">
            {isGreek ? "Μεταμόρφωση · Ένα πρόγραμμα" : "Metamorphosis · One program"}
          </p>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
            {isGreek ? "Χάσε βάρος μία φορά. Κράτα τον ρυθμό για πάντα." : "Lose the weight once. Keep the rhythm forever."}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl font-sans text-base leading-relaxed text-muted-foreground sm:text-lg">
            {isGreek
              ? "Ένα σύστημα που σε κρατά συνεπή. Ο Σύμβουλος του Αλέξανδρου, διαθέσιμος όποτε τον χρειάζεσαι. Ένας ρυθμός που συνεχίζει ακόμα κι όταν χάνεις την όρεξη."
              : "A system that keeps you consistent. Alex's Σύμβουλος, available whenever you need it. A rhythm that holds even when motivation doesn't."}
          </p>

          {/* Pricing card */}
          <div className="mx-auto mt-10 max-w-md rounded-[2rem] border border-gold/40 bg-background/80 p-7 shadow-2xl shadow-black/5 backdrop-blur">
            <div className="flex items-center justify-center gap-1 text-foreground">
              <span className="font-serif text-5xl font-semibold">€47</span>
              <span className="font-sans text-sm text-muted-foreground">/{isGreek ? "μήνα" : "month"}</span>
            </div>
            <p className="mt-2 font-sans text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {isGreek ? "Ένα τίμημα. Όλα μέσα." : "One price. Everything inside."}
            </p>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="shimmer-gold mt-6 flex w-full items-center justify-center rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 shadow-gold-md"
            >
              {loading
                ? (isGreek ? "Φόρτωση..." : "Loading...")
                : (isGreek ? "Ξεκίνα τώρα" : "Start now")}
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-sans text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" />
              <span>
                {isGreek ? "Εγγύηση 60 ημερών · Άκυρο όποτε θες · " : "60-day guarantee · Cancel anytime · "}
                <a href="/policy" className="underline hover:text-foreground">
                  {isGreek ? "Όροι" : "Terms"}
                </a>
              </span>
            </div>

            {wasCanceled && (
              <p className="mt-3 text-xs text-muted-foreground">
                {isGreek ? "Ακυρώσατε τη χρέωση. Όποτε είσαι έτοιμος." : "You canceled checkout. Whenever you're ready."}
              </p>
            )}
            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          </div>
        </motion.div>

        {/* Philosophy block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 rounded-[2rem] border border-border/60 bg-background/75 p-8 shadow-xl shadow-black/5 backdrop-blur sm:p-12"
        >
          {(isGreek ? PHILOSOPHY.el : PHILOSOPHY.en).map((line) => (
            <p key={line} className="mb-4 font-serif text-xl leading-relaxed text-foreground sm:text-2xl">
              {line}
            </p>
          ))}
        </motion.div>

        {/* Visual gallery — see the app */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20"
        >
          <div className="text-center">
            <p className="text-[11px] font-sans uppercase tracking-[0.35em] text-gold font-semibold">
              {isGreek ? "Έτσι μοιάζει" : "What it looks like"}
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
              {isGreek ? "Δες το από μέσα" : "See it from the inside"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
              {isGreek
                ? "Κάθε μέρα ανοίγεις την εφαρμογή και ξέρεις ακριβώς τι θα κάνεις. Καμία αμφιβολία."
                : "Open the app every day and know exactly what to do. No second-guessing."}
            </p>
          </div>
          {/* Mobile: horizontal scroll. Desktop: 4-up grid. */}
          <div className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-2 pb-6 scrollbar-thin lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible lg:px-0">
            <div className="snap-center flex-shrink-0 lg:flex-shrink">
              <PhoneFrame caption={isGreek ? "Σήμερα" : "Today"}>
                <ScreenToday isGreek={isGreek} />
              </PhoneFrame>
            </div>
            <div className="snap-center flex-shrink-0 lg:flex-shrink">
              <PhoneFrame caption={isGreek ? "Σύμβουλος" : "Concierge"}>
                <ScreenChat isGreek={isGreek} />
              </PhoneFrame>
            </div>
            <div className="snap-center flex-shrink-0 lg:flex-shrink">
              <PhoneFrame caption={isGreek ? "Ανάλυση" : "Meal check"}>
                <ScreenPhoto isGreek={isGreek} />
              </PhoneFrame>
            </div>
            <div className="snap-center flex-shrink-0 lg:flex-shrink">
              <PhoneFrame caption={isGreek ? "Ρυθμός" : "Rhythm"}>
                <ScreenRhythm isGreek={isGreek} />
              </PhoneFrame>
            </div>
          </div>
        </motion.div>

        {/* Features grid */}
        <div className="mt-20">
          <h2 className="font-serif text-3xl font-semibold text-foreground sm:text-4xl">
            {isGreek ? "Τι είναι μέσα" : "What's inside"}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, el, en }) => {
              const copy = isGreek ? el : en;
              return (
                <div
                  key={copy.title}
                  className="rounded-2xl border border-border/70 bg-card/80 p-5 transition hover:border-gold/40"
                >
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-sans text-base font-semibold text-foreground">{copy.title}</h3>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20">
          <h2 className="font-serif text-3xl font-semibold text-foreground sm:text-4xl">
            {isGreek ? "Συχνές ερωτήσεις" : "Frequently asked"}
          </h2>
          <div className="mt-8 space-y-4">
            {(isGreek ? FAQ.el : FAQ.en).map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-border/70 bg-card/80 p-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-4 font-sans text-base font-semibold text-foreground">
                  {item.q}
                  <span className="text-gold transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-20 rounded-[2rem] border border-gold/40 bg-background/80 p-10 text-center shadow-2xl shadow-black/5 backdrop-blur"
        >
          <h2 className="font-serif text-3xl font-semibold text-foreground sm:text-4xl">
            {isGreek ? "Δεν σου ζητώ να ξαναξεκινήσεις. Σου ζητώ να μείνεις." : "I'm not asking you to start over. I'm asking you to stay."}
          </h2>
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="shimmer-gold mt-8 inline-flex items-center justify-center rounded-2xl bg-gold px-10 py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 shadow-gold-md"
          >
            {loading
              ? (isGreek ? "Φόρτωση..." : "Loading...")
              : (isGreek ? "Ξεκίνα τώρα · €47/μήνα" : "Start now · €47/month")}
          </button>
          <p className="mt-4 text-xs font-sans text-muted-foreground">
            {isGreek ? "Εγγύηση αποτελέσματος · " : "Results guarantee · "}
            <a href="/policy" className="underline hover:text-foreground">
              {isGreek ? "Δες όρους" : "See terms"}
            </a>
          </p>
        </motion.div>

        {/* Legal disclaimer footer */}
        <p className="mx-auto mt-12 max-w-3xl text-center text-[11px] font-sans leading-relaxed text-muted-foreground/80">
          {isGreek
            ? "Η Μεταμόρφωση είναι πρόγραμμα lifestyle coaching και εκπαίδευσης. Δεν αντικαθιστά ιατρική συμβουλή, διάγνωση ή θεραπεία. Πριν από οποιαδήποτε αλλαγή διατροφής ή τρόπου ζωής, συμβουλέψου τον γιατρό σου — ειδικά αν λαμβάνεις φαρμακευτική αγωγή ή έχεις χρόνια κατάσταση. "
            : "Metamorphosis is a lifestyle coaching and education program. It does not replace medical advice, diagnosis or treatment. Before any change in diet or lifestyle, consult your physician — especially if you are on medication or have a chronic condition. "}
          <a href="/policy" className="underline hover:text-foreground">
            {isGreek ? "Όροι & Πολιτική" : "Terms & Policy"}
          </a>
        </p>
      </div>

      <EmbeddedMetamorphosisCheckout
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        isGreek={isGreek}
      />
    </div>
  );
};

export default Unico;
