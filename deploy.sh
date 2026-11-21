#!/usr/bin/env bash
# Run on the server after pushing to GitHub:  cd /var/www/tekcard-api && ./deploy.sh
set -e
cd "$(dirname "$0")"
git pull --ff-only
npm ci --omit=dev
mkdir -p data uploads
if pm2 describe tekcard-api >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js && pm2 save
fi
pm2 status tekcard-api
