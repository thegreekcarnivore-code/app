# Bike Excellence Product Audit And Feature Roadmap

Date: 2026-03-16
Primary optimization target: coach workflow
Secondary optimization target: brand/shareability growth
Scope: current Bike Excellence app plus future expansion ideas

## Runtime Verification

- Local toolchain: Node `v20.20.1`, npm `10.8.2`
- `npm install --no-audit`: passed
- `npm run build`: passed
- `npm test`: passed, but only 1 smoke test exists
- `npm run lint`: failed with 15 errors and 7 warnings
- Build warning: main JS bundle is very large
  - `dist/assets/index-B0sYdWf5.js`: 1,126.10 kB minified, 344.62 kB gzip
  - `html2canvas` and report/export tooling are part of the shipped client bundle

## Executive Summary

1. The core product loop is good and differentiated. The path from client record to dictated note to AI extraction to published assessment to branded report is a strong coach workflow foundation.
2. The biggest product weakness is the data model, not the UI. Clients and assessments live in browser `localStorage`, while appointments and working hours live in Supabase. That split makes the app inconsistent across devices and risky for real business use.
3. The biggest operational risk is security. Booking and working-hours tables allow anonymous public read and write, and the AI function disables JWT verification. That is acceptable for a prototype, not for a real booking system.
4. The AI assistant is useful, but not yet trustworthy enough for high-confidence coaching records. It can infer goals and setting keys without exposing confidence, uncertainty, or field-level approval.
5. The premium visual language is strong, but it sometimes slows down practical work. Heavy glass effects, ambient overlays, and staggered animations make the app feel polished, but not always fast to scan during live sessions.
6. The public booking page is clean, but it is still a prototype funnel. It lacks deeper intake, hard slot protection, anti-abuse controls, and branded trust signals that would improve conversion and reduce admin follow-up.
7. The report flow is promising but not yet a standout client-facing asset. It is editable and exportable, but it lacks stronger before/after storytelling, visual proof, and higher perceived polish.
8. There is no live reel or video feature in the current app. The carousel primitive exists in the codebase but is unused. Social-media growth should be built on shareable outcomes, not on a generic carousel for its own sake.

## Product Map

### 1. Dashboard / Client Management

- Main entrypoint: `src/pages/Index.tsx`
- Current jobs:
  - Show top-level stats
  - Show weekly schedule
  - Copy public booking link
  - Search and open clients
  - Create client or session
- Product role:
  - Coach command center
  - Daily operational surface

### 2. Client Detail / Session Workspace

- Main entrypoint: `src/pages/ClientDashboard.tsx`
- Current jobs:
  - Review client identity and notes
  - Dictate or type new session notes
  - Send notes to AI analysis
  - Review structured output
  - Publish assessment
  - Edit bike settings
  - Inspect bike diagram and history
- Product role:
  - Main working screen during and after a fit session

### 3. Voice To AI Analysis

- UI: `src/components/VoiceRecorder.tsx`
- Review surface: `src/components/AnalysisReview.tsx`
- Backend logic: `supabase/functions/analyze-notes/index.ts`
- Product role:
  - Save time after sessions
  - Convert messy observations into structured coaching data

### 4. Report Preview / Export

- Main entrypoint: `src/pages/ReportPreview.tsx`
- Export logic: `src/utils/generateReport.ts`
- Product role:
  - Internal summary
  - Client-facing deliverable
  - Potential referral/share asset

### 5. Public Booking

- Main entrypoint: `src/pages/BookingPage.tsx`
- Data hook: `src/hooks/useAppointments.ts`
- Product role:
  - Client conversion funnel
  - Schedule intake

## Detailed Findings

### Speed

#### Finding S1

- Issue: The shipped app bundle is too large for a small workflow product.
- Why it matters: Large initial JS slows first load, especially on mobile or weak connections, and makes the public booking page pay for code it does not need.
- Where it appears: `src/App.tsx`, `src/pages/ReportPreview.tsx`, `src/utils/generateReport.ts`
- Recommended improvement: Lazy-load route pages and dynamically import report/export code so `jspdf`, `jspdf-autotable`, and `html2canvas` are only loaded on the report route.
- Expected impact: Faster initial render, smaller booking-page payload, better perceived speed.

#### Finding S2

