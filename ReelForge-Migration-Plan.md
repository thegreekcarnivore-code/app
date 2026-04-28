# Technical Migration Plan — From Single-Brand to Multi-Deployment

How to evolve the existing reels app (`reels.thegreekcarnivore.com`, deployed on VPS) into ReelForge — a service that runs **N isolated client deployments from a single codebase**.

This is a multi-deployment plan, **not** a multi-tenant SaaS plan. Each client gets their own VPS, their own Supabase, their own domain, their own OpenClaw instance, their own social accounts. Failure isolation, privacy, and buyout-readiness are deliberate properties.

---

## Current State (as of 2026-04-27)

- **Single brand:** The Greek Carnivore is the only deployment.
- **Brand-specific config hardcoded** across automation-generator, automation-scheduler, prompt files, and step-specific configs.
- Single Supabase project (`bowvosskzbtuxmrwatoj`), single VPS.
- Pipeline architecture: Sonnet 4.6 writes → Opus 4.7 grammar-checks (Option A, locked 2026-04-21).
- OpenClaw on this VPS sends Telegram/Discord notifications.

---

## End State

- **One source repo** that you maintain (single codebase in git).
- **N isolated deployments**, one per client. Each has:
  - Own VPS (€15-€25/mo each, e.g., Hetzner CX22)
  - Own Supabase project (€25/mo each, free tier insufficient at scale)
  - Own domain or subdomain
  - Own OpenClaw with dual-routing (client channel + your operator channel)
  - Own API keys for Meta/TikTok/OpenAI/ElevenLabs (most billed back-to-back to client)
  - Own Brand DNA, content calendar, generated assets, publish history
- **Provisioning automation** spins up a new client's stack with one command.
- **Admin UI (you only)** provides a single dashboard view of all client deployments.
- **Analytics + weekly report generator** automates the loop.

---

## Phase 0 — Manual Multi-Deployment (this week, no code changes)

**Goal:** Onboard your first paying client manually with **zero code changes**. Validate demand and revenue before building automation.

### Per-client provisioning checklist (manual, ~6-8 hours)

1. **VPS:** Provision a new Hetzner/Vultr/DigitalOcean instance. Note IP, set up SSH, install Docker + Caddy.
2. **Domain:** Either a subdomain of yours (`maria.reelforge.com` via wildcard DNS) OR a fresh domain you register (€15/yr).
3. **Supabase:** Create new Supabase project. Note project URL + anon + service role keys.
4. **API keys for the client:**
   - OpenAI API key (use your master key for Phase 0 — bill back-to-back later).
   - ElevenLabs API key.
   - Meta access token (Instagram Graph API for posting + analytics).
   - TikTok Creator Marketplace token if applicable.
5. **Clone the repo** to the VPS. Branch off `main`: `git checkout -b client-{slug}`.
6. **Brand DNA:** Drop their JSON file at `configs/brand-dna.json` on this VPS only.
7. **`.env`** populated with their Supabase credentials, their API keys, their domain, their voice ID.
8. **OpenClaw install** on the VPS:
   - Their Telegram bot/channel: receives "reel published," "weekly digest ready," "draft awaiting approval."
   - Your operator webhook: receives "VPS disk 85%," "API quota near limit," "generation failed twice."
9. **SSL:** Caddy auto-provisions Let's Encrypt cert.
10. **Database migrations:** run on their Supabase.
11. **Smoke test:** generate one reel, verify it lands in their content calendar correctly.
12. **Social accounts:** OAuth connect their Instagram + TikTok via Meta Business Manager.

**Limitations you accept temporarily:**
- 6-8 hours per client. Painful past 2-3 clients.
- Manual SSH tunnels for monitoring.
- Updates require you to SSH into each VPS individually and pull the latest code.

**Why do it anyway:**
- Validates that clients pay before you spend 25-40 hours on automation.
- Generates revenue from week 2.
- Forces discovery of provisioning gotchas you'd hit in Phase 1 anyway, but cheaply.

---

