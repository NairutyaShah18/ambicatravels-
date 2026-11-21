<?php
defined( 'ABSPATH' ) || exit;

/*
 * Shortcodes used inside Elementor (Shortcode widget). They read the details from
 * Settings → Ambica Travels and from route pages, so they stay correct when those change.
 *
 * [ambica_fare_card]     WhatsApp fare card for the hero
 * [ambica_ticker]        moving strip of destinations
 * [ambica_routes]        auto-scrolling route cards
 * [ambica_booking]       booking hours card + booking form (put the section ID "book" on its container)
 * [ambica_route_facts]   distance / time strip on a route page
 * [ambica_route_cars]    cars with fares on a route page
 * [ambica_route_buttons] Call + WhatsApp buttons on a route page
 * [ambica_other_routes]  links to the other routes
 * [ambica_icon i="plane"]
 */

add_shortcode( 'ambica_icon', function ( $a ) {
	$a = shortcode_atts( [ 'i' => 'road' ], $a );
	return '<span class="amb-ico">' . amb_icon( 'i-' . sanitize_key( $a['i'] ) ) . '</span>';
} );

add_shortcode( 'ambica_fare_card', function () {
	$city   = amb_s( 'city' );
	$routes = amb_routes();
	ob_start(); ?>
	<form class="quick" id="quick" aria-label="Quick fare request">
		<p class="quick-t">Get a fare in one message</p>
		<div class="quick-leg"><span><small>From</small><b><?php echo esc_html( $city ); ?></b></span><i aria-hidden="true"></i><span><small>To</small>
			<select id="q-to" aria-label="Drop city"><?php foreach ( $routes as $r ) : ?><option><?php echo esc_html( $r['to'] ); ?></option><?php endforeach; ?><option value="">Somewhere else</option></select></span></div>
		<div class="f"><label for="q-cab">Car</label><select id="q-cab"><?php foreach ( amb_cars() as $c ) : ?><option><?php echo esc_html( $c['name'] ); ?></option><?php endforeach; ?></select></div>
		<div class="f"><label for="q-date">Travel date</label><input id="q-date" type="date"></div>
		<a class="btn wa block" id="q-send" href="<?php echo esc_url( amb_links()['wa'] ); ?>" target="_blank" rel="noopener"><?php echo amb_icon( 'i-wa' ); // phpcs:ignore ?>Ask fare on WhatsApp</a>
		<a class="quick-more" href="#book">or fill in the full booking form</a>
	</form>
	<?php
	return ob_get_clean();
} );

add_shortcode( 'ambica_ticker', function () {
	$city  = esc_html( amb_s( 'city' ) );
	$items = '';
	foreach ( amb_routes() as $r ) {
		$items .= '<span>' . $city . ' <b>→</b> ' . esc_html( $r['to'] ) . '</span>';
	}
	return '<div class="ticker" aria-hidden="true"><div class="ticker-in">' . $items . $items . '</div></div>';
} );

