<?php
defined( 'ABSPATH' ) || exit;

/* Settings → Ambica Travels: contact details and lists used by the header, footer, booking form and route cards. */

add_action( 'admin_menu', function () {
	add_options_page( 'Ambica Travels', 'Ambica Travels', 'manage_options', 'ambica-settings', 'amb_settings_page' );
} );

add_action( 'admin_init', function () {
	register_setting( 'ambica_settings', 'ambica_settings', [
		'type'              => 'array',
		'sanitize_callback' => 'amb_sanitize_settings',
	] );
} );

function amb_settings_fields() {
	return [
		'name'        => [ 'Business name', 'text' ],
		'city'        => [ 'Base city', 'text', 'Routes are shown as "From this city".' ],
		'region'      => [ 'State', 'text' ],
		'phone'       => [ 'Phone', 'text', 'Used by every Call button.' ],
		'whatsapp'    => [ 'WhatsApp number', 'text', 'With country code. Used by every WhatsApp button and the booking form.' ],
		'email'       => [ 'Email', 'email' ],
		'address'     => [ 'Address shown on the site', 'text' ],
		'hours_title' => [ 'Booking hours heading', 'text' ],
		'hours_text'  => [ 'Booking hours text', 'textarea' ],
		'trips'       => [ 'Trip types (one per line)', 'textarea', 'Choices in the booking form.' ],
		'cars'        => [ 'Cars (one per line)', 'textarea', 'Format: Name | seats | note. Used in the booking form, route cards and route pages. Each route page has a fare box per car.' ],
	];
}

function amb_sanitize_settings( $in ) {
	$out = [];
	foreach ( amb_settings_fields() as $k => $f ) {
		$v = $in[ $k ] ?? '';
		$out[ $k ] = 'textarea' === $f[1] ? sanitize_textarea_field( $v ) : ( 'email' === $f[1] ? sanitize_email( $v ) : sanitize_text_field( $v ) );
	}
	return $out;
}

function amb_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$opts = amb_s();
	echo '<div class="wrap"><h1>Ambica Travels</h1><p>These details appear in the header, footer, floating buttons, booking form and route cards across the whole site.</p>';
	echo '<form method="post" action="options.php">';
	settings_fields( 'ambica_settings' );
	echo '<table class="form-table" role="presentation">';
	foreach ( amb_settings_fields() as $k => $f ) {
		$id = 'amb-' . $k;
		echo '<tr><th scope="row"><label for="' . esc_attr( $id ) . '">' . esc_html( $f[0] ) . '</label></th><td>';
		if ( 'textarea' === $f[1] ) {
			echo '<textarea class="large-text" rows="5" id="' . esc_attr( $id ) . '" name="ambica_settings[' . esc_attr( $k ) . ']">' . esc_textarea( $opts[ $k ] ) . '</textarea>';
		} else {
			echo '<input class="regular-text" type="' . esc_attr( $f[1] ) . '" id="' . esc_attr( $id ) . '" name="ambica_settings[' . esc_attr( $k ) . ']" value="' . esc_attr( $opts[ $k ] ) . '">';
		}
		if ( ! empty( $f[2] ) ) {
			echo '<p class="description">' . esc_html( $f[2] ) . '</p>';
		}
		echo '</td></tr>';
	}
	echo '</table>';
	submit_button();
	echo '</form>';
	echo '<h2>Adding a new route page</h2><ol><li>Pages → hover an existing route page (for example "Surat to Vadodara Taxi") → <b>Duplicate</b>.</li><li>Open the copy, change its title and URL slug, fill in the <b>Route details</b> box (destination, distance, time, fares) and publish.</li><li>Click <b>Edit with Elementor</b> to change the headline, About text and FAQs. Set the SEO title and description in the Rank Math box.</li></ol><p>The new route appears automatically on the home page, in the footer and in the sitemap.</p>';
	echo '</div>';
}