## Phase 1 — Provisioning Automation (1-2 weeks)

**Goal:** A single command provisions a new client's complete stack. From "client Brand DNA ready" to "engine generating content" in ~30 minutes wall-clock.

### Build target

```bash
$ ./provision-new-client.sh \
    --slug=maria-pilates \
    --brand-dna-path=./inputs/maria-brand-dna.json \
    --domain=maria.reelforge.com \
    --tier=starter

[1/12] Provisioning Hetzner VPS... ✓ (IP: 49.12.x.x)
[2/12] Configuring DNS A record... ✓
[3/12] Creating Supabase project via Management API... ✓
[4/12] Installing dependencies on VPS (Docker, Caddy, OpenClaw)... ✓
[5/12] Cloning repo to VPS... ✓
[6/12] Generating .env from template + secrets... ✓
[7/12] Running database migrations on client Supabase... ✓
[8/12] Installing Brand DNA v1.0... ✓
[9/12] Configuring OpenClaw dual-routing... ✓
[10/12] Setting up SSL via Caddy... ✓
[11/12] Smoke test (generate 1 reel, verify pipeline)... ✓
[12/12] Sending operator alert via OpenClaw... ✓

✅ Client maria-pilates provisioned in 28m41s.
   Admin URL: https://maria.reelforge.com/admin (your access only)
   Brand DNA: v1.0 locked
   Next step: trigger first batch of 5 sample reels
```

### Components to build

1. **`provision-new-client.sh`** — orchestrator script. Calls each step's tooling.
2. **VPS provisioning module** — uses Hetzner Cloud API (or whichever provider) to spin up an instance, set hostname, install firewall rules.
3. **DNS automation** — uses Cloudflare/DigitalOcean DNS API to create A record.
4. **Supabase Management API integration** — creates a new project, retrieves keys, runs migrations.
5. **Ansible playbook (or simple SSH script)** — installs Docker, Caddy, OpenClaw, deploys repo, configures `.env`.
6. **Brand DNA validator** — schema-checks the JSON before deploy. Fail fast if a required field is missing.
7. **Smoke test runner** — automated end-to-end pipeline test before marking provisioning complete.
8. **Secret management** — central vault (1Password CLI, Vault, or even a private encrypted file) so secrets are templated, not pasted.

### Risk to manage

- **Repo divergence per client.** Don't let yourself commit client-specific changes to their VPS's local clone — they must remain in sync with `main`. All customization lives in `.env` + `brand-dna.json`. **Hard rule.**
- **Secrets sprawl.** Use a vault. Don't paste API keys into chat or scripts. (Memory rule: never ask user to paste secrets via terminal.)

### Deliverable

You can provision a new client in <1 hour active time. New-client onboarding becomes scalable.

---

## Phase 2 — Admin UI (1 week)

**Goal:** Stop SSH'ing into 10 different VPSes. One dashboard managing all client deployments.

### Pages

- **Clients list**
  - All clients, status (healthy / warning / down), last reel published, last weekly report sent, current Brand DNA version, next scheduled post time.
  - Quick filters: tier, status, days-since-onboarded.

- **Client detail**
  - **Brand DNA editor** — structured form (tabs per top-level section). Save = bump minor version.
  - **Iteration log viewer** — chronological history of DNA changes with diffs.
  - **Content calendar** — next 14 days. Click any slot to see/edit/regenerate.
  - **Recent reels** — last 30 with engagement metrics.
  - **Manual actions:** trigger generation, force-publish, pause autopilot, regenerate failed reel.
  - **Operator notes** — your private notes on this client (preferences observed, things to remember).

- **Bulk actions**
  - **Deploy update to all clients:** pulls latest `main` to all VPSes, runs migrations.
  - **Health check all:** pings every VPS, reports status.
  - **Export all reports:** PDF bundle of last week's reports across all clients.

### Implementation note

The admin UI is a single app YOU host (centralized — only you log in). It connects to each client VPS via API + reads each client's Supabase via service-role key. It does NOT hold client content data itself; it queries on demand.

