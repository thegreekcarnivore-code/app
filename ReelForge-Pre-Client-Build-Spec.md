# ReelForge — Pre-Client Build Spec

The build plan for everything you can do BEFORE client #1 is operational. Two stages to build now, two to defer until you have real clients to validate against.

This doc is the source spec to hand to Lovable (or any builder). It pairs with `ReelForge-Migration-Plan.md` (which covers all 4 phases). This one is narrower — only the pre-client subset.

---

## Build Order at a Glance

| Stage | What | Status | Build now? | Calendar time |
|---|---|---|---|---|
| **1** | Engine refactor — Brand DNA-driven, deployment-ready | NEW | ✅ Yes | 1-2 weeks |
| **2** | Operator admin UI | NEW | ✅ Yes | 1-2 weeks |
| 3 | Provisioning automation (`provision-new-client.sh`) | from Migration Plan | ❌ Defer | — |
| 4 | Analytics + weekly report generator | from Migration Plan | ❌ Defer | — |

### Why defer 3 and 4

- **Stage 3 (provisioning automation):** Premature without 2-3 paying clients to validate against. You'll discover provisioning friction only by doing it manually first. Build automation around real friction, not imagined friction. The Phase 0 manual runbook handles clients #1-3 fine.
- **Stage 4 (analytics + reports):** The LLM report drafter has nothing meaningful to draft from until at least 4-6 weeks of real client engagement data flows in. Build it when your weekly manual reports start straining your time — typically around client #4-5.

Total pre-client build time: **~4-6 weeks calendar, ~50-70 hours active.**

---

## Stage 1 — Engine Refactor (Lovable Build Brief)

### The problem you're solving

The existing reels app at `reels.thegreekcarnivore.com` is hardcoded for The Greek Carnivore brand. Brand-specific values — prompts, voice IDs, signature phrases, forbidden words, language defaults, niche terminology, CTAs — are scattered across the codebase as constants and prompt strings.

**Goal:** refactor the engine so **all brand-specific behavior is driven by a single `brand-dna.json` config file** read at runtime. Same engine + different DNA = different output. The Greek Carnivore becomes the first deployment of this refactored engine, with its current settings expressed as a Brand DNA JSON.

### Acceptance criteria (Definition of Done)

1. [ ] **Single source of truth for Brand DNA.** All brand-specific content reads from `configs/brand-dna.json` at runtime. No hardcoded Greek Carnivore-specific strings, voice IDs, or rules anywhere in code.

2. [ ] **All secrets in `.env`.** `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `META_ACCESS_TOKEN`, `OPENCLAW_CLIENT_TG_CHAT_ID`, `OPENCLAW_OPERATOR_WEBHOOK_URL`, etc. Nothing hardcoded.

3. [ ] **Dockerized.** A `Dockerfile` and `docker-compose.yml` at the repo root. `docker compose up -d` boots the entire stack from a fresh clone given valid `.env` and `brand-dna.json`.

4. [ ] **Portable database schema.** Migrations run cleanly against any new Supabase project. The schema is NOT tied to `bowvosskzbtuxmrwatoj`. As part of this work: migrate Greek Carnivore's reels app data to a new dedicated Supabase project (separate from the carnivore main app's project).

5. [ ] **Identical Greek Carnivore output.** Side-by-side test: generate the same 5 topics on the OLD code path and the NEW refactored path. Outputs (titles, scripts, captions, CTAs) must be substantively equivalent. **If voice or quality drifts, the refactor lost fidelity — fix before merging.**

6. [ ] **Healthcheck endpoint.** `GET /health` returns 200 with a JSON body indicating status of: Supabase connection, OpenAI reachability, ElevenLabs reachability, Brand DNA loaded successfully, last successful generation timestamp.

7. [ ] **Brand DNA validator on boot.** App refuses to start if `brand-dna.json` is missing required fields or has invalid types. Fails fast with a clear error message naming the offending field path.

8. [ ] **Hot-reload on SIGHUP.** Sending `kill -HUP <pid>` to the app reloads `brand-dna.json` without restarting. (Required so Stage 2's Brand DNA editor takes effect immediately, no downtime.)

### Architectural notes for Lovable

**Brand DNA loading pattern:**

```
On app boot:
  1. Read configs/brand-dna.json (path from BRAND_DNA_PATH env var, default ./configs/brand-dna.json)
  2. Validate against schema (use ajv for Node / pydantic for Python — pick one)
  3. Load into a singleton accessible by every step (research, script, audio, etc.)
  4. Subscribe to SIGHUP for hot-reload (no restart on DNA edits)
