// Ported from scripts/greek-carnivore-content-generator.py

export type ContentType = 'diet_testing' | 'transformation' | 'daily_tips' | 'food_showcase';

export interface GeneratedContent {
  hook: string;
  description: string;
  hashtags: string[];
  content_type: ContentType;
  character_count: number;
  estimated_performance: number;
}

const TEMPLATES: Record<ContentType, { hooks: string[]; descriptions: string[] }> = {
  diet_testing: {
    hooks: [
      'Δοκιμάζω την κάρνιβορ διατροφή για 30 μέρες',
      'Η κάρνιβορ διατροφή άλλαξε τη ζωή μου',
      'Τι συμβαίνει όταν τρως ΜΟΝΟ κρέας;',
      '30 μέρες μόνο κρέας - Τα αποτελέσματα θα σε σοκάρουν',
    ],
    descriptions: [
      '🥩 Δοκιμάζω την κάρνιβορ διατροφή!\nΜόνο κρέας για έναν μήνα - δες τι συμβαίνει στο σώμα μου.\nΠεριγραφή περιήγησης για την κάρνιβορ ζωή! 💪\n\n#ΚάρνιβορΔιατροφή #ΕλληνικήΚάρνιβορ #ΜόνοΚρέας #ΥγιεινήΖωή',
      '🔥 Η κάρνιβορ διατροφή σε δράση!\nΞεκίνησα να αισθάνεσαι περιήγηση για το σώμα σου με εύκολες και πρακτικές κινήσεις.\nΕίσαι έτοιμος;\n\n💪 #ΑγαπήστεΤοΣώματαΣας #ΑπώλειαΒάρους #ΓρεεκΚάρνιβορ',
      '🥩 ΚΡΕΑΣ = ΔΥΝΑΜΗ\nΔες γιατί η κάρνιβορ διατροφή είναι το μυστικό για:\n✅ Απώλεια βάρους\n✅ Περισσότερη ενέργεια\n✅ Καλύτερη υγεία\n✅ Ψυχική διαύγεια\n\n#ΚάρνιβορΣτυλ #ΕλλάδαΚάρνιβορ #ΥγιεινήΔιατροφή',
    ],
  },
  transformation: {
    hooks: [
      'Πώς έχασα 15 κιλά σε 3 μήνες',
      'Η μεταμόρφωσή μου με την κάρνιβορ',
      'Από 90 κιλά σε 75 - Η ιστορία μου',
      'Αυτό που κάνει η κάρνιβορ στο σώμα',
    ],
    descriptions: [
      '🔥 ΜΕΤΑΜΟΡΦΩΣΗ ALERT!\nΑπό 90 κιλά σε 75 σε 3 μήνες - ΜΟΝΟ με κάρνιβορ διατροφή!\n\n✨ Τι άλλαξε:\n• Απώλεια βάρους χωρίς πείνα\n• Ενέργεια στα ύψη\n• Καθαρό δέρμα\n• Καλύτερος ύπνος\n\n#ΚάρνιβορΜεταμόρφωση #ΑπώλειαΒάρους #ΕλληνικήΔιατροφή',
      '💪 Η ΑΛΗΤΕΙΑ για την κάρνιβορ διατροφή!\nΔες τη δική μου μεταμόρφωση και μάθε:\n🥩 Τι τρώω κάθε μέρα\n⏰ Πότε τρώω\n💡 Γιατί λειτουργεί\n\nΕίσαι έτοιμος για αλλαγή;\n\n#ΚάρνιβορΖωή #ΕλλάδαΚάρνιβορ #ΥγιεινήΖωή',
    ],
  },
  daily_tips: {
    hooks: [
      '5 λόγοι να ξεκινήσεις κάρνιβορ ΣΗΜΕΡΑ',
      'Το μυστικό που δεν σου λένε οι γιατροί',
      'Γιατί το κρέας είναι η καλύτερη τροφή',
      'Αυτό που δε ξέρεις για τη ζωική πρωτεΐνη',
    ],
    descriptions: [
      '🥩 ΚΑΡΝΙΒΟΡ ΣΥΜΒΟΥΛΗ ΤΗΣ ΗΜΕΡΑΣ!\n\nΣήμερα μαθαίνουμε γιατί το κρέας είναι το ΤΕΛΕΙΟ φαγητό:\n✅ Πλήρης πρωτεΐνη\n✅ Βιταμίνες Β12 & σίδηρος\n✅ Μηδέν υδατάνθρακες\n✅ Φυσική κετόζη\n\nΔοκίμασες ήδη;\n\n#ΚάρνιβορΣυμβουλές #ΕλληνικήΚάρνιβορ #ΥγιεινήΔιατροφή',
      '💡 ΤΟ ΞΕΡΕΣ ΟΤΙ...\nΗ κάρνιβορ διατροφή είναι η πιο αρχαία διατροφή του ανθρώπου;\n\nΟι πρόγονοί μας έτρωγαν ΜΟΝΟ ζωικές τροφές για χιλιάδες χρόνια!\nΓι\' αυτό το σώμα μας τα "θυμάται" αυτά τα φαγητά.\n\n#ΚάρνιβορΙστορία #ΑρχαίαΔιατροφή #ΕλλάδαΚάρνιβορ',
    ],
  },
  food_showcase: {
    hooks: [
      'Το ΤΕΛΕΙΟ κάρνιβορ γεύμα',
      'Τι τρώω σε μία μέρα - Κάρνιβορ edition',
      'Ribeye vs Μοσχάρι - Ποιο είναι καλύτερο;',
      'Η αλήθεια για τα όργανα (liver, heart)',
    ],
    descriptions: [
      '🍖 ΚΑΡΝΙΒΟΡ MEAL PREP!\n\nΔες τι τρώω σε μία τυπική κάρνιβορ μέρα:\n🌅 Πρωί: Αυγά + μπέικον\n☀️ Μεσημέρι: Ribeye steak\n🌙 Βράδυ: Λάμπ τσοπς\n\nΑπλό, νόστιμο, αποτελεσματικό!\n\n#ΚάρνιβορΦαγητό #MealPrep #ΕλληνικήΚάρνιβορ #Steak',
      '🥩 RIBEYE = Ο ΒΑΣΙΛΙΑΣ των κρεάτων!\n\nΓιατί το ribeye είναι το #1 κάρνιβορ φαγητό:\n🔥 Υψηλά λιπαρά για ενέργεια\n💪 Πλούσιο σε πρωτεΐνη\n😋 Απίστευτη γεύση\n🧠 Ωμέγα-3 για τον εγκέφαλο\n\nΈχεις δοκιμάσει;\n\n#Ribeye #ΚάρνιβορΣτυλ #ΕλληνικόΚρέας',
    ],
  },
};

