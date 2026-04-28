# Backup Recovery Guide — 2026-04-28

This file documents the backups created before starting the Tier 1 funnel + program organization implementation. If anything goes wrong, you can return to the exact pre-change state.

## What Was Backed Up

### 1. Code (Git) — DONE ✓

Two backups pushed to GitHub (`origin`):

| What | Where | Recovers |
|---|---|---|
| **Deployed app code** | Tag `backup/deployed-pre-tier1-2026-04-28` (commit `ed9e910` on origin/main) | The exact code currently running at app.thegreekcarnivore.com |
| **Local working tree** | Branch `backup/working-tree-2026-04-28` (commit `721c3e9`) | The full local state including all uncommitted modifications, new docs, new edge functions, new migrations |

GitHub URLs:
- Deployed tag: https://github.com/thegreekcarnivore-code/app/releases/tag/backup/deployed-pre-tier1-2026-04-28
- Working tree branch: https://github.com/thegreekcarnivore-code/app/tree/backup/working-tree-2026-04-28

### 2. Database (Supabase) — TODO

The Supabase database (`bowvosskzbtuxmrwatoj`) is NOT yet backed up by this script. Options:
- **Easiest (recommended):** Supabase dashboard → Project Settings → Database → "Backups" → take a manual snapshot. Free tier gets 7-day daily auto-backups; Pro+ has Point-in-Time Recovery (PITR).
- **Manual dump (technical):** `supabase db dump --linked > backup-2026-04-28.sql` (requires Supabase CLI installed and project linked)

### 3. User-Uploaded Files (Supabase Storage) — TODO

Photos, progress images, etc. uploaded by clients live in Supabase Storage buckets. To back up:
- Supabase dashboard → Storage → for each bucket → use "Download all" or use the Storage API
- Or technical: `supabase storage download` per bucket

### 4. Stripe State — TODO

Existing Stripe products and prices should be documented before adding new ones (Foundation €103, Único Monthly €47, Único Annual €550). To capture:
- Stripe dashboard → Products → screenshot or export
- Or technical: `stripe products list` + `stripe prices list` via Stripe CLI

---

## How to Recover (If Something Goes Wrong)

### To return the **deployed code** to the pre-change version:

```bash
# Option A: Reset main branch back to the deployed backup
git fetch origin --tags
git checkout main
git reset --hard backup/deployed-pre-tier1-2026-04-28
git push origin main --force-with-lease

# Option B: Just check out the backup tag in detached mode (read-only inspection)
git checkout backup/deployed-pre-tier1-2026-04-28
```

⚠️ Option A force-pushes to main and triggers a redeploy. Use only if you really want production rolled back.

### To return your **local working tree** to the pre-change state:

```bash
git fetch origin
git checkout backup/working-tree-2026-04-28
# You're now on the exact local state from 2026-04-28 (with all docs and uncommitted modifications committed)
```

### To recover the database (if backed up):

- From Supabase dashboard backup: Project Settings → Database → Backups → Restore
- From SQL dump: `psql <connection-string> < backup-2026-04-28.sql`

### To recover Storage files:

- Re-upload from local copies via Supabase dashboard

---

## Important Note: Local main is BEHIND origin/main

When this backup was taken, the local `main` branch was 9 commits behind `origin/main`. The actual deployed app is at commit `ed9e910` (which the deployed tag points to). The 9 newer commits on origin/main include:

- `ed9e910` Merge PR #4
- `35a8079` Schedule process-program-automations via pg_cron every 30 minutes
- `dde8b28` Merge PR #3
- `8966fee` Send day-zero messages + welcome email on all enrollment paths
- `e9a43d2` Merge PR #2
- `6c1ce32` Fix program automation emails: include actual content, remove duplicates
- `7931ab9` Merge PR #1
- `3bd7c20` Add journal tab to Measurements page and fix tab sizing for mobile
- `403e93d` Send email notification when accountability message is sent

**One file conflicts between local and origin:** `src/pages/Measurements.tsx` (you have local modifications, and origin/main also has changes from commit `3bd7c20`).

**Recommendation for the next step:** Before building Phase A, fast-forward local main to origin/main and resolve the Measurements.tsx conflict — otherwise the new work will be based on stale code that's missing 9 commits of recent work (journal tab, pg_cron schedules, day-zero messages, etc.).

---

## Backup Verification Checklist

- [x] Deployed code tagged on origin: `backup/deployed-pre-tier1-2026-04-28` → commit `ed9e910`
- [x] Working tree branched on origin: `backup/working-tree-2026-04-28` → commit `721c3e9`
- [x] Both visible on GitHub
- [ ] Supabase database snapshot taken (manual step)
- [ ] Supabase Storage buckets backed up (manual step, optional if no critical user uploads)
- [ ] Stripe products/prices documented (manual step, before creating new ones)

---

*Generated 2026-04-28 by Claude Code during Tier 1 funnel planning session.*
