/**
 * Skeleton drawing. One topology, two outputs: a canvas overlay for the live
 * camera feed and an SVG illustration for the pre-enabled card, so the resting
 * state looks like a frozen frame of the running state.
 */

import { CONNECTIONS, PALM, CANONICAL_HAND, THUMB_TIP, INDEX_TIP } from './landmarks.js';
import { COLOR } from './tokens.js';

const JOINT = 3.2; // side of the square drawn at every landmark
const BONE = 1.6;

/**
 * Draws the skeleton onto a 2D context. `points` are already in CSS pixels
 * relative to the canvas.
 */
export function drawSkeleton(ctx, points, { pinching = false } = {}) {
  const stroke = pinching ? COLOR.green : COLOR.purple;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = stroke;
  ctx.lineWidth = BONE;
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    ctx.moveTo(points[a].x, points[a].y);
    ctx.lineTo(points[b].x, points[b].y);
  }
  ctx.stroke();

  // The pinch gap, dashed while open and solid once the click lands.
  ctx.strokeStyle = COLOR.green;
  ctx.lineWidth = 1.4;
  ctx.setLineDash(pinching ? [] : [3, 3]);
  ctx.beginPath();
  ctx.moveTo(points[INDEX_TIP].x, points[INDEX_TIP].y);
  ctx.lineTo(points[THUMB_TIP].x, points[THUMB_TIP].y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = stroke;
  const half = JOINT / 2;
  for (const p of points) {
    ctx.fillRect(p.x - half, p.y - half, JOINT, JOINT);
  }
}

/**
 * The static hand shown before the camera turns on. Built from the same
 * topology: a thick soft pass makes the silhouette, a thin pass makes the
 * skeleton on top.
 */
export function handIllustration() {
  const S = 100;
  // The canonical pose is squatter than the 66x98 frame it has to fill, so the
  // artwork is drawn on a stretched vertical axis rather than letterboxed.
  const STRETCH = 1.26;
  const pt = (i) => CANONICAL_HAND[i];
  const px = (i) => pt(i).x * S;
  const py = (i) => pt(i).y * S * STRETCH;
  const at = (i) => `${px(i).toFixed(2)} ${py(i).toFixed(2)}`;

  const bones = CONNECTIONS.map(([a, b]) => `M${at(a)}L${at(b)}`).join('');
  const palm = `M${PALM.map(at).join('L')}Z`;
  const tips = [4, 8, 12, 16, 20]
    .map((i) => `<circle cx="${px(i).toFixed(2)}" cy="${py(i).toFixed(2)}" r="6"/>`)
    .join('');
  const joints = CANONICAL_HAND.map(
    (_, i) =>
      `<rect x="${(px(i) - 1.6).toFixed(2)}" y="${(py(i) - 1.6).toFixed(2)}" width="3.2" height="3.2"/>`,
  ).join('');

  // A single flat tone rather than a translucent one: overlapping strokes would
  // otherwise pile up into darker patches where the fingers meet the palm.
  const skin = '#E4E4E4';

  return (
    // Cropped to the hand itself rather than the 0..1 landmark box, so the
    // artwork fills the 66x98 frame instead of floating in it.
    `<svg class="hc-illo-svg" viewBox="9 7 82 122" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">` +
    `<g fill="${skin}">` +
    `<path d="${palm}"/>${tips}` +
    `<path d="${bones}" fill="none" stroke="${skin}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>` +
    `<path d="${bones}" fill="none" stroke="${COLOR.purple}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${at(INDEX_TIP)}L${at(THUMB_TIP)}" fill="none" stroke="${COLOR.green}" ` +
    `stroke-width="1.4" stroke-dasharray="3 3" stroke-linecap="round"/>` +
    `<g fill="${COLOR.purple}">${joints}</g>` +
    `</svg>`
  );
}