add_shortcode( 'ambica_routes', function () {
	$city = amb_s( 'city' );
	$cars = implode( ' · ', wp_list_pluck( amb_cars(), 'name' ) );
	ob_start(); ?>
	<div class="amb-routes">
		<div class="rail-nav"><button type="button" data-rail="routeRail" data-dir="-1" aria-label="Previous routes"><?php echo amb_icon( 'i-left' ); // phpcs:ignore ?></button><button type="button" data-rail="routeRail" data-dir="1" aria-label="More routes"><?php echo amb_icon( 'i-right' ); // phpcs:ignore ?></button></div>
		<div class="rail auto" id="routeRail">
		<?php foreach ( amb_routes() as $r ) : ?>
			<article class="dest">
				<div class="dest-top"><span class="dest-from">From <?php echo esc_html( $city ); ?></span><span class="dest-km"><?php echo esc_html( $r['km'] ); ?> km</span></div>
				<h3><a href="<?php echo esc_url( $r['url'] ); ?>"><?php echo esc_html( $r['to'] ); ?></a></h3>
				<div class="dest-line" aria-hidden="true"><i></i><svg viewBox="0 0 200 78"><use href="#car"/></svg><b><?php echo amb_icon( 'i-pin' ); // phpcs:ignore ?></b></div>
				<p class="dest-meta"><?php echo amb_icon( 'i-clock' ); // phpcs:ignore ?><?php echo esc_html( $r['hours'] ); ?> by road</p>
				<p class="dest-cabs"><?php echo esc_html( $cars ); ?></p>
				<div class="dest-act">
					<a class="btn wa" href="<?php echo esc_url( amb_wa_text_link( "Hi, I need a taxi from {$city} to {$r['to']}. Please share the fare." ) ); ?>" target="_blank" rel="noopener"><?php echo amb_icon( 'i-wa' ); // phpcs:ignore ?>Get fare</a>
					<a class="btn ghost" href="<?php echo esc_url( $r['url'] ); ?>" aria-label="<?php echo esc_attr( "{$city} to {$r['to']} taxi details" ); ?>">Details</a>
				</div>
			</article>
		<?php endforeach; ?>
		</div>
	</div>
	<?php
	return ob_get_clean();
} );

add_shortcode( 'ambica_booking', function () {
	$s     = amb_s();
	$l     = amb_links();
	$route = amb_current_route();
	ob_start(); ?>
	<div class="book-grid">
		<aside class="hours">
			<h3>Booking Hours</h3>
			<p class="big"><?php echo esc_html( $s['hours_title'] ); ?></p>
			<p><?php echo esc_html( $s['hours_text'] ); ?></p>
			<ul>
				<li><?php echo amb_icon( 'i-call' ); // phpcs:ignore ?><a href="<?php echo esc_url( $l['tel'] ); ?>"><?php echo esc_html( $s['phone'] ); ?></a></li>
				<li><?php echo amb_icon( 'i-wa' ); // phpcs:ignore ?><a href="<?php echo esc_url( $l['wa'] ); ?>" target="_blank" rel="noopener"><?php echo esc_html( $s['whatsapp'] ); ?></a></li>
				<li><?php echo amb_icon( 'i-mail' ); // phpcs:ignore ?><a href="<?php echo esc_url( $l['mail'] ); ?>"><?php echo esc_html( $s['email'] ); ?></a></li>
			</ul>
		</aside>
		<div class="card-form">
			<form id="bookForm" novalidate>
				<div class="f"><label for="f-name">Name</label><input id="f-name" name="name" placeholder="Your name" required autocomplete="name"></div>
				<div class="f"><label for="f-mobile">Mobile number</label><input id="f-mobile" name="mobile" type="tel" inputmode="tel" placeholder="10-digit mobile" required autocomplete="tel"></div>
				<div class="f"><label for="f-from">Pickup</label><input id="f-from" name="from" value="<?php echo esc_attr( $s['city'] ); ?>"></div>
				<div class="f"><label for="f-to">Drop</label><input id="f-to" name="to" placeholder="Where to?" value="<?php echo esc_attr( $route['to'] ?? '' ); ?>"></div>
				<div class="f"><label for="f-date">Travel date</label><input id="f-date" name="date" type="date"></div>
				<div class="f"><label for="f-time">Pickup time</label><input id="f-time" name="time" type="time"></div>
				<div class="f"><label for="f-trip">Trip type</label><select id="f-trip" name="trip"><?php foreach ( amb_lines( 'trips' ) as $t ) : ?><option><?php echo esc_html( $t ); ?></option><?php endforeach; ?></select></div>
				<div class="f"><label for="f-cab">Car</label><select id="f-cab" name="cab"><?php foreach ( amb_cars() as $c ) : ?><option><?php echo esc_html( $c['name'] ); ?></option><?php endforeach; ?></select></div>
				<div class="f full"><label for="f-msg">Message</label><textarea id="f-msg" name="msg" placeholder="Passengers, luggage, stops on the way"></textarea></div>
				<div class="f full"><button class="btn block" type="submit">Prepare my booking request</button></div>
				<div class="sendbox" id="sendbox" role="status">
					<p id="sendmsg"></p>
					<pre id="sendpre"></pre>
					<a class="btn wa" id="sendlink" href="<?php echo esc_url( $l['wa'] ); ?>" target="_blank" rel="noopener"><?php echo amb_icon( 'i-wa' ); // phpcs:ignore ?>Send on WhatsApp</a>
				</div>
				<p class="form-note">Nothing is sent until you press Send in WhatsApp.</p>
			</form>
		</div>
	</div>
	<?php
	return ob_get_clean();
} );