### Auth

Just you. Single super-admin account. 2FA mandatory.

### Deliverable

Onboarding active time drops from ~3 hours (post-provisioning) to ~45 minutes. Daily ops time drops from "SSH into each VPS" to "open dashboard."

---

## Phase 3 — Analytics + Weekly Report Generator (2 weeks)

**Goal:** Automate the weekly evolution loop — the actual product moat.

This phase is **the highest-leverage build of the entire roadmap.** Without it, you're capped at ~5-6 clients before weekly reports become unsustainable. With it, you can serve 10-12 comfortably.

### Component 1: Metrics ingestion (per-VPS daily cron)

On each client's VPS, a daily cron job:
- Calls Instagram Graph API for each reel posted in last 30 days. Pulls: reach, plays, saves, shares, comments, completion rate, avg watch time.
- Calls TikTok API equivalent if applicable.
- Stores in client's Supabase: `reel_metrics` table (reel_id, day, metrics_jsonb).

**Privacy-correct:** metrics stay on the client's VPS/DB. The aggregator (next component) pulls aggregates only, never raw content.

### Component 2: Weekly aggregator (per-VPS Sunday cron)

Every Sunday morning:
- Aggregates last 7 days' metrics by archetype, topic, posting time, voice type, hook style.
- Computes top 3 / bottom 3 reels.
- Compares vs `analytics.baseline_metrics` and previous week.
- Determines `trend_direction` (improving / flat / declining).
- Stores aggregate in client Supabase: `weekly_aggregate` table.

### Component 3: AI report drafter (centralized, runs in your admin app)

Sunday evening, your admin app:
- Pulls each client's `weekly_aggregate` (small payload — aggregates only).
- Calls Sonnet 4.6 with a structured prompt: client's Brand DNA + aggregate data + previous week's report (for continuity) → drafts the weekly report.
- Drops draft into your admin inbox queue.

**Report sections (LLM-drafted):**
1. Headline summary (1 sentence)
2. Numbers vs baseline
3. Top 3 reels analysis
4. Bottom 3 reels analysis
5. Pattern insights
6. **Recommended Brand DNA changes** (specific field-level edits with reasoning)
7. **Next week's plan**

Sections 1, 5, 6, 7 you ALWAYS refine. Don't ship LLM defaults.

### Component 4: Brand DNA edit applier

