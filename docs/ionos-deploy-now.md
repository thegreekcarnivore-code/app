# IONOS Deploy Now setup for `app.thegreekcarnivore.com`

This project is designed to be deployed as a static Vite application through IONOS Deploy Now.

## 1. Prepare the source repository

If this folder is not already a Git repository:

```sh
git init -b main
git add .
git commit -m "Initial import"
```

Create a GitHub repository and push this project:

```sh
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

Before pushing, copy `.env.example` to `.env` locally and keep the real values out of Git.

## 2. Create the Deploy Now project

In IONOS Deploy Now:

1. Create a new project from your GitHub repository.
2. Choose the production branch, normally `main`.
3. Confirm these build settings:
   - Install command: `npm ci`
   - Build command: `npm run build`
   - Output directory: `dist`
   - SPA fallback: `public/.htaccess`

Add these environment variables in the deployment settings:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

Deploy Now should generate and maintain the GitHub Actions workflow for subsequent deployments.

## 3. Connect the subdomain

Attach this hostname to the production deployment:

- `app.thegreekcarnivore.com`

Leave these hostnames separate from this app deployment:

- `thegreekcarnivore.com`
- `www.thegreekcarnivore.com`

## 4. DNS in IONOS

When you connect the custom domain in Deploy Now, IONOS will show the exact record required for the `app` host.

Use that exact value. In practice this is commonly a CNAME-style record for the `app` subdomain, but the source of truth is the record shown inside the Deploy Now domain connection flow.

Do not:

- point `app.thegreekcarnivore.com` to `127.0.0.1`
- point `app.thegreekcarnivore.com` to your Mac's current IP
- replace the apex-domain records unless you intentionally want the main site to move

## 5. Validate the deployment

After DNS propagation and SSL provisioning:

1. Open `https://app.thegreekcarnivore.com`
2. Confirm the page loads over HTTPS without certificate warnings
3. Confirm `thegreekcarnivore.com` still serves its separate site
4. Confirm `www.thegreekcarnivore.com` still serves or redirects according to your main-site setup

## 6. Notes for future routes

The current app only exposes `/` plus a catch-all React route. If the project later grows into a multi-route SPA with direct deep links, make sure the hosting setup includes an SPA fallback to `index.html`.
