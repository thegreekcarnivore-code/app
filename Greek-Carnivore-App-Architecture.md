# THE GREEK CARNIVORE — APP ARCHITECTURE & PROGRAM LAYOUT
## How the app manufactures the feeling *"this is exactly what I need"* — and naturally guides users up the tier ladder

**Version:** 1.0 — April 2026
**Status:** Architecture spec. Ready for implementation.
**Companion docs:**
- Offer: `Greek-Carnivore-Tier-1-Offer.md`
- Strategy: `Greek-Carnivore-Three-Tier-Action-Plan.docx`

This doc covers TWO layers:
1. **THE PROGRAM** — the structured coaching experience (what the user goes through over 30/60/90+ days)
2. **THE APP** — the UI/UX that delivers that program, designed to maximize daily return and natural tier upgrades

---

## PART 1 — DESIGN PRINCIPLES (the foundation)

Six principles govern every decision in this doc. When in doubt, go back to these.

### 1. The app is a *rhythm*, not a *feature set*
Users don't pay €47/mo for features. They pay for the feeling of *being held accountable every day*. The job of the UI is to make the daily return trip feel automatic — same moments, same rituals, same small wins.

### 2. Home is the anchor. Everything else is secondary.
A user opens the app → they should know in 2 seconds: *"what's today's win, what's my one thing, how am I doing."* Home must answer all three.

### 3. Lock features *visibly*, never silently.
Hidden features = hidden upsell. Locked features shown with premium aesthetic = constant gentle reminder that more exists. **Every Tier 1 user should see the locked Accelerator door every single day**, framed as an invitation, not a block.

### 4. Upsell by *behavior*, not by *calendar*.
Nudges triggered by what they DO (finished 3 reports, hit 80% of book, plateaued 14 days) convert 3-5× better than time-based nudges.

### 5. The program has *phases*, and the UI reflects them.
Week 1 must look and feel different from Week 4 and from Month 3. Progress must be visible. Change over time is the single strongest signal that the system is working.

### 6. Scarcity of the coach's time = premium of higher tiers.
Alex's face, Alex's voice, Alex's time are distributed in CAREFULLY CURATED MOMENTS. The message is always: *"Alex is available — just climb."*

---

## PART 2 — THE PROGRAM (5 phases)

Tier 1 is not "app access." It's a **structured 12-week program** that users can extend indefinitely. The app is the delivery mechanism. Each phase has a clear goal, specific activities, retention moments, and natural Tier 2 upsell triggers.

### Phase 0 — Acquisition & First 24 Hours
**Goal:** Convert a lead into a committed user. Get their first win before bed.

| Activity | When | Why |
|---|---|---|
| Lead magnet (new short 10-15p ebook) | Pre-purchase | Curiosity, email capture |
| Email nurture sequence (7 emails) | Days 0-14 | Build trust, show value |
| Purchase decision | Any time | €47/mo or €120/quarter |
| Welcome email + SMS | Within 60s of purchase | Reduce anxiety |
| Disclaimer + welcome video (90s) | First app open | Legal + emotional anchor |
| First goal set (1 sentence) | Day 1, minute 3 | Intention → commitment bias |
| First meal logged with photo | Day 1, any time | First win, first system interaction |
| Day 1 complete screen | Day 1, evening | Closure, ritualize the day |

**Retention moment:** The Day 1 Complete screen is the single highest-leverage moment in the entire program. It must feel earned, celebratory, and confirm: *"I just did something different today."*

### Phase 1 — Foundation (Days 2-14)
**Goal:** Establish the daily rhythm. Install habits. Let them feel the system working before motivation wanes.

| Activity | When | Why |
|---|---|---|
| Book Chapter 1 | Day 2 | Start the method journey |
| First community post | Day 3 | Social accountability begins |
| First social-situation test (Discover) | Day 4 | Test in real life |
| First measurement (baseline) | Day 5 | Future progress needs a baseline |
| First deep Σύμβουλος chat | Day 6 | Teach them to use the chat |
| First Weekly Report | Day 7 | THE anchor ritual for all future weeks |
| Daily Μικρή Νίκη | Every day | Addictive micro-progress |
| Book Chapters 2-4 | Days 9, 11, 13 | Reading continues |
| Carnivore Buddy assigned | Day 14 | Pair accountability installed |

**Retention moment:** Day 7 Weekly Report. From here forward, Sunday night = report night. Forever.

**Tier 2 upsell signal (do NOT trigger yet — too early):** N/A. Tier 1 is earning trust.

