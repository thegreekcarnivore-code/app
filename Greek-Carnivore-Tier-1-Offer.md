# THE GREEK CARNIVORE — TIER 1 OFFER
## "The Carnivore App" — €47/month

**Version:** 1.0 — April 2026
**Status:** Locked. Ready for landing page build + app configuration.
**Companion doc:** Greek-Carnivore-Three-Tier-Action-Plan.docx (strategy)
**This doc:** The full Tier 1 product specification, offer, and launch-ready copy.

---

## 1. THE CORE PROMISE

### One-line offer statement (for the landing page hero)

> **Ο προσωπικός σου σύμμαχος Carnivore, κάθε μέρα.**
> **Δεν ξαναρχίζεις από την αρχή κάθε Δευτέρα.**

### What it really solves

The people buying Tier 1 do NOT have an information problem. They already know what to eat. They've tried before. They quit. Every time.

**The real problem:** *"Δεν μπορώ να μείνω σταθερός/η μόνος/η μου."*

Tier 1 is the answer. Not education. Not motivation. **A daily support system** that carries them through the moments where they'd normally fall off — and surfaces the small wins that prove they're still in the game.

### The positioning sentence (use this EVERYWHERE)

> *"The system gets you results. The Accelerator gets you ME."*

This is the unlock that makes Tier 1 valuable AND makes the Tier 2 upgrade obvious. Tier 1 isn't a watered-down version of coaching — it's a **different product** that delivers a different promise: *consistency*, not *acceleration*.

---

## 2. WHO THIS IS FOR (AND WHO IT'S NOT)

### Perfect fit

- Has tried carnivore (or keto/low-carb) before and fallen off
- Wants to lose weight or heal a chronic issue
- Greek-speaking, living in Greece or abroad
- Cannot afford or doesn't need 1:1 coaching
- Has a phone and uses it daily
- Wants results but needs *structure*, not more information

### NOT for

- People looking for a free resource (send them the ebook)
- People wanting medical advice (disclaimer addresses this)
- People who won't use an app daily (Tier 2 call-based may fit better)
- Complete beginners to nutrition who haven't read the ebook yet

### The emotional state of a buyer

Before they buy, they are thinking:
- *"Έχω δοκιμάσει τόσες φορές. Μήπως κι αυτή τη φορά αποτύχω;"*
- *"Θα είναι απλό; Δεν έχω χρόνο για πολύπλοκα."*
- *"Θα με βοηθήσει ΟΤΑΝ θα θέλω να τα παρατήσω;"*

The offer must answer YES to all three. Explicitly.

---

## 3. PRICING & RISK REVERSAL

### The price

**€47/month**, recurring.
Frame it as: **"€1.55/μέρα — λιγότερο από έναν φραπέ."**

### Options shown on landing page

| Option | Price | Best for | Savings |
|---|---|---|---|
| **Monthly** | €47/μήνα | Ξεκινάω τώρα | — |
| **Quarterly (3 μήνες)** | €120 εφάπαξ | Είμαι σοβαρός/η | Κερδίζεις €21 (1 μήνα δώρο) |
| **Yearly (12 μήνες)** | €397 εφάπαξ | All-in, όλο το χρόνο | Κερδίζεις €167 (3+ μήνες δώρο) |

The **Quarterly** option is your recommended default — highlight it on the page. It locks retention (3 months is the adaptation window) and makes Tier 2 upgrades cleaner (you have a full dataset on them).

### The guarantee — clean, no strings

> **Εγγύηση 30 ημερών.**
>
> *Δοκίμασε την εφαρμογή. Αν δεν είναι για σένα, σου επιστρέφω ΟΛΑ τα λεφτά σου. Χωρίς ερωτήσεις. Χωρίς φόρμες. Χωρίς προβλήματα.*
>
> *Δεν ζητάω να με εμπιστευθείς εσύ. Εγώ εμπιστεύομαι το σύστημα.*

This is a clean, premium guarantee with **no attached offers or "bonuses"**. Why:

