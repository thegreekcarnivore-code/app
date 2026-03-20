import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { stripGreekAccents } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Lang = "en" | "el";

const translations = {
  // Branding
  appName: { en: "The Greek Carnivore", el: "The Greek Carnivore" },
  subtitle: { en: "Food Concierge", el: "Σύμβουλος Διατροφής" },

  // Common
  back: { en: "← Back", el: "← Πίσω" },
  shareLocation: { en: "Share My Location", el: "Κοινοποίηση Τοποθεσίας" },
  newSearch: { en: "New Search", el: "Νέα Αναζήτηση" },
  locationNotSupported: { en: "Location not supported", el: "Η τοποθεσία δεν υποστηρίζεται" },
  locationDenied: { en: "Location access denied", el: "Η πρόσβαση τοποθεσίας απορρίφθηκε" },
  enableLocation: { en: "Please enable location access.", el: "Παρακαλώ ενεργοποιήστε την πρόσβαση τοποθεσίας." },
  couldntFetch: { en: "Couldn't fetch recommendations", el: "Δεν ήταν δυνατή η λήψη προτάσεων" },
  tryAgain: { en: "Please try again.", el: "Παρακαλώ δοκιμάστε ξανά." },
  orEnterLocation: { en: "Or enter a location", el: "Ή εισάγετε τοποθεσία" },
  enterAddress: { en: "City, address, or place...", el: "Πόλη, διεύθυνση ή τόπος..." },
  go: { en: "Go", el: "Πάμε" },
  locationNotFound: { en: "Location not found", el: "Η τοποθεσία δεν βρέθηκε" },

  // Home page
  homeDescription: { en: "Share your location. We'll find what's best around you.", el: "Μοιραστείτε την τοποθεσία σας. Θα βρούμε ό,τι καλύτερο γύρω σας." },
  yourBestMove: { en: "Your Best Move", el: "Η Καλύτερη Επιλογή" },
  whatToAvoid: { en: "What to Avoid", el: "Τι να Αποφυγετε" },
  findingBest: { en: "Finding what's best around you", el: "Βρίσκουμε ό,τι καλύτερο γύρω σας" },
  verifyingRestaurants: { en: "Curating the finest spots just for you…", el: "Επιλέγουμε τα καλύτερα μέρη ειδικά για εσάς…" },

  // Delivery page
  delivery: { en: "Delivery", el: "Παράδοση" },
  foodAtYourDoor: { en: "Food at Your Door", el: "Φαγητό στην Πόρτα σας" },
  deliveryDescription: { en: "Share your location to find the best delivery options nearby.", el: "Μοιραστείτε την τοποθεσία σας για τις καλύτερες επιλογές παράδοσης." },
  deliveryOptions: { en: "Delivery Options", el: "Επιλογες Παραδοσης" },
  findingDelivery: { en: "Finding delivery options", el: "Βρίσκουμε επιλογές παράδοσης" },
  checkingDelivery: { en: "Checking who's delivering near you…", el: "Ελέγχουμε ποιος κάνει παράδοση κοντά σας…" },
  couldntFetchDelivery: { en: "Couldn't fetch delivery options", el: "Δεν ήταν δυνατή η λήψη επιλογών παράδοσης" },
  deliveryTime: { en: "Delivery", el: "Παράδοση" },
  orderVia: { en: "Order via", el: "Παραγγελία μέσω" },

  // Meal time selector
  whenEating: { en: "When are you eating?", el: "Ποτε θελεις να φας;" },
  rightNow: { en: "Right Now", el: "Τώρα" },
  rightNowDesc: { en: "Open kitchens near you", el: "Ανοιχτές κουζίνες κοντά σας" },
  nextBreakfast: { en: "Next Breakfast", el: "Επόμενο Πρωινό" },
  nextBreakfastDesc: { en: "Tomorrow morning", el: "Αύριο το πρωί" },
  nextLunch: { en: "Next Lunch", el: "Επόμενο Μεσημεριανό" },
  nextLunchDesc: { en: "Midday options", el: "Μεσημεριανές επιλογές" },
  nextDinner: { en: "Next Dinner", el: "Επόμενο Δείπνο" },
  nextDinnerDesc: { en: "Evening dining", el: "Βραδινό δείπνο" },

  // Price tier selector
  howMuchSpend: { en: "How much do you want to spend?", el: "Ποσα θελεις να ξοδεψεις;" },
  goodDeal: { en: "Affordable", el: "Οικονομικό" },
  goodDealDesc: { en: "Cheap eats, best value spots", el: "Φθηνό φαγητό, τα καλύτερα σε τιμή" },
  highEnd: { en: "High-End", el: "Υψηλής Ποιότητας" },
  highEndDesc: { en: "Premium restaurants and venues", el: "Premium εστιατόρια και χώροι" },
  mostExclusive: { en: "Most Exclusive", el: "Πιο Αποκλειστικό" },
  mostExclusiveDesc: { en: "Rare spots, VIP-level experience", el: "Σπάνια μέρη, εμπειρία VIP" },

  // Scope toggle
  closest: { en: "Closest", el: "Κοντινότερα" },
  bestInTown: { en: "Best in Town", el: "Καλύτερα στην Πόλη" },

  // Distance slider
  maxDistance: { en: "Max Distance", el: "Μεγιστη Αποσταση" },
  km: { en: "km", el: "χλμ" },

  // Restaurant card
  whyHere: { en: "Why here", el: "Γιατι εδω" },
  whatToOrder: { en: "What to order", el: "Τι να παραγγειλεις" },
  orderThis: { en: "Order this", el: "Παραγγειλε αυτο" },
  howToOrder: { en: "How to order", el: "Πως να παραγγειλεις" },
  appleMaps: { en: "Apple Maps", el: "Apple Maps" },
  googleMaps: { en: "Google Maps", el: "Google Maps" },
  uber: { en: "Uber", el: "Uber" },
  copyAddress: { en: "Copy Address", el: "Αντιγραφή Διεύθυνσης" },
  seePhotos: { en: "See Photos", el: "Δες Φωτογραφίες" },
  hidePhotos: { en: "Hide Photos", el: "Απόκρυψη Φωτογραφιών" },
  website: { en: "Website", el: "Ιστοσελίδα" },
  viewPhotosOf: { en: "View photos of", el: "Δες φωτογραφίες του" },
  saved: { en: "Saved", el: "Αποθηκεύτηκε" },
  removed: { en: "Removed", el: "Αφαιρέθηκε" },
  addedToCollection: { en: "added to your collection.", el: "προστέθηκε στη συλλογή σας." },
  removedFromSaved: { en: "removed from saved.", el: "αφαιρέθηκε από τα αποθηκευμένα." },
  copied: { en: "Copied", el: "Αντιγράφηκε" },
  addressCopied: { en: "Address copied to clipboard.", el: "Η διεύθυνση αντιγράφηκε." },
  failedToCopy: { en: "Failed to copy", el: "Αποτυχία αντιγραφής" },

  // Bottom nav
  home: { en: "Home", el: "Αρχική" },
  restaurant: { en: "Restaurant", el: "Εστιατόριο" },
  savedNav: { en: "Saved", el: "Αποθηκευμένα" },
  explore: { en: "Activities", el: "Δραστηριότητες" },

  // Explore page
  exploreDescription: { en: "Discover the best activities and live events around you.", el: "Ανακαλύψτε τις καλύτερες δραστηριότητες και εκδηλώσεις γύρω σας." },
  selectInterests: { en: "What are you into?", el: "Τι σας ενδιαφερει;" },
  whenVisiting: { en: "When are you visiting?", el: "Πότε θα είστε εδώ;" },
  findingActivities: { en: "Finding the best experiences", el: "Βρίσκουμε τις καλύτερες εμπειρίες" },
  curatingExperiences: { en: "Curating unforgettable moments for you…", el: "Επιλέγουμε αξέχαστες στιγμές για εσάς…" },
  visitingHours: { en: "Visiting Hours", el: "Ώρες Επίσκεψης" },
  nearbyRestaurants: { en: "Nearby Restaurants", el: "Κοντινά Εστιατόρια" },
  topActivities: { en: "Top Experiences", el: "Κορυφαιες Εμπειριες" },
  loadMore: { en: "Load More", el: "Φόρτωση Περισσότερων" },
  loadingMore: { en: "Loading more…", el: "Φόρτωση…" },
  noMoreActivities: { en: "You've seen it all!", el: "Τα είδατε όλα!" },
  exploreButton: { en: "Explore", el: "Εξερεύνηση" },
  sightseeing: { en: "Sightseeing", el: "Αξιοθέατα" },
  kidFriendly: { en: "Kid-Friendly", el: "Για Παιδιά" },
  relaxing: { en: "Relaxing", el: "Χαλάρωση" },
  museum: { en: "Museum", el: "Μουσείο" },
  forADate: { en: "For a Date", el: "Για Ραντεβού" },
  science: { en: "Science", el: "Επιστήμη" },
  adventure: { en: "Adventure", el: "Περιπέτεια" },
  extremeAdventure: { en: "Extreme Adventure", el: "Ακραία Περιπέτεια" },
  nightlife: { en: "Nightlife", el: "Νυχτερινή Ζωή" },
  comedy: { en: "Comedy", el: "Κωμωδία" },
  musicCategory: { en: "Music", el: "Μουσική" },
  opera: { en: "Opera", el: "Όπερα" },
  businessEvents: { en: "Business", el: "Επιχειρήσεις" },
  preferredLanguages: { en: "Languages (e.g. English, Greek)", el: "Γλώσσες (π.χ. Αγγλικά, Ελληνικά)" },
  places: { en: "Places", el: "Τοποθεσίες" },
  events: { en: "Events", el: "Εκδηλώσεις" },
  eventTime: { en: "Event Time", el: "Ώρα Εκδήλωσης" },
  showRestaurants: { en: "Show Nearby Restaurants", el: "Εμφάνιση Κοντινών Εστιατορίων" },
  hideRestaurantsLabel: { en: "Hide Restaurants", el: "Απόκρυψη Εστιατορίων" },

  // Airport security
  airportDetected: { en: "Airport Detected", el: "Ανιχνεύθηκε Αεροδρόμιο" },
  airportSecurityQuestion: { en: "Are you before or after security?", el: "Είστε πριν ή μετά τον έλεγχο ασφαλείας;" },
  beforeSecurity: { en: "Before Security", el: "Πριν τον Έλεγχο" },
  afterSecurity: { en: "After Security", el: "Μετά τον Έλεγχο" },
  afterSecurityDesc: { en: "Airside — past the security checkpoint", el: "Μετά το σημείο ελέγχου ασφαλείας" },
  checkingAirport: { en: "Checking your location…", el: "Έλεγχος τοποθεσίας…" },
  beforeSecurityDesc: { en: "Landside — before passport/boarding check", el: "Πριν τον έλεγχο διαβατηρίων" },

  // Auth
  signIn: { en: "Sign In", el: "Σύνδεση" },
  signUp: { en: "Sign Up", el: "Εγγραφή" },
  signInToContinue: { en: "Sign in to continue", el: "Συνδεθείτε για να συνεχίσετε" },
  createAccount: { en: "Create your account", el: "Δημιουργήστε τον λογαριασμό σας" },
  emailPlaceholder: { en: "Email address", el: "Διεύθυνση email" },
  passwordPlaceholder: { en: "Password", el: "Κωδικός πρόσβασης" },
  passwordRequirement: { en: "Min 6 characters, e.g. MyDiet2024!", el: "Τουλάχιστον 6 χαρακτήρες, π.χ. MyDiet2024!" },
  pleaseWait: { en: "Please wait...", el: "Παρακαλώ περιμένετε..." },
  noAccount: { en: "Don't have an account?", el: "Δεν έχετε λογαριασμό;" },
  haveAccount: { en: "Already have an account?", el: "Έχετε ήδη λογαριασμό;" },
  signInFailed: { en: "Sign in failed", el: "Η σύνδεση απέτυχε" },
  signUpFailed: { en: "Sign up failed", el: "Η εγγραφή απέτυχε" },
  checkEmail: { en: "Check your email", el: "Ελέγξτε το email σας" },
  verificationLink: { en: "We sent you a verification link.", el: "Σας στείλαμε σύνδεσμο επαλήθευσης." },

  // Load More
  showMoreOptions: { en: "Show More Options", el: "Περισσότερες Επιλογές" },
  loadingMoreOptions: { en: "Loading more...", el: "Φόρτωση..." },
  noMoreOptions: { en: "No more options nearby", el: "Δεν υπάρχουν άλλες επιλογές κοντά" },

  // Concierge
  concierge: { en: "Concierge", el: "Συμβουλος" },
  conciergeGreeting: { en: "How can I help? Ask me about restaurants, menus, or what to order.", el: "Πώς μπορώ να βοηθήσω; Ρωτήστε με για εστιατόρια, μενού ή τι να παραγγείλετε." },
  askAnything: { en: "Ask anything...", el: "Ρωτήστε ό,τι θέλετε..." },
  shareLocationShort: { en: "Share location", el: "Κοινοποίηση τοποθεσίας" },
  located: { en: "Located", el: "Εντοπίστηκε" },
  locationShared: { en: "Location shared", el: "Η τοποθεσία κοινοποιήθηκε" },
  conciergeKnows: { en: "Your concierge now knows where you are.", el: "Ο σύμβουλός σας γνωρίζει πλέον πού βρίσκεστε." },
  attachFile: { en: "Attach photo", el: "Επισύναψη φωτογραφίας" },

  // More menu
  more: { en: "More", el: "Περισσότερα" },
  shopping: { en: "Shopping", el: "Ψωνια" },
  recipes: { en: "Recipes", el: "Συνταγές" },
  videos: { en: "Videos", el: "Βίντεο" },
  measurements: { en: "Accountability", el: "Υπευθυνότητα" },
  community: { en: "Community", el: "Κοινότητα" },

  // Shopping page
  shoppingDescription: { en: "Find the best supermarkets, butchers, and markets near you for carnivore and low-carb shopping.", el: "Βρείτε τα καλύτερα σούπερ μάρκετ, κρεοπωλεία και αγορές κοντά σας για αγορές carnivore και χαμηλών υδατανθράκων." },
  findingShopping: { en: "Finding the best shops", el: "Βρίσκουμε τα καλύτερα καταστήματα" },
  checkingShops: { en: "Curating the best shops for you…", el: "Επιλέγουμε τα καλύτερα καταστήματα για εσάς…" },
  shoppingOptions: { en: "Shopping Options", el: "Επιλογες Αγορων" },
  couldntFetchShopping: { en: "Couldn't fetch shopping options", el: "Δεν ήταν δυνατή η λήψη επιλογών αγορών" },
  shoppingPriceGoodDeal: { en: "Affordable", el: "Οικονομικό" },
  shoppingPriceGoodDealDesc: { en: "Cheapest shops and markets", el: "Τα πιο οικονομικά καταστήματα" },
  shoppingPriceHighEnd: { en: "Premium", el: "Premium" },
  shoppingPriceHighEndDesc: { en: "Top quality meats and products", el: "Κορυφαία ποιότητα κρεάτων και προϊόντων" },
  shoppingPriceMostExclusive: { en: "Exclusive", el: "Αποκλειστικό" },
  shoppingPriceMostExclusiveDesc: { en: "Artisan butchers, rare cuts, organic", el: "Χειροτέχνες κρεοπώλες, σπάνια κομμάτια, βιολογικά" },
  attachedImage: { en: "Photo attached", el: "Φωτογραφία επισυνάφθηκε" },
  fileTooLarge: { en: "File too large. Maximum 4MB.", el: "Αρχείο πολύ μεγάλο. Μέγιστο 4MB." },
  unsupportedFile: { en: "Unsupported file type", el: "Μη υποστηριζόμενος τύπος αρχείου" },
  calendar: { en: "Calendar", el: "Ημερολόγιο" },
  selectDateTime: { en: "Pick a date", el: "Επιλέξτε ημερομηνία" },
  addToCalendar: { en: "Add to Google Calendar", el: "Προσθήκη στο Google Calendar" },
  duration: { en: "Duration", el: "Διάρκεια" },
  preferences: { en: "Preferences", el: "Προτιμήσεις" },
  anyPrice: { en: "Any Price", el: "Οποιαδήποτε Τιμή" },
  menuVerified: { en: "Menu verified", el: "Επαληθευμένο μενού" },
  unverifiedDish: { en: "Unverified", el: "Μη επαληθευμένο" },
  history: { en: "Search History", el: "Ιστορικο Αναζητησης" },
  noHistory: { en: "No search history yet.", el: "Δεν υπάρχει ιστορικό αναζήτησης." },
  noHistoryHint: { en: "Your past searches will appear here.", el: "Οι προηγούμενες αναζητήσεις σας θα εμφανίζονται εδώ." },
  cachedResults: { en: "Showing cached results", el: "Εμφάνιση αποθηκευμένων αποτελεσμάτων" },
  childrenAges: { en: "Children's Ages", el: "Ηλικίες Παιδιών" },
  childrenAgesPlaceholder: { en: "e.g. 3, 8", el: "π.χ. 3, 8" },
  directLine: { en: "Direct Line", el: "Απευθειας Γραμμη" },
  humanAssistance: { en: "Human Assistance", el: "Ανθρώπινη Βοήθεια" },
  askConcierge: { en: "Ask your concierge...", el: "Ρωτήστε τον σύμβουλό σας..." },
  locationSharedLabel: { en: "Location shared", el: "Τοποθεσία κοινοποιήθηκε" },
} as const;