### Phase 2 — Consolidation (Days 15-42)
**Goal:** Hit the 30-day mark. Weather the first dip in motivation. Make the rhythm autopilot.

| Activity | When | Why |
|---|---|---|
| Weekly rhythm (Mon/Wed/Fri/Sun) | Every week | Autopilot rituals |
| Book Chapters 5-8 | Spread across phase | Deepen method understanding |
| Buddy accountability check-ins | Weekly | Pair system kicks in |
| First "Μηνιαίο Personal Video" from Alex | Day 30 | Emotional reinforcement |
| Plateau detection active | Daily | Catch stalls automatically |
| Community win-share prompts | Wednesdays | Public progress |

**Retention moment:** Day 30 celebration. 30 days consistent → badge → Alex's personal video → community shoutout.

**Tier 2 upsell signal triggers:**
- Day 21: 3 consecutive weekly reports → first soft nudge
- Day 28: 30-day milestone → second soft nudge

### Phase 3 — Method (Days 43-84)
**Goal:** Deep integration. Make carnivore a lifestyle, not a diet. Complete the book.

| Activity | When | Why |
|---|---|---|
| Book Chapters 9-12 | Spread across phase | Finish the method |
| 80% book completion triggered | Variable | THE key Tier 2 signal |
| Bonus content unlocked | Month 3 | New value keeps them engaged |
| Advanced Σύμβουλος topics | As they ask | Deepen their knowledge |
| Community leadership | Organic | They help newer members |

**Retention moment:** Book completion. Full-screen ceremony. Completion badge. Unlock of a private 15-min group call with Alex (the call is free for Alex — 20 book-completers on one call).

**Tier 2 upsell signal triggers:**
- 80% book completion: the biggest natural trigger — send the clearest Tier 2 offer
- Day 60 with good adherence: second major trigger

### Phase 4 — Lifestyle (Day 85+)
**Goal:** Retention forever. Turn them into long-term members or natural Tier 2 upgrades.

| Activity | When | Why |
|---|---|---|
| Monthly new content (recipes, mini-videos) | Month 4+ | Fresh value avoids staleness |
| Monthly Personal Videos continue | Monthly | Alex presence maintained |
| Community leadership recognition | Ongoing | Status within the group |
| Tier 2 upgrade offered regularly | Behavior-triggered | Natural progression |
| Tier 3 offered for stuck-plateau members | As needed | Top of ladder available |

**Retention moment:** Quarterly milestone (Day 90) celebration with major content release and special community event.

---

## PART 3 — THE APP UI/UX (architecture that delivers the program)

### 3.1 — The 5-tab bottom navigation (current state + proposed refinement)

**Current tabs:** Home, Discover, Measurements, Learn, Community (+ Admin).

**Proposed refined tabs (5 primary):**

| Tab | Label (GR / EN) | Icon concept | What's inside |
|---|---|---|---|
| 1 | **Σήμερα** / Today | Flame | Daily loop, rhythm prompts, quick actions, progress pulse |
| 2 | **Σύμβουλος** / Coach | Chat bubble | Concierge chat (always-on), voice input, photo scan button |
| 3 | **Πρόοδος** / Progress | Line chart | Measurements, weekly reports, photos, trends |
| 4 | **Μέθοδος** / Method | Book + play | Book, videos, recipes, resources — all learning content |
| 5 | **Κοινότητα** / Community | People | Feed, buddy, prompts, live events |

**What changes from current:**
- Rename **Home → Σήμερα** (Today) — emotionally stronger, more ritual-oriented
- **Rename Discover → NOT a main tab** — move restaurant/delivery/travel to Σήμερα as Quick Tools + Concierge as button
- **Concierge is promoted to a primary tab** — it's your #1 retention feature, it deserves a permanent slot
- **Measurements → Πρόοδος** (Progress) — bigger, includes weekly reports prominently
- **Learn → Μέθοδος** (Method) — rename to reflect it's your METHOD, not generic learning. Book becomes the anchor inside.

**What stays:** Top-right bell (notifications), top-right avatar (profile/settings), admin mode for Alex.

---

### 3.2 — Screen by screen: what's on each tab

#### TAB 1 — Σήμερα (The most important screen)

This is the screen they see most often. It must answer three questions in 2 seconds:
- *Πώς πήγα χθες;* (How did I do yesterday?)
- *Τι έχω να κάνω σήμερα;* (What do I do today?)
- *Πού βρίσκομαι στη διαδρομή μου;* (Where am I in the journey?)

**Layout (top to bottom, mobile scroll):**

