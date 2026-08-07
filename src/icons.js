/**
 * Inline icons, drawn on the Material Symbols 24px grid so they can be swapped
 * for the real Material Symbols assets without touching any layout.
 *
 *   videocam      -> Enable Camera button
 *   videocam_off  -> turn the camera off
 *   collapse      -> collapse_content (minimize the trackpad)
 *   expand        -> expand_content (restore the trackpad)
 */

const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const CAMERA_BODY =
  '<rect x="3" y="6" width="13" height="12" rx="2.5"/>' +
  '<path d="M16 10.6 21 7v10l-5-3.6z"/>';

export const ICONS = {
  videocam: svg(CAMERA_BODY),

  videocamOff: svg(`${CAMERA_BODY}<path d="M3.5 3.5 20.5 20.5"/>`),

  // Two corner brackets pulled in toward the middle. The 6-unit offset from the
  // centre line keeps them from merging into a plus sign at 16px.
  collapse: svg('<path d="M15 3v6h6"/><path d="M9 21v-6H3"/>'),

  // The same brackets pushed back out to the edges.
  expand: svg('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/>'),
};

/**
 * The cursor arrow. The tip sits at (0,0) and the shape points up-left, which
 * is the familiar resting orientation; `ARROW_REST_ANGLE` is that direction in
 * screen degrees, so rotation math can express "point along the heading".
 */
export const ARROW_REST_ANGLE = -112;

export const ARROW_SVG =
  '<svg viewBox="0 0 13 21" aria-hidden="true" focusable="false">' +
  '<path d="M0 0 0 16.8 4.3 13 6.8 19.3 9.6 18.2 7.1 12 12 11.6Z" ' +
  'fill="currentColor" stroke="rgba(255,255,255,0.92)" stroke-width="1.1" ' +
  'stroke-linejoin="round" paint-order="stroke fill"/>' +
  '</svg>';

/** Aspect ratio of ARROW_SVG, used to size the cursor element. */
export const ARROW_ASPECT = 21 / 13;
