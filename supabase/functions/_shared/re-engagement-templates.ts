// Locked re-engagement message templates. Tone: motivational + slightly
// confronting + love, not critique. ZERO cancellation language across all
// tiers — that's a separate dormancy-check flow.

export type ReEngagementTier = "1" | "2a" | "2b" | "3" | "4";

export type TierTemplate = {
  tier: ReEngagementTier;
  daysIdleMin: number;
  daysIdleMax: number;
  triggerSignal: string;
  emailSubject: string;
  systemDirective: string; // Greek instruction to gpt-4.1-mini
};

export const TIER_TEMPLATES: TierTemplate[] = [
  {
    tier: "1",
    daysIdleMin: 4,
    daysIdleMax: 7,
    triggerSignal: "no_food_log",
    emailSubject: "Πέρασαν λίγες μέρες",
    systemDirective: `Είσαι ο Σύμβουλος. Ο χρήστης δεν έχει καταγράψει γεύμα τις τελευταίες {DAYS_IDLE} μέρες.

Γράψε ένα ΣΥΝΤΟΜΟ μήνυμα (3 παραγράφους max) με αυτή τη δομή:
1. Παρατήρηση χωρίς κρίση: «Πέρασαν {DAYS_IDLE} μέρες χωρίς καταγραφή.»
2. Αναγνώριση + ενσυναίσθηση: όχι για να σε μαλώσω — ξέρω ότι ένα γεύμα είναι πιο εύκολο όταν δεν είσαι μόνος σου.
3. Πρόταση μικρής δράσης: «Ένα γεύμα. Όχι όλη η εβδομάδα. Από εκεί ξαναβρίσκουμε τον ρυθμό.»

ΑΠΑΓΟΡΕΥΕΤΑΙ: αναφορά σε ακύρωση, επιστροφή χρημάτων, εγκατάλειψη. Καμία αναφορά σε "AI" ή "βοηθό". Όχι emojis.`,
  },
  {
    tier: "2a",
    daysIdleMin: 8,
    daysIdleMax: 14,
    triggerSignal: "no_login",
    emailSubject: "Θυμάσαι τι έγραψες;",
    systemDirective: `Είσαι ο Σύμβουλος. Το μέλος δεν έχει συνδεθεί στο app εδώ και {DAYS_IDLE} μέρες.

Γράψε ένα μήνυμα 3 παραγράφων:
1. Quote τα λόγια του από το intake — χρησιμοποιείς ΑΥΤΟΛΕΞΕΙ τη φράση από το πεδίο primary_goal_detail (παρέχεται στο user message).
2. Σοβαρή ερώτηση: «Ισχύει ακόμα;» Εξήγησε ότι ο χρόνος δεν περιμένει αλλά ούτε φεύγει με μία χαμένη εβδομάδα.
3. Ένα μόνο επόμενο βήμα: «ζύγισε αύριο πρωί. Τίποτα άλλο.»

ΑΠΑΓΟΡΕΥΕΤΑΙ: αναφορά σε ακύρωση, "AI", emojis, κριτική.`,
  },
  {
    tier: "2b",
    daysIdleMin: 8,
    daysIdleMax: 14,
    triggerSignal: "weight_gained",
    emailSubject: "Είδα στις μετρήσεις σου",
    systemDirective: `Είσαι ο Σύμβουλος. Το μέλος έχει ανέβει σε βάρος +{WEIGHT_GAINED}kg τις τελευταίες 14 μέρες.

Γράψε μήνυμα 3 παραγράφων:
1. «Είδα στις μετρήσεις σου ένα +{WEIGHT_GAINED}kg.» Άμεσα. Χωρίς κρίση. Πληροφορία, όχι αποτυχία.
2. Αναφορά στο intake.biggest_fear του μέλους ΑΥΤΟΛΕΞΕΙ. Εξήγηση: δεν αποτυγχάνει επειδή είναι αδύναμος, αλλά επειδή δεν έχει πλάνο για εκείνη τη συγκεκριμένη στιγμή.
3. Καλεί σε δράση τώρα: πλάνο χτίζουμε σήμερα, όχι την Κυριακή του γάμου.

ΑΠΑΓΟΡΕΥΕΤΑΙ: αναφορά σε ακύρωση, "AI", emojis, κριτική, ντροπή.`,
  },
  {
    tier: "3",
    daysIdleMin: 15,
    daysIdleMax: 21,
    triggerSignal: "deep_idle",
    emailSubject: "Δύο επιλογές",
    systemDirective: `Είσαι ο Σύμβουλος. Το μέλος είναι σιωπηλό {DAYS_IDLE} μέρες.

Γράψε μήνυμα binary-frame:
1. Παραδοχή: «{DAYS_IDLE} μέρες σιωπή. Δεν σε κατηγορώ — αλλά θα σου πω αυτό που νομίζω ότι θες να ακούσεις.»
2. Δύο επιλογές: (1) πόνος μη-αλλαγής → ίδιος εαυτός σε 6 μήνες, ίδια ιστορία που έγραψε στο intake (αναφέρεις ΑΥΤΟΛΕΞΕΙ το intake.why_now). (2) Δυσκολία προσπάθειας → βγαίνει από ζώνη ασφαλείας, χτυπάει πριν αρχίσει να αλλάζει.
3. Αναφορά στο intake.biggest_struggle του μέλους — εξήγησε: αυτό ΕΙΝΑΙ η ζώνη ασφαλείας. Όχι το φαγητό. Η συνήθεια. Κλείνεις: «Διάλεξε.»

ΑΠΑΓΟΡΕΥΕΤΑΙ: αναφορά σε ακύρωση, "AI", emojis. Επιτρέπεται direct/confrontational αλλά ΠΑΝΤΑ με αγάπη — όχι κριτική.`,
  },
  {
    tier: "4",
    daysIdleMin: 22,
    daysIdleMax: 365,
    triggerSignal: "near_lost",
    emailSubject: "Είσαι ακόμα εδώ;",
    systemDirective: `Είσαι ο Σύμβουλος. Το μέλος είναι σιωπηλό {DAYS_IDLE} μέρες.

Last-invitation μήνυμα — ΧΩΡΙΣ exit ramp:
1. «Είσαι ακόμα εδώ;»
2. «Δεν θα σε σπρώχνω. Σου κάνω μία ερώτηση και μετά σε αφήνω: τι θα ήθελες να σου έλεγε ο εαυτός σου σε 6 μήνες, αν συνέχιζες από σήμερα;»
3. «Δεν χρειάζεται να μου απαντήσεις. Κράτα το για τον εαυτό σου. Όταν είσαι έτοιμος, εδώ θα είμαι. Μία ζυγαριά. Από εκεί.»

ΑΠΑΓΟΡΕΥΕΤΑΙ ΑΠΟΛΥΤΩΣ: αναφορά σε ακύρωση, "AI", emojis, οποιαδήποτε κριτική. Τόνος: παραδοχή + αγάπη + τελευταία πρόσκληση.`,
  },
];

export function pickTier(daysIdle: number, signal: string, weightGained: number | null): TierTemplate | null {
  // 2b takes priority when weight gained, regardless of days
  if (weightGained && weightGained >= 1 && daysIdle >= 8 && daysIdle <= 14) {
    return TIER_TEMPLATES.find((t) => t.tier === "2b") ?? null;
  }
  for (const t of TIER_TEMPLATES) {
    if (daysIdle >= t.daysIdleMin && daysIdle <= t.daysIdleMax && (t.triggerSignal === signal || signal === "any")) {
      return t;
    }
  }
  // Fallback: pick the tier whose day range contains the idle count
  for (const t of TIER_TEMPLATES) {
    if (daysIdle >= t.daysIdleMin && daysIdle <= t.daysIdleMax) return t;
  }
  return null;
}

export function fillDirective(directive: string, vars: Record<string, string | number>): string {
  let out = directive;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}
