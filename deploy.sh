#!/usr/bin/env bash
# Run on the server after pushing to GitHub:  cd /var/www/tekcard-api && ./deploy.sh
set -e
cd "$(dirname "$0")"

NODE_DIR=/opt/node22
if [ ! -x "$NODE_DIR/bin/node" ]; then
  echo "Node 22 not found in $NODE_DIR — run the install step in README.md first"; exit 1
fi

git pull --ff-only
# install packages with Node 22 (native modules are built for it); system node is untouched
( export PATH="$NODE_DIR/bin:$PATH"; npm ci --omit=dev )
mkdir -p data uploads

if pm2 describe tekcard-api >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save
pm2 status tekcard-api
