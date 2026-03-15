# The Greek Carnivore

This repository contains the Vite/React frontend for The Greek Carnivore landing and app experience.

## Requirements

- Node `20.x`
- npm `10.x`

Use `.nvmrc` if you manage Node via `nvm`:

```sh
nvm use
```

## Local development

```sh
npm ci
npm run dev
```

## Local URLs

- Dev: `http://127.0.0.1:8081`
- Preview: `http://127.0.0.1:4181`
- Ports are fixed and strict so this app fails fast instead of silently reusing another project's URL.

## Production deployment

The production target for this app is:

- App: `https://app.thegreekcarnivore.com`
- Main site left separate: `https://thegreekcarnivore.com`
- Main site left separate: `https://www.thegreekcarnivore.com`

Deploy this app through IONOS Deploy Now using a GitHub repository as the source.

Build settings:

- Install: `npm ci`
- Build: `npm run build`
- Output directory: `dist`
- SPA fallback: `public/.htaccess`

Environment variables required at build/runtime:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

Use [.env.example](/Users/alexandrosadamantiadis/Downloads/thegreekcarnivore-main/.env.example) as the template and keep real `.env` files out of Git.

## IONOS Deploy Now checklist

1. Initialize a Git repository for this folder if needed.
2. Push the code to a GitHub repository you control.
3. In IONOS Deploy Now, create a project from that GitHub repository.
4. Confirm the build settings above.
5. Add the required `VITE_` environment variables in the GitHub/IONOS deployment settings.
6. Connect the custom domain `app.thegreekcarnivore.com` to the production deployment.
7. Apply the DNS record shown by IONOS for the `app` host only.
8. Leave the apex domain and `www` untouched.
9. Wait for DNS propagation and SSL issuance, then verify `https://app.thegreekcarnivore.com`.

The exact DNS record can vary by IONOS deployment target. Use the record shown in Deploy Now for `app` and do not point the subdomain at your local machine.

## Verification

```sh
npm run build
npm run test
```

## Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

Detailed deployment steps are documented in [docs/ionos-deploy-now.md](/Users/alexandrosadamantiadis/Downloads/thegreekcarnivore-main/docs/ionos-deploy-now.md).
