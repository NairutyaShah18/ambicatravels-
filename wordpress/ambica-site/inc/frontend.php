<?php
defined( 'ABSPATH' ) || exit;

/* ---------- menus ---------- */
add_action( 'after_setup_theme', function () {
	register_nav_menus( [ 'ambica_primary' => 'Ambica header menu' ] );
} );

/* The Hello Elementor theme's own header/footer are replaced by ours. */
add_filter( 'hello_elementor_header_footer', '__return_false' );
add_filter( 'hello_elementor_page_title', '__return_false' );

/* ---------- styles and scripts ---------- */
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style( 'amb-fonts', 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Outfit:wght@300;400;500;600&display=swap', [], null );
	wp_enqueue_style( 'amb-site', AMB_URL . 'assets/ambica.css', [], AMB_VER . '-' . filemtime( AMB_DIR . 'assets/ambica.css' ) );
	wp_enqueue_script( 'amb-site', AMB_URL . 'assets/ambica.js', [], AMB_VER . '-' . filemtime( AMB_DIR . 'assets/ambica.js' ), [ 'in_footer' => true, 'strategy' => 'defer' ] );
	$route = amb_current_route();
	wp_add_inline_script( 'amb-site', 'window.SITE=' . wp_json_encode( [
		'name'  => amb_s( 'name' ),
		'city'  => amb_s( 'city' ),
		'wa'    => amb_digits( amb_s( 'whatsapp' ) ),
		'route' => $route ? amb_s( 'city' ) . ' to ' . $route['to'] : '',
	] ) . ';', 'before' );

	// Nothing on this site uses the block editor's front-end styles.
	if ( ! is_admin() ) {
		wp_dequeue_style( 'wp-block-library' );
		wp_dequeue_style( 'wp-block-library-theme' );
		wp_dequeue_style( 'classic-theme-styles' );
		wp_dequeue_style( 'global-styles' );
	}
}, 20 );

add_action( 'wp_head', function () {
	echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n";
	echo '<meta name="theme-color" content="#16122A">' . "\n";
}, 1 );

add_filter( 'body_class', function ( $c ) {
	$c[] = 'amb';
	return $c;
} );

/* ---------- header (top of every page) ---------- */
function amb_menu_links() {
	$locations = get_nav_menu_locations();
	$items     = ! empty( $locations['ambica_primary'] ) ? wp_get_nav_menu_items( $locations['ambica_primary'] ) : [];
	if ( ! $items ) {
		$items = [
			(object) [ 'title' => 'Services', 'url' => home_url( '/#services' ), 'classes' => [] ],
			(object) [ 'title' => 'Routes', 'url' => home_url( '/#routes' ), 'classes' => [] ],
			(object) [ 'title' => 'Fleet', 'url' => home_url( '/#fleet' ), 'classes' => [] ],
			(object) [ 'title' => 'Book a ride', 'url' => '#book', 'classes' => [ 'nav-cta' ] ],
		];
	}
	$out = '';
	foreach ( $items as $i ) {
		$cls  = in_array( 'nav-cta', (array) $i->classes, true ) ? ' class="nav-cta"' : '';
		$out .= '<a' . $cls . ' href="' . esc_url( $i->url ) . '">' . esc_html( $i->title ) . '</a>';
	}
	return $out;
}

add_action( 'wp_body_open', function () {
	if ( is_admin() ) {
		return;
	}
	readfile( AMB_DIR . 'assets/sprite.svg' );
	$links = amb_menu_links();
	?>
<div class="progress" aria-hidden="true"><i id="prog"><svg viewBox="0 0 200 78"><use href="#car"/></svg></i></div>
<header class="site-head" id="top">
	<div class="wrap head-row">
		<a class="brand" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="<?php echo esc_attr( amb_s( 'name' ) ); ?> home"><?php echo amb_logo(); // phpcs:ignore ?></a>
		<nav class="nav" aria-label="Main"><?php echo $links; // phpcs:ignore -- escaped in amb_menu_links ?></nav>
		<button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="drawer">Menu</button>
	</div>
	<div class="drawer" id="drawer">
		<?php echo $links; // phpcs:ignore ?>
		<p class="quick">Quick contact</p>
		<p class="quick"><?php echo esc_html( amb_s( 'phone' ) ); ?></p>
		<p class="quick"><?php echo esc_html( amb_s( 'email' ) ); ?></p>
	</div>
</header>
	<?php
}, 5 );

/* ---------- footer and floating buttons (end of every page) ---------- */
add_action( 'wp_footer', function () {
	if ( is_admin() ) {
		return;
	}
	$city = amb_s( 'city' );
	$l    = amb_links();
	?>
<footer class="site-foot">
	<div class="wrap">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="foot-logo" aria-label="<?php echo esc_attr( amb_s( 'name' ) ); ?> home"><?php echo amb_logo( true ); // phpcs:ignore ?></a>
		<nav aria-label="Taxi routes"><?php foreach ( amb_routes() as $r ) : ?><a href="<?php echo esc_url( $r['url'] ); ?>"><?php echo esc_html( "{$city} to {$r['to']} taxi" ); ?></a><?php endforeach; ?></nav>
		<span>© <?php echo esc_html( gmdate( 'Y' ) ); ?> <b><?php echo esc_html( amb_s( 'name' ) ); ?></b>. All rights reserved.</span><span><?php echo esc_html( amb_s( 'address' ) . ' · ' . amb_s( 'phone' ) ); ?></span>
	</div>
</footer>
<div class="float">
	<a class="w" href="<?php echo esc_url( $l['wa'] ); ?>" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><?php echo amb_icon( 'i-wa' ); // phpcs:ignore ?></a>
	<a class="c" href="<?php echo esc_url( $l['tel'] ); ?>" aria-label="Call <?php echo esc_attr( amb_s( 'name' ) ); ?>"><?php echo amb_icon( 'i-call' ); // phpcs:ignore ?></a>
</div>
	<?php
}, 5 );

/* ---------- lighter pages ---------- */
add_action( 'init', function () {
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	remove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
	remove_action( 'wp_head', 'wp_shortlink_wp_head' );
	remove_action( 'wp_head', 'rsd_link' );
	remove_action( 'wp_head', 'wlwmanifest_link' );
} );

/* New uploads get WebP versions for every displayed size (smaller files, same look). No plugin needed. */
add_filter( 'image_editor_output_format', function ( $formats ) {
	$formats['image/jpeg'] = 'image/webp';
	$formats['image/png']  = 'image/webp';
	return $formats;
} );
