#!/usr/bin/env bash
# Installs the Ambica Travels WordPress site on the VPS, next to (and walled off from) VanixStore.
# Run as root. Safe to run again: it skips what is already done.
#   bash /srv/ambicatravels/wordpress/install.sh
set -euo pipefail

HOST="${AMB_WP_HOST:-new.ambicatravels.in}"     # preview address until go-live
WP_USER="ambicawp"
WP_DIR="/srv/ambicawp"
DOC="$WP_DIR/public"
DB="ambica_wp"
DBUSER="ambica_wp"
ADMIN_EMAIL="shahrakesh1232@gmail.com"
REPO_DIR="/srv/ambicatravels"
CADDYFILE="/etc/caddy/Caddyfile"
SECRETS="/root/ambica-wp-login.txt"
WP="sudo -u $WP_USER -H -- /usr/local/bin/wp --path=$DOC --quiet"

say(){ echo; echo "==> $*"; }
cd /tmp   # commands run as the site user need a folder they can enter
free -h | head -2

say "Packages: PHP and MariaDB"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq php-fpm php-cli php-mysql php-xml php-mbstring php-curl php-zip php-gd php-intl php-imagick php-bcmath mariadb-server unzip >/dev/null
PHPV=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
systemctl enable --now mariadb >/dev/null
echo "PHP $PHPV"

say "Separate user and folder (no access to VanixStore)"
id "$WP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$WP_DIR" --shell /usr/sbin/nologin "$WP_USER"
mkdir -p "$DOC" "$WP_DIR/tmp" "$WP_DIR/backups"
chown -R "$WP_USER:$WP_USER" "$WP_DIR"
chmod 750 "$WP_DIR"
usermod -aG "$WP_USER" caddy          # Caddy may read the public files, nothing else
chmod 700 "$WP_DIR/tmp" "$WP_DIR/backups"

