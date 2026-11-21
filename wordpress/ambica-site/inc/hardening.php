<?php
defined( 'ABSPATH' ) || exit;

/* Small security measures that sit alongside Wordfence. */

// XML-RPC is an old remote-login door that attackers brute-force. Nothing here uses it.
add_filter( 'xmlrpc_enabled', '__return_false' );
add_filter( 'wp_headers', function ( $h ) {
	unset( $h['X-Pingback'] );
	return $h;
} );

// Don't advertise the WordPress version.
remove_action( 'wp_head', 'wp_generator' );
add_filter( 'the_generator', '__return_empty_string' );

// Stop visitors finding admin usernames through ?author=1 or the public users API.
add_action( 'template_redirect', function () {
	if ( is_author() || isset( $_GET['author'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		wp_safe_redirect( home_url( '/' ), 301 );
		exit;
	}
} );
add_filter( 'rest_endpoints', function ( $e ) {
	if ( ! is_user_logged_in() ) {
		unset( $e['/wp/v2/users'], $e['/wp/v2/users/(?P<id>[\d]+)'] );
	}
	return $e;
} );

// Same answer for wrong user and wrong password.
add_filter( 'login_errors', function () {
	return 'Wrong username or password.';
} );