- Issue: The main operational surfaces use premium motion everywhere, including staged fade-ins and glow effects.
- Why it matters: The aesthetic is strong, but repeated entrance animations can slow scan speed for a coach opening and reopening screens many times a day.
- Where it appears: `src/pages/Index.tsx`, `src/pages/ClientDashboard.tsx`, `src/pages/BookingPage.tsx`, `tailwind.config.ts`
- Recommended improvement: Keep animation on high-value moments only, reduce repeated page-load choreography, and add reduced-motion handling for custom motion utilities.
- Expected impact: Faster scanning, lower cognitive load, better accessibility.

#### Finding S3

- Issue: Report-generation logic likely pulls heavy libraries into the normal app path.
- Why it matters: Export is valuable, but it is not the first action on every session. Heavy PDF tooling should not dominate the default bundle budget.
- Where it appears: `src/pages/ReportPreview.tsx`, `src/utils/generateReport.ts`
- Recommended improvement: Split report preview into a lazy route and defer export helpers until the user clicks download.
- Expected impact: Better performance without sacrificing export capability.

#### Finding S4

- Issue: The dashboard is visually rich, but not optimized for rapid operational triage.
- Why it matters: Daily workflow apps win on scan speed. Decorative layers such as ambient orbs, noise overlays, and card chrome should not compete with primary actions.
- Where it appears: `src/index.css`, `src/pages/Index.tsx`, `src/pages/ClientDashboard.tsx`
- Recommended improvement: Preserve brand style, but simplify the default operational surfaces and reserve stronger motion/glow for client-facing pages or hero moments.
- Expected impact: Faster decision-making during real work.

### Effectiveness / Reasoning

#### Finding E1

- Issue: The AI extraction step does not expose confidence, uncertainty, or ambiguous fields.
- Why it matters: Bike-fit notes often include partial measurements, verbal shortcuts, and implied reasoning. The current system can over-structure uncertain input without telling the coach what is shaky.
- Where it appears: `supabase/functions/analyze-notes/index.ts`, `src/components/AnalysisReview.tsx`
- Recommended improvement: Add field-level confidence, ambiguity flags, and a required confirmation step for auto-filled bike settings.
- Expected impact: Higher trust and safer publishing.

#### Finding E2

- Issue: The prompt explicitly encourages the model to infer goals even when they are only implied.
- Why it matters: This is useful for summary generation, but risky for durable client records because inferred intent can be mistaken for confirmed intent.
- Where it appears: `supabase/functions/analyze-notes/index.ts`
- Recommended improvement: Separate `explicitly stated` from `inferred` reasoning, and visually distinguish those categories in the review UI.
- Expected impact: Better coaching integrity and less hidden model overreach.

#### Finding E3

- Issue: Publishing AI output is all-or-nothing.
- Why it matters: The coach can review the extracted block, but cannot approve or reject individual changes, measurements, or goals before saving them into history.
- Where it appears: `src/components/AnalysisReview.tsx`, `src/pages/ClientDashboard.tsx`
- Recommended improvement: Allow per-item toggles and inline edits before publish.
- Expected impact: More precise records and better real-world adoption.

#### Finding E4

- Issue: The voice workflow depends on browser speech recognition rather than actual audio capture and transcription.
- Why it matters: This makes the feature lightweight, but fragile. It only works in supported browsers and is sensitive to noisy conditions and browser behavior.
- Where it appears: `src/components/VoiceRecorder.tsx`
- Recommended improvement: Add clear compatibility messaging, typed fallback by default, and later support real audio upload or server-side transcription.
- Expected impact: More reliable note capture and fewer failed dictation attempts.

### Layout / UI

#### Finding L1

- Issue: The visual system is cohesive and premium, but some pages are over-styled for the amount of information they contain.
- Why it matters: Operational products need strong hierarchy more than atmospheric depth. Too much card treatment makes different blocks feel equally important.
- Where it appears: `src/pages/Index.tsx`, `src/pages/ClientDashboard.tsx`
- Recommended improvement: Increase contrast between primary actions, secondary information, and decorative containers. Reduce identical glass-card treatments on dense pages.
- Expected impact: Clearer visual priority and less interface fatigue.

#### Finding L2