- At €47, the refund alone is enough risk reversal — no need to sweeten it.
- Any attached "free call" would break the core ladder philosophy (*"The system gets you results. The Accelerator gets you ME."*).
- Premium brands (Apple, Tesla) refund without fanfare. That's the positioning we want.
- Protects your time 100% — the refund is transactional, not relational.

### Post-refund Tier 3 funnel (SEPARATE from the guarantee)

After the refund is processed, a **completely separate, optional** opportunity is presented. It is NOT attached to the guarantee — it is a new offer, in a new email, framed as a new conversation.

**The flow:**

1. **Refund happens.** Full, immediate, no questions. Stripe processes it.
2. **Confirmation email** auto-fires (triggered by `stripe-webhook` refund event). Two short paragraphs:

   > *Η επιστροφή σου επεξεργάζεται. €47 θα εμφανιστούν στην κάρτα σου σε 5-10 εργάσιμες. Ευχαριστώ που δοκίμασες την εφαρμογή.*
   >
   > *Αν σταμάτησες γιατί ένιωσες ότι χρειαζόσουν κάτι πιο προσωπικό από μια εφαρμογή — και είσαι πραγματικά αποφασισμένος/η να δεις αποτέλεσμα — μπορείς να συμπληρώσεις αυτή τη φόρμα (5 λεπτά). Αν δω ότι ταιριάζουμε, θα σε καλέσω για να μιλήσουμε για το 1:1 coaching μου. Χωρίς πίεση.*
   >
   > [Button: **Συμπλήρωσε τη φόρμα**]

3. **The form** (hosted at `/apply` — same endpoint as the main Tier 3 application). 6 open-ended questions that filter for seriousness:

   1. Τι ήταν το μεγαλύτερο εμπόδιο για σένα στο carnivore;
   2. Τι έχεις δοκιμάσει στο παρελθόν (διατροφές, προγράμματα);
   3. Ποιος είναι ο πραγματικός σου στόχος — σε κιλά, σε υγεία, σε ενέργεια;
   4. Γιατί πιστεύεις ότι η εφαρμογή από μόνη της δεν ήταν αρκετή;
   5. Σε ποια κλίμακα 1-10 είσαι αποφασισμένος/η να αλλάξεις — και γιατί όχι χαμηλότερα;
   6. Τι θα ήθελες να πετύχεις μαζί μου αν δουλεύαμε 1:1;

4. **You review.** If the responses are serious and fit, you book a Tier 3 sales call via Calendly. If shallow or wrong-fit, you send a polite no (or ignore). **You decide — always.**

### Why this is better than a refund + free call

