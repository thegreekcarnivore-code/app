# First Client Setup — Phase 0 Manual Runbook

Your operator's runbook for setting up a new client's complete stack **manually** (Phase 0 — before `provision-new-client.sh` automation exists).

**Use this for:** your first client. And clients #2-3 if you're still in Phase 0.
**After Phase 1 automation ships:** this gets replaced by one terminal command.
**Total wall-clock time:** ~3 days from "client paid" to "first 5 sample reels sent."
**Total active hours on your side:** ~9-12 hours.

---

## Before You Start — Pre-Flight Checklist

**Do not begin infrastructure work until ALL of these are ✓:**

### From the client
- [ ] Brand DNA captured on Zoom #1 (your notes are complete enough to fill the schema).
- [ ] **€5,000 setup invoice paid.** Don't start work on a verbal yes.
- [ ] Meta Business Manager admin access granted to your business account (they add you in their Settings → Users).
- [ ] TikTok creator credentials shared if posting there.
- [ ] Telegram channel created by client (or by you, if they want you to manage it). They give you the chat ID or invite the bot.
- [ ] Domain preference confirmed: subdomain of yours (`maria.reelforge.com`) OR they bought their own (`engine.mariapilates.com`).

### On your side
- [ ] Hetzner Cloud account active with billing.
- [ ] Cloudflare account (or whoever holds the DNS for the chosen domain).
- [ ] Supabase Pro plan active (free tier won't cut it — limits hit fast).
- [ ] OpenAI API key (master account — bill back-to-back to client later, or use a dedicated client key if they prefer).
- [ ] ElevenLabs API key.
- [ ] 1Password (or vault) ready to store this client's secrets in a separate item.
- [ ] GitHub repo with reels code accessible (you can `git clone` from VPS).
- [ ] OpenClaw installer/playbook ready.
- [ ] **A 3-day window blocked** in your calendar — splitting this across distractions causes mistakes.

If any item is unchecked, **stop and resolve it first.** Provisioning errors compound.

---

## The Sequence at a Glance

```
DAY 1 — Inputs & DNS  (~2-3 hrs active)
  ┌──────────────────────────────────────────────────────────────┐
  │  A. Translate Zoom notes → Brand DNA JSON v0.9-draft         │
  │  B. Validate JSON against schema                             │
  │  C. Register/confirm domain + create DNS A record (placeholder IP)│
  └──────────────────────────────────────────────────────────────┘

DAY 2 — Infrastructure  (~4-5 hrs active, lots of waiting)
  ┌──────────────────────────────────────────────────────────────┐
  │  D. Provision VPS (Hetzner CX22, Ubuntu 24.04)               │
  │  E. Update DNS A record to real VPS IP                       │
  │  F. SSH harden (key-only, firewall, non-root user)           │
  │  G. Install base deps (Docker, Caddy)                        │
  │  H. Create Supabase project + capture keys                   │
  │  I. Clone repo → populate .env → run migrations              │
  │  J. Install Brand DNA → start app → SSL via Caddy            │
  └──────────────────────────────────────────────────────────────┘

DAY 3 — Notifications + Content  (~2-4 hrs active)
  ┌──────────────────────────────────────────────────────────────┐
  │  K. Install + configure OpenClaw (dual-routing)              │
  │  L. End-to-end smoke test (1 reel)                           │
  │  M. Connect social accounts (Meta + TikTok OAuth)            │
  │  N. Generate 5 sample reels                                  │
  │  O. QC pass + iterate Brand DNA if needed                    │
  │  P. Record Loom + send to client + book Zoom #2              │
  └──────────────────────────────────────────────────────────────┘

DAYS 4-7 — Client review window
  → Zoom #2 → Brand DNA v1.0 locked → autopilot ON → €500/mo billing starts
```

---

## Day 1 — Inputs & DNS

### Step A — Translate Zoom notes to Brand DNA JSON v0.9-draft (~45 min)

1. Open `ReelForge-Brand-DNA-Schema.md` in another window.
2. Open the Pilates worked example as a reference.
3. Create `clients/{client-slug}/brand-dna.json` in a private working folder (NOT in the repo yet).
4. Fill **every field**. If unknown, mark `"TBD"` and note in a sidecar `questions.md` to ask client at Zoom #2.

**Self-check before proceeding:**
- [ ] `business.sub_niche` is narrow (not "fitness" — "reformer pilates for women 35-55 with back pain")
- [ ] `strategy.differentiator` is a single sharp sentence
- [ ] `ideal_client.pain_points` are RANKED, not just listed
- [ ] `voice.signature_phrases` AND `voice.forbidden_phrases` BOTH populated (forbidden is just as important)
- [ ] `strategy.cta_style` is decided (not blank)
- [ ] `compliance.topics_to_avoid` populated for any health/legal/financial niche

If any of these are weak, **fix them before generating any content.** Bad inputs = bad first drafts = refund risk.

**Verification:** the JSON parses without error AND every field above passes the self-check.

### Step B — Schema-validate the JSON (~5 min)

Run the JSON through a validator (any online JSON Schema validator, or write a tiny Node/Python check). Confirms no missing required fields.

**Failure mode:** validator complains about missing fields. Don't ignore — fix or mark as `TBD` explicitly.

### Step C — Domain + DNS (~30 min, mostly waiting)

**If using your subdomain (e.g., `maria.reelforge.com`):**
1. In Cloudflare DNS for `reelforge.com`, create an A record: `maria` → `1.2.3.4` (placeholder, you'll update once VPS IP is known).
2. Set TTL to 300 (5 min) for now — speeds up later updates.
3. Don't enable Cloudflare proxy yet (orange cloud OFF). Caddy needs direct DNS for SSL.

**If client bought their own domain:**
1. Have them give you DNS admin OR delegate the relevant subdomain to your DNS.
2. Same A-record setup.

**Verification:** `dig +short maria.reelforge.com` returns the placeholder IP within 5 minutes.

**Failure mode:** DNS not propagating. Common causes: wrong nameservers, TTL too high, propagation delay. Wait it out — don't rush to step D until DNS is live or you'll fight SSL battles.

---

## Day 2 — Infrastructure

### Step D — Provision VPS (~15 min active, then waiting)

1. Log in to Hetzner Cloud Console.
2. Create new server:
   - Location: closest to client's audience (Athens audience → Falkenstein/Nuremberg works fine; Greek latency irrelevant)
   - Image: **Ubuntu 24.04 LTS**
   - Type: **CX22** (€4.59/mo, 2 vCPU, 4 GB RAM — sufficient for 30 reels/mo workload)
   - SSH key: your dedicated key for this client (consider a separate key per client for blast-radius isolation)
   - Firewall: create new firewall, allow inbound 22 (SSH), 80, 443. Block everything else.
   - Hostname: `reelforge-{client-slug}` (e.g., `reelforge-maria-pilates`)
3. Note the IPv4 address.
4. Save the IP, root password (if generated), and SSH key reference in 1Password under this client's vault item.

**Verification:** `ssh root@<IP>` succeeds.

### Step E — Update DNS A record to real VPS IP (~5 min)

Cloudflare → DNS → update `maria` A record from placeholder to actual VPS IP. Wait ~5 min for propagation.

**Verification:** `dig +short maria.reelforge.com` returns VPS IP.

### Step F — SSH hardening (~20 min)

On the VPS as root:

1. Create non-root user: `adduser deploy && usermod -aG sudo deploy`.
2. Copy your SSH key to deploy user: `rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy`.
3. Disable root SSH + password auth in `/etc/ssh/sshd_config`:
   - `PermitRootLogin no`
   - `PasswordAuthentication no`
4. Restart SSH: `systemctl restart sshd`. **From a NEW terminal**, verify `ssh deploy@<IP>` works before closing the root session.
5. Enable UFW: `ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable`.
6. Enable unattended-upgrades: `apt install unattended-upgrades -y && dpkg-reconfigure -plow unattended-upgrades`.

**Verification:** `ssh deploy@<IP>` works; `ssh root@<IP>` is rejected.

**Failure mode:** locking yourself out by killing root SSH before confirming deploy user works. Always test the new path FIRST.

### Step G — Install Docker + Caddy (~15 min)

As `deploy` user:

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
# (log out and back in for group to take effect)

# Caddy (for SSL + reverse proxy)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy -y
```

**Verification:** `docker run hello-world` works; `caddy version` returns a version string.

### Step H — Create Supabase project (~15 min)

1. Supabase dashboard → New Project.
2. Organization: your ReelForge org (separate from `bowvosskzbtuxmrwatoj` which stays Greek Carnivore's).
3. Name: `reelforge-{client-slug}`.
4. Region: closest to VPS region.
5. Plan: **Pro** (€25/mo — free tier dies fast at scale).
6. Strong DB password — save in 1Password.
7. Wait for provisioning (~2 min).
8. Capture: **Project URL**, **anon key**, **service_role key**, **DB connection string**. Save in 1Password.

**Verification:** dashboard shows green/healthy; you can connect via the SQL editor.

### Step I — Deploy app code (~45 min)

On VPS as `deploy`:

```bash
mkdir -p ~/apps && cd ~/apps
git clone <your-reels-repo-url> reelforge-{client-slug}
cd reelforge-{client-slug}
```

**Populate `.env`** from a template you keep in 1Password (`reelforge.env.template`). Required values:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
META_ACCESS_TOKEN=...
TIKTOK_ACCESS_TOKEN=...
DOMAIN=maria.reelforge.com
BRAND_DNA_PATH=/app/configs/brand-dna.json
OPENCLAW_CLIENT_TG_CHAT_ID=...
OPENCLAW_OPERATOR_WEBHOOK_URL=...
```

**Run database migrations** against the new Supabase:

```bash
# Whatever your migration runner is — likely supabase CLI
npx supabase db push --db-url "postgresql://..."
```

**Drop the Brand DNA JSON** at `configs/brand-dna.json` (matches `BRAND_DNA_PATH`).

**Build + start the app:**

```bash
docker compose up -d --build
```

**Verification:** `docker compose ps` shows all services healthy. App logs (`docker compose logs -f`) show clean startup with no errors.

### Step J — SSL via Caddy (~10 min)

Create `/etc/caddy/Caddyfile`:

```
maria.reelforge.com {
    reverse_proxy localhost:3000  # whatever port your app exposes
}
```

```bash
sudo systemctl reload caddy
```

Caddy auto-fetches a Let's Encrypt cert on first request.

**Verification:** `curl -I https://maria.reelforge.com/health` returns 200 OK with valid HTTPS cert.

**Failure mode:** SSL fails to provision. Almost always = DNS not actually pointing at VPS. Run `dig` again.

---

## Day 3 — Notifications + Content

### Step K — Install + configure OpenClaw (~30 min)

1. Install OpenClaw on the VPS (follow your existing OpenClaw install procedure).
2. Configure `/etc/openclaw/config.yml`:

```yaml
destinations:
  client_channel:
    type: telegram
    chat_id: "{{ from .env: OPENCLAW_CLIENT_TG_CHAT_ID }}"
    events:
      - reel.published
      - reel.draft_awaiting_approval
      - report.weekly_ready
      - brand_dna.version_bumped

  operator_channel:
    type: discord
    webhook_url: "{{ from .env: OPENCLAW_OPERATOR_WEBHOOK_URL }}"
    events:
      - vps.disk_usage_warning
      - api.quota_warning
      - generation.failure
      - generation.failure_consecutive
      - service.unreachable
```

3. Restart OpenClaw service.
4. **Send test events:**
   - Trigger a `reel.published` test → confirm it lands in client's Telegram channel.
   - Trigger a `vps.disk_usage_warning` test → confirm it lands in YOUR ops Discord.

**Verification:** both channels received their respective test events. NEITHER channel received the OTHER's event.

### Step L — End-to-end smoke test (~15 min)

Trigger a single reel generation through the full pipeline:

1. Manually queue a topic via admin command or DB insert.
2. Watch logs: research step → script (Sonnet 4.6) → grammar (Opus 4.7) → audio (TTS) → caption burning → final video.
3. Verify the resulting `.mp4` lands in the client's Supabase storage and the metadata row in `generated_reels`.

**Verification:** one fully-rendered reel exists end-to-end. You watched it back. It looks like the client's brand.

**Failure modes:**
- LLM fails: check API key in .env, check model availability, check Brand DNA JSON syntax.
- TTS fails: check ElevenLabs key, check voice ID exists, check character quota.
- Caption burning fails: check FFmpeg present in container, check fonts installed.

### Step M — Connect social accounts (~30 min, async with client)

1. **Meta Business Manager:** client invited your business account already (pre-flight). Now connect their Instagram via Meta Graph API OAuth flow → exchange short-lived for long-lived token (60-day) → store in their `.env` as `META_ACCESS_TOKEN`.
2. **TikTok:** OAuth flow via their Creator Marketplace → store token.
3. **Test publish:** post one of the smoke-test reels to their Instagram, then **delete it immediately** (just confirming auth works, don't pollute their feed before v1.0).

**Verification:** test publish succeeded, then deleted, no errors.

### Step N — Generate 5 sample reels (~30-60 min)

Trigger 5 generations across the 5 archetypes. Topic spread:
1. **Pain Point #1** — directly named in hook
2. **Transformation #1** — promise-led hook
3. **Differentiator** — "everyone else does X, I do Y"
4. **Common objection** — answering most-heard hesitation
5. **Credibility / origin story** — proof + identity content

### Step O — QC pass (~30 min)

For each of the 5:
- Voice match the client?
- Forbidden phrases respected? (Search transcript for forbidden list.)
- CTA style correct?
- Would the client read this and say "yes, that's me"?

If a draft is off → identify which Brand DNA field caused it (usually `tone`, `signature_phrases`, or `cta_style`) → tweak → regenerate that ONE reel. **Never ship a draft you'd be embarrassed by.**

### Step P — Loom + Zoom #2 (~30 min)

1. Record a 5-min Loom walking through all 5 drafts, framing each as an archetype, asking for specific feedback.
2. Email client: drafts (linked or attached) + Loom + Zoom #2 confirmation.
3. Calendar invite for Zoom #2 within 3-5 days.

---

## Time Budget — Realistic

| Group | Steps | Active hours | Wall-clock |
|---|---|---|---|
| Day 1 (inputs + DNS) | A-C | 1.5-2 hrs | ½ day |
| Day 2 (infrastructure) | D-J | 4-5 hrs | full day |
| Day 3 (notifications + content) | K-P | 2-4 hrs | ½ day |
| **Total** | | **~9-12 hrs** | **3 days wall-clock** |

If you're consistently hitting 14+ hours per client, that's the signal to **stop and build Phase 1 automation**. Don't grind through 5 manual provisionings.

---

## Common Failure Modes & Fixes

| Failure | Likely cause | Fix |
|---|---|---|
| Smoke test reel sounds nothing like the client | Brand DNA voice fields weak | Re-do voice fields with the Pilates example as reference; regenerate. |
| Forbidden phrase appears in output | Opus grammar-check not catching, or list too short | Add the specific phrase that slipped through; re-run. |
| SSL won't provision | DNS not pointing at VPS / Cloudflare proxy enabled | Confirm DNS via `dig`; turn proxy OFF. |
| OpenClaw test events not arriving | Wrong webhook URL / wrong chat ID / bot not in channel | Send a curl directly to the webhook to isolate; fix config. |
| Supabase migrations fail | Schema mismatch with code version | Make sure repo branch matches the schema; check migration order. |
| Meta token exchange fails | Wrong app ID / app not in Live mode / missing permissions | Check Meta App Dashboard; permissions need approval for production. |
| VPS disk fills during first reel render | CX22 too small for video temp files OR temp not cleaned | Upgrade to CX32 OR confirm cleanup cron is running. |

---

## Definition of Done (for Phase 0 manual setup)

A client setup is complete when:

1. [ ] HTTPS health check at `https://{client-domain}/health` returns 200.
2. [ ] One smoke-test reel rendered end-to-end and you watched it.
3. [ ] OpenClaw test events confirmed in both client and operator channels.
4. [ ] OAuth tokens for Meta + TikTok in `.env`, test publish succeeded.
5. [ ] 5 sample reels generated, QC'd, Loom recorded, sent to client.
6. [ ] Zoom #2 booked.
7. [ ] All secrets in 1Password under this client's vault item.
8. [ ] Brand DNA v0.9-draft committed to `configs/brand-dna.json` on the VPS.

When all 8 are ✓, you've earned the right to wait for Zoom #2.

After Zoom #2 → Brand DNA bumped to v1.0 locked → engine starts auto-generating the week's content → **€500/mo Stripe subscription activates** → enter the weekly evolution loop perpetually.

---

## When This Doc Becomes Obsolete

Once you've built Phase 1 automation (`provision-new-client.sh`), Steps D-J collapse into one terminal command. This runbook stays useful for:
- Steps A-C (always manual — Brand DNA is a human craft)
- Steps L-P (always manual — content QC is a human craft)
- Failure-mode debugging (the table above)

The middle (infrastructure provisioning) is the only part automation can fully replace.
