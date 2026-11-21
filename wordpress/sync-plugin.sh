#!/usr/bin/env bash
# Copies the Ambica Travels plugin from the git checkout into WordPress. Run as root.
# Called by install.sh and by deploy/deploy.sh after every push, so plugin changes go live automatically.
set -euo pipefail
SRC="/srv/ambicatravels/wordpress/ambica-site"
DEST="/srv/ambicawp/public/wp-content/plugins/ambica-site"
[ -d "$(dirname "$DEST")" ] || exit 0
rm -rf "$DEST.new"
cp -r "$SRC" "$DEST.new"
chown -R ambicawp:ambicawp "$DEST.new"
rm -rf "$DEST.old"
[ -d "$DEST" ] && mv "$DEST" "$DEST.old"
mv "$DEST.new" "$DEST"
rm -rf "$DEST.old"
# Clear cached pages so visitors see the change.
sudo -u ambicawp -H -- /usr/local/bin/wp --path=/srv/ambicawp/public --quiet cache-enabler clear >/dev/null 2>&1 \
  || rm -rf /srv/ambicawp/public/wp-content/cache/cache-enabler 2>/dev/null || true
echo "$(date -Is) ambica-site plugin synced"
