<?php
/**
 * Plugin Name: Ambica Travels Site
 * Description: Ambica Travels design, header and footer, booking tools (fare card, routes, booking form) and route page details. Edit business details under Settings → Ambica Travels.
 * Version: 1.0.0
 * Requires at least: 6.4
 * Requires PHP: 8.0
 * Author: Ambica Travels
 * Text Domain: ambica-site
 */

defined( 'ABSPATH' ) || exit;

define( 'AMB_VER', '1.0.0' );
define( 'AMB_DIR', plugin_dir_path( __FILE__ ) );
define( 'AMB_URL', plugin_dir_url( __FILE__ ) );

require AMB_DIR . 'inc/helpers.php';
require AMB_DIR . 'inc/settings.php';
require AMB_DIR . 'inc/routes.php';
require AMB_DIR . 'inc/shortcodes.php';
require AMB_DIR . 'inc/frontend.php';
require AMB_DIR . 'inc/hardening.php';

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	require AMB_DIR . 'inc/cli.php';
}