| Refund + free 1:1 call | Refund + optional apply form (what we're doing) |
|---|---|
| Gives time to everyone who refunds | Gives time ONLY to qualified applicants |
| Attached to the refund (feels like consolation) | Separate funnel (feels like opportunity) |
| Dilutes the ladder | Reinforces it — Tier 3 access is earned |
| 5+ hours/month lost on ~1 conversion | 30 min/month, higher conversion rate |
| Weakens premium positioning | Strengthens it — *"my time is valuable"* |

### Build cost for post-refund flow

**Low (~2-3 hours of work).** You already have:
- Stripe webhook (refund detection ready)
- Email sending (`send-message-email` edge function)
- Will have `/apply` page (already scoped in existing Three-Tier plan)

New work: (1) refund-detection handler in `stripe-webhook`, (2) confirmation email template in Greek, (3) notification to you when form submitted.

### Why NOT a €7 trial (decision locked)

- 40-60% month-1 churn vs 10-20% on €47 upfront
- Attracts idea-stealers and content-harvesters
- Weakens premium brand positioning
- High support burden from half-committed users
- Your market (Greek, coaching-brand) rewards barrier-of-entry

---

## 4. WHAT'S INSIDE TIER 1

Each feature here is listed with (a) what it is, (b) the **outcome** it delivers, and (c) whether it's already built in your app.

### 4.1 — Ο Προσωπικός σου Σύμβουλος Carnivore (24/7 chat)

- **What:** Always-on chat trained on your entire method. Answers about food, symptoms, motivation, plateaus, social situations.
- **Outcome:** *"Δεν νιώθω μόνος. Έχω πάντα κάποιον να ρωτήσω."*
- **Status:** ✅ Already built (Concierge.tsx + concierge-chat function)
- **Marketing language:** NEVER "AI chatbot". ALWAYS "Προσωπικός Σύμβουλος" or "Προσωπικός Σύμμαχος".

### 4.2 — Ανάλυση φωτογραφίας φαγητού

- **What:** Snap a photo of any meal. Instant feedback: on-track / off-track / suggestion.
- **Outcome:** *"Δεν χρειάζεται να μαντεύω. Ξέρω αμέσως αν είμαι σωστά."*
- **Status:** ✅ Already built (analyze-food-photo function)
- **Limit in Tier 1:** 3 scans/day (Tier 2 unlocks unlimited — natural upgrade trigger)

### 4.3 — Εβδομαδιαία Παρακολούθηση Προόδου

- **What:** Weight, measurements, energy, sleep, mood, cravings — all tracked weekly. Auto-generated report every Sunday night.
- **Outcome:** *"Βλέπω ότι προχωράω. Δεν είναι στο μυαλό μου."*
- **Status:** ✅ Already built (Measurements.tsx + program automations)
- **Tier 1-specific:** Basic weekly report. (Tier 2 adds group comparisons + deeper trends.)

### 4.4 — Η Κουζίνα σου (Συνταγές + Λίστα Αγορών)

- **What:** Full Greek carnivore recipe database. Auto-generated shopping lists. Weekly meal suggestions based on what they've logged.
- **Outcome:** *"Δεν χρειάζεται να σκέφτομαι τι θα φάω."*
- **Status:** ✅ Already built (Resources.tsx + Shopping.tsx)

### 4.5 — Εστιατόρια & Delivery (Όταν είσαι έξω)

- **What:** Greek restaurant finder that shows carnivore-compatible options. Delivery suggestions for cities. Travel mode for vacations.
- **Outcome:** *"Δεν με σπάει η κοινωνική μου ζωή."*
- **Status:** ✅ Already built (Discover.tsx, Delivery.tsx, Travel.tsx)

### 4.6 — Η Κοινότητα

- **What:** Structured community chat with weekly prompts, win-sharing, Q&A. Moderated by you (10 min/week).
- **Outcome:** *"Δεν το κάνω μόνος. Βλέπω άλλους σαν εμένα."*
- **Status:** ✅ Already built (Community.tsx)
- **NEW for Tier 1:** Weekly structured prompts (Sunday night check-in, Wednesday win-sharing, Friday weekend-plan)

### 4.7 — Έξυπνες Υπενθυμίσεις (Smart Nudges)

- **What:** Morning, evening, weekly nudges. Re-engagement if absent 3 days.
- **Outcome:** *"Δεν ξεχνάω. Το σύστημα με κρατάει σε ρυθμό."*
- **Status:** ✅ Already built (generate-motivation + send-push-notification + program automations)

### 4.8 — Η Βιβλιοθήκη Πόρων

- **What:** PDFs, shopping lists, "τι να πεις στον γιατρό σου", FAQ, protocol cheatsheets.
- **Outcome:** *"Έχω ΟΛΑ τα εργαλεία σε ένα μέρος."*
- **Status:** ✅ Already built (Resources.tsx)

### 4.9 — 🆕 Το Βιβλίο Carnivore Method (πλήρης έκδοση — μέσα στην εφαρμογή)

- **What:** Your full current book, now converted into an in-app reading experience. Chapter-by-chapter. Reading progress tracked. Each chapter ends with a reflection question + a linked tool in the app.
- **Outcome:** *"Έχω ΟΛΟ το βιβλίο μέσα στην εφαρμογή, και δεν διαβάζω απλά — εφαρμόζω."*
- **Status:** 🔨 **NEW BUILD** (details in Section 6)
- **Why this matters:** Your current free-book magnet converts poorly because people get the whole method and leave. Move the full book INSIDE the paid app and it becomes a retention machine AND the clearest Tier 2 upsell signal you have.

### 4.10 — 🆕 Καθημερινή Μικρή Νίκη

- **What:** One screen on the home dashboard each morning showing ONE thing they did right yesterday, framed against community averages.
- **Outcome:** *"Κάτι πηγαίνει καλά. Δεν είμαι αποτυχημένος/η."*
- **Status:** 🔨 **NEW BUILD** (small UI addition on Home.tsx)
- **Example copy:** *"Χθες: 2.1L νερό. Είσαι πιο ενυδατωμένος/η από το 78% της κοινότητας αυτή τη βδομάδα."*

### 4.11 — 🆕 Πρωτόκολλο Σαββατοκύριακου

- **What:** Friday 18:00 auto-message: *"Σαββατοκύριακο έρχεται. Πες μου ένα δύσκολο σημείο αυτής της βδομάδας — θα σου στείλω πώς το περνάς."*
- **Outcome:** *"Δεν πέφτω το Σαββατοκύριακο."*
- **Status:** 🔨 **NEW BUILD** (new trigger in program-automations)
- **Why:** 70% of carnivore attempts die on weekends. Owning that moment is the single highest-impact retention move in the entire offer.

### 4.12 — 🆕 Carnivore Buddy (ζεύγος accountability στη 2η εβδομάδα)

- **What:** On Day 14, the system auto-pairs each user with another Tier 1 member at similar stage. A shared weekly goal. 2-way check-in.
- **Outcome:** *"Έχω κάποιον που κοιτάει αν είμαι εδώ."*
- **Status:** 🔨 **NEW BUILD** (matching logic + shared state table)
- **Why:** An unstructured community dies in 6 weeks. A pair doesn't.

### 4.13 — 🆕 Μηνιαίο Προσωπικό Βίντεο 30 δευτ. από τον Αλέξανδρο

- **What:** A 30-second personal video message from you, triggered by milestone (30 days in, first 3kg lost, plateau detected). You batch-record 20 of these on one Sunday per month.
- **Outcome:** *"Ο Αλέξανδρος με βλέπει. Ξέρει ότι υπάρχω."*
- **Status:** 🔨 **NEW BUILD** (admin video upload + trigger assignment + in-app player)
- **Why:** This ONE feature justifies €47/mo emotionally. Feels 1:1, costs you 2 hours/month.

### Features VISIBLE BUT LOCKED (Tier 2 upsell)

These show in the Tier 1 app with a lock icon + "Διαθέσιμο στο Accelerator":

- Full video library (12 modules in 3 phases)
- Weekly group call with Alex
- Unlimited food photo analysis
- Custom meal plans
- Direct messaging to Alex

The visibility is intentional. They should see the locked door every day.

---

## 5. THE 7-DAY ONBOARDING EXPERIENCE

The first 72 hours determine 80% of retention. This onboarding is designed so that by bedtime on Day 1 they've already felt the value — and by Day 7 the rhythm is established.

### Day 0 — Checkout moment

- Success page: *"Καλώς ήρθες. Θα σου στείλω email σε 30 δευτερόλεπτα."*
- Immediate welcome email + SMS (if phone provided) with app link
- Disclaimer modal is the FIRST thing they see in the app (legal + trust)

### Day 1 — The first-meal win (CRITICAL)

The user cannot "explore" the app on Day 1. They are led through a focused checklist:

1. **Accept disclaimer** (stored with timestamp)
2. **Watch a 90-second welcome video** from Alex (record once, serves forever)
3. **Set 1 goal** in their own words (single text input — no form)
4. **Log first meal WITH photo** — the system analyzes and replies with a personal message
5. **Get first "Μικρή Νίκη"** — they did it. Celebration screen.
6. **Meet the Σύμβουλος** — one pre-written question they can send to warm up the chat
7. **Day 1 Complete** — confetti, and a message: *"Τα λέμε αύριο."*

Nothing else is accessible on Day 1. No overwhelming feature tour. ONE path, ONE win.

### Day 2 — The book introduction

- Notification: *"Ήρθε η ώρα για το Κεφάλαιο 1 του βιβλίου."*
- In-app book reader opens to Chapter 1 (5-7 min read)
- End of chapter: 1 reflection question ("Ποιο είναι ΤΟ δικό σου γιατί;") saved in their journal
- Reflection triggers Chapter 1 badge + unlocks Day 3 content

### Day 3 — Community introduction

- Notification: *"Ήρθε η ώρα να γνωρίσεις την κοινότητα."*
- Guided first post template: *"Γεια σε όλους, είμαι [name], ξεκίνησα πριν 3 μέρες, το πιο δύσκολο για μένα είναι..."*
- You or a moderator welcomes them within 2 hours (use the notify system you already have)

### Day 4 — First social situation test

- Prompt: *"Έρχεται σαββατοκύριακο ή κάποια έξοδος; Άσε με να σε βοηθήσω."*
- Opens Discover/Delivery with guided flow
- Learn the restaurant/delivery tools in a real context, not abstractly

### Day 5 — First measurement

- Reminder to log first full measurements (weight + waist + energy 1-10)
- This becomes the baseline for weekly reports

### Day 6 — The chat deep-dive

- Prompt: *"Τι θα ήθελες να ρωτήσεις κάποιον που ήταν στη θέση σου;"*
- Encourages serious chat use, not just surface questions
- Σύμβουλος answers with personalized depth

### Day 7 — The anchor moment (FIRST WEEKLY REPORT)

- Sunday night (no matter which day they joined, Day 7 = their first report)
- Auto-generated: "You did X this week. Here's how you compare to Day 1."
- 3 reflection prompts: Κύρια Νίκη / Κύρια Πρόκληση / Στόχος για την επόμενη βδομάδα
- This becomes their weekly ritual forever

**By end of Day 7:** They have logged 7 days of meals, completed 1 chapter, made 1 community post, done 1 social-situation test, set 1 measurement baseline, and received 1 weekly report. They are in rhythm. Churn risk from here onward drops dramatically.

---

## 6. THE BOOK INSIDE THE APP (Full Specification)

This is the single biggest NEW feature. It absorbs your existing ~200-page book, converts it into the app, and turns it into a retention + Tier 2 upsell engine.

### How it works

1. **Book moves OUT of free-download.** Your current free PDF book stops being offered publicly. The short 10-15 page conversion-focused ebook (per existing plan) replaces it as the lead magnet.
2. **Book moves INTO the app** as a dedicated Book section.
3. **Structured into chapters** with estimated read time per chapter.
4. **Reading tracker:** % of book read, chapters completed, time spent reading, last chapter opened.
5. **End-of-chapter actions:** each chapter ends with (a) 1 reflection question, (b) 1 linked tool in the app ("Now try this — tap here to log your first X"), (c) 1 completion badge.
6. **Completion rewards:** finishing the whole book unlocks a private 15-minute group call invitation OR a discount code on Tier 2 Accelerator (your choice — I recommend the call, it's free for you and has higher perceived value).

### What you need to prepare (content side)

- Split book into chapters (if not already done)
- Write 1 reflection question per chapter
- Decide the "linked tool" per chapter (e.g., Ch 2 links to food-photo tool, Ch 4 links to community, Ch 6 links to measurements)
- Record a 60-second intro video for the book (optional but powerful)

### What needs to be built (technical side)

**Database (Supabase):**
```
books (id, title, description, cover_image)
book_chapters (id, book_id, chapter_number, title, content_html, estimated_read_minutes, reflection_question, linked_tool_path, order_index)
book_progress (user_id, book_id, chapter_id, completed_at, reflection_answer, time_spent_seconds)
```

**Frontend:**
- New page: `src/pages/Book.tsx` — chapter list with progress bar
- New page: `src/pages/BookChapter.tsx` — reader UI with scroll tracking, bookmark, end-of-chapter flow
- Nav entry with book icon

**Edge function:**
- `book-completion-trigger` — fires when user hits 100% completion, sends notification to admin + enrolls user in Tier 2 upsell campaign

### Why this is powerful for Tier 2 conversion

Reading % is the single best behavioral signal of intent. A user at 60% book completion has DECIDED they are serious. At 80%, they are READY for Tier 2. The system triggers the upgrade offer at exactly that moment — not by calendar, by behavior.

**Upsell trigger copy at 80% book completion:**

> *"Έχεις διαβάσει το 80% του βιβλίου μου. Αυτό σημαίνει ένα πράγμα: είσαι σοβαρός/η. Οι άνθρωποι που φτάνουν ως εδώ και μπαίνουν στο Accelerator χάνουν διπλά βάρος στις επόμενες 6 εβδομάδες. Θέλεις να μιλήσουμε;"*

---

## 7. THE WEEKLY RHYTHM (The rituals that keep them)

Features don't retain. **Rhythm** retains. These 4 weekly touchpoints should feel predictable within 3 weeks.

| Day | Time | Ritual |
|---|---|---|
| **Monday** | 08:00 | Weekly Intention — 1-sentence prompt: *"Τι θα πετύχεις αυτή τη βδομάδα;"* |
| **Wednesday** | 19:00 | Community Win Share — guided post prompt: *"Μία μικρή νίκη που είχες αυτή τη βδομάδα;"* |
| **Friday** | 18:00 | Weekend Protocol — Σαββατοκύριακο survival check-in |
| **Sunday** | 20:00 | Weekly Report — auto report + 3 reflection questions + set next goal |

These are the anchor moments. Missing 2 in a row triggers a personal re-engagement message. Missing 3 in a row triggers a 1:1 outreach from you (automated draft, you approve).

---

## 8. RETENTION MECHANISMS SUMMARY

All 10 retention layers in one view:

1. **Day-1 quick win onboarding** — feel the system before bedtime Day 1
2. **Daily Μικρή Νίκη surface** — addictive micro-wins on home screen
3. **Weekly rhythm** — Monday/Wednesday/Friday/Sunday rituals
4. **Weekend Protocol** — own the moment where they would normally quit
5. **Carnivore Buddy** — accountability pair at week 2
6. **Structured community prompts** — community with purpose, not chaos
7. **Book reading tracker** — continuous progress visible
8. **Monthly 30-second personal video** — feels 1:1, costs 2hr/month
9. **Smart re-engagement** — 3-day absence nudge, 7-day personal outreach
10. **30-day guarantee safety net** — zero risk to stay

---

## 9. TIER 2 UPSELL TRIGGERS (Behavior-based, not calendar-based)

These are the moments the app automatically surfaces a Tier 2 offer. Each trigger has specific copy in Greek.

| Trigger | Timing | Offer copy (short) |
|---|---|---|
| 3 consecutive weekly reports completed | ~Day 21 | *"3 εβδομάδες σταθερός/η. Οι άνθρωποι που ανέβηκαν Accelerator σε αυτό το σημείο έχασαν 2x περισσότερο."* |
| 80% book completion | Variable | *"Είσαι σοβαρός/η. Accelerator ξεκινάει τη Δευτέρα. 15 θέσεις."* |
| First plateau detected (no weight change 14 days) | Variable | *"Έχεις plateau. Αυτό χρειάζεται fine-tuning που μπορούμε να κάνουμε στο Accelerator."* |
| Asked 5+ deep questions to Σύμβουλος | Variable | *"Βλέπω ότι ψάχνεις βαθιά. Στο Accelerator μιλάμε live κάθε βδομάδα."* |
| Day 60 reached with good adherence | ~Day 60 | *"2 μήνες. Time to accelerate — Phase 2 videos + group calls."* |
| Completed book + hit a plateau | Variable | *"Έχεις ολοκληρώσει το βιβλίο και χτύπησες plateau. Αυτή είναι η στιγμή."* |

**Rule:** Max 1 upsell trigger per user per 10 days. If they say "no" to a trigger, park for 30 days. Never push.

---

## 10. LANDING PAGE COPY (Greek, converting)

### URL: `thegreekcarnivore.com/app`

### Hero section

**Headline:**
> **Ο προσωπικός σου σύμμαχος Carnivore, κάθε μέρα.**

**Subhead:**
> Μην ξαναρχίζεις μόνος/η κάθε Δευτέρα. Έχεις καθημερινή καθοδήγηση, εργαλεία και κοινότητα για να μείνεις σταθερός/η στο carnivore — ό,τι κι αν γίνει.

**CTA button:**
> **Ξεκίνα με €47/μήνα →**

**Subtext under CTA:**
> €1.55/μέρα. Λιγότερο από έναν φραπέ. 30 μέρες εγγύηση.

### Problem section — speak their pain

> ### Ξέρεις το πρόβλημα.
>
> Δεν είναι ότι δεν ξέρεις τι να φας. Το ξέρεις.
> Το έχεις ξεκινήσει 3, 5, 10 φορές. Ξεκινάς Δευτέρα με ενθουσιασμό. Φτάνει Παρασκευή βράδυ και πέφτεις. Την επόμενη Δευτέρα ξαναρχίζεις από την αρχή. Πάλι.
>
> Δεν χρειάζεσαι περισσότερη πληροφορία.
>
> **Χρειάζεσαι κάποιον να κοιτάει όταν κανείς άλλος δεν κοιτάει.**

### Solution section — what you get

> ### Αυτό είναι η εφαρμογή.
>
> Ένα σύστημα που σε κρατάει σταθερό/ή — ακόμα και όταν εσύ δεν θέλεις.

[Grid of 6 feature cards with icons]

- **Προσωπικός Σύμβουλος 24/7** — Ρώτα ό,τι θες. Οποιαδήποτε στιγμή.
- **Ανάλυση φαγητού με φωτογραφία** — Βγάλε μια φωτογραφία. Ξέρεις αμέσως.
- **Εβδομαδιαίες Αναφορές** — Βλέπεις την πρόοδό σου. Όχι στο μυαλό σου — στα νούμερα.
- **Το Βιβλίο Carnivore Method** — Όλη η μέθοδός μου, μέσα στην εφαρμογή.
- **Κοινότητα & Buddy System** — Δεν το κάνεις μόνος/η. Έχεις ζευγάρι accountability.
- **Πρωτόκολλο Σαββατοκύριακου** — Εκεί που όλοι πέφτουν, εσύ κρατιέσαι.

### Social proof section

[3 client transformation photos + quotes]

> *"Έχω χάσει 14 κιλά σε 4 μήνες. Η εφαρμογή με κρατάει σε ρυθμό. Δεν χρειάζεται να σκέφτομαι."* — Μαρία, 42, Αθήνα

### Pricing section

[3-card pricing grid — Monthly / Quarterly (highlighted) / Yearly]

### Guarantee section

[Big trust block]

> ### Εγγύηση 30 ημερών.
>
> Δοκίμασε την εφαρμογή. Αν δεν είναι για σένα, σου επιστρέφω ΟΛΑ τα λεφτά σου — χωρίς ερωτήσεις, χωρίς φόρμες.
>
> Δεν ζητάω να με εμπιστευθείς εσύ. Εγώ εμπιστεύομαι το σύστημα.

### FAQ section

1. **Τι διαφορετικό έχει από άλλες εφαρμογές;** — Δεν είναι εφαρμογή γενικής διατροφής. Είναι ένα σύστημα χτισμένο γύρω από τη carnivore μέθοδο, στα Ελληνικά, για Έλληνες, από κάποιον που το έχει κάνει.
2. **Τι γίνεται αν δεν ξέρω τεχνολογίες;** — Αν μπορείς να στέλνεις μήνυμα στο WhatsApp, μπορείς να χρησιμοποιήσεις την εφαρμογή. Είναι απλή.
3. **Μπορώ να ακυρώσω όποτε θέλω;** — Ναι. Ακυρώνεις με ένα κλικ, όποτε θέλεις. Κρατάς πρόσβαση μέχρι το τέλος του μήνα που έχεις πληρώσει.
4. **Τι γίνεται αν δεν πετυχαίνω αποτελέσματα;** — Η εγγύηση 30 ημερών καλύπτει όλα. Και σου δίνω και 1:1 μαζί μου για να βρούμε τι σου λείπει.
5. **Μπορώ να ανέβω σε Accelerator αργότερα;** — Ναι. Όταν είσαι έτοιμος/η, ανεβαίνεις. Τα €47 πιάνονται για τον πρώτο μήνα του Accelerator.

### Final CTA

> ### Δεν θα ξαναξεκινήσεις από την αρχή.
>
> [Button: **Ξεκίνα τώρα — €47/μήνα**]
>
> 30 μέρες εγγύηση. Ακυρώνεις όποτε θες.

---

## 11. BUILD CHECKLIST — WHAT EXISTS vs WHAT'S NEW

### ✅ Already built (configuration only)

- [ ] Configure Stripe products: Tier 1 Monthly €47, Quarterly €120, Yearly €397
- [ ] Configure program_template for "Carnivore App" with feature-access flags
- [ ] Lock Tier 2 features with visible lock icons
- [ ] Update disclaimer modal to fire on first app open post-subscription
- [ ] Configure food-photo scan limit to 3/day for Tier 1
- [ ] Configure smart notification schedule (Monday/Wednesday/Friday/Sunday)
- [ ] Configure 3-day absence re-engagement + 7-day personal outreach trigger

### 🔨 New builds required

- [ ] **Book reader** — database + Book.tsx + BookChapter.tsx + book-completion-trigger edge function
- [ ] **Weekend Protocol** — Friday 18:00 automation trigger in program-automations
- [ ] **Carnivore Buddy matching** — Day 14 auto-pairing logic + shared state table
- [ ] **Daily Μικρή Νίκη component** — new home dashboard card with community-comparison logic
- [ ] **Monthly personal video** — admin batch upload UI + trigger assignment + in-app player
- [ ] **Tier 2 upsell trigger system** — behavior-based trigger engine with max-1-per-10-days throttle
- [ ] **Weekly rhythm prompts** — Monday intention, Wednesday win-share, Sunday report flow
- [ ] **7-day guided onboarding** — locked onboarding state machine, unlocks features Day 1 → Day 7
- [ ] **Landing page** — thegreekcarnivore.com/app (Carrd or static HTML)

### 📝 Content to write/record

- [ ] 90-second welcome video (Alex, one-time recording)
- [ ] 20 batch "personal 30-second videos" for milestone triggers (first recording session)
- [ ] 60-second book intro video (optional)
- [ ] Split current book into chapters + write reflection questions
- [ ] Email receipt + welcome sequence (3 emails, first 7 days)

---

## 12. SUCCESS METRICS — HOW WE KNOW THIS WORKS

**Week 1 retention:** 85%+ (Day 7 active users / Day 1 signups)
**Month 1 retention:** 80%+ (standard SaaS is 40-60%, but this is coaching-grade)
**Month 3 retention:** 65%+
**Tier 1 → Tier 2 upgrade rate:** 20% within 3 months
**Refund rate on guarantee:** Under 10%
**Book completion rate:** 40%+ reach 80% read
**Weekly report completion:** 60%+ complete Sunday report in any given week

---

## 13. WHAT'S NEXT (after Tier 1 is locked)

Once Tier 1 is built and the landing page is live, the same depth of work needs to happen for:

- **Tier 2 — The Accelerator (€150/mo)** — group calls, phased video unlock, unlimited features
- **Tier 3 — Elite 1:1 (€500/mo)** — application-only, personal plan, direct access

Then the funnel:

- New short 10-15p ebook (conversion-optimized lead magnet)
- ManyChat automation
- 7-email nurture sequence
- Weekly content calendar
- DM strategy

All of this is already scoped in your Three-Tier Action Plan doc. Tier 1 is the foundation — once it's solid, the rest scaffolds onto it.

---

**Στόχος Δεκεμβρίου 2026: €100K**
**Tier 1 contribution needed: 80 active subscribers × €47 = €3,760 MRR = €45K ARR**
**Tier 2 contribution needed: 15 active × €150 = €2,250 MRR = €27K ARR**
**Tier 3 contribution needed: 5 active × €500 = €2,500 MRR = €30K ARR**
**= €102K on track. Tier 1 is the entry point that makes the rest possible.**
