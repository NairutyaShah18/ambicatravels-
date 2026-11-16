#!/usr/bin/env bash
# One-time setup for ambicatravels.in on the SAME server that already runs VanixStore.
# Run as root:  curl -fsSL https://raw.githubusercontent.com/NairutyaShah18/ambicatravels-/main/deploy/setup-server.sh | bash
# It does NOT touch the VanixStore app. It only ADDS a site block to Caddy and a small auto-update timer.
set -euo pipefail

DOMAIN="ambicatravels.in"
APP_USER="ambica"
APP_DIR="/srv/ambicatravels"
REPO="https://github.com/NairutyaShah18/ambicatravels-.git"   # public repo, no deploy key needed
CADDYFILE="/etc/caddy/Caddyfile"

command -v node >/dev/null || { echo "Node.js is missing. It should already be here from the VanixStore setup."; exit 1; }
command -v caddy >/dev/null || { echo "Caddy is missing. It should already be here from the VanixStore setup."; exit 1; }

echo "==> App user and folder"
id "$APP_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"; chown "$APP_USER:$APP_USER" "$APP_DIR"; chmod 755 "$APP_DIR"

echo "==> Code"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git clone --branch main "$REPO" "$APP_DIR"
fi
bash "$APP_DIR/deploy/deploy.sh"

echo "==> Web server: add $DOMAIN to Caddy (existing sites are left as they are)"
if ! grep -q "# BEGIN $DOMAIN" "$CADDYFILE"; then
  cp "$CADDYFILE" "$CADDYFILE.bak-$(date +%s)"
  cat >> "$CADDYFILE" <<EOF

# BEGIN $DOMAIN
$DOMAIN {
	root * $APP_DIR/dist
	encode zstd gzip
	header {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
		Strict-Transport-Security "max-age=31536000"
	}
	@assets path /assets/*
	header @assets Cache-Control "public, max-age=31536000, immutable"
	file_server
	handle_errors {
		rewrite * /404.html
		file_server
	}
}
www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
# END $DOMAIN
EOF
  if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
  else
    echo "!! Caddy config did not validate. Restoring the previous file."
    cp "$(ls -t $CADDYFILE.bak-* | head -1)" "$CADDYFILE"
    exit 1
  fi
fi

echo "==> Auto-update: every minute, publish whatever is on GitHub main"
cat > /etc/systemd/system/ambicatravels-update.service <<U
[Unit]
Description=Ambica Travels auto-update from GitHub
[Service]
Type=oneshot
ExecStart=/bin/bash $APP_DIR/deploy/auto-update.sh
StandardOutput=append:/var/log/ambicatravels-deploy.log
StandardError=append:/var/log/ambicatravels-deploy.log
U
cat > /etc/systemd/system/ambicatravels-update.timer <<U
[Unit]
Description=Check GitHub for Ambica Travels updates every minute
[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
[Install]
WantedBy=timers.target
U
systemctl daemon-reload
systemctl enable --now ambicatravels-update.timer

echo
echo "Done. Once DNS for $DOMAIN and www.$DOMAIN points at this server, open https://$DOMAIN"
curl -s -o /dev/null -w "Local check: HTTP %{http_code}\n" --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" || true
