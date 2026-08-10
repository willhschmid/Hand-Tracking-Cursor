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
  miniSize: 106,
  pad: 12,
  gap: 12,
  cornerInset: 4,
  cornerButton: 32,
  iconSize: 24,
  ctaHeight: 32,
  ctaPadX: 12,
  ctaGap: 8,
  miniCta: 32,
  /** The hand illustration on the pre-enabled card. */
  illoWidth: 66,
  illoHeight: 98,
};

export const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap';