type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  lang: Lang;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
  /** Returns translation with Greek accents stripped — use for uppercase text */
  tUp: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem("app-lang");
    return (stored === "el" ? "el" : "en") as Lang;
  });

  useEffect(() => {
    localStorage.setItem("app-lang", lang);
  }, [lang]);

  // Sync language preference to profile whenever it changes
  useEffect(() => {
    const syncToProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from("profiles")
          .update({ language: lang } as any)
          .eq("id", session.user.id);
      }
    };
    syncToProfile();
  }, [lang]);

  // Load language from profile on first auth
  useEffect(() => {
    const loadFromProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("language" as any)
          .eq("id", session.user.id)
          .single();
        if (data && (data as any).language) {
          const profileLang = (data as any).language as Lang;
          if (profileLang !== lang) {
            setLang(profileLang);
            localStorage.setItem("app-lang", profileLang);
          }
        }
      }
    };
    loadFromProfile();
  }, []);

  const toggleLanguage = useCallback(() => setLang((prev) => (prev === "en" ? "el" : "en")), []);
  const t = useCallback((key: TranslationKey) => translations[key][lang], [lang]);
  const tUp = useCallback((key: TranslationKey) => {
    const text = translations[key][lang];
    return lang === "el" ? stripGreekAccents(text) : text;
  }, [lang]);

  const value = useMemo(() => ({ lang, toggleLanguage, t, tUp }), [lang, toggleLanguage, t, tUp]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: "en" as Lang,
      toggleLanguage: () => {},
      t: (key: TranslationKey) => translations[key]?.en ?? key,
      tUp: (key: TranslationKey) => translations[key]?.en ?? key,
    };
  }
  return ctx;
};
