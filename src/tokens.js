/**
 * Design tokens — Hand Tracking Cursor Design System (August 2026).
 * Every value here maps 1:1 to a swatch or measurement in the style guide.
 */

export const COLOR = {
  green: '#00CA48',
  darkGreen: '#008630',
  red: '#FF4040',
  purple: '#FB79FF',
  yellow: '#FFC44F',

  white: '#FFFFFF',
  lightGray: '#F6F6F6',
  border: '#EBEBEB',
  mediumGray: '#D9D9D9',
  toggleGray: '#C5C5C6',
  iconDark: '#1C1B1F',
  black: '#000000',

  textPrimary: 'rgba(0, 0, 0, 1)',
  textSecondary: 'rgba(0, 0, 0, 0.6)',
  textTertiary: 'rgba(0, 0, 0, 0.4)',
  divider: 'rgba(0, 0, 0, 0.08)',
};

/** Corner radii: buttons and controls share one, cards are rounder. */
export const RADIUS = {
  button: 8,
  card: 12,
};

/** The only two type sizes the trackpad needs. */
export const TYPE = {
  family:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  label: { size: 12, weight: 500, leading: 16 },
  body: { size: 12, weight: 400, leading: 16 },
};

/** Panel geometry, straight off the dev spec column. */
export const SIZE = {
  panelWidth: 260,
  panelHeight: 200,
  pad: 12,
  gap: 12,
  cornerInset: 4,
  cornerButton: 32,
  iconSize: 24,
  ctaHeight: 32,
  ctaPadX: 12,
  ctaGap: 8,
  /** The hand illustration on the pre-enabled card. */
  illoWidth: 66,
  illoHeight: 98,
};

/**
 * The minimized state: a tab stuck to the edge of the screen.
 *
 * The two heights are derived rather than written down, because the spec gives
 * them as a stack — 8, then the icon, then 8, with the dot and another gap
 * added once the camera is on — and a hardcoded 64 and 80 would be free to
 * drift away from the parts that make them up.
 */
const TAB = {
  width: 24,
  pad: 8,
  gap: 8,
  dot: 8,
  iconWidth: 16,
  iconHeight: 48,
};

/**
 * The card's resize, shared by every property that has to move with it.
 *
 * One value rather than six copies: the padding, the offsets and the
 * illustration's scale are only correct *because* they run on the card's exact
 * timing, so they cannot be allowed to drift apart from it.
 *
 * The curve is easeInOutQuart as easings.net gives it.
 */
export const RESIZE = '400ms cubic-bezier(0.76, 0, 0.24, 1)';

/**
 * The crossfade underneath it, in ms. Shorter than the resize on purpose — the
 * contents should be gone well before the card has finished moving — but tied
 * to it, because the ratio is what decides how much of the card the chevron has
 * crossed by the time it disappears. Left at 160ms against a 400ms resize it
 * managed 23%, where against the 280ms it was written for it managed 97%; held
 * to the same ratio it manages 77%.
 */
export const FADE_MS = 230;

export const SIDETAB = {
  ...TAB,
  height: TAB.pad * 2 + TAB.iconHeight,
  liveHeight: TAB.pad * 3 + TAB.dot + TAB.iconHeight,
};

export const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap';
