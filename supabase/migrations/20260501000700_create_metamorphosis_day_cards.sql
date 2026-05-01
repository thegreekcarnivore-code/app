-- Day 1..Day 7 Metamorphosis onboarding cards.
-- Drives the Σήμερα tab Day card on Home for new members.
-- The Σύμβουλος references the day's focus when answering questions during week 1.

CREATE TABLE public.metamorphosis_day_cards (
  day_number INTEGER PRIMARY KEY CHECK (day_number BETWEEN 1 AND 7),
  title_el TEXT NOT NULL,
  body_el TEXT NOT NULL,
  cta_label_el TEXT NOT NULL,
  cta_route TEXT NOT NULL,            -- internal app route the CTA opens
  required_action TEXT,                -- 'baseline' | 'first_meal_logged' | 'first_chat' | 'first_post' | NULL (auto-mark)
  unlock_video_tag TEXT,               -- personal_videos.trigger_tags element shown on completion
  helper_note_el TEXT
);

ALTER TABLE public.metamorphosis_day_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read day cards"
  ON public.metamorphosis_day_cards FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage day cards"
  ON public.metamorphosis_day_cards FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.metamorphosis_day_cards
  (day_number, title_el, body_el, cta_label_el, cta_route, required_action, unlock_video_tag, helper_note_el)
VALUES
  (1,
   'Ημέρα 1 — Σημείο εκκίνησης',
   'Πριν προχωρήσεις, χρειαζόμαστε το σημείο εκκίνησης. Ζύγισε τον εαυτό σου, μέτρα μέση και ισχία, και ανέβασε 4 φωτογραφίες (μπροστά, πλάι, πίσω, πρόσωπο). Χωρίς αυτά, δεν υπάρχει αξιόπιστη σύγκριση σε 30, 60 και 90 μέρες.',
   'Καταγραφή βασικών μετρήσεων',
   '/measurements',
   'baseline',
   'milestone:day_1_baseline',
   'Όλα είναι ιδιωτικά. Μόνο εσύ και ο Σύμβουλος έχουν πρόσβαση.'),
  (2,
   'Ημέρα 2 — Πρώτη μέρα Carnivore',
   'Σήμερα ξεκινάει το πρόγραμμα. Δες το πρώτο βίντεο της Φάσης 1 και τι να περιμένεις τις πρώτες 72 ώρες — η προσαρμογή έχει σήμα και πιθανή πρόκληση. Καρφίτσωσε τη συνταγή ηλεκτρολυτών.',
   'Άνοιγμα Φάσης 1',
   '/method',
   NULL,
   'phase:1_intro',
   'Αν νιώσεις πονοκέφαλο ή κούραση, είναι αναμενόμενο. Πιες αλάτι και νερό.'),
  (3,
   'Ημέρα 3 — Καταγραφή φαγητού',
   'Η καταγραφή είναι το εργαλείο που δείχνει τι δουλεύει. Ανέβασε φωτογραφία ή σύντομη περιγραφή του πρώτου σου γεύματος. Η καταγραφή τρέφει τον Σύμβουλο.',
   'Καταγραφή πρώτου γεύματος',
   '/measurements?tab=food',
   'first_meal_logged',
   NULL,
   'Δεν χρειάζεται μέτρηση γραμμαρίων. Φωτογραφία και σύντομη περιγραφή αρκούν.'),
  (4,
   'Ημέρα 4 — Ο Σύμβουλος',
   'Ώρα να γνωρίσεις τον Σύμβουλο — τον προσωπικό σου καθοδηγητή 24/7 μέσα στην εφαρμογή. Ξέρει το intake σου, τις μετρήσεις και τις φωτογραφίες σου. Κάνε την πρώτη σου ερώτηση.',
   'Άνοιγμα Συμβούλου',
   '/coach',
   'first_chat',
   NULL,
   'Ξεκίνα με κάτι απλό: "Τι να φάω αύριο;" ή "Τι να περιμένω αυτή την εβδομάδα;"'),
  (5,
   'Ημέρα 5 — Πρωτόκολλο σαββατοκύριακου',
   'Τα Σαββατοκύριακα είναι όπου σπάει η συνέπεια στους περισσότερους. Δες το σύντομο βίντεο επιβίωσης Παρασκευής και πάρε το cheat sheet για social εξόδους.',
   'Δες πρωτόκολλο σαββατοκύριακου',
   '/method',
   NULL,
   'weekend:protocol',
   'Ο στόχος δεν είναι η τελειότητα. Ο στόχος είναι να μην χάσεις τη ροή.'),
  (6,
   'Ημέρα 6 — Κοινότητα',
   'Η κοινότητα είναι ο πιο υποτιμημένος μοχλός. Άφησε ένα μικρό μήνυμα στο feed — μια νίκη, μια απορία, μια εικόνα. Δεν χρειάζεται να είναι τέλειο.',
   'Άνοιγμα κοινότητας',
   '/community',
   'first_post',
   NULL,
   'Όταν αναγνωρίζεσαι, μένεις. Όταν μένεις, αλλάζεις.'),
  (7,
   'Ημέρα 7 — Επισκόπηση πρώτης εβδομάδας',
   'Συγχαρητήρια. Πέρασες την πρώτη εβδομάδα. Τώρα πάρε την πρώτη σου εβδομαδιαία ανάλυση — μια σύντομη γραπτή ανασκόπηση από τον Σύμβουλο, βασισμένη σε όσα έχεις καταγράψει.',
   'Πάρε την ανάλυσή σου',
   '/weekly-report',
   NULL,
   'milestone:day_7_review',
   'Η εβδομαδιαία ανάλυση είναι διαθέσιμη μία φορά κάθε ISO εβδομάδα.');