```

**Prompt template injection:**

Every LLM-calling step currently has hardcoded prompts. Refactor each into a template file (e.g., `prompts/script-generation.md`) with `{{brand.field.path}}` placeholders filled from the loaded Brand DNA at runtime. See the canonical prompt template in `ReelForge-Brand-DNA-Schema.md` Section 4.

Use a simple template engine (Mustache, Handlebars, Jinja — pick by language). No fancy logic in templates; just substitution.

**Steps that need refactoring** (per the existing reels app pipeline: research → script → audio → captions → social-description → carousel):

| Step | What to extract from hardcode | Brand DNA field |
|---|---|---|
| Research | Niche, sub-niche, ideal-client profile | `business.*`, `ideal_client.*` |
| Script (Sonnet 4.6) | Tone, signature phrases, forbidden phrases, pain points, transformations, CTAs, archetype weights | `voice.*`, `ideal_client.*`, `strategy.*`, `content_rules.archetype_weights` |
| Grammar (Opus 4.7) | Language, language-specific rules (Greek double-accent, gender agreement), forbidden phrases | `voice.language_primary`, `voice.forbidden_phrases`, `voice.forbidden_words` |
| Audio (TTS) | Voice provider, voice ID, voice style prompt | `audio.*` |
| Captions | Language, font preset | `voice.language_primary`, `visual.title_style_preset` |
| Social description | Brand voice, signature phrases, CTAs, language | `voice.*`, `strategy.*` |
| Carousel | Title style preset, fading-stars rule | `visual.*`, `content_rules.format_specific_rules` |

**Existing rules that MUST persist** (these are locked decisions in the user's memory):
- Reel duration target: 45-50s with 105-145 word spoken body
- Sonnet 4.6 → Opus 4.7 grammar-check pipeline (Option A architecture, ~€0.09/reel)
- 8-word title cap
- 1 CTA per post
- Numbers → Greek words (when `voice.language_primary == "el"` and `content_rules.numbers_to_words == true`)
- Forbidden phrase: "πάτα ακολούθησε"
- Greek double-accent rule (e.g., "ενέργειά σου" not "ενέργεια σου")
- Noun gender agreement rules (e.g., "οι νευροδιαβιβαστές" not "τα νευροδιαβιβαστές")
- Music on by default
- Fading stars + centered text on 1-slide carousels

These rules currently encoded in code/prompts must end up in either Brand DNA fields (if brand-specific) or universal engine logic (if true for all clients). Default Greek-language rules belong in language-specific universal logic, NOT in Brand DNA, since they apply to any Greek-language client.

### Test approach (do not skip)

Before merging the refactor:
1. Pull the current Greek Carnivore app's most recent 5 production reels (titles + scripts + audio).
2. Construct a Brand DNA JSON that captures Greek Carnivore's exact current settings.
3. Re-run the same 5 topics through the NEW refactored engine.
4. **Diff the outputs.** Voice, tone, length, structure must match. Minor stylistic variation acceptable. Major drift = refactor incomplete.
5. If diff acceptable: deploy to staging VPS, generate one fresh reel end-to-end, watch the rendered video, confirm it could pass for a Greek Carnivore reel.

### Out of scope for Stage 1

- Multi-deployment provisioning (Stage 3)
- Admin UI (Stage 2)
- Analytics or report generation (Stage 4)
- Any new features beyond Brand DNA-driven configuration
- Performance optimization unless something is now meaningfully slower

### Definition of Done

You can:
- [ ] Run `docker compose up -d` on a fresh VPS with valid `.env` + `brand-dna.json` → engine starts cleanly.
- [ ] `curl https://your-domain/health` returns 200 with all subsystems green.
- [ ] Generate a reel end-to-end, output is indistinguishable from the OLD code path's output for Greek Carnivore.
- [ ] Edit `brand-dna.json`, send SIGHUP, next generation reflects the change without restart.

