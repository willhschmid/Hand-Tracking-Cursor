/**
 * MediaPipe hand landmark topology plus the few measurements the cursor needs.
 * Landmark indices follow the standard 21-point hand model.
 */

export const WRIST = 0;
export const THUMB_TIP = 4;
export const INDEX_MCP = 5;
export const INDEX_TIP = 8;
export const MIDDLE_MCP = 9;
export const RING_MCP = 13;
export const PINKY_MCP = 17;

/** Bone pairs drawn by the skeleton renderer. */
export const CONNECTIONS = [
  // thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // middle
  [9, 10], [10, 11], [11, 12],
  // ring
  [13, 14], [14, 15], [15, 16],
  // pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // knuckle bridge across the palm
  [5, 9], [9, 13], [13, 17],
];

/**
 * Distance between two landmarks in a frame whose pixels are `aspect` times
 * wider than tall — normalized coordinates are anisotropic, so x has to be
 * rescaled before any distance is meaningful.
 */
function distance(a, b, aspect) {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/** Wrist-to-middle-knuckle span: a stable stand-in for "how big is this hand". */
export function handScale(points, aspect = 1) {
  return Math.max(
    distance(points[WRIST], points[MIDDLE_MCP], aspect),
    1e-4,
  );
}

/** Thumb/index separation as a fraction of hand size. Small means pinched. */
export function pinchRatio(points, aspect = 1) {
  return (
    distance(points[THUMB_TIP], points[INDEX_TIP], aspect) /
    handScale(points, aspect)
  );
}

/**
 * The point the cursor follows: halfway between thumb tip and index tip.
 * Both tips travel toward each other during a pinch, so their midpoint barely
 * moves — the cursor does not jump at the moment of the click.
 */
export function controlPoint(points) {
  const a = points[THUMB_TIP];
  const b = points[INDEX_TIP];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
