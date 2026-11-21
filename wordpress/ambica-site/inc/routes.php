<?php
defined( 'ABSPATH' ) || exit;

/* A route page is a normal page with the "Route details" box filled in. */

const AMB_ROUTE_META = [ '_amb_is_route', '_amb_to', '_amb_km', '_amb_hours', '_amb_blurb', '_amb_fares' ];

/** All published route pages, in page order. */
function amb_routes() {
	static $routes = null;
	if ( null !== $routes ) {
		return $routes;
	}
	$posts  = get_posts( [
		'post_type'      => 'page',
		'post_status'    => 'publish',
		'posts_per_page' => 100,
		'meta_key'       => '_amb_is_route',
		'meta_value'     => '1',
		'orderby'        => [ 'menu_order' => 'ASC', 'title' => 'ASC' ],
		'no_found_rows'  => true,
	] );
	$routes = array_map( 'amb_route', $posts );
	return $routes;
}

function amb_route( $post ) {
	$post  = get_post( $post );
	$fares = get_post_meta( $post->ID, '_amb_fares', true );
	return [
		'id'    => $post->ID,
		'to'    => get_post_meta( $post->ID, '_amb_to', true ) ?: $post->post_title,
		'km'    => (int) get_post_meta( $post->ID, '_amb_km', true ),
		'hours' => get_post_meta( $post->ID, '_amb_hours', true ),
		'blurb' => get_post_meta( $post->ID, '_amb_blurb', true ),
		'fares' => is_array( $fares ) ? $fares : [],
		'url'   => get_permalink( $post ),
	];
}

function amb_current_route() {
	$id = get_queried_object_id() ?: get_the_ID();
	return $id && get_post_meta( $id, '_amb_is_route', true ) ? amb_route( $id ) : null;
}

/* ---------- Route details box on the page editor ---------- */
add_action( 'add_meta_boxes_page', function () {
	add_meta_box( 'amb-route', 'Route details', 'amb_route_box', 'page', 'normal', 'high' );
} );

function amb_route_box( $post ) {
	wp_nonce_field( 'amb_route_save', 'amb_route_nonce' );
	$v     = fn( $k ) => get_post_meta( $post->ID, $k, true );
	$fares = $v( '_amb_fares' );
	$fares = is_array( $fares ) ? $fares : [];
	?>
	<p><label><input type="checkbox" name="amb_is_route" value="1" <?php checked( $v( '_amb_is_route' ), '1' ); ?>> <b>This is a route page</b> (shows on the home page, footer and booking card)</label></p>
	<table class="form-table" role="presentation">
		<tr><th><label for="amb-to">Destination</label></th><td><input class="regular-text" id="amb-to" name="amb_to" value="<?php echo esc_attr( $v( '_amb_to' ) ); ?>" placeholder="Vadodara"></td></tr>
		<tr><th><label for="amb-km">Distance (km)</label></th><td><input type="number" min="1" max="3000" id="amb-km" name="amb_km" value="<?php echo esc_attr( $v( '_amb_km' ) ); ?>"></td></tr>
		<tr><th><label for="amb-hours">Travel time</label></th><td><input class="regular-text" id="amb-hours" name="amb_hours" value="<?php echo esc_attr( $v( '_amb_hours' ) ); ?>" placeholder="2.5 to 3 hours"></td></tr>
		<tr><th><label for="amb-blurb">Short description</label></th><td><textarea class="large-text" rows="2" id="amb-blurb" name="amb_blurb"><?php echo esc_textarea( $v( '_amb_blurb' ) ); ?></textarea><p class="description">One sentence, used on this page's banner.</p></td></tr>
		<?php foreach ( amb_cars() as $c ) : ?>
			<tr><th><label for="amb-fare-<?php echo esc_attr( $c['key'] ); ?>"><?php echo esc_html( $c['name'] ); ?> fare</label></th><td><input class="regular-text" id="amb-fare-<?php echo esc_attr( $c['key'] ); ?>" name="amb_fares[<?php echo esc_attr( $c['name'] ); ?>]" value="<?php echo esc_attr( $fares[ $c['name'] ] ?? '' ); ?>" placeholder="e.g. ₹3,500 one way (leave empty to show Get fare)"></td></tr>
		<?php endforeach; ?>
	</table>
	<?php
}

add_action( 'save_post_page', function ( $post_id ) {
	if ( ! isset( $_POST['amb_route_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['amb_route_nonce'] ), 'amb_route_save' ) ) {
		return;
	}
	if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_page', $post_id ) ) {
		return;
	}
	update_post_meta( $post_id, '_amb_is_route', empty( $_POST['amb_is_route'] ) ? '' : '1' );
	update_post_meta( $post_id, '_amb_to', sanitize_text_field( wp_unslash( $_POST['amb_to'] ?? '' ) ) );
	update_post_meta( $post_id, '_amb_km', absint( $_POST['amb_km'] ?? 0 ) );
	update_post_meta( $post_id, '_amb_hours', sanitize_text_field( wp_unslash( $_POST['amb_hours'] ?? '' ) ) );
	update_post_meta( $post_id, '_amb_blurb', sanitize_textarea_field( wp_unslash( $_POST['amb_blurb'] ?? '' ) ) );
	$fares = [];
	foreach ( (array) wp_unslash( $_POST['amb_fares'] ?? [] ) as $car => $fare ) {
		$fare = sanitize_text_field( $fare );
		if ( '' !== $fare ) {
			$fares[ sanitize_text_field( $car ) ] = $fare;
		}
	}
	update_post_meta( $post_id, '_amb_fares', $fares );
} );

/* Route pages listed first in Pages, with a column showing which pages are routes. */
add_filter( 'manage_page_posts_columns', function ( $cols ) {
	$cols['amb_route'] = 'Route';
	return $cols;
} );
add_action( 'manage_page_posts_custom_column', function ( $col, $id ) {
	if ( 'amb_route' === $col && get_post_meta( $id, '_amb_is_route', true ) ) {
		echo esc_html( (int) get_post_meta( $id, '_amb_km', true ) . ' km' );
	}
}, 10, 2 );