---

## Stage 2 — Operator Admin UI (Lovable Build Brief)

### The problem you're solving

Once you have multiple client deployments, SSHing into each VPS to manage things doesn't scale. You need ONE dashboard where you view and manage all your client deployments from one place.

**Important:** this UI is **only for you**. Clients never log in. Single-user from an auth perspective.

### Acceptance criteria

1. [ ] **Hosted at `admin.reelforge.com`** (or chosen final domain — separate from any client deployment).

2. [ ] **Auth: only you.** Supabase Auth (or similar). Single super-admin account. **2FA mandatory.** No registration page; auth seeded manually.

3. [ ] **Connects to N client deployments.** Each deployment's Supabase URL + service-role key stored encrypted in the central admin DB. Adding a new deployment = paste in URL + key + display name + click "Add."

4. [ ] **Pages:**

   **Deployments List** (the home page)
   - Table of all deployments.
   - Columns: client name, status (healthy / warning / down — based on `/health` ping), Brand DNA version, last reel published, last weekly report sent, posts this month.
   - Click row → deployment detail.
   - "Add deployment" button top-right.

   **Deployment Detail** (per-client view)
   - **Brand DNA editor** — structured form with tabs per top-level section (business / ideal_client / voice / strategy / content_rules / visual / audio / scheduling / references / compliance / analytics). NOT raw JSON. Save = bumps Brand DNA minor version, appends entry to `iteration_log`. UI shows version + locked/iterating status prominently.
   - **Iteration log viewer** — chronological list of DNA changes. Click any two versions to see a side-by-side diff.
   - **Content calendar** — next 14 days of scheduled reels in a calendar grid. Click any slot to view, edit, regenerate, or skip.
   - **Recent reels** — last 30 reels in a list with embedded video preview, archetype tag, post date, status (scheduled / published / failed). Engagement metric columns (reach, plays, saves, etc.) — populated by Stage 4; for now show "—".
   - **Manual actions** (action bar): trigger generation now, force-publish next queued reel, pause autopilot, resume autopilot, regenerate last failed reel, send SIGHUP (reload Brand DNA).
   - **Operator notes** — markdown editor for your private notes on this client (preferences observed, things to remember). Never shown to client.

   **Bulk actions (header bar across all pages)**
   - Health check all deployments (one-click ping `/health` on each).
   - Deploy update to all (placeholder button — wires up in Stage 3).

5. [ ] **Greek Carnivore is deployment #1** from day 1, populated automatically by the seed script.

### Tech stack recommendation

