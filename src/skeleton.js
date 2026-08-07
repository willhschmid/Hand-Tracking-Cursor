/** Draws the hand skeleton over the live camera feed. */

import { CONNECTIONS, THUMB_TIP, INDEX_TIP } from './landmarks.js';
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