```
┌──────────────────────────────────┐
│ 🔥 Day 34 · Phase 2              │  ← Phase indicator + day count
│ Καλημέρα, Μαρία 👋                │  ← Greeting with name
│ Streak: 🔥 12 days                │  ← Streak badge
├──────────────────────────────────┤
│                                   │
│  🏆 ΧΘΕΣ: ΜΙΚΡΗ ΝΙΚΗ              │  ← Daily Μικρή Νίκη banner
│  2.1L νερό — πιο ενυδατωμένη      │   (NEW component)
│  από το 78% της κοινότητας        │
│                                   │
├──────────────────────────────────┤
│ ΣΗΜΕΡΑ                            │  ← Today section
│                                   │
│ [📷 Log Φαγητό] [💬 Ρώτα]         │  ← Quick Actions (4 cards)
│ [📊 Check-in]   [📖 Διάβασε]      │
│                                   │
├──────────────────────────────────┤
│ 📚 ΤΟ ΒΙΒΛΙΟ                      │  ← Book Progress card
│ Κεφάλαιο 4 — 45% διαβασμένο       │   (NEW component)
│ [▓▓▓▓▓░░░░░] Συνέχισε →           │
├──────────────────────────────────┤
│ 📅 ΑΥΤΗ ΤΗ ΒΔΟΜΑΔΑ                │  ← Weekly Rhythm card
│                                   │
│ ✓ Δευτέρα: Intention              │
│ ○ Τετάρτη: Μοιράσου νίκη          │
│ ○ Παρασκευή: Weekend Protocol     │
│ ○ Κυριακή: Weekly Report          │
├──────────────────────────────────┤
│ 🎯 ΠΡΟΓΡΑΜΜΑ                      │  ← Program Phase card (existing)
│ Week 5 of 12 · Phase 2            │
│ Next milestone: Day 42            │
│ [Progress bar ▓▓▓▓▓░░░░░░░░]      │
├──────────────────────────────────┤
│ 👥 Η ΠΑΡΕΑ ΣΟΥ                    │  ← Buddy card
│ Buddy: Γιώργος · 15 μέρες         │   (NEW component)
│ "Πώς πήγε χθες η ημέρα σου;"     │
├──────────────────────────────────┤
│ ⚡ ΓΡΗΓΟΡΑ ΕΡΓΑΛΕΙΑ              │  ← Discover Quick Tools (collapsed)
│ [Εστιατόρια] [Delivery] [Ταξίδι]  │   (was its own tab)
├──────────────────────────────────┤
│ 🔒 ACCELERATOR                    │  ← Upsell peek (only after Day 7)
│ Ξεκλείδωσε live calls με τον      │   (NEW component)
│ Αλέξανδρο. Επόμενο: Σάββατο 11:00 │
│ [Δες περισσότερα →]                │
└──────────────────────────────────┘
```

**Conditional rendering rules:**
- **Streak badge** shows only if streak ≥ 2 days
- **Μικρή Νίκη** shows only if there's yesterday data (skip first day)
- **Weekly Rhythm card** highlights current day's prompt (pulsing dot)
- **Buddy card** appears only after Day 14 (when buddy is assigned)
- **Accelerator peek** appears only after Day 7, and rotates its messaging based on what Tier 2 feature would be most compelling for this user's stage

**On first launch (Day 1) the entire home screen is REPLACED by the onboarding flow** (see Section 3.7).

#### TAB 2 — Σύμβουλος (Concierge Chat)

**Layout:** Full-screen chat — already built, minor enhancements.

**Enhancements to add:**
- **Pinned prompt examples at top** (rotating daily): *"Ρώτα με: Τι να φάω σήμερα; / Τι να κάνω αν δεν πεινάω; / Έχω stall — τι κάνω;"* → makes chat feel inviting, removes "blank page syndrome"
- **Voice input button** (already exists, make it prominent) — Greek users love voice
- **Food photo scan button** — direct entry into photo analysis (counts against 3/day limit)
- **"Ρώτησε το Accelerator" button** (subtle, bottom of chat) — when user asks a question the Σύμβουλος can't answer definitively, offer: *"Θα μπορούσα να ρωτήσω τον ίδιο τον Αλέξανδρο στο Accelerator."* Upsell by context.
- **Session memory indicator** — small text: *"Ο Σύμβουλος θυμάται τη συζήτησή μας τις τελευταίες 7 ημέρες."* Builds continuity feel.