- Issue: Dashboard metrics are visually attractive but operationally shallow.
- Why it matters: Total clients, total sessions, and this-week appointments are fine summary stats, but they do not guide the next action.
- Where it appears: `src/pages/Index.tsx`
- Recommended improvement: Replace or augment vanity stats with action stats such as upcoming sessions today, clients needing follow-up, and incomplete reports.
- Expected impact: Better operational usefulness from the landing view.

#### Finding L3

- Issue: The client detail page is strong, but the top action row hides important state changes behind toggle buttons.
- Why it matters: `Note`, `Dictate`, and `Report` are key actions, yet the UI does not show clearly which mode is active or what the next recommended action is.
- Where it appears: `src/pages/ClientDashboard.tsx`
- Recommended improvement: Turn the top row into a clearer workflow strip with explicit states such as `Capture`, `Review`, `Publish`, and `Export`.
- Expected impact: Better session flow and lower operator hesitation.

#### Finding L4

- Issue: The report preview reads more like an editable admin page than a premium document composer.
- Why it matters: The inline edit pattern is practical, but the screen could do more to feel like a polished final artifact.
- Where it appears: `src/pages/ReportPreview.tsx`
- Recommended improvement: Add a stronger document frame, clearer before/after sections, and more designed outcome blocks rather than only editable text chunks.
- Expected impact: Higher perceived professionalism.

### UX

#### Finding U1

- Issue: Unsupported speech recognition falls back to `alert`.
- Why it matters: This is abrupt and low-trust in a premium product, and it does not help the user recover beyond “use Chrome or Edge.”
- Where it appears: `src/components/VoiceRecorder.tsx`
- Recommended improvement: Replace browser alerts with inline guidance and always-visible fallback options.
- Expected impact: Better resilience and smoother failure recovery.

#### Finding U2

- Issue: Booking intake is minimal.
- Why it matters: Minimal forms reduce friction, but they also leave the coach without essential pre-session context such as bike type, goals, symptoms, or fit history.
- Where it appears: `src/pages/BookingPage.tsx`
- Recommended improvement: Add a second, optional intake step or progressive disclosure for richer client context.
- Expected impact: Better prepared sessions without destroying conversion.

#### Finding U3

- Issue: Report edits are ephemeral.
- Why it matters: Users can click to edit the preview, but there is no concept of saving a report draft. A refresh or route exit loses work.
- Where it appears: `src/pages/ReportPreview.tsx`
- Recommended improvement: Add explicit draft save or auto-save behavior tied to persistent report state.
- Expected impact: Safer editing and higher confidence in using the report screen seriously.

#### Finding U4

- Issue: Assessment history is readable but hard to compare over time.
- Why it matters: Timeline narrative is helpful, but coaches also need quick diffing between current settings, prior settings, and trend direction.
- Where it appears: `src/components/AssessmentTimeline.tsx`, `src/components/BikeDiagram.tsx`
- Recommended improvement: Add compare modes, filters, and compact before/after snapshots.
- Expected impact: Stronger longitudinal coaching workflow.

### Data / Persistence

#### Finding D1

- Issue: Core client data is stored only in `localStorage`.
- Why it matters: This creates single-browser persistence, no shared truth across devices, and real risk of data loss or fragmentation.
- Where it appears: `src/hooks/useClients.ts`
- Recommended improvement: Move clients, assessments, and report drafts to a real backend model with sync and backup.
- Expected impact: The app becomes usable as an actual business system instead of a local prototype.

#### Finding D2

- Issue: The product has split persistence: appointments and working hours in Supabase, clients and assessments in local storage.
- Why it matters: Booking a session updates both systems, but they are not transactionally linked. That creates sync drift and inconsistent business state.
- Where it appears: `src/hooks/useAppointments.ts`, `src/hooks/useWorkingHours.ts`, `src/hooks/useClients.ts`, `src/pages/BookingPage.tsx`
- Recommended improvement: Unify business data in one persistence layer and make booking create or update client entities through a single server-side flow.
- Expected impact: Higher data integrity and simpler mental model.

#### Finding D3

