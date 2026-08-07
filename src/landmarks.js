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

/** Outline of the palm, used to fill the silhouette in the static illustration. */
export const PALM = [0, 5, 9, 13, 17];

/**
 * A canonical open right hand, normalized to a 0..1 box with y pointing down.
 * Drives the illustration shown before the camera is enabled, so the resting
 * state and the live overlay share one visual language.
 */
export const CANONICAL_HAND = [
  [0.50, 0.95], // 0  wrist
  [0.67, 0.87], // 1  thumb cmc
  [0.79, 0.75], // 2  thumb mcp
  [0.86, 0.64], // 3  thumb ip
  [0.91, 0.54], // 4  thumb tip
  [0.58, 0.53], // 5  index mcp
  [0.61, 0.37], // 6  index pip
  [0.62, 0.27], // 7  index dip
  [0.63, 0.17], // 8  index tip
  [0.47, 0.51], // 9  middle mcp
  [0.47, 0.33], // 10
  [0.47, 0.22], // 11
  [0.47, 0.12], // 12 middle tip
  [0.36, 0.53], // 13 ring mcp
  [0.33, 0.36], // 14
  [0.32, 0.25], // 15
  [0.31, 0.16], // 16 ring tip
  [0.26, 0.58], // 17 pinky mcp
  [0.21, 0.45], // 18
  [0.19, 0.36], // 19
  [0.17, 0.28], // 20 pinky tip
].map(([x, y]) => ({ x, y }));

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