**Locked feature visible:** Below the input, a muted banner: *"Θες να μιλήσεις απευθείας με τον Αλέξανδρο; Αυτό είναι στο Accelerator. [Μάθε περισσότερα]"*. Triggers only if user has sent 10+ messages in past 7 days (they're engaged enough to upsell).

#### TAB 3 — Πρόοδος (Progress)

**Layout:** 3 sub-tabs at top — **Σώμα** / **Φαγητό** / **Φωτογραφίες** (as currently structured), plus a prominent **Weekly Report** section.

**Enhancements:**

1. **Weekly Report is the star.** At the top of Πρόοδος, above the sub-tabs, a permanent card:
   ```
   ┌──────────────────────────────────┐
   │ 📊 ΕΒΔΟΜΑΔΙΑΙΑ ΑΝΑΦΟΡΑ           │
   │ Κυριακή 20:00 — 3 ημέρες ακόμα    │
   │ 5/7 ημέρες logged αυτή τη βδομάδα │
   │ [Προετοιμάσου για την αναφορά →]   │
   └──────────────────────────────────┘
   ```

2. **Trends visualization** — weight line graph prominent. Mood/energy/sleep trend lines. **Comparison with other community members** ("Είσαι στο top 40% σε σταθερότητα αυτό τον μήνα") — aggregated, anonymous, motivating.

3. **Plateau detection badge** — if system detects 14 days no change, a gentle card appears: *"Το σώμα σου εξισορροπεί. Αυτό είναι φυσιολογικό. [Δες τι να κάνεις]"* — tap opens either a Σύμβουλος-guided troubleshoot OR a soft Tier 2 nudge.

4. **Photo comparison** — side-by-side current vs Day 1 vs milestone. Triggers at Day 14, Day 30, Day 60, Day 90.

#### TAB 4 — Μέθοδος (Method)

**Layout:** 4 sub-tabs or cards — **Βιβλίο** / **Videos** / **Recipes** / **Resources**.

**BOOK (the flagship addition):**

```
┌──────────────────────────────────┐
│ 📖 CARNIVORE METHOD               │
│ Από τον Αλέξανδρο                 │
│ [Cover image]                     │
│                                   │
│ 🎯 Πρόοδος: 45% διαβασμένο        │
│ [▓▓▓▓▓░░░░░]                      │
│                                   │
│ [Συνέχισε το Κεφάλαιο 4 →]        │
├──────────────────────────────────┤
│ ΚΕΦΑΛΑΙΑ                          │
│                                   │
│ ✅ 1. Τι είναι το Carnivore       │
│ ✅ 2. Γιατί δουλεύει              │
│ ✅ 3. Οι πρώτες 7 ημέρες          │
│ 📖 4. Τα 3 μεγάλα λάθη            │ ← currently reading
│ 🔒 5. Plateau — πώς το σπας       │ ← next
│ 🔒 ...                             │
│                                   │
│ 🏆 Ολοκλήρωση: 15λ group call     │ ← Reward preview
│    με τον Αλέξανδρο (ΔΩΡΟ)        │
└──────────────────────────────────┘
```

**Inside a chapter (reader view):**
- Full-screen, typography-focused (serif, large line-height, warm off-white bg)
- Scroll tracking (resume where they left off)
- Bookmark button (top right)
- Highlight feature (select text → highlight gold)
- Estimated remaining read time shown in corner
- End of chapter: a fixed card appears:
  ```
  ┌──────────────────────────────────┐
  │ ✨ Ολοκλήρωσες το Κεφάλαιο 4      │
  │                                   │
  │ Σκέψου: Ποιο είναι ΤΟ μεγαλύτερο  │
  │ λάθος ΣΟΥ μέχρι τώρα;             │
  │ [Γράψε σκέψη...]                  │
  │                                   │
  │ 🛠 Τώρα δοκίμασε: Log το επόμενό  │
  │   σου γεύμα με φωτό.              │
  │   [Άνοιξε Σύμβουλο →]             │
  │                                   │
  │ [Επόμενο κεφάλαιο →]              │
  └──────────────────────────────────┘
  ```

**VIDEOS tab** (inside Μέθοδος):
- **Module 1** (ΒΑΣΗ, Weeks 1-4) — all 4 videos UNLOCKED for Tier 1. This is a NEW permission (currently locked fully). Give them the foundation freely. This is key — 4 videos gives them a TASTE of Accelerator quality and desire for more.
- **Modules 2-12** — VISIBLE with lock icon + "Accelerator only" label + preview thumbnails. Tap locked module → elegant upsell modal (see Section 3.5).

**RECIPES tab:** current database (already built).

**RESOURCES tab:** PDFs, cheatsheets, shopping lists (already built).

#### TAB 5 — Κοινότητα (Community)

**Layout:** Feed + structured prompts + buddy panel.

**Enhancements:**

1. **Structured Weekly Prompts at top** (pinned card):
   - Monday: *"Ποιος είναι ο στόχος σου αυτή τη βδομάδα;"*
   - Wednesday: *"Μία μικρή νίκη από αυτή τη βδομάδα;"*
   - Friday: *"Τι σχεδιάζεις για το Σαββατοκύριακο;"*
   - Sunday: *"Τι έμαθες αυτή τη βδομάδα;"*

2. **Buddy panel** — shows your assigned buddy, their recent activity, a prompt to check in.

3. **Win Wall** — a dedicated tab/section showing only transformation posts. Acts as social proof constantly.

4. **Live Events preview (locked)** — shows upcoming Accelerator group calls: *"Σάββατο 11:00 — Live με τον Αλέξανδρο. Διαθέσιμο στο Accelerator. 12 μέλη θα είναι εκεί."*

5. **Moderation** — Alex uses Admin mode to pin posts, post weekly announcements, welcome new members. You should spend 10 min/day here.

---

### 3.3 — The Daily Loop (what a user does each day)

The entire app is architected around a predictable daily loop. If the user doesn't do this, re-engagement triggers. If they do, they feel in control.

**Morning loop (3-5 min):**
1. Open app → Σήμερα tab
2. See yesterday's Μικρή Νίκη (dopamine hit #1)
3. See streak (dopamine hit #2)
4. See today's prompt (Monday intention, Wednesday win share, etc.)
5. Log breakfast with photo (or quick-log without photo)
6. Read 5-10 min of current book chapter (optional)

**Midday loop (1-2 min):**
1. Open app (notification-triggered)
2. Quick meal log
3. Optional Σύμβουλος chat (question, craving help)

**Evening loop (3-5 min):**
1. Open app → Σήμερα
2. Complete daily check-in (wellness scores)
3. Community: see wins, maybe post
4. Buddy: quick message to partner
5. See tomorrow's preview

**Weekly anchor (Sunday 20:00, 10 min):**
1. Push notification: *"Ώρα για την Εβδομαδιαία Αναφορά σου."*
2. Auto-generated report loads
3. User fills 3 reflection prompts:
   - Κύρια νίκη της βδομάδας
   - Κύρια πρόκληση
   - Ένας στόχος για την επόμενη βδομάδα
4. Report saved. Visible forever in Πρόοδος → Weekly Reports.

---

### 3.4 — The Weekly Rhythm (4 anchor moments)

These 4 touchpoints create the "ritual" that retains. They are **automated** (via `program-automations`) and **gentle** (never pushy).

| Day | Time | Notification | Screen change |
|---|---|---|---|
| Monday | 08:00 | *"Νέα βδομάδα. Τι θα πετύχεις;"* | Σήμερα shows prompt at top |
| Wednesday | 19:00 | *"Μοιράσου μία μικρή νίκη."* | Κοινότητα shows guided post prompt |
| Friday | 18:00 | *"Σαββατοκύριακο έρχεται. Ρωτήσου κάτι."* | Σήμερα shows Weekend Protocol card |
| Sunday | 20:00 | *"Ώρα της εβδομαδιαίας αναφοράς."* | Direct deep-link into report flow |

**Rule:** If user misses 2 rhythm moments in a row → soft re-engagement message. If 3 in a row → personal outreach from Alex (via admin dashboard alert).

---

### 3.5 — Upsell UX Patterns (how Tier 2/3 offers appear)

This is where most apps fail: either too pushy (burns goodwill) or too invisible (no upgrades). The right pattern: **premium-feel locked content shown constantly, but only ACTIONABLE upsells triggered by behavior**.

#### Pattern A — Passive "premium peek" (always visible)

Used for: locked video modules, locked features, live events.

Visual: dimmed or glass-blur preview + small gold lock icon + label *"Accelerator"*.

Tap behavior: opens a **non-pushy modal**:

```
┌──────────────────────────────────┐
│ [close X]                         │
│                                   │
│ 🔒 Μέρος του Accelerator          │
│                                   │
│ Αυτό το module είναι μέρος της    │
│ Phase 2 του Accelerator (Weeks    │
│ 5-8). Για να το ξεκλειδώσεις      │
│ έχεις πρόσβαση σε:                │
│                                   │
│ • Εβδομαδιαίο live call με Αλέξ. │
│ • Όλα τα 12 modules               │
│ • Απεριόριστη ανάλυση φωτό        │
│ • Accelerator κοινότητα            │
│                                   │
│ €150/μήνα                         │
│                                   │
│ [Δες αναλυτικά →]                 │
│ [Συνέχισε με το Tier 1]           │
└──────────────────────────────────┘
```

**Critical:** The modal is INFORMATIONAL, not a hard close. "Συνέχισε με το Tier 1" is the secondary button, equal dignity. No countdown timers. No scarcity spam. This is premium, not sleazy.

#### Pattern B — Behavior-triggered upsell (the money pattern)

Used for: the key moments when the user is MOST likely to say yes.

These fire **as full-screen moments** (not ads, not modals — dedicated screens the user navigates through):

| Trigger | Screen title | Approx conversion |
|---|---|---|
| 3 consecutive weekly reports completed | *"3 εβδομάδες. Είσαι διαφορετικός/η."* | 8-12% to Tier 2 |
| 80% book completion | *"Έχεις μάθει τη μέθοδο. Τώρα εφάρμοσέ την στο βαθύ επίπεδο."* | 15-25% to Tier 2 |
| First plateau detected (14 days no change) | *"Stall είναι φυσιολογικό. Fine-tuning χρειάζεται."* | 5-10% to Tier 2 |
| Day 30 milestone | *"Ένας μήνας. Εδώ αποφασίζουν όσοι θέλουν περισσότερο."* | 5-8% to Tier 2 |
| Day 60 milestone with good adherence | *"60 μέρες. Time to accelerate."* | 10-15% to Tier 2 |

**Throttle:** Max 1 behavior-triggered upsell per user per 10 days. If they say "not now", park 30 days. NEVER stack upsells.

#### Pattern C — Contextual upsell (inside features)

Tiny in-line nudges inside features, where relevant:

- In Σύμβουλος chat, after a deep question: *"Αυτή η ερώτηση είναι live-call υλικό. Ο Αλέξανδρος το καλύπτει στο Accelerator."*
- On plateau detection card: *"Fine-tuning στο Accelerator — Phase 2 εστιάζει εκεί."*
- Next to locked videos: *"3 νέα videos αυτό τον μήνα στο Accelerator."*

These are **passive and non-interruptive** — they exist to remind, not to sell.

#### Pattern D — Tier 3 (Elite 1:1) upsell

Only surfaces in 2 places, very rarely:
1. **From Tier 2 (Accelerator) users** who've been plateaued + maxed out the group calls. (This is the natural Tier 3 funnel — they've climbed the ladder.)
2. **Post-refund optional form** for Tier 1 refunders who self-identified as needing more (see offer doc).

**Never shows Tier 3 pricing in the Tier 1 app.** Tier 3 is application-only. The magic comes from scarcity.

---

### 3.6 — Tier Identity in the UI

Users should always know what tier they're on. This serves two purposes: (1) they feel the value of what they HAVE, and (2) they see what they could have.

**Top-left badge on every screen:**

```
Tier 1: [Carnivore App]      ← gold text on dark
Tier 2: [Accelerator]         ← bronze text, slightly embossed
Tier 3: [Elite]               ← crimson + gold, premium feel
```

**On Profile screen:**
- Current tier prominently displayed
- "Σε ποιο επίπεδο είσαι τώρα" with visible steps: Carnivore App → Accelerator → Elite
- Subtle "See all tiers" button that opens a clean comparison view
- This is where a Tier 1 user goes when they're CONSIDERING upgrading — make it beautiful, informative, not salesy.

---

### 3.7 — The 7-Day Onboarding Flow (first-time UI)

The first 7 days, the app behaves differently from the normal state. Home is REPLACED by a guided day-by-day flow. Other tabs accessible but dimmed.

**Day 1 — Welcome**
```
┌──────────────────────────────────┐
│ Καλώς ήρθες, Μαρία 👋             │
│                                   │
│ Ημέρα 1 από 7                     │
│ [▓░░░░░░]                         │
│                                   │
│ ΣΗΜΕΡΑ                            │
│                                   │
│ ✓ Αποδέχτηκες τους όρους          │
│ → Δες το welcome video (90s)       │
│ ○ Γράψε 1 στόχο σου              │
│ ○ Κατέγραψε το πρώτο σου γεύμα    │
│ ○ Γνώρισε τον Σύμβουλό σου        │
│                                   │
└──────────────────────────────────┘
```

**Days 2-6:** same structure, one task per day.
- Day 2: Read Chapter 1
- Day 3: Post in community
- Day 4: Try a social situation
- Day 5: Log first measurement
- Day 6: Have a deep Σύμβουλος chat

**Day 7:** Weekly Report — after this, the onboarding banner disappears. User enters the normal rhythm permanently.

**Why this works:** Focus. One task per day. No overwhelm. The user can't "get lost" in features they don't need yet.

---

### 3.8 — Retention Mechanisms built into the UI (summary)

Every design decision above serves one of these 10 retention pillars:

| # | Mechanism | Where in UI |
|---|---|---|
| 1 | Daily Μικρή Νίκη | Σήμερα top banner |
| 2 | Streak | Σήμερα header badge |
| 3 | Weekly rhythm rituals | Σήμερα rhythm card + notifications |
| 4 | Phase progression visible | Σήμερα program card with phase name |
| 5 | Book reading progress | Μέθοδος book card + Σήμερα card |
| 6 | Monthly personal video from Alex | Notification + Σήμερα banner when delivered |
| 7 | Buddy pairing | Σήμερα buddy card + Κοινότητα buddy panel |
| 8 | Plateau catch + support | Πρόοδος card when detected |
| 9 | Weekend Protocol | Friday 18:00 auto-trigger |
| 10 | 7-day onboarding → forever rhythm | Days 1-7 replaces home, then steady state |

---

### 3.9 — What makes them KEEP COMING BACK (the psychology)

Retention is not about features. It's about **predictable emotional beats**. The UI should trigger these every day:

- **Competence** — *"I did something today."* (Μικρή Νίκη, streak)
- **Progress** — *"I'm moving forward."* (Phase, book %, weight trend)
- **Belonging** — *"I'm not alone."* (Buddy, community, comments)
- **Support** — *"Someone's got me."* (Σύμβουλος, Alex's monthly video)
- **Anticipation** — *"Something's coming."* (Next milestone, next chapter, next weekly report)

If a user opens the app and feels any 2 of these 5 emotions, they return tomorrow. The UI above is designed to trigger AT LEAST 3 on every open.

---

### 3.10 — Build Changes Required (mapped to existing code)

Most of this builds ON what exists. Here's the concrete change list:

**Modify (existing components):**

| File | Change |
|---|---|
| `src/components/BottomNav.tsx` | Change tabs from Home/Discover/Measurements/Learn/Community → Σήμερα/Σύμβουλος/Πρόοδος/Μέθοδος/Κοινότητα. Rename labels + restructure route mapping. |
| `src/pages/Home.tsx` | Rebuild as Σήμερα per layout in Section 3.2. Add Μικρή Νίκη banner, streak badge, weekly rhythm card, buddy card, Accelerator peek. |
| `src/pages/Concierge.tsx` | Promote to its own top-level tab `/coach`. Add pinned prompt examples, voice prominence, Ρώτησε-Accelerator button. |
| `src/pages/Measurements.tsx` | Rename to Πρόοδος. Add prominent Weekly Report card at top. Add community comparison widget. Add plateau detection card. |
| `src/pages/VideoLibrary.tsx` | Merge into Μέθοδος page with sub-tabs. Unlock Phase 1 (Modules 1-4) for Tier 1 users. Keep Phases 2-3 locked with premium-peek UI. |
| `src/pages/Community.tsx` | Add structured weekly prompts, buddy panel, live events preview, win wall section. |
| `supabase/functions/stripe-webhook/index.ts` | Add refund detection → send post-refund email with apply form link. |
| `supabase/functions/program-automations/*` | Add Friday 18:00 weekend protocol trigger, Monday 08:00 intention prompt, Wednesday 19:00 win prompt. |

**New components to build:**

| Component | Purpose |
|---|---|
| `src/pages/Book.tsx` | Book chapter list with progress |
| `src/pages/BookChapter.tsx` | Full-screen reader with scroll tracking, highlights, end-of-chapter flow |
| `src/components/home/DailyWinBanner.tsx` | Daily Μικρή Νίκη surface |
| `src/components/home/StreakBadge.tsx` | Streak counter |
| `src/components/home/WeeklyRhythmCard.tsx` | Monday/Wed/Fri/Sun prompt card |
| `src/components/home/BuddyCard.tsx` | Buddy pairing display |
| `src/components/home/AcceleratorPeek.tsx` | Soft Tier 2 peek on home |
| `src/components/upsell/UpsellModal.tsx` | Reusable Pattern A modal for locked features |
| `src/components/upsell/BehaviorTriggeredUpsell.tsx` | Full-screen Pattern B trigger moments |
| `src/components/onboarding/SevenDayFlow.tsx` | Day 1-7 guided state machine |
| `src/components/community/WeeklyPromptCard.tsx` | Structured weekly prompts |
| `src/components/community/BuddyPanel.tsx` | Buddy pair feature in community |
| `src/components/community/WinWall.tsx` | Transformation-only feed section |
| `src/components/progress/WeeklyReportCard.tsx` | Prominent report card on Πρόοδος |
| `src/components/progress/PlateauDetectionCard.tsx` | Plateau card + Tier 2 nudge |

**New database tables (Supabase):**

| Table | Purpose |
|---|---|
| `books` | Book metadata |
| `book_chapters` | Chapter content + reflection prompts |
| `book_progress` | Per-user reading state |
| `buddy_pairings` | Day-14 buddy assignments |
| `upsell_events` | Track when upsell triggered + user response (for throttle + analytics) |
| `personal_videos` | Monthly video uploads + trigger rules |
| `daily_wins` | Computed daily win per user (materialized or view) |
| `streak_state` | Current user streak |

---

## PART 4 — OFFER TEMPLATE SUMMARY (the one-page view)

For when you need to reference the Tier 1 offer quickly (full detail in `Greek-Carnivore-Tier-1-Offer.md`):

```
╔══════════════════════════════════════════════════════╗
║          CARNIVORE APP — €47/ΜΗΝΑ                     ║
║  Ο προσωπικός σου σύμμαχος Carnivore, κάθε μέρα.     ║
║  Δεν ξαναρχίζεις από την αρχή κάθε Δευτέρα.          ║
╚══════════════════════════════════════════════════════╝

🎯 ΓΙΑ ΠΟΙΟΝ
Έχει δοκιμάσει carnivore ή keto και έπεσε. Θέλει αποτέλεσμα
αλλά χρειάζεται δομή, όχι άλλη πληροφορία.

💰 ΚΟΣΤΟΣ
€47/μήνα (ή €120 τρίμηνο, ή €397 έτος)
€1.55/μέρα — λιγότερο από έναν φραπέ

🛡 ΕΓΓΥΗΣΗ
30 ημέρες. Πλήρης επιστροφή. Χωρίς ερωτήσεις.

✅ ΤΙ ΠΑΙΡΝΕΙ
• Προσωπικός Σύμβουλος 24/7
• Ανάλυση φαγητού με φωτογραφία (3/ημέρα)
• Εβδομαδιαία αναφορά & tracking
• ΟΛΟ το βιβλίο Carnivore Method μέσα στην εφαρμογή
• Κοινότητα + Carnivore Buddy
• Πρωτόκολλο Σαββατοκύριακου
• Καθημερινή Μικρή Νίκη
• Μηνιαίο προσωπικό βίντεο από Αλέξανδρο
• Εστιατόρια / Delivery / Travel finder
• Phase 1 (Weeks 1-4) video modules

🔒 ΑΥΤΑ ΥΠΑΡΧΟΥΝ ΣΤΟ ACCELERATOR
• Εβδομαδιαία live calls με Αλέξανδρο
• Phase 2 & 3 videos (Modules 5-12)
• Unlimited food photo analysis
• Accelerator-only κοινότητα

📈 ΦΥΣΙΚΟ ΜΟΝΟΠΑΤΙ
3 εβδομάδες consistent → προσφορά Accelerator
80% βιβλίου → ισχυρή προσφορά Accelerator
Plateau 14 ημέρες → fine-tuning @ Accelerator
Accelerator full → αίτηση για Elite 1:1
```

---

## NEXT STEPS

1. **Review this architecture.** Flag anything you want to change.
2. **Decide priority order** for build. My suggested order:
   - **Week 1:** Rebuild Σήμερα home screen + rename nav tabs + add streak/Μικρή Νίκη widgets
   - **Week 1-2:** Build Book reader (highest-leverage single feature)
   - **Week 2:** Wire Phase 1 video unlocks for Tier 1 + premium-peek locked modules
   - **Week 2-3:** Build weekly rhythm prompts + Weekend Protocol trigger
   - **Week 3:** Build behavior-triggered upsell engine
   - **Week 3-4:** Build buddy pairing + monthly personal video system
   - **Week 4:** 7-day onboarding flow
3. **Content preparation (parallel):**
   - Split book into chapters with reflection questions
   - Record 90-second welcome video
   - Record first batch of 20 monthly 30-sec videos

Once Tier 1 app is live and humming, move to Tier 2 (Accelerator) architecture — it's a layer ON TOP of this, not a different app.

---

**The one sentence that governs everything in this doc:**

> *The app is a rhythm, not a feature set. The user returns because the rhythm holds them — and the rhythm, every day, quietly shows them there's a higher tier waiting when they're ready.*
