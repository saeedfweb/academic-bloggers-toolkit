<?php
/**
 * Utility functions used throughout the backend.
 *
 * @package ABT
 */

declare(strict_types=1);

namespace ABT\Utils;

/**
 * Safely adds JSON data into a page to be used by scripts.
 *
 * @param string $id A unique ID for the data.
 * @param mixed  $data The data to be JSON encoded.
 * @throws \RuntimeException If the provided action is already done and over with.
 */
function add_json_script( string $id, $data ) {
	$prefix = is_admin() ? 'admin_' : 'wp_';
	$action = $prefix . 'footer';
	if ( did_action( $action ) ) {
		throw new \RuntimeException( 'Action already fired for JSON data with ID ' . $id );
	}
	add_action(
		$action,
		function () use ( $id, $data ) {
			?>
				<script
					id="<?php echo esc_attr( $id ); ?>"
					type="application/json"
					><?php echo wp_json_encode( $data ); ?></script>
			<?php
		}
	);
}

/**
 * Parses and returns ./citation-styles.json
 */
function get_citation_styles() {
	return json_decode(
		file_get_contents( // phpcs:ignore
			ABT_ROOT_PATH . '/citation-styles.json'
		)
	);
}

/**
 * Parses and returns ./dependencies.json
 */
function get_dependencies() {
	return json_decode(
		file_get_contents( // phpcs:ignore
			ABT_ROOT_PATH . '/dependencies.json'
		),
		true
	);
}

/**
 * Utility function that registers a script and/or its associated style if it exists.
 *
 * @param string $relpath Path of script/style relative to the bundle directory.
 * @param array  $deps    Optional. List of script dependencies. Default [].
 *
 * @throws \InvalidArgumentException If the relative path refers to a non-existent file.
 */
function register_script( string $relpath, array $deps = [] ) {
	$handle        = 'abt-' . $relpath;
	$script_suffix = "/bundle/$relpath.js";
	$style_suffix  = "/bundle/$relpath.css";

	if ( file_exists( ABT_ROOT_PATH . $script_suffix ) ) {
		wp_register_script(
			$handle,
			ABT_ROOT_URI . $script_suffix,
			$deps['scripts'] ?? [],
			filemtime( ABT_ROOT_PATH . $script_suffix ),
			true
		);
		if ( in_array( 'wp-i18n', $deps['scripts'] ?? [], true ) ) {
			wp_set_script_translations(
				$handle,
				'academic-bloggers-toolkit',
				basename( ABT_ROOT_PATH ) . '/languages'
			);
		}
	}
	if ( file_exists( ABT_ROOT_PATH . $style_suffix ) ) {
		$registered_styles = wp_styles()->registered;
		$style_deps        = array_merge(
			$deps['styles'] ?? [],
			array_filter(
				$deps['scripts'],
				function( $id ) use ( $registered_styles ) {
					return array_key_exists( $id, $registered_styles );
				}
			)
		);
		wp_register_style(
			$handle,
			ABT_ROOT_URI . $style_suffix,
			$style_deps,
			filemtime( ABT_ROOT_PATH . $style_suffix )
		);
	}
}
