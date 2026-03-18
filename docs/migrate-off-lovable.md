# Move Production Off Lovable

This app can leave Lovable, but it is a real migration. The live Lovable Cloud
project (`lglgmhzgxyvyftdhvdsy`) still owns the production data today.

## Current state

- Live production domain: `https://app.thegreekcarnivore.com`
- Live backend today: Lovable Cloud / Supabase project `lglgmhzgxyvyftdhvdsy`
- New self-owned Supabase project: `bowvosskzbtuxmrwatoj`

## What is already prepared in this repo

- Auth email hook no longer depends on `@lovable.dev/*`.
- Email templates and edge functions no longer hardcode the old project URL.
- Historical SQL migrations no longer hardcode the old function URLs.
- The app domain is already configurable through `APP_BASE_URL`.

## What still must happen outside the repo

1. Export or restore the Lovable Cloud data into the new Supabase project.
2. Copy Storage objects, especially:
   - `email-assets`
   - progress photos
   - any recipe/resource/media buckets used by clients
3. Recreate project secrets in the new Supabase project:
   - `APP_BASE_URL=https://app.thegreekcarnivore.com`
   - `RESEND_API_KEY`
   - `SEND_EMAIL_HOOK_SECRET`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL_SMALL`
   - `OPENAI_MODEL_STANDARD`
   - `OPENAI_MODEL_PREMIUM`
   - `OPENAI_MODEL_VISION`
   - `OPENAI_MODEL_TRANSCRIPTION`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `ZOOM_ACCOUNT_ID`
   - `ZOOM_CLIENT_ID`
   - `ZOOM_CLIENT_SECRET`
   - `GOOGLE_MAPS_API_KEY`
   - `GOOGLE_SHEETS_SERVICE_KEY`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
4. Configure Supabase Auth in the new project:
   - Site URL: `https://app.thegreekcarnivore.com`
   - Redirect URLs:
     - `https://app.thegreekcarnivore.com/auth`
     - `https://app.thegreekcarnivore.com/reset-password`
   - Send Email Hook secret and endpoint for `auth-email-hook`
5. Deploy the frontend from this repo to your own host.
6. Deploy the Supabase migrations and edge functions to the new project.
7. Smoke test staging before switching the production domain.

## Recommended cutover order

1. Keep the current Lovable production app live.
2. Restore/migrate data into `bowvosskzbtuxmrwatoj`.
3. Deploy this repo to your new frontend host using a staging URL.
4. Point the staging frontend at `bowvosskzbtuxmrwatoj`.
5. Test:
   - admin login
   - client login
   - invites
   - password reset
   - profile / measurements
   - weekly check-ins
   - push notifications
   - Resend email flows
   - Stripe checkout + webhook
   - Zoom meeting creation / reminders
6. Freeze writes briefly for final cutover if needed.
7. Update production frontend env to the new project:
   - `VITE_SUPABASE_URL=https://bowvosskzbtuxmrwatoj.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<new anon key>`
8. Repoint `app.thegreekcarnivore.com` to the new frontend host.
9. Run production smoke tests immediately after cutover.

## Files to update when the data migration is ready

- `.env`
- `supabase/config.toml`

Do not switch those to the new project until the new database is ready and the
new host is deployed, otherwise local testing will point at an incomplete
backend.