- **Frontend:** React + TypeScript + Tailwind. Lovable defaults are fine.
- **Backend:** Supabase Edge Functions for server-side logic. Central admin Supabase project (separate from client Supabases — likely a new dedicated project just for the admin UI's metadata).
- **Brand DNA editor:** use **react-jsonschema-form** (or similar JSON Schema-driven form library) to **auto-render the form from the Brand DNA JSON Schema**. Saves you weeks of bespoke UI work. The schema IS your form.
- **Diff viewer:** use a lightweight JSON diff library (e.g., `jsondiffpatch` + a renderer).
- **Auth:** Supabase Auth with TOTP-based 2FA.

### Why a structured form, not raw JSON

You'll edit Brand DNAs constantly — every weekly report likely produces 1-3 field-level edits per client. Raw JSON editing leads to syntax errors, accidentally dropped fields, and version-control mistakes. A form enforces schema validation, makes editing 5x faster, and is readable for future-you at 11pm Sunday after 4 hours of weekly reports.

### Data flow

```
                            admin.reelforge.com
                                    │
                          (your encrypted secrets DB
                           with each deployment's
                           Supabase URL + service key)
                                    │
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
         Greek Carnivore       Client A             Client B
         Supabase project      Supabase project    Supabase project
         (read/write)          (read/write)        (read/write)
```

The admin UI never holds client *content* data. It only holds the credentials needed to connect TO each client's Supabase, and queries on demand. **Privacy-respectful + matches the locked architecture.**

### Out of scope for Stage 2

- Provisioning automation (Stage 3) — admin UI consumes existing deployments only.
- Analytics charts (Stage 4) — leave placeholder columns in recent-reels metrics.
- Client portal — clients never log in.
- White-label / branding — you're the only user.

### Definition of Done

You can:
- [ ] Log into `admin.reelforge.com` with 2FA.
- [ ] See Greek Carnivore in the deployments list with healthy status.
- [ ] Open Greek Carnivore detail, edit a Brand DNA field, save, see version bumped from v1.0 → v1.1, see entry appear in iteration log.
- [ ] Verify the running engine picks up the new DNA (the SIGHUP fires automatically on save, OR there's a "Reload" button that fires it).
- [ ] View Greek Carnivore's content calendar for the next 14 days.
- [ ] Trigger a manual reel generation from the UI; see it appear in the recent-reels list within minutes.
- [ ] Add a "Test Client" deployment by pasting in another Supabase URL + key, see it appear in the deployments list.

---

## Build sequence — what to do this week vs next

| Week | Focus | Outcome |
|---|---|---|
| **This week** | Hand the Stage 1 brief to Lovable. Start engine refactor. | Engine refactor in progress |
| Weeks 2-3 | Stage 1 ships. Greek Carnivore re-deploys cleanly with Brand DNA-driven engine. Side-by-side validation passes. | First proof the architecture works |
| Weeks 4-5 | Hand the Stage 2 brief to Lovable. Start admin UI. | Admin UI in progress |
| Week 6 | Stage 2 ships. You manage Greek Carnivore from `admin.reelforge.com`. | Ready to plug client #1 into the same admin |

When client #1 lands and pays:
- Provision their VPS via the manual runbook (`ReelForge-First-Client-Setup.md` — no Stage 3 automation yet).
- Drop their Brand DNA JSON.
- Add their deployment to the admin UI (paste Supabase URL + key).
- Manage them through the SAME admin UI you've been polishing for weeks.

By client #3-4, the friction of manual provisioning will tell you exactly what Stage 3 automation needs to do. Build it then, not now.

---

## What you actually do this week

1. **Pick a final brand name** for ReelForge if you haven't. Buy the domain (~€15/yr).
2. **Set up a fresh GitHub repo** for the refactored engine (separate from any existing reels app repo if one exists, or branch off the existing one).
3. **Hand this doc's Stage 1 section to Lovable** in a fresh project session. Reference `ReelForge-Brand-DNA-Schema.md` so it has the schema target.
4. **Block 2 hours daily** for the next 2 weeks to review Lovable's output and steer it. Refactors go off-rails fast without daily attention.
5. **Don't start Stage 2 until Stage 1's side-by-side validation passes.** If the refactor degraded Greek Carnivore output, building admin UI on top doubles the problem.

---

## Risks specific to pre-client building

| Risk | Mitigation |
|---|---|
| Building polished software with no real-world friction = building wrong thing | Stage 1+2 are deliberately the LEAST speculative pieces. Both serve Greek Carnivore from day 1, so you have one real user (yourself) testing them. |
| Refactor breaks Greek Carnivore's content quality | Side-by-side test (acceptance criterion #5) is non-negotiable. Don't merge if outputs drift. |
| Admin UI sprawl — adding features for hypothetical needs | Stick to the acceptance criteria. Anything not listed = next sprint, not this one. |
| Time slips — 4-6 weeks becomes 12 | Weekly milestone reviews. If Stage 1 isn't shipped after 3 weeks, stop and diagnose: scope creep? wrong builder? refactor harder than expected? Don't grind blindly. |
| Lovable produces low-quality code that needs rebuilding | Acceptance criteria are your gate. If output doesn't pass, rebuild that section. Better to lose a week than ship technical debt. |

---

## What's NOT in this doc (deliberately)

- **Stage 3 (provisioning automation):** Full spec already in `ReelForge-Migration-Plan.md` Phase 1. Build when you have 3 clients giving you real provisioning friction to optimize.
- **Stage 4 (analytics + reports):** Full spec already in `ReelForge-Migration-Plan.md` Phase 3. Build when your manual weekly reports become unsustainable.
- **Sales / marketing materials:** Different track. The doc you're reading is the build track only.
- **Client-facing UI:** Cut from architecture by design. Clients never log in.
