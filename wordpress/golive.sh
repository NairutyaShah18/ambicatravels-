#!/usr/bin/env bash
# Moves ambicatravels.in from the old static site to WordPress. Run as root.
#   bash /srv/ambicatravels/wordpress/golive.sh            switch to WordPress
#   bash /srv/ambicatravels/wordpress/golive.sh rollback   go back to the static site
set -euo pipefail
CADDYFILE=/etc/caddy/Caddyfile
BACKUP=/root/Caddyfile.before-golive
DOC=/srv/ambicawp/public
WP="sudo -u ambicawp -H -- /usr/local/bin/wp --path=$DOC --quiet"
cd /tmp

if [ "${1:-}" = "rollback" ]; then
  [ -f "$BACKUP" ] || { echo "No backup at $BACKUP"; exit 1; }
  cp "$BACKUP" "$CADDYFILE"; systemctl restart caddy
  $WP search-replace 'https://ambicatravels.in' 'https://new.ambicatravels.in' --all-tables --skip-columns=guid >/dev/null
  $WP option update blog_public 0
  $WP cache-enabler clear >/dev/null 2>&1 || true
  echo "Rolled back: ambicatravels.in is the static site again; WordPress is at https://new.ambicatravels.in"
  exit 0
fi

[ -f "$BACKUP" ] || cp "$CADDYFILE" "$BACKUP"
awk '/# BEGIN ambicatravels.in/{skip=1; next} /# END ambicatravels.in/{skip=0; next} /# BEGIN ambica-wp/{skip=1; next} /# END ambica-wp/{skip=0; next} !skip' "$CADDYFILE" > "$CADDYFILE.new"
cat >> "$CADDYFILE.new" <<'EOF'

# BEGIN ambica-wp
ambicatravels.in {
	root * /srv/ambicawp/public
	encode zstd gzip
	header {
		X-Content-Type-Options nosniff
		X-Frame-Options SAMEORIGIN
		Referrer-Policy strict-origin-when-cross-origin
		Strict-Transport-Security "max-age=31536000"
		-Server
	}
	@blocked {
		path /xmlrpc.php /wp-config.php /wp-config-sample.php /readme.html /license.txt
		path /wp-content/uploads/*.php /wp-content/debug.log
		path */.git* */.env* *.sql *.bak
	}
	respond @blocked 404
	@static path *.css *.js *.woff2 *.png *.jpg *.jpeg *.webp *.svg *.gif *.ico
	header @static Cache-Control "public, max-age=2592000"
	php_fastcgi unix//run/php/ambicawp.sock
	file_server
}
www.ambicatravels.in, new.ambicatravels.in {
	redir https://ambicatravels.in{uri} permanent
}
# END ambica-wp
EOF
caddy validate --config "$CADDYFILE.new" --adapter caddyfile >/dev/null
mv "$CADDYFILE.new" "$CADDYFILE"
$WP search-replace 'https://new.ambicatravels.in' 'https://ambicatravels.in' --all-tables --skip-columns=guid >/dev/null
$WP option update blog_public 1
$WP elementor flush-css >/dev/null 2>&1 || true
$WP cache-enabler clear >/dev/null 2>&1 || true
systemctl restart caddy
sleep 3
curl -s -o /dev/null -w "ambicatravels.in: HTTP %{http_code}\n" https://ambicatravels.in/ || true
echo "Live on WordPress. Admin: https://ambicatravels.in/wp-admin/   (undo with: bash $0 rollback)"
