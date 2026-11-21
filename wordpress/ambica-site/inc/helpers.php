<?php
defined( 'ABSPATH' ) || exit;

function amb_defaults() {
	return [
		'name'          => 'Ambica Travels',
		'city'          => 'Surat',
		'region'        => 'Gujarat',
		'phone'         => '+91 85113 01423',
		'whatsapp'      => '+91 85113 01423',
		'email'         => 'shahrakesh1232@gmail.com',
		'address'       => 'Jahangirpura, Surat, Gujarat',
		'hours_title'   => 'Open all day, every day',
		'hours_text'    => 'Early-morning airport drop or a late-night return, tell us the time and a car will be there.',
		'trips'         => "One way\nRound trip\nAirport transfer\nLocal (hourly)\nWedding / event",
		'cars'          => "Sedan | 4 passengers | Dzire, Etios and similar\nSUV | 6 passengers | Ertiga and similar\nInnova Crysta | 6 to 7 passengers | The long-distance favourite\nTempo Traveller | 12 to 17 passengers | One vehicle for the whole group",
	];
}

/** One setting, or all of them. */
function amb_s( $key = null ) {
	static $opts = null;
	if ( null === $opts ) {
		$saved = get_option( 'ambica_settings', [] );
		$opts  = wp_parse_args( is_array( $saved ) ? array_filter( $saved, 'strlen' ) : [], amb_defaults() );
	}
	return null === $key ? $opts : ( $opts[ $key ] ?? '' );
}

function amb_digits( $s ) {
	return preg_replace( '/\D/', '', (string) $s );
}

function amb_links() {
	return [
		'tel'  => 'tel:' . preg_replace( '/\s/', '', amb_s( 'phone' ) ),
		'wa'   => 'https://wa.me/' . amb_digits( amb_s( 'whatsapp' ) ),
		'mail' => 'mailto:' . amb_s( 'email' ),
	];
}

function amb_lines( $key ) {
	return array_values( array_filter( array_map( 'trim', explode( "\n", (string) amb_s( $key ) ) ) ) );
}

/** Cars from Settings → Ambica Travels, one per line: Name | seats | note */
function amb_cars() {
	$cars = [];
	foreach ( amb_lines( 'cars' ) as $line ) {
		$p = array_map( 'trim', explode( '|', $line ) );
		if ( '' === $p[0] ) {
			continue;
		}
		$cars[] = [ 'name' => $p[0], 'seats' => $p[1] ?? '', 'note' => $p[2] ?? '', 'key' => sanitize_title( $p[0] ) ];
	}
	return $cars;
}

/** Attachment ID of a car photo, keyed by car name slug (sedan, suv, innova-crysta, tempo-traveller). */
function amb_car_image( $key, $size = 'medium_large', $attr = [] ) {
	$ids = get_option( 'ambica_car_images', [] );
	return ! empty( $ids[ $key ] ) ? wp_get_attachment_image( (int) $ids[ $key ], $size, false, $attr ) : '';
}

function amb_icon( $id ) {
	return '<svg aria-hidden="true"><use href="#' . esc_attr( $id ) . '"/></svg>';
}

function amb_car_svg() {
	return '<svg class="car" viewBox="0 0 200 78" aria-hidden="true"><use href="#car"/></svg>';
}

/** The route wordmark. $dark = colours for light backgrounds. */
function amb_logo( $dark = false ) {
	$c = $dark
		? [ '#16122A', '#B4470A', '#E2620E', '#E2620E', '#FFFFFF' ]
		: [ '#FFFFFF', '#F6B23C', '#E2620E', '#F6B23C', '#16122A' ];
	return sprintf(
		'<svg class="logo" viewBox="20 14 460 196" role="img" aria-label="%1$s"><text x="250" y="112" text-anchor="middle" font-family="\'Playfair Display\',Georgia,serif" font-style="italic" font-weight="600" font-size="118" fill="%2$s">Ambica</text><path d="M46 150c120 26 250 26 372-6" fill="none" stroke="%4$s" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="150" r="8" fill="%2$s"/><path d="M430 104a17 17 0 0 0-17 17c0 13 17 30 17 30s17-17 17-30a17 17 0 0 0-17-17Z" fill="%5$s"/><circle cx="430" cy="121" r="6" fill="%6$s"/><text x="250" y="200" text-anchor="middle" font-family="\'Outfit\',system-ui,sans-serif" font-weight="500" font-size="32" letter-spacing="14" fill="%3$s">TRAVELS</text></svg>',
		esc_attr( amb_s( 'name' ) ), $c[0], $c[1], $c[2], $c[3], $c[4]
	);
}

function amb_wa_text_link( $text ) {
	return amb_links()['wa'] . '?text=' . rawurlencode( $text );
}