say "Database"
touch "$SECRETS"; chmod 600 "$SECRETS"
DBPASS=$(grep -oP '^db_password=\K.*' "$SECRETS" || true)
if [ -z "$DBPASS" ]; then DBPASS=$(openssl rand -hex 24); echo "db_password=$DBPASS" >> "$SECRETS"; fi
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DBUSER'@'localhost' IDENTIFIED BY '$DBPASS';
ALTER USER '$DBUSER'@'localhost' IDENTIFIED BY '$DBPASS';
GRANT ALL PRIVILEGES ON \`$DB\`.* TO '$DBUSER'@'localhost';
FLUSH PRIVILEGES;
SQL

say "WP-CLI"
if [ ! -x /usr/local/bin/wp ]; then
  curl -fsSL -o /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  chmod 755 /usr/local/bin/wp
fi

say "PHP pool that runs as $WP_USER only, locked to its own folder"
cat > "/etc/php/$PHPV/fpm/pool.d/ambicawp.conf" <<EOF
[ambicawp]
user = $WP_USER
group = $WP_USER
listen = /run/php/ambicawp.sock
listen.owner = caddy
listen.group = caddy
listen.mode = 0660
pm = ondemand
pm.max_children = 8
pm.process_idle_timeout = 30s
pm.max_requests = 500
php_admin_value[open_basedir] = $WP_DIR:/usr/share/php
php_admin_value[upload_tmp_dir] = $WP_DIR/tmp
php_admin_value[sys_temp_dir] = $WP_DIR/tmp
php_admin_value[session.save_path] = $WP_DIR/tmp
php_admin_value[upload_max_filesize] = 32M
php_admin_value[post_max_size] = 32M
php_admin_value[memory_limit] = 256M
php_admin_value[max_execution_time] = 120
php_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen,pcntl_exec
php_admin_flag[expose_php] = off
php_admin_flag[allow_url_include] = off
EOF
systemctl restart "php$PHPV-fpm"

say "WordPress"
if [ ! -f "$DOC/wp-load.php" ]; then
  $WP core download --locale=en_US
fi
if [ ! -f "$DOC/wp-config.php" ]; then
  $WP config create --dbname="$DB" --dbuser="$DBUSER" --dbpass="$DBPASS" --dbhost=localhost --extra-php <<'PHP'
define( 'DISALLOW_FILE_EDIT', true );      // no code editing from the dashboard
define( 'FORCE_SSL_ADMIN', true );
define( 'WP_AUTO_UPDATE_CORE', true );     // security and feature updates install themselves
define( 'WP_POST_REVISIONS', 20 );
define( 'WP_MEMORY_LIMIT', '256M' );
define( 'WP_DEBUG', false );
define( 'WP_TEMP_DIR', '/srv/ambicawp/tmp' );
PHP
  chmod 640 "$DOC/wp-config.php"
fi
if ! $WP core is-installed 2>/dev/null; then
  ADMINPASS=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
  $WP core install --url="https://$HOST" --title="Ambica Travels" --admin_user="ambica_admin" --admin_password="$ADMINPASS" --admin_email="$ADMIN_EMAIL" --skip-email
  { echo "wp_login_url=https://$HOST/wp-admin/"; echo "wp_username=ambica_admin"; echo "wp_password=$ADMINPASS"; } >> "$SECRETS"
  $WP post delete 1 2 --force >/dev/null 2>&1 || true
  $WP plugin uninstall akismet hello --deactivate >/dev/null 2>&1 || true
fi

say "Settings"
$WP option update blogdescription "Taxi service in Surat"
$WP option update timezone_string "Asia/Kolkata"
$WP option update date_format "j F Y"
$WP option update default_comment_status closed
$WP option update default_ping_status closed
$WP option update users_can_register 0
$WP option update blog_public 0          # hidden from Google until go-live
$WP rewrite structure '/%postname%/'

say "Theme and plugins (all free)"
$WP theme install hello-elementor --activate
$WP theme list --status=inactive --field=name | xargs -r -n1 sudo -u "$WP_USER" -H -- /usr/local/bin/wp --path="$DOC" --quiet theme delete || true
for p in elementor seo-by-rank-math wordfence updraftplus cache-enabler duplicate-post duracelltomi-google-tag-manager wp-mail-smtp; do
  $WP plugin is-installed "$p" || $WP plugin install "$p"
  $WP plugin activate "$p"
done
bash "$REPO_DIR/wordpress/sync-plugin.sh"
$WP plugin activate ambica-site
$WP plugin auto-updates enable --all || true
$WP theme auto-updates enable --all || true

say "Plugin settings"
# Elementor: let the Ambica styles set fonts and colours; skip onboarding.
$WP option update elementor_disable_color_schemes yes
$WP option update elementor_disable_typography_schemes yes
$WP option update elementor_font_display swap
$WP option update elementor_google_font 0
$WP option update elementor_onboarded 1
$WP option update elementor_cpt_support '["page","post"]' --format=json
# Rank Math: skip the setup wizard, turn on the modules we use.
$WP option update rank_math_wizard_completed 1
$WP option update rank_math_registration_skip 1
$WP option update rank_math_modules '["link-counter","seo-analysis","sitemap","rich-snippet","local-seo","redirections","404-monitor","image-seo"]' --format=json
$WP option patch update rank-math-options-titles knowledgegraph_type company >/dev/null 2>&1 || true
$WP option patch update rank-math-options-titles knowledgegraph_name "Ambica Travels" >/dev/null 2>&1 || true
$WP option patch update rank-math-options-titles website_name "Ambica Travels" >/dev/null 2>&1 || true
$WP option patch update rank-math-options-titles local_business_type TaxiService >/dev/null 2>&1 || true
# Duplicate Post: show "Duplicate" on pages.
$WP option update duplicate_post_types_enabled '["post","page"]' --format=json
# Page cache: cached pages for visitors, never for logged-in editors.
$WP option update cache_enabler '{"cache_expires":1,"cache_expiry_time":24,"clear_site_cache_on_saved_post":1,"clear_site_cache_on_saved_comment":0,"clear_site_cache_on_changed_plugin":1,"convert_image_urls_to_webp":0,"mobile_cache":0,"compress_cache":1,"minify_html":1,"minify_inline_css_js":0,"excluded_post_ids":"","excluded_page_paths":"","excluded_query_strings":"","excluded_cookies":""}' --format=json
# Backups: database daily, files weekly, keep a week / a month.
$WP option update updraft_interval weekly
$WP option update updraft_interval_database daily
$WP option update updraft_retain 4
$WP option update updraft_retain_db 14

say "Images, site icon and pages"
IMG_JSON="{"
for f in sedan suv innova-crysta tempo-traveller; do
  src="$REPO_DIR/local-static/cars/$f.jpg"
  [ -f "$src" ] || continue
  existing=$(sudo -u "$WP_USER" -H -- /usr/local/bin/wp --path="$DOC" eval 'echo (int) ( get_option( "ambica_car_images", [] )["'"$f"'"] ?? 0 );' 2>/dev/null | tail -1 || true)
  [ "$existing" = "0" ] && existing=""
  if [ -z "$existing" ]; then
    cp "$src" "$WP_DIR/tmp/$f.jpg"; chown "$WP_USER" "$WP_DIR/tmp/$f.jpg"
    existing=$(sudo -u "$WP_USER" -H -- /usr/local/bin/wp --path="$DOC" media import "$WP_DIR/tmp/$f.jpg" --title="$f taxi" --porcelain 2>/dev/null | tail -1)
    rm -f "$WP_DIR/tmp/$f.jpg"
  fi
  IMG_JSON="$IMG_JSON\"$f\":$existing,"
done
IMG_JSON="${IMG_JSON%,}}"
$WP option update ambica_car_images "$IMG_JSON" --format=json
ICON_NOW=$(sudo -u "$WP_USER" -H -- /usr/local/bin/wp --path="$DOC" eval 'echo (int) get_option( "site_icon" );' 2>/dev/null | tail -1 || true)
if [ -z "$ICON_NOW" ] || [ "$ICON_NOW" = "0" ]; then
  cp "$DOC/wp-content/plugins/ambica-site/assets/icon-512.png" "$WP_DIR/tmp/"; chown "$WP_USER" "$WP_DIR/tmp/icon-512.png"
  ICON=$(sudo -u "$WP_USER" -H -- /usr/local/bin/wp --path="$DOC" media import "$WP_DIR/tmp/icon-512.png" --title="Site icon" --porcelain 2>/dev/null | tail -1)
  $WP option update site_icon "$ICON"; rm -f "$WP_DIR/tmp/icon-512.png"
  cp "$DOC/wp-content/plugins/ambica-site/assets/og.jpg" "$WP_DIR/tmp/"; chown "$WP_USER" "$WP_DIR/tmp/og.jpg"
  OG=$(sudo -u "$WP_USER" -H -- /usr/local/bin/wp --path="$DOC" media import "$WP_DIR/tmp/og.jpg" --title="Ambica Travels share image" --porcelain 2>/dev/null | tail -1)
  $WP option patch update rank-math-options-titles open_graph_image_id "$OG" >/dev/null 2>&1 || true
  $WP option patch update rank-math-options-titles open_graph_image "$(sudo -u "$WP_USER" -H -- /usr/local/bin/wp --path="$DOC" post get "$OG" --field=guid)" >/dev/null 2>&1 || true
  rm -f "$WP_DIR/tmp/og.jpg"
fi
sudo -u "$WP_USER" -H -- /usr/local/bin/wp --path="$DOC" ambica import
$WP elementor flush-css >/dev/null 2>&1 || true
$WP cache flush >/dev/null 2>&1 || true

say "Web server: $HOST"
BLOCK=$(mktemp)
cat > "$BLOCK" <<EOF
# BEGIN ambica-wp
$HOST {
	root * $DOC
	encode zstd gzip
	header {
		X-Content-Type-Options nosniff
		X-Frame-Options SAMEORIGIN
		Referrer-Policy strict-origin-when-cross-origin
		Strict-Transport-Security "max-age=31536000"
		-Server
	}
$( [ "${HOST#new.}" != "$HOST" ] && printf '\theader X-Robots-Tag "noindex, nofollow"\n' )
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
# END ambica-wp
EOF
cp "$CADDYFILE" "$CADDYFILE.bak-$(date +%s)"
if grep -q "# BEGIN ambica-wp" "$CADDYFILE"; then
  awk -v f="$BLOCK" '/# BEGIN ambica-wp/{while((getline l < f)>0) print l; skip=1; next} /# END ambica-wp/{skip=0; next} !skip' "$CADDYFILE" > "$CADDYFILE.new"
else
  { cat "$CADDYFILE"; echo; cat "$BLOCK"; } > "$CADDYFILE.new"
fi
if caddy validate --config "$CADDYFILE.new" --adapter caddyfile >/dev/null 2>&1; then
  mv "$CADDYFILE.new" "$CADDYFILE"; systemctl restart caddy
else
  echo "!! Caddy config invalid, left unchanged:"; caddy validate --config "$CADDYFILE.new" --adapter caddyfile 2>&1 | tail -3; rm -f "$CADDYFILE.new"
fi
rm -f "$BLOCK"

say "Done"
echo "Preview: https://$HOST   Admin: https://$HOST/wp-admin/"
echo "Owner login is saved in $SECRETS (root only). Show it with:  cat $SECRETS"
curl -s -o /dev/null -w "Local check: HTTP %{http_code}\n" --resolve "$HOST:443:127.0.0.1" "https://$HOST/" || true