When you approve a report:
- The recommended DNA edits get staged in a UI (each edit shown with old → new value).
- You can accept all, accept some, or modify before applying.
- On apply: bumps Brand DNA minor version, writes to client's Supabase, appends entry to `iteration_log` with "approved_by_client" pending.
- Email goes to client with the report PDF + a "approve changes" link (they don't have to login — link is signed/expiring).
- Engine picks up new DNA Monday morning.

### Component 5: Report delivery

- PDF generated from the approved report.
- Sent to client via email.
- Stored in client Supabase: `weekly_reports` table.
- Optional: hosted at a signed URL on their domain (`maria.reelforge.com/reports/2026-W23`) so they can revisit.

### Effort estimate

| Subcomponent | Time |
|---|---|
| Metrics ingestion (IG + TikTok APIs) | 5-7 days |
| Aggregator + storage | 2-3 days |
| LLM report drafter (prompt + structured output + integration) | 3-4 days |
| Edit applier UI | 2-3 days |
| Report delivery (PDF gen, email, hosted page) | 1-2 days |
| End-to-end testing across 2 clients | 2 days |

**Total: ~14-21 days of focused work.** Almost certainly the longest phase.

### Deliverable

Your weekly per-client time drops from ~3-5 hours to ~1.5-3 hours. Capacity ceiling expands from ~5 clients to ~12.

---

## Phase Sequencing & Effort Summary

| Phase | Calendar time | Your active hours | Direct cost | Revenue gate |
|---|---|---|---|---|
| 0 | 1 week | ~3 hrs setup + 6-8 hrs/client provisioning | €0 | **Sell before you build** — revenue from week 2 |
| 1 | 1-2 weeks | 25-40 hrs | ~€100 (test VPSes) | Required before client #4 |
| 2 | 1 week | 8-12 hrs | €0 | Required before client #7-10 |
| 3 | 2-3 weeks | 30-50 hrs | ~€100 (LLM during dev) | Required before client #6-8 |

### Recommended sequence

| Weeks | Focus |
|---|---|
| 1-2 | Phase 0. Sell first 2 clients. Provision manually. |
| 3-5 | Phase 1 automation. Greek Carnivore migrated to clean deployment-pattern. |
| 6 | Phase 2 admin UI. |
| 7-8 | Sales push to 5 clients. Manual weekly reports during this window. |
| 9-11 | Phase 3 (analytics + report generator). |
| 12+ | Hold at 10-12 clients. Replace churn selectively. |

**Critical rule:** don't build Phase 3 before Phase 0 has proven the demand. If 3 paying clients don't materialize after 2 months of selling, you have a sales/positioning problem, not a tooling problem. Building automation for an empty pipeline = wasted weeks.

---

## What to Build vs. What to Buy

| Component | Build | Buy / use existing |
|---|---|---|
| Brand DNA schema + LLM injection | ✅ Build (it's the moat) | — |
| Provisioning orchestration script | ✅ Build (custom to your stack) | — |
| Admin UI | ✅ Build via Lovable | — |
| Analytics ingestion + report drafter | ✅ Build (custom integration) | — |
| Auth (admin only) | — | ✅ Supabase Auth or Clerk |
| VPS provider | — | ✅ Hetzner / Vultr / DigitalOcean |
| Supabase project provisioning | — | ✅ Supabase Management API |
| DNS automation | — | ✅ Cloudflare API |
| SSL | — | ✅ Caddy + Let's Encrypt |
| Payments + subscription management | — | ✅ Stripe Checkout + Customer Portal |
| Email transactional | — | ✅ Resend or Postmark |
| PDF generation | — | ✅ Puppeteer / WeasyPrint / similar |
| OpenClaw | — | ✅ Already have it on VPS, replicate per-client |

**Rule:** the only things to BUILD are what makes ReelForge unique. Everything else, pay €5-€50/mo for a vendor.

---

## OpenClaw Per-Client Configuration (Reference)

Each client VPS gets one OpenClaw with two notification destinations:

```yaml
# /etc/openclaw/config.yml on each client VPS

destinations:
  client_channel:
    type: telegram
    chat_id: "{{ CLIENT_TELEGRAM_CHAT_ID }}"  # client's own Telegram channel
    events:
      - reel.published
      - reel.draft_awaiting_approval
      - report.weekly_ready
      - brand_dna.version_bumped

  operator_channel:
    type: discord  # or telegram — your central ops channel
    webhook_url: "{{ OPERATOR_DISCORD_WEBHOOK_URL }}"
    events:
      - vps.disk_usage_warning
      - api.quota_warning
      - generation.failure
      - generation.failure_consecutive
      - service.unreachable
      - subscription.lifecycle_event
```

**On buyout:** delete the `operator_channel` block. That's it. They have a clean self-contained system.

---

## Migration Done = Definition of Done

The migration is complete when:

1. You can onboard a new client (post-Zoom #2) in **<1 hour active time** (Phase 1 + Phase 2).
2. Greek Carnivore content quality is **identical** to pre-migration baseline (validated side-by-side).
3. Each client deployment is **fully isolated** — failure isolation tested by deliberately crashing one client's pipeline; others must not flinch.
4. Weekly reports auto-generate; you only **review and refine**, not author from scratch.
5. You've gone a full month without manually SSH'ing into a single VPS.
6. Stripe subscription lifecycle (signup → pause → cancel → buyout-handoff) works end-to-end.
7. **At least 5 active paying clients** are running on the new infra without daily intervention.

When all 7 are true, ReelForge is a real productized service. Until then, you've built a manual high-touch agency.