- Issue: Booking integrity is enforced in the UI, not the database.
- Why it matters: The page checks whether a slot is taken, but the database does not appear to enforce uniqueness or overlap constraints. Two clients could still book the same slot concurrently.
- Where it appears: `src/pages/BookingPage.tsx`, `supabase/migrations/20260308210529_967f8483-8e95-4e24-a191-d4a7f52a2147.sql`
- Recommended improvement: Add database-level protection for slot collisions and move booking confirmation into a guarded server-side operation.
- Expected impact: Real scheduling reliability.

#### Finding D4

- Issue: Time and date storage is naive.
- Why it matters: Appointments store `DATE` and `TIME` fields without timezone-aware event modeling. That is manageable for one local coach, but brittle for public booking links, travel, or remote consultations.
- Where it appears: `supabase/migrations/20260308210529_967f8483-8e95-4e24-a191-d4a7f52a2147.sql`, `src/pages/BookingPage.tsx`
- Recommended improvement: Store timezone-aware timestamps or explicitly lock booking to a declared business timezone.
- Expected impact: Fewer scheduling errors and cleaner future expansion.

### Trust / Security

#### Finding T1

- Issue: Public anonymous users can read, insert, update, and delete appointments.
- Why it matters: This is the highest-risk issue in the app. Anyone with the public keys and schema access could manipulate schedule data.
- Where it appears: `supabase/migrations/20260308210529_967f8483-8e95-4e24-a191-d4a7f52a2147.sql`
- Recommended improvement: Add proper authentication or server-side booking functions, then lock tables with strict RLS.
- Expected impact: Major reduction in abuse and operational risk.

#### Finding T2

- Issue: Public anonymous users can also update working hours.
- Why it matters: This means the live availability surface can be altered by unauthorized users.
- Where it appears: `supabase/migrations/20260308210529_967f8483-8e95-4e24-a191-d4a7f52a2147.sql`
- Recommended improvement: Restrict working-hours writes to authenticated admin users only.
- Expected impact: Protects the booking funnel and business operations.

#### Finding T3

- Issue: The AI function disables JWT verification.
- Why it matters: That makes prototyping easier, but it weakens control over who can spend AI budget and call the analysis endpoint.
- Where it appears: `supabase/config.toml`
- Recommended improvement: Require authenticated invocation or route AI calls through a server-side access layer with quotas and logging.
- Expected impact: Lower abuse risk and better cost control.

#### Finding T4

- Issue: There is no strong trust layer around AI-generated coaching records.
- Why it matters: The UI makes AI feel seamless, but not sufficiently accountable. Coaches need confidence markers, auditability, and reversible publish actions.
- Where it appears: `src/components/AnalysisReview.tsx`, `src/pages/ClientDashboard.tsx`
- Recommended improvement: Add versioning, confidence, edit history, and undo for published assessments.
- Expected impact: Stronger product trust and better professional credibility.

## Expansion Analysis: Social / Content Potential

- Current state:
  - No live reel or video feature exists in the Bike Excellence app.
  - `src/components/ui/carousel.tsx` exists as an embla wrapper, but is unused in the current product.
- Strategic conclusion:
  - The right next step is not to bolt on a generic content feature.
  - The stronger move is to turn Bike Excellence outputs into branded proof assets:
    - before/after fit snapshots
    - progress cards
    - outcome summaries
    - anonymized case studies
    - testimonial capture flows
- Why this matters:
  - It keeps the product aligned with its core value: better coaching outcomes.
  - It makes social growth a by-product of real session work instead of a separate content tool.

## Prioritized Backlog

### Must Fix Now

1. Secure bookings, working hours, and AI access with proper auth and RLS.
2. Unify clients, assessments, bookings, and report drafts under one persistent backend model.
3. Add confidence, ambiguity, and field-level approval to AI extraction.
4. Reduce bundle size with route-level lazy loading and deferred report tooling.
5. Replace brittle browser-alert voice fallback with a stronger capture and recovery UX.
6. Expand automated tests beyond one smoke test and clean up current lint failures.

### Next Phase

1. Improve the report into a stronger premium deliverable with better outcome storytelling.
2. Add richer booking intake and session prep data.
3. Add compare views and trend views for bike settings and assessment history.
4. Rework dashboard metrics toward next-action usefulness.
5. Add persistent report drafts and saved client-facing summaries.

### Strategic Bets

