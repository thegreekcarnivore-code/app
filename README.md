# The Greek Carnivore App

Client coaching app for measurements, reports, messaging, payments, calls, resources, and admin workflows.

## Local development

```sh
cd /Users/alexandrosadamantiadis/Downloads/thegreekcarnivore-main
npm install
npm run dev -- --host 127.0.0.1 --port 8085
```

Use [`.env.example`](/Users/alexandrosadamantiadis/Downloads/thegreekcarnivore-main/.env.example) as the client-side template. Keep server-side secrets in Supabase project secrets.

## Deployment

- Frontend: build with `npm run build` and publish `dist`
- App domain: set `APP_BASE_URL=https://app.thegreekcarnivore.com` in Supabase secrets
- Edge functions: set `OPENAI_API_KEY`, `RESEND_API_KEY`, Stripe, Zoom, Google, and VAPID secrets in Supabase

## Notes

- Core app data and logins live in Supabase, not in the frontend host
- Changing the frontend host does not delete client data as long as you keep the same Supabase project
- Users may need to sign in again after the domain cutover because browser sessions are origin-specific
