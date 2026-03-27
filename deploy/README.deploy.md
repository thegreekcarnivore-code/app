# The Greek Carnivore App — VPS Deployment Guide

## Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser    │────▶│  Hetzner VPS     │     │   Supabase      │
│   (client)   │     │  Nginx → dist/   │     │                 │
│              │     │  (static files)  │     │  • Database      │
│              │────────────────────────────▶│  • Auth          │
│              │     │                  │     │  • Storage       │
│              │     │                  │     │  • Edge Funcs    │
└─────────────┘     └──────────────────┘     │  • Realtime      │
                                              └─────────────────┘
```

The VPS only serves static files. All backend logic stays in Supabase.

---

## What Changed vs What Didn't

| Component | Status | Notes |
|-----------|--------|-------|
| React frontend | **MOVED to VPS** | Built and served by Nginx |
| Supabase DB | Unchanged | Same project, same URL |
| Supabase Auth | Unchanged | Need to add redirect URLs |
| Supabase Edge Functions | Unchanged | Called directly from browser |
| Supabase Storage | Unchanged | Direct browser access |
| GitHub repo | Unchanged | Same repo, cloned on VPS |
| DNS | Manual change later | Only after staging is tested |

---

## Prerequisites

- Hetzner VPS with root access (Ubuntu 22.04+)
- Domain DNS access (IONOS)
- GitHub access to `thegreekcarnivore-code/app`

---

## Step-by-Step Execution

### Phase 1: MacBook (preparation)

Nothing to do — the repo is already on GitHub.

### Phase 2: VPS Setup

#### 2.1 — SSH into VPS as root

```bash
ssh root@178.104.103.233
```

#### 2.2 — Install Git if needed

```bash
apt-get update && apt-get install -y git curl
```

#### 2.3 — Set up GitHub access

The repo is private, so you need a deploy key or personal access token:

```bash
# Option A: Deploy key (recommended)
ssh-keygen -t ed25519 -C "vps-deploy" -f /root/.ssh/github_deploy
cat /root/.ssh/github_deploy.pub
# → Add this key to GitHub repo → Settings → Deploy keys

# Option B: HTTPS with token
# Use a GitHub PAT when cloning
```

#### 2.4 — Copy deploy files to VPS

From your MacBook:
```bash
scp -r ~/Downloads/thegreekcarnivore-main/deploy/ root@178.104.103.233:/tmp/deploy/
```

#### 2.5 — Install Nginx configs

```bash
cp /tmp/deploy/nginx.staging.conf /etc/nginx/sites-available/staging.app.thegreekcarnivore.com
cp /tmp/deploy/nginx.production.conf /etc/nginx/sites-available/app.thegreekcarnivore.com
```

#### 2.6 — Create .env.production

```bash
cp /tmp/deploy/.env.production.example /srv/thegreekcarnivore-app/.env.production
nano /srv/thegreekcarnivore-app/.env.production
# Fill in: VITE_SUPABASE_PUBLISHABLE_KEY (your anon key)
```

**Note:** The .env.production file must exist BEFORE running deploy.sh.
Create the directory first if needed:
```bash
mkdir -p /srv/thegreekcarnivore-app
cp /tmp/deploy/.env.production.example /srv/thegreekcarnivore-app/.env.production
nano /srv/thegreekcarnivore-app/.env.production
```

#### 2.7 — Copy and run deploy script

```bash
cp /tmp/deploy/deploy.sh /srv/deploy.sh
chmod +x /srv/deploy.sh
bash /srv/deploy.sh
```

This will:
- Install Node 20 + Nginx (if needed)
- Clone the repo
- Install dependencies
- Build the frontend
- Enable Nginx configs
- Reload Nginx

#### 2.8 — Set up SSL for staging

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d staging.app.thegreekcarnivore.com
```

---

### Phase 3: DNS (staging only)

In IONOS DNS, add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | staging.app | 178.104.103.233 | 300 |

**Do NOT change the main `app` A record yet.**

Wait for DNS propagation (~5-15 min), then visit:
`https://staging.app.thegreekcarnivore.com`

