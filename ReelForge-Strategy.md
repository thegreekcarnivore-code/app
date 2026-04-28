# ReelForge — Strategy & Roadmap

**Status:** Direction locked 2026-04-27
**Working name:** ReelForge (placeholder — pick final name before Phase 1)

---

## 1. Vision

A fully-managed premium content automation service. Each client gets a **private, isolated content engine** that produces on-brand short-form video content automatically. You operate everything end-to-end. Clients see only the results — content appearing on their socials and a weekly performance + strategy report from you.

Greek Carnivore reels app proves the engine works. ReelForge productizes it for other businesses.

---

## 2. The Two Core Insights

**1. The engine is 95% generic.** The 5% that's brand-specific is data, captured as a structured "Brand DNA" config object. Same engine + different DNA = wildly different output per client.

**2. The real moat is the weekly evolution loop, not the engine.** Every week, performance data feeds back into Brand DNA edits. Bad-performing content patterns die; winners get reinforced. **The DNA is alive, not locked.** Competitors can copy the engine; they can't copy a strategist applying judgment to performance data 52 times a year per client.

---

## 3. Architecture: One Codebase, N Isolated Deployments

```
Source repo (you maintain in git) ──┐
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
   Client A's stack            Client B's stack            Client C's stack
   ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
   │ Own VPS      │            │ Own VPS      │            │ Own VPS      │
   │ Own Supabase │            │ Own Supabase │            │ Own Supabase │
   │ Own domain   │            │ Own domain   │            │ Own domain   │
   │ Own OpenClaw │            │ Own OpenClaw │            │ Own OpenClaw │
   │ Own social   │            │ Own social   │            │ Own social   │
   │  accounts    │            │  accounts    │            │  accounts    │
   └──────┬───────┘            └──────┬───────┘            └──────┬───────┘
          │ posts                     │ posts                     │ posts
          ▼                           ▼                           ▼
     Client A's IG               Client B's IG               Client C's IG

   OpenClaw routes:
   • Client-facing alerts → THEIR Telegram/Discord
   • Operator alerts ─────────────┬────────────────────────────────┐
                                  └──────────────────┬─────────────┘
                                                     ▼
                                            YOUR ops channel
                                       (one place to monitor everything)
```

### Key properties
- **Failure isolation:** Client A crashing cannot affect Client B.
- **Privacy:** client content never flows through your infrastructure.
- **Buyout-ready:** hand over keys, remove operator-channel webhook, done.
- **Single-codebase maintenance:** you push to git once; deploy automation pushes to all VPSes.
- **No client UI ever:** clients have no access to backend or frontend by design. They only see content on their socials + your weekly report.

---

## 4. Pricing (Single Flat Tier)

| Component | Amount |
|---|---|
| **Setup (one-time)** | **€5,000** |
| **Monthly recurring** | **€500** (starts when client confirms satisfaction) |
| **Optional buyout** | **€10,000-€15,000** for full handover at any time |

### What €5,000 setup includes
- Discovery Zoom (45-60 min)
- Brand DNA crafting (v1.0)
- Infrastructure provisioning (VPS, domain, Supabase project, OpenClaw setup, social-account integration)
- 5 sample reels generation
- Review Zoom + Brand DNA v1.0 lock
- 2-week iteration window before €500/mo billing starts

### What €500/month includes
- All infrastructure (VPS, Supabase, LLM, TTS) — ~€60-€85/mo of that is direct cost, the rest is your margin
- Content generation + posting at agreed cadence
- Weekly performance ingestion (Instagram + TikTok APIs)
- Weekly performance + strategy report
- Weekly Brand DNA iteration
- Email support

### Guarantee (instead of free trial)
30-day money-back on the first month's €500 if no reels published in month one. Setup fee non-refundable (work was done). Aligns with premium positioning + your IP-protection preference.

---

## 5. The Service Model — The Weekly Evolution Loop

```
   Monday              Tue-Sat                  Sunday
      │                   │                        │
      ▼                   ▼                        ▼
   Engine            Reels post              Metrics ingested
   generates         on schedule             from IG/TikTok APIs
   week's
   content
                                                   │
                                                   ▼
                                            AI-drafted weekly
                                            analysis report
                                            (Sonnet 4.6)
                                                   │
                                                   ▼
                                            You review, refine,
                                            send to client
                                                   │
                                                   ▼
                                            Brand DNA bumped
                                            (v1.4 → v1.5)
                                                   │
                                                   ▼
                                            Engine picks up new
                                            DNA Monday morning
```