add_shortcode( 'ambica_route_facts', function () {
	$r = amb_current_route();
	if ( ! $r ) {
		return '';
	}
	return '<div class="facts">'
		. '<div><small>Distance</small><b>About ' . esc_html( $r['km'] ) . ' km</b></div>'
		. '<div><small>Travel time</small><b>' . esc_html( $r['hours'] ) . '</b></div>'
		. '<div><small>Trip types</small><b>One way · Round trip</b></div>'
		. '<div><small>Pickup</small><b>Any time, any day</b></div></div>';
} );

add_shortcode( 'ambica_route_cars', function () {
	$r = amb_current_route();
	$o = '<div class="cabrows">';
	foreach ( amb_cars() as $c ) {
		$img  = amb_car_image( $c['key'], 'medium', [ 'class' => 'cab-photo', 'loading' => 'lazy' ] ) ?: amb_car_svg();
		$fare = $r['fares'][ $c['name'] ] ?? '';
		$o   .= '<div class="cabrow">' . $img . '<div><b>' . esc_html( $c['name'] ) . '</b><span>' . esc_html( trim( $c['seats'] . ' · ' . $c['note'], ' ·' ) ) . '</span></div>'
			. '<div class="act"><span class="fare">' . esc_html( $fare ) . '</span> <button class="btn ghost" type="button" data-enq-to="' . esc_attr( $r['to'] ?? '' ) . '" data-enq-cab="' . esc_attr( $c['name'] ) . '">' . ( $fare ? 'Book' : 'Get fare' ) . '</button></div></div>';
	}
	return $o . '</div>';
} );

add_shortcode( 'ambica_route_buttons', function () {
	$r = amb_current_route();
	$l = amb_links();
	$to = $r['to'] ?? '';
	return '<div class="hero-cta"><a class="btn" href="' . esc_url( $l['tel'] ) . '">' . amb_icon( 'i-call' ) . 'Call ' . esc_html( amb_s( 'phone' ) ) . '</a>'
		. '<a class="btn light" href="' . esc_url( amb_wa_text_link( 'Hi, I need a taxi from ' . amb_s( 'city' ) . ' to ' . $to . '. Please share the fare.' ) ) . '" target="_blank" rel="noopener">' . amb_icon( 'i-wa' ) . 'WhatsApp for fare</a></div>';
} );

add_shortcode( 'ambica_home_buttons', function () {
	$l = amb_links();
	return '<div class="hero-cta"><a class="btn" href="' . esc_url( $l['tel'] ) . '">' . amb_icon( 'i-call' ) . 'Call ' . esc_html( amb_s( 'phone' ) ) . '</a>'
		. '<a class="btn light" href="' . esc_url( $l['wa'] ) . '" target="_blank" rel="noopener">' . amb_icon( 'i-wa' ) . 'WhatsApp us</a></div>';
} );

add_shortcode( 'ambica_other_routes', function () {
	$cur  = get_queried_object_id();
	$city = esc_html( amb_s( 'city' ) );
	$o    = '<div class="others">';
	foreach ( amb_routes() as $r ) {
		if ( $r['id'] === $cur ) {
			continue;
		}
		$o .= '<a href="' . esc_url( $r['url'] ) . '">' . $city . ' to ' . esc_html( $r['to'] ) . '<small>' . esc_html( $r['km'] ) . ' km</small></a>';
	}
	return $o . '</div>';
} );