const GREEK_HASHTAGS = [
  '#ΚάρνιβορΔιατροφή', '#ΕλληνικήΚάρνιβορ', '#ΜόνοΚρέας',
  '#ΑπώλειαΒάρους', '#ΥγιεινήΖωή', '#ΚάρνιβορΣτυλ',
  '#ΕλλάδαΚάρνιβορ', '#ΚρεατοΦάγος', '#ΦυσικήΔιατροφή',
  '#ΠαλαιολιθικήΔιατροφή', '#ΚάρνιβορΜεταμόρφωση',
];

const ENGLISH_HASHTAGS = [
  '#Carnivore', '#CarnivoreLife', '#MeatOnly', '#CarnivoreDiet',
  '#ZeroCarb', '#AnimalBased', '#CarnivoreResults', '#GreekCarnivore',
  '#CarnivoreTransformation', '#MeatHeals',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sample<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
}

function getContextualAdditions(videoContext: string): string {
  const ctx = videoContext.toLowerCase();
  const additions: string[] = [];
  if (ctx.includes('δοκιμάζει') || ctx.includes('testing')) additions.push('🎯 Παρακολούθησε το ταξίδι μου!');
  if (ctx.includes('κρέας') || ctx.includes('meat')) additions.push('🥩 Quality κρέας = Quality αποτελέσματα');
  if (ctx.includes('μεταμόρφωση') || ctx.includes('transformation')) additions.push('📸 Πριν/μετά φωτογραφίες σύντομα!');
  if (ctx.includes('ribeye') || ctx.includes('steak')) additions.push('🔥 Grass-fed όταν γίνεται!');
  if (ctx.includes('αποτελέσματα') || ctx.includes('results')) additions.push('📊 Τα νούμερα δε λένε ψέματα!');
  return additions.join(' ');
}

function estimatePerformance(contentType: ContentType, description: string): number {
  const base: Record<ContentType, number> = {
    transformation: 9.0,
    diet_testing: 8.5,
    food_showcase: 8.0,
    daily_tips: 7.5,
  };
  let score = base[contentType];
  if (description.includes('?')) score += 0.3;
  if (['🥩', '🔥', '💪', '✅'].some(e => description.includes(e))) score += 0.2;
  if (description.length > 150 && description.length < 300) score += 0.3;
  if (description.includes('#')) score += 0.2;
  return Math.min(score, 10.0);
}

export function generateReelDescription(
  videoContext: string,
  contentType: ContentType = 'diet_testing',
  includeEnglish = true
): GeneratedContent {
  const template = TEMPLATES[contentType];
  const hook = pick(template.hooks);
  let description = pick(template.descriptions);

  const contextual = getContextualAdditions(videoContext);
  if (contextual) description += `\n\n${contextual}`;

  const hashtags = [
    ...sample(GREEK_HASHTAGS, 4),
    ...(includeEnglish ? sample(ENGLISH_HASHTAGS, 3) : []),
  ];
  description += `\n\n${hashtags.join(' ')}`;

  return {
    hook,
    description,
    hashtags,
    content_type: contentType,
    character_count: description.length,
    estimated_performance: estimatePerformance(contentType, description),
  };
}

export function suggestImprovements(description: string): string[] {
  const suggestions: string[] = [];
  if (description.length > 400) suggestions.push('Μείωσε το μήκος - κάτω από 400 χαρακτήρες είναι καλύτερο');
  if (!['🥩', '🔥', '💪', '✅'].some(e => description.includes(e))) suggestions.push('Πρόσθεσε emojis για περισσότερη προσοχή');
  if (!description.includes('#')) suggestions.push('Πρόσθεσε hashtags για καλύτερη προβολή');
  if (!description.includes('?')) suggestions.push('Πρόσθεσε ερώτηση για engagement');
  if (!['κάρνιβορ', 'carnivore', 'κρέας'].some(w => description.toLowerCase().includes(w))) suggestions.push('Συμπέριλαβε λέξεις-κλειδιά: κάρνιβορ, κρέας');
  return suggestions;
}

export const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'diet_testing', label: 'Diet Testing' },
  { value: 'transformation', label: 'Transformation' },
  { value: 'daily_tips', label: 'Daily Tips' },
  { value: 'food_showcase', label: 'Food Showcase' },
];