1. A client portal with reports, recommendations, homework, and follow-ups.
2. Before/after visual proof workflows using posture images and annotated diagrams.
3. Social asset generation from approved session outcomes.
4. Referral and testimonial capture tied to successful reports and follow-ups.
5. Benchmarking across rider segments, bike types, and common issues.

## Top 10 Features To Elevate The App

### 1. Shareable Before/After Fit Cards

Who it helps: coaches and prospective clients. Problem solved: the app currently stores useful outcomes, but does not package them into fast proof. Why it elevates the app: it turns session results into visually strong evidence of value. Social value: easy posting as story/carousel tiles with anonymized metrics and branded visuals. Effort: medium.

### 2. AI Confidence And Approval Queue

Who it helps: coaches. Problem solved: AI output feels helpful but too absolute. Why it elevates the app: it makes the assistant feel professional instead of magical. Social value: more trustworthy data creates better shareable outcomes and less fear of publishing inaccurate insights. Effort: medium.

### 3. Client Progress Dashboard

Who it helps: coaches and returning clients. Problem solved: current history is narrative, not strongly comparative. Why it elevates the app: it shows cumulative gains, repeated pain points, and stable improvements over time. Social value: progress visuals become reusable case-study material. Effort: medium.

### 4. Pre-Fit Intake Questionnaire

Who it helps: both sides. Problem solved: booking only collects name, email, and reason. Why it elevates the app: it makes every session more prepared and increases perceived professionalism before the first meeting. Social value: stronger intake produces stronger case studies and testimonials later. Effort: low to medium.

### 5. Branded Client Portal

Who it helps: clients after the session. Problem solved: reports are exported, but the relationship mostly ends there. Why it elevates the app: it extends the product from session tool to ongoing service platform. Social value: a polished portal creates better word-of-mouth and a more premium brand impression. Effort: high.

### 6. Visual Posture Capture And Overlay

Who it helps: coaches and clients. Problem solved: bike-fit improvement is easier to believe when the difference is visible. Why it elevates the app: it adds objective-looking proof and makes reports more memorable. Social value: before/after visuals are among the strongest organic content assets. Effort: high.

### 7. Session Templates By Rider Type

Who it helps: coaches. Problem solved: every session currently starts from the same blank capture process. Why it elevates the app: it speeds note capture, standardizes reasoning, and improves consistency for road, triathlon, endurance, gravel, and pain-specific sessions. Social value: standardized structures make outcome content easier to repurpose. Effort: low to medium.

### 8. Referral And Testimonial Capture Flow

Who it helps: the business. Problem solved: the current app does not operationalize client satisfaction into growth. Why it elevates the app: it turns positive outcomes into referrals and social proof at the right moment. Social value: direct pipeline for written testimonials, star ratings, and approval-based social snippets. Effort: medium.

### 9. Follow-Up Automation And Reminders

Who it helps: coaches and clients. Problem solved: the app records history but does not actively drive re-engagement. Why it elevates the app: it creates a repeatable care cycle with nudges for follow-up sessions, check-ins, and recommendation reminders. Social value: better follow-up leads to better outcomes, which leads to stronger shareable proof. Effort: medium.

### 10. Outcome-To-Content Studio

Who it helps: the brand side of the business. Problem solved: there is no built-in path from real session output to public-facing content. Why it elevates the app: it uses actual client outcomes to draft post ideas, case-study captions, carousel copy, or reel scripts. Social value: this is the cleanest future bridge from Bike Excellence to social growth without turning the core app into a creator toy. Effort: high.

## Validation Notes

- Voice flow reviewed for:
  - unsupported browser behavior
  - pause/resume
  - transcript editing
  - AI failure handling
  - publish/discard flow
- Booking flow reviewed for:
  - empty states
  - past-slot protection
  - slot collision risk
  - repeat-client handling
  - mobile completion concerns
- Report flow reviewed for:
  - inline editing
  - export readiness
  - premium feel
  - shareability
- Dashboard reviewed for:
  - scan speed
  - hierarchy
  - action usefulness
- Runtime verification added through:
  - dependency install
  - production build
  - tests
  - lint

## Bottom Line

Bike Excellence already has the right product core: structured coaching workflow, note capture, AI assistance, and report generation. The next leap is not a flashy new media layer. It is tightening trust, persistence, and workflow clarity first, then converting real coaching outcomes into premium, shareable proof that grows the business.
