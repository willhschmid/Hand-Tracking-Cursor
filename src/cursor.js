import { ARROW_SVG } from './icons.js';

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/**
 * The on-screen arrow.
 *
 * Two behaviours from the spec live here: the arrow leans into the direction it
 * is travelling, and it scales down slightly while pressed.
 */
export class Cursor {
  constructor(options) {
    this.options = options;
    this.el = document.createElement('div');
    this.el.className = 'hc-cursor';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = ARROW_SVG;

    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.scale = options.cursor.scale;
    this.visible = false;
    this.pressed = false;
    this.lastMoveAt = 0;

    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  mount(parent) {
    parent.appendChild(this.el);
  }

  setVisible(visible) {
    if (this.visible === visible) return;
    this.visible = visible;
    this.el.dataset.visible = String(visible);
  }

  setPressed(pressed) {
    this.pressed = pressed;
  }

  /**
   * @param {number} x       viewport x of the arrow tip
   * @param {number} y       viewport y of the arrow tip
   * @param {number} vx      horizontal speed, px per frame
   * @param {number} vy      vertical speed, px per frame
   * @param {number} now     timestamp of this frame
   */
  update(x, y, vx, vy, now) {
    this.x = x;
    this.y = y;

    const rotation = this.options.rotation;
    if (rotation.enabled && !this.reducedMotion) {
      // A slight lean into horizontal travel, never a spin.
      //
      // The obvious implementation — point the arrow along atan2(vy, vx) — is
      // unusable in practice: the *direction* of a near-zero velocity vector is
      // noise, so a hand holding still whips the cursor through every angle.
      // Horizontal magnitude is stable at rest, and it decays to zero on its
      // own, so the arrow returns upright without any idle bookkeeping.
      const target =
        Math.abs(vx) < rotation.minSpeed
          ? 0
          : clamp(vx * rotation.gain, -rotation.maxAngle, rotation.maxAngle);
      this.angle += (target - this.angle) * rotation.smoothing;
    } else {
      this.angle = 0;
    }

    const targetScale = this.pressed
      ? this.options.cursor.pressScale
      : this.options.cursor.scale;
    this.scale += (targetScale - this.scale) * 0.35;

    this.el.style.transform =
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) ` +
      `rotate(${this.angle.toFixed(2)}deg) ` +
      `scale(${this.scale.toFixed(3)})`;
  }

  reset() {
    this.angle = 0;
    this.scale = this.options.cursor.scale;
    this.pressed = false;
  }

  destroy() {
    this.el.remove();
  }
}
