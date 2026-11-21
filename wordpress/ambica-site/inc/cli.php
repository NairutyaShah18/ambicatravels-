<?php
defined( 'ABSPATH' ) || exit;

/**
 * Sets up the Ambica Travels pages. Run by the server install script.
 *
 *   wp ambica import            create pages that don't exist yet (never touches pages you've edited)
 *   wp ambica import --force    rebuild every page from the template (overwrites Elementor edits)
 */
class Amb_CLI {

	/**
	 * Create the home page and route pages with their Elementor layouts.
	 *
	 * [--force]
	 * : Overwrite pages that already exist.
	 */
	public function import( $args, $assoc ) {
		$force = ! empty( $assoc['force'] );
		$file  = AMB_DIR . 'import/pages.json';
		$pages = json_decode( file_get_contents( $file ), true ); // phpcs:ignore
		if ( ! is_array( $pages ) ) {
			WP_CLI::error( 'Could not read ' . $file );
		}
		$images = get_option( 'ambica_car_images', [] );
		$home_id = 0;

		foreach ( $pages as $i => $p ) {
			$existing = get_page_by_path( $p['slug'], OBJECT, 'page' );
			if ( $existing && ! $force ) {
				WP_CLI::log( "skip   /{$p['slug']}/ (already exists)" );
				if ( ! empty( $p['front'] ) ) {
					$home_id = $existing->ID;
				}
				continue;
			}
			$json = wp_json_encode( $p['elementor'] );
			$json = preg_replace_callback( '/"\{\{imgid:([a-z0-9-]+)\}\}"/', fn( $m ) => (string) (int) ( $images[ $m[1] ] ?? 0 ), $json );
			$json = preg_replace_callback( '/\{\{img:([a-z0-9-]+)\}\}/', function ( $m ) use ( $images ) {
				$url = ! empty( $images[ $m[1] ] ) ? wp_get_attachment_image_url( (int) $images[ $m[1] ], 'medium_large' ) : '';
				return $url ? str_replace( '/', '\\/', $url ) : '';
			}, $json );

			$postarr = [
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_title'   => $p['title'],
				'post_name'    => $p['slug'],
				'post_content' => $p['text'] ?? '',
				'menu_order'   => $i,
			];
			if ( $existing ) {
				$postarr['ID'] = $existing->ID;
			}
			$id = wp_insert_post( wp_slash( $postarr ), true );
			if ( is_wp_error( $id ) ) {
				WP_CLI::warning( $p['slug'] . ': ' . $id->get_error_message() );
				continue;
			}
			update_post_meta( $id, '_wp_page_template', 'elementor_header_footer' );
			update_post_meta( $id, '_elementor_edit_mode', 'builder' );
			update_post_meta( $id, '_elementor_template_type', 'wp-page' );
			update_post_meta( $id, '_elementor_version', defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : '3.0.0' );
			update_post_meta( $id, '_elementor_data', wp_slash( $json ) );
			delete_post_meta( $id, '_elementor_css' );

			if ( ! empty( $p['route'] ) ) {
				update_post_meta( $id, '_amb_is_route', '1' );
				update_post_meta( $id, '_amb_to', $p['route']['to'] );
				update_post_meta( $id, '_amb_km', (int) $p['route']['km'] );
				update_post_meta( $id, '_amb_hours', $p['route']['hours'] );
				update_post_meta( $id, '_amb_blurb', $p['route']['blurb'] );
				if ( ! metadata_exists( 'post', $id, '_amb_fares' ) ) {
					update_post_meta( $id, '_amb_fares', [] );
				}
			}
			if ( ! empty( $p['seo'] ) ) {
				update_post_meta( $id, 'rank_math_title', $p['seo']['title'] );
				update_post_meta( $id, 'rank_math_description', $p['seo']['description'] );
				update_post_meta( $id, 'rank_math_focus_keyword', $p['seo']['focus'] );
			}
			if ( ! empty( $p['front'] ) ) {
				$home_id = $id;
			}
			WP_CLI::log( ( $existing ? 'update ' : 'create ' ) . "/{$p['slug']}/ (#{$id})" );
		}

		if ( $home_id ) {
			update_option( 'show_on_front', 'page' );
			update_option( 'page_on_front', $home_id );
		}
		$this->menu();
		if ( class_exists( '\Elementor\Plugin' ) ) {
			\Elementor\Plugin::$instance->files_manager->clear_cache();
		}
		WP_CLI::success( 'Pages ready.' );
	}

	/**
	 * Fill Rank Math's local business details from Settings → Ambica Travels and stop pages being marked as articles.
	 */
	public function seo() {
		$o = get_option( 'rank-math-options-titles', [] );
		$o = is_array( $o ) ? $o : [];
		$o['knowledgegraph_type']           = 'company';
		$o['knowledgegraph_name']           = amb_s( 'name' );
		$o['website_name']                  = amb_s( 'name' );
		$o['local_business_type']           = 'TaxiService';
		$o['pt_page_default_rich_snippet']  = 'off';
		$o['email']                         = amb_s( 'email' );
		$o['url']                           = home_url( '/' );
		$o['local_address']                 = [ 'streetAddress' => 'Jahangirpura', 'addressLocality' => amb_s( 'city' ), 'addressRegion' => amb_s( 'region' ), 'postalCode' => '', 'addressCountry' => 'IN' ];
		$o['local_address_format']          = '{address} {locality}, {region} {postalcode}';
		$o['phone_numbers']                 = [ [ 'type' => 'customer support', 'number' => preg_replace( '/\s/', '', amb_s( 'phone' ) ) ] ];
		$o['opening_hours']                 = array_map( fn( $d ) => [ 'day' => $d, 'time' => '00:00-23:59' ], [ 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday' ] );
		update_option( 'rank-math-options-titles', $o );
		foreach ( get_posts( [ 'post_type' => 'page', 'posts_per_page' => -1, 'fields' => 'ids' ] ) as $id ) {
			update_post_meta( $id, 'rank_math_rich_snippet', 'off' );
		}
		WP_CLI::success( 'Rank Math business details set.' );
	}

	private function menu() {
		$locations = get_nav_menu_locations();
		if ( ! empty( $locations['ambica_primary'] ) ) {
			return;
		}
		$menu_id = wp_create_nav_menu( 'Main menu' );
		if ( is_wp_error( $menu_id ) ) {
			$menu = wp_get_nav_menu_object( 'Main menu' );
			$menu_id = $menu ? $menu->term_id : 0;
		} else {
			foreach ( [ [ 'Services', home_url( '/#services' ), '' ], [ 'Routes', home_url( '/#routes' ), '' ], [ 'Fleet', home_url( '/#fleet' ), '' ], [ 'Book a ride', '#book', 'nav-cta' ] ] as $pos => $it ) {
				wp_update_nav_menu_item( $menu_id, 0, [
					'menu-item-title'    => $it[0],
					'menu-item-url'      => $it[1],
					'menu-item-classes'  => $it[2],
					'menu-item-status'   => 'publish',
					'menu-item-type'     => 'custom',
					'menu-item-position' => $pos + 1,
				] );
			}
		}
		if ( $menu_id ) {
			$locations['ambica_primary'] = $menu_id;
			set_theme_mod( 'nav_menu_locations', $locations );
		}
	}
}

WP_CLI::add_command( 'ambica', 'Amb_CLI' );
