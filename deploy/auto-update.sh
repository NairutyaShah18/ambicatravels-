#!/usr/bin/env bash
# Runs every minute (systemd timer). If GitHub main has new commits, rebuild the site.
# Pause: touch /srv/ambicatravels/.no-auto-update    Resume: delete that file.
set -euo pipefail
APP_DIR=/srv/ambicatravels
[ -f "$APP_DIR/.no-auto-update" ] && exit 0
exec 9>/run/ambicatravels-update.lock
flock -n 9 || exit 0
sudo -u ambica git -C "$APP_DIR" fetch -q origin main
[ "$(sudo -u ambica git -C "$APP_DIR" rev-parse HEAD)" = "$(sudo -u ambica git -C "$APP_DIR" rev-parse origin/main)" ] && [ -d "$APP_DIR/dist" ] && exit 0
bash "$APP_DIR/deploy/deploy.sh" || echo "$(date -Is) BUILD FAILED, the previous version stays live"