This is what €500/mo actually buys. The compounding improvement over 6 months is the difference between a generic AI-content service and a real strategic partnership.

---

## 6. Roadmap

| Phase | What | Calendar time | Your active hours | Why |
|---|---|---|---|---|
| **0** | Manual sell + manual deploy | 1 week | 3 hrs | Get first paying client |
| **1** | Provisioning automation (one-command "new client" deploy) | 1-2 weeks | 25-40 hrs | Cuts onboarding from days to hours |
| **2** | Admin UI (you only) — single dashboard managing all client deployments | 1 week | 8-12 hrs | Stops you SSH'ing into 10 separate VPSes |
| **3** | **Analytics ingestion + weekly report generator** | 2 weeks | 30-50 hrs | **The actual product moat** — automates the loop |

### What's NOT on the roadmap (deliberately cut)
- ❌ Self-serve client onboarding wizard — clients never log in
- ❌ Client portal / white-label UI — clients never log in
- ❌ Multi-tenant database — every client has their own deployment instead

These cuts are not laziness — they're strategic. They map to the operational decision that you manage everything; clients just receive results.

---

## 7. Capacity & Revenue Path

| Active clients | Weekly hours (with Phase 3 automation) | Monthly recurring |
|---|---|---|
| 1 | 1.5-3 hrs | €500 |
| 5 | 7-15 hrs | €2,500 |
| 10 | 15-30 hrs | €5,000 |
| 12 | 18-36 hrs | €6,000 |
| 15+ | ⚠️ unsustainable without further automation or a junior hire |

**Practical ceiling: 10-12 clients.** Beyond that you either burn out, hire help, or drop service quality. Pick the cap consciously.

### 12-month realistic target

| Months | Focus | Outcome |
|---|---|---|
| 1-3 | Validate end-to-end with 2-3 paying clients (Phase 0 + 1) | First testimonials, schema gaps surfaced |
| 4-6 | 5-7 clients, build Phase 3 (analytics + reports) | The weekly loop becomes automated |
| 7-12 | Hold at 10-12 clients, replace churn selectively | Stable €5-6k MRR + setup income |

**Year 1 expected income:** ~€60k-€90k blend of setup fees + MRR (assuming reasonable close rate, sustainable cadence).

---

## 8. The Moat (Why This Wins)

**What competitors CAN replicate:**
- The reel engine itself (LLM orchestration is increasingly commoditized).
- The Brand DNA schema (the structure could be reverse-engineered).
- The Zoom onboarding script.

**What they CANNOT easily replicate:**
- Your strategic eye on the Zoom call — quality of Brand DNA capture separates good content from generic.
- The weekly evolution loop applied with **human judgment** — automated reports without your refinement become spam. Your hour-per-client-per-week is the unscalable, premium-justifying layer.
- Reputation compounded across happy clients — testimonials from clients showing measurable improvement weekly.

These three layered together = a defensible premium business. Not built to scale to 1,000 clients. Built to be a real, profitable practice serving 10-12 clients excellently.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Manual provisioning takes 6-8 hrs per client | Phase 1 automation is non-negotiable — invest 25-40 hrs once, save 6+ hrs per client thereafter. |
| Weekly reports become shallow as you scale | Phase 3 LLM-drafts the report; you refine. Your time stays bounded; quality stays high. |
| Client demands custom features outside scope | Position firmly: "We're a strategy + content service, not a software vendor." Don't bend the architecture per client. |
| Instagram/TikTok API breakage | Per-client isolation means one breakage doesn't crash everyone. Fix in priority order. Build degradation gracefully (manual posting fallback). |
| Burnout at 12 clients | Cap at 12. Don't take #13 unless automation has expanded or you've hired a junior. |
| Client wants out → demands refund | 30-day money-back guarantee on month 1 only. Setup fee non-refundable. Make this clear in contract. |

---

## 10. Companion Documents

- **`ReelForge-Brand-DNA-Schema.md`** — Full JSON schema, field guide, worked example, LLM prompt template, weekly iteration log structure
- **`ReelForge-Client-Onboarding.md`** — Pre-call form, Zoom #1 script, first-draft generation, Zoom #2 review, **and the weekly evolution loop after v1.0 lock**
- **`ReelForge-Migration-Plan.md`** — Phase-by-phase technical roadmap: provisioning automation, OpenClaw dual-routing, analytics pipeline, report generator

Read in order: Strategy → Brand DNA → Onboarding → Migration. The first three you can use this week. The fourth is the engineering plan for the months after.
