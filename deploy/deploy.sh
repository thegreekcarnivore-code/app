#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# deploy.sh — The Greek Carnivore App — VPS Deployment Script
# ============================================================
#
# Usage:
#   sudo bash deploy.sh
#
# What this does:
#   1. Checks/installs Node 20 + npm
#   2. Clones or updates the repo in /srv/thegreekcarnivore-app
#   3. Installs dependencies
#   4. Builds the frontend (Vite → dist/)
#   5. Verifies dist/ exists
#   6. Reloads Nginx
#
# Safe to run multiple times (idempotent).
# Does NOT touch DNS, Supabase, or any backend.
# ============================================================

APP_DIR="/srv/thegreekcarnivore-app"
REPO_URL="https://github.com/thegreekcarnivore-code/app.git"
BRANCH="main"
NGINX_CONF_STAGING="/etc/nginx/sites-available/staging.app.thegreekcarnivore.com"
NGINX_CONF_PRODUCTION="/etc/nginx/sites-available/app.thegreekcarnivore.com"
NODE_MAJOR=20

echo "============================================"
echo "  The Greek Carnivore — VPS Deploy"
echo "============================================"

# ----------------------------------------------------------
# 1. Check we're running as root (needed for apt + nginx)
# ----------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
  echo "ERROR: This script must be run as root (use sudo)."
  exit 1
fi

# ----------------------------------------------------------
# 2. Install Node.js 20 if not present
# ----------------------------------------------------------
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  echo "→ Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y nodejs
else
  echo "✓ Node.js $(node -v) already installed"
fi

# ----------------------------------------------------------
# 3. Install Nginx if not present
# ----------------------------------------------------------
if ! command -v nginx &>/dev/null; then
  echo "→ Installing Nginx..."
  apt-get update
  apt-get install -y nginx
else
  echo "✓ Nginx already installed"
fi

# ----------------------------------------------------------
# 4. Clone or update the repository
# ----------------------------------------------------------
if [[ -d "$APP_DIR/.git" ]]; then
  echo "→ Updating existing repo in ${APP_DIR}..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard "origin/${BRANCH}"
else
  echo "→ Cloning repo into ${APP_DIR}..."
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ----------------------------------------------------------
# 5. Check that .env.production exists
# ----------------------------------------------------------
if [[ ! -f "${APP_DIR}/.env.production" ]]; then
  echo ""
  echo "WARNING: .env.production not found!"
  echo "Copy .env.production.example and fill in real values:"
  echo "  cp ${APP_DIR}/deploy/.env.production.example ${APP_DIR}/.env.production"
  echo "  nano ${APP_DIR}/.env.production"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

# ----------------------------------------------------------
# 6. Install npm dependencies
# ----------------------------------------------------------
echo "→ Installing dependencies..."
npm ci --production=false

# ----------------------------------------------------------
# 7. Build the frontend
# ----------------------------------------------------------
echo "→ Building the app..."
npm run build

# ----------------------------------------------------------
# 8. Verify dist/ was created
# ----------------------------------------------------------
if [[ ! -f "${APP_DIR}/dist/index.html" ]]; then
  echo "ERROR: Build failed — dist/index.html not found!"
  exit 1
fi

DIST_SIZE=$(du -sh "${APP_DIR}/dist" | cut -f1)
echo "✓ Build successful — dist/ is ${DIST_SIZE}"

# ----------------------------------------------------------
# 9. Set correct ownership for Nginx
# ----------------------------------------------------------
chown -R www-data:www-data "${APP_DIR}/dist"

# ----------------------------------------------------------
# 10. Install Nginx configs if not already linked
# ----------------------------------------------------------
if [[ -f "$NGINX_CONF_STAGING" ]] && [[ ! -L "/etc/nginx/sites-enabled/$(basename "$NGINX_CONF_STAGING")" ]]; then
  echo "→ Enabling staging Nginx config..."
  ln -sf "$NGINX_CONF_STAGING" /etc/nginx/sites-enabled/
fi

if [[ -f "$NGINX_CONF_PRODUCTION" ]] && [[ ! -L "/etc/nginx/sites-enabled/$(basename "$NGINX_CONF_PRODUCTION")" ]]; then
  echo "→ Enabling production Nginx config..."
  ln -sf "$NGINX_CONF_PRODUCTION" /etc/nginx/sites-enabled/
fi

# ----------------------------------------------------------
# 11. Test and reload Nginx
# ----------------------------------------------------------
echo "→ Testing Nginx configuration..."
nginx -t

echo "→ Reloading Nginx..."
systemctl reload nginx

echo ""
echo "============================================"
echo "  ✓ Deployment complete!"
echo "============================================"
echo ""
echo "  Staging:    https://staging.app.thegreekcarnivore.com"
echo "  Production: https://app.thegreekcarnivore.com"
echo ""
echo "  dist/ served from: ${APP_DIR}/dist"
echo ""
