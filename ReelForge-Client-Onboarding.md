# Client Onboarding & Lifecycle Playbook

The full process from "client books a Zoom" to "client is on autopilot with continuous evolution."

**Onboarding window:** ~7 days from first Zoom to v1.0 lock.
**Active onboarding time on your side:** 2.5-3 hours per client.
**Steady-state weekly time per client (after v1.0):** 1.5-3 hours (with Phase 3 automation).

---

## The Lifecycle at a Glance

```
        [Onboarding — one-time, ~7 days]                  [Steady state — perpetual]
        
   1          2            3            4                       5
   │          │            │            │                       │
   ▼          ▼            ▼            ▼                       ▼
Pre-call → Discovery →  First-draft → Review &  ──────────► Weekly evolution
homework   Zoom         generation    Zoom #2                 loop forever
                                      (lock v1.0)
```

| Step | When | Duration | Owner | Outcome |
|---|---|---|---|---|
| 1. **Pre-call homework** | 24-48h before Zoom | 20 min (client) | Client | Filled-in pre-call form |
| 2. **Discovery Zoom** | Zoom #1 | 45-60 min | You | Brand DNA draft (90% complete) |
| 3. **First-draft generation** | After Zoom #1 | 1-2 hours | You / engine | 5 sample reels |
| 4. **Review Zoom + lock v1.0** | Zoom #2 (3-5 days later) | 30 min | You + client | Brand DNA v1.0 locked, autopilot ON, **€500/mo billing starts** |
| 5. **Weekly evolution loop** | Every Sunday → Monday, perpetually | 1.5-3 hrs/week | You + engine | Brand DNA bumps, performance reports, client retention |

---

## Step 1 — Pre-Call Homework (you send via email after they book)

Send 24-48 hours before Zoom #1. Use Google Form or Typeform.

