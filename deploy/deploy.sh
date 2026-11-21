#!/usr/bin/env bash
# Pull the latest main and rebuild. The live folder is swapped only after a successful build. Run as root.
set -euo pipefail
APP_USER="ambica"; APP_DIR="/srv/ambicatravels"
sudo -u "$APP_USER" git -C "$APP_DIR" fetch -q origin main
sudo -u "$APP_USER" git -C "$APP_DIR" checkout -q -B main origin/main
sudo -u "$APP_USER" bash -c "cd $APP_DIR && node build.mjs dist.new && rm -rf dist.old && { [ -d dist ] && mv dist dist.old || true; } && mv dist.new dist && rm -rf dist.old"
echo "$(date -Is) live at $(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"
# WordPress site (if installed): copy the latest Ambica plugin into it.
[ -d /srv/ambicawp/public/wp-content/plugins ] && bash "$APP_DIR/wordpress/sync-plugin.sh" || true