---

### Phase 4: Supabase Auth Configuration

In Supabase Dashboard → Authentication → URL Configuration:

1. **Add to "Redirect URLs"**:
   ```
   https://staging.app.thegreekcarnivore.com/**
   ```

2. Later, for production (only after DNS cutover):
   ```
   https://app.thegreekcarnivore.com/**
   ```

   (This should already exist if it's your current production URL)

**Important:** Do NOT remove the existing Netlify redirect URLs until you've fully cut over.

---

### Phase 5: Staging Test Checklist

Test each of these on `staging.app.thegreekcarnivore.com`:

- [ ] Homepage loads correctly
- [ ] All images load (recipes, covers, favicon)
- [ ] Login works (email + password)
- [ ] Login works (magic link — check redirect URL)
- [ ] Password reset works
- [ ] Client dashboard loads after login
- [ ] Admin dashboard loads (admin user)
- [ ] Measurements page works
- [ ] Food entry with voice transcription works
- [ ] AI concierge chat works
- [ ] Push notifications can be subscribed
- [ ] Restaurant exploration loads
- [ ] Profile page loads and saves
- [ ] PWA install prompt appears on mobile
- [ ] Service worker registers (check DevTools → Application)
- [ ] Stripe checkout redirects work
- [ ] Zoom call links work
- [ ] Page refresh on deep routes works (e.g., /measurements, /admin)
- [ ] Mobile responsiveness is correct

---

### Phase 6: Production Cutover Checklist

Only proceed if ALL staging tests pass.

1. **In IONOS DNS:**

   Change the `app` A record:
   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | A | app | 178.104.103.233 | 300 |

2. **Wait for DNS propagation** (check with `dig app.thegreekcarnivore.com`)

3. **Run SSL for production:**
   ```bash
   certbot --nginx -d app.thegreekcarnivore.com
   ```

4. **Verify production** at `https://app.thegreekcarnivore.com`

5. **Keep Netlify running** for 48 hours as fallback

6. **After 48h stable:** disable Netlify deployment

---

## Likely Failure Points

| Issue | Cause | Fix |
|-------|-------|-----|
| Login redirects to old URL | Supabase redirect URLs not updated | Add new URLs in Supabase Auth settings |
| Magic links go to Netlify | Supabase "Site URL" still points to Netlify | Update Site URL in Supabase Auth settings |
| 404 on page refresh | Nginx not configured for SPA | Check `try_files` directive is present |
| Push notifications fail | Service worker scope mismatch | Clear service worker, re-register |
| Images broken | Supabase storage URLs changed | They shouldn't — storage is direct from Supabase |
| CORS errors | Supabase doesn't allow new origin | Shouldn't happen — Supabase anon key works from any origin |
| Build fails | Missing env vars | Check .env.production exists with all VITE_ vars |
| SSL cert fails | DNS not pointing to VPS yet | Run certbot only AFTER DNS is propagated |

---

## What Is Intentionally NOT Automated

| Thing | Reason |
|-------|--------|
| DNS changes | Risk of downtime if done wrong |
| Supabase redirect URLs | Must be verified manually in dashboard |
| Supabase "Site URL" change | Affects magic links for ALL users |
| SSL certificate | Requires DNS to be pointing to VPS first |
| Netlify shutdown | Keep as rollback for 48h minimum |
| GitHub deploy key setup | Security — should be done manually |
| .env.production values | Contains keys — user fills in manually |

---

## Re-deploying After Code Changes

After pushing changes to GitHub:

```bash
ssh root@178.104.103.233
cd /srv/thegreekcarnivore-app
git pull origin main
npm ci --production=false
npm run build
chown -R www-data:www-data dist/
systemctl reload nginx
```

Or simply re-run:
```bash
bash /srv/deploy.sh
```

---

## Rollback Plan

If something goes wrong after production cutover:

1. **Change DNS back** in IONOS to point `app` to Netlify's IP/CNAME
2. Netlify is still running — it will serve immediately
3. Fix the issue on VPS
4. Re-test on staging
5. Try cutover again