> **Subject:** Welcome — quick prep before our call
>
> Before our call, fill in the questions below. This gets us 50% of the way to your first reel and saves us 30 minutes on the call.
>
> 1. **Brand name + 1-sentence description** of what you sell.
> 2. **Who is your dream client?** (1 paragraph — age, life situation, what's keeping them up at night).
> 3. **Top 3 problems they're trying to solve.**
> 4. **Top 3 outcomes they want from working with you.**
> 5. **What makes you different from others in your niche?** (the angle).
> 6. **3 accounts whose content style you LOVE** (post links).
> 7. **3 accounts whose content style you HATE** (post links).
> 8. **Languages you want content in.**
> 9. **How many posts per week do you want?**
> 10. **Compliance/legal limits** — anything you must NEVER say? (medical claims, etc.).

Clients who fill this in are 3x more likely to convert and be a good fit. Use response (or non-response) as a signal.

---

## Step 2 — The Discovery Zoom (45-60 min)

Open the Brand DNA template (Notion or local doc) on screen-share. Fill in **live as you ask** — clients love seeing their brand take structured shape in real time. It also visibly justifies your fee.

### Opening (3 min)
- Confirm pre-call form contents.
- Set expectations: "We'll go through 4 blocks. By end of call, I have a structured map of your brand. I'll provision your private system this week, generate 5 sample reels, send them as a Loom, then we book a 30-min review. That review locks v1.0 and starts your monthly subscription."

### Block 1 — Business & Audience (15 min)

Fill `business.*` and `ideal_client.*` blocks. Dig deep:

- **"Walk me through your last 3 sales — what was the moment they decided to buy?"** → Real fears/desires.
- **"What objection do you hear most often that you wish people knew the answer to?"** → Content pillar.
- **"Tell me about a client who got an unbelievable result. Starting point and end point?"** → Becomes signature `credibility_proof`.
- **"If your dream client described themselves to a friend, what would they say? Not their job — their identity."** → Fills `psychographics.identity` (most important field).
- **"Rank these pain points by how much they emotionally hurt your client."** → Force ranking.

### Block 2 — Voice & Strategic Angle (15 min)

Fill `voice.*` and `strategy.*` blocks.

- **"If your brand were a person at a dinner party, how would they show up? Funny? Authoritative? Warm? Provocative?"** → Tone.
- **"What does the rest of your industry get WRONG that you do RIGHT?"** → Differentiator. If they can't articulate, reflect back until they say "yes, exactly that."
- **"Are there phrases or words you've found yourself repeating because they capture something you believe?"** → Signature phrases. Listen during the call too.
- **"What language or CTA style do you HATE seeing on Instagram?"** → Forbidden list.
- **"How do you want people to feel after watching one of your reels? In one word."** → Tone sanity-check.

### Block 3 — Visual & Audio Aesthetic (10 min)

Fill `visual.*` and `audio.*` blocks.

- Pull up LOVED accounts together: **"What specifically catches you here? Pacing? Colors? Voiceover style?"** → Build aesthetic vocabulary.
- **"What music plays in your studio / while you work / when you feel most yourself?"** → Honest music answer.
- **"How do you want the voice on the reels to sound — your own, voiceover, male/female, what tone?"** → Voice preset (flag pricing if they want their own voice — different workflow).

### Block 4 — Logistics + Account Access (10 min)

Fill `scheduling.*` and `compliance.*` blocks. Then arrange:

- **Social account access:** Meta Business Manager invite to your agency account, TikTok creator code, etc. (handled async post-call if needed).
- **Domain preference:** Will their content engine live at a subdomain of yours (`maria.reelforge.com`) or their own (`engine.mariapilates.com`)? They never log in either way — this is just where their VPS receives webhooks and admin connects.
- Time zone, posting times, auto-publish vs review-first (default auto-publish).

### Close (5 min)

- Recap captured Brand DNA. Read back differentiator and pain point #1 — get explicit confirmation.
- Confirm payment: €5,000 setup invoiced today; €500/mo starts at v1.0 lock (Zoom #2).
- **Schedule Zoom #2 live**, don't leave to email.

---

## Step 3 — Post-Call: Provisioning + Brand DNA + First Drafts (~5-8 hours your side, mostly automated post-Phase 1)

### 3a. Translate notes → Brand DNA JSON v0.9-draft (~30 min)

Use the schema template. Fill every field. If unknown, mark `TBD` and note what to ask. Self-check before generating:
- Is `differentiator` a sharp single sentence?
- Are `pain_points` ranked, not just listed?
- Are `signature_phrases` and `forbidden_phrases` BOTH populated?
- Is `cta_style` decided?
- Is `compliance` populated for any health/legal/financial niche?

If weak in any, refine before generating — bad inputs = bad first drafts = refund risk.

### 3b. Provision the client's private stack

**Phase 0 (manual):** Follow the per-client provisioning checklist in `ReelForge-Migration-Plan.md` (provision VPS, set up DNS, create Supabase project, install OpenClaw with dual-routing, deploy code, drop Brand DNA in). Takes 6-8 hours manually.

**Phase 1+ (automated):** Run `./provision-new-client.sh maria-pilates` from your terminal. ~30 min wall-clock, ~5 min of your active attention while it runs.

### 3c. Run the first-draft generator (~30-60 min)

On the new client's deployment, trigger 5 reel generations. Topic spread:
1. **Pain Point #1** — directly named in hook
2. **Transformation #1** — promise-led hook
3. **Differentiator** — "everyone else does X, I do Y"
4. **Common objection** — answering most-heard hesitation
5. **Credibility / origin story** — proof + identity content

Covers all 5 reel archetypes. If the engine produces decent output across all 5, Brand DNA is solid.

### 3d. Quality check (~15 min)

For each draft:
- Voice match the client?
- Engine respect forbidden phrases? (Search output for the forbidden list.)
- CTAs the right style?
- Would the client read this and say "yes, that's me"?

If a draft is off, identify which Brand DNA field is responsible (usually `tone`, `signature_phrases`, or `cta_style`), tweak, regenerate. **Never ship a draft you'd be embarrassed by.**

### 3e. Send drafts to client (~15 min)

Record a 5-min Loom walking through all 5 drafts:
- "Draft 1 = pain-point archetype, hook targets pain #1."
- "Draft 2 = transformation, soft CTA."
- "Where I want your feedback: voice match? CTA style? specific words?"

Send Loom + 5 drafts in one email. Confirm Zoom #2 in the same email.

---

## Step 4 — Review Zoom + Lock v1.0 (30 min)

Open all 5 drafts in shared screen.

For each, ask in this order:
1. **"Does this sound like you?"** (voice match)
2. **"Would your dream client stop scrolling for this?"** (hook strength)
3. **"Is the CTA something you'd actually want them to do?"** (CTA fit)
4. **"What would you change?"** (specifics)

Capture every change as a Brand DNA edit. Common edits:
- Add forbidden phrase
- Add missed signature phrase
- Refine `tone` ("more direct, less warm")
- Shift `cta_style`
- Add credibility proof you missed

By end of 30 min:
- Brand DNA bumped to **v1.0** and locked.
- Autopilot enabled (engine generates + auto-publishes per their cadence).
- **€500/mo billing starts.** (Stripe subscription activates today; first charge in 30 days.)
- Set `analytics.baseline_period_start = today`.
- First weekly report delivered after **week 3** (need at least 2-3 weeks of data for meaningful baseline).

---

## Step 5 — The Weekly Evolution Loop (Perpetual)

This is what €500/mo actually buys. Predictable, weekly cadence.

### Weekly schedule

| Day | What happens | Your involvement |
|---|---|---|
| **Mon** | Engine reads latest locked Brand DNA. Generates this week's content (5-7 reels depending on cadence). | None (Phase 3 automation runs) |
| **Tue-Sat** | Reels post automatically per client's `scheduling.preferred_post_times_local`. | None |
| **Sun morning** | Metrics ingestion job pulls last 7 days from IG/TikTok APIs. Aggregator computes per-archetype performance. | None |
| **Sun evening** | LLM (Sonnet 4.6) drafts weekly performance report from structured data. Lands in your admin inbox. | None |
| **Mon morning** | **You review the draft report.** ~30 min per client. Refine wording, sharpen recommendations. | ~30 min/client |
| **Mon afternoon** | Send finalized report to client (PDF or web link). Apply Brand DNA edits → bump version. Engine picks up new DNA. | ~30 min/client |

**Total:** ~1 hour per client per week (Phase 3 automated). Plus ~30-60 min handling client questions/feedback if any.

### What the weekly report contains

1. **Headline** — one sentence summary ("This week reach +18%, top performer was the back-pain hook").
2. **Numbers vs baseline** — reach, plays, completion rate, saves, shares, comments. Trend arrows.
3. **Top 3 reels** — with screenshots, hook, archetype, why it worked.
4. **Bottom 3 reels** — with screenshots, hook, archetype, why it likely underperformed.
5. **Pattern insights** — "Pain-point hooks averaged 2.3x reach vs transformation hooks this week."
6. **Recommended Brand DNA changes** — what fields to bump and why.
7. **Next week's plan** — archetype mix, topic priorities, any A/B test you're running.

The LLM drafts steps 2-4 from raw data. You write/refine 1, 5, 6, 7 — that's where the strategic value lives.

### When to NOT iterate Brand DNA in a given week

- Sample size too small (fewer than 5 reels in the period).
- Single anomalous post skewing averages (e.g., one viral reel inflating reach).
- Client requested a hold while running an external campaign.
- You've hit 3 consecutive weeks of "improving" — let the current DNA cook longer.

Discipline matters. Over-iteration = noise. Skipping a week is a valid choice if the data isn't conclusive.

### Monthly client check-in (end of every 4 weeks)

A short (15-min) Zoom or email touchpoint:
- Recap of past 4 weeks (cumulative metrics, top patterns).
- Any strategic shifts on their side (new product launches, seasonal pushes, events) that should influence content.
- Confirm continued satisfaction (preempts churn).

This is included in €500/mo. Position it as a relationship anchor, not a sales pitch.

---

## Common Pitfalls & How to Avoid Them

| Pitfall | Avoidance |
|---|---|
| Client describes pain points generically | Force specificity: "Tell me about a specific client and the exact words they used." |
| Client can't articulate differentiator | Don't generate content until they can. Reschedule Zoom #2 if needed. |
| Skipping `forbidden_phrases` because client didn't volunteer any | Always ask "what tropes in your industry make you cringe?" |
| Shipping first drafts without your QC pass | Never. Even one bad draft sets the wrong expectation. |
| Letting Zoom #2 slip past 30 min | Discipline. The 5×4 structure is exactly 30 min. |
| Brand DNA edits informal, no version bump | Every change = at minimum a v1.x bump in the iteration log. |
| **Sending raw LLM-drafted weekly report without review** | Never. The LLM drafts the data sections; your judgment writes the recommendations. Skipping your refinement turns the service into spam. |
| **Letting reports become formulaic** | Every 4-6 weeks, look across all clients for cross-cutting patterns ("audio length matters more than I assumed across niches") and feed back into your engine prompts. |

---

## What You Tell the Client This Process Is

**Sales positioning:**
> "I don't just generate content for you. I do a deep brand audit on a Zoom call, turn your brand into a structured 'Brand DNA,' build you your own private content engine on isolated infrastructure, and generate content from that. Then every week I analyze what worked, what didn't, and evolve your DNA — so the engine actually learns your audience over time. Your reels get better month over month. That's why €500/mo, and that's why we cap to a small number of clients per quarter."

This positioning protects your premium pricing because the value is in three layers competitors can't easily replicate:
1. The strategic Brand DNA capture (your judgment).
2. The isolated infrastructure (their data, their stack — premium feel).
3. The weekly evolution loop (compounding improvement they see month-over-month).
