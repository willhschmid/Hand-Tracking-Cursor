import { Cursor } from './cursor.js';
import { TouchEmulator } from './pointer.js';
import { PointFilter } from './one-euro.js';
import { controlPoint, pinchRatio } from './landmarks.js';
import { HoverEmulator } from './hover.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Everything between "here are 21 landmarks" and "the page reacted": mapping
 * into viewport space, smoothing, pinch detection, and the cursor itself.
 *
 * It deliberately knows nothing about where the landmarks came from. The
 * script-tag build feeds it from a camera in the same document; the Chrome
 * extension feeds it from an iframe running the model in another origin.
 */
export class CursorDriver {
  /**
   * @param {object} options            resolved config
   * @param {object} hooks
   * @param {import('./pointer.js').OwnUi} hooks.ui  the trackpad's own chrome
   * @param {Function} [hooks.onEvent]  (type, detail) for every gesture
   */
  constructor(options, { ui, onEvent } = {}) {
    this.options = options;
    this.onEvent = onEvent;

    this.cursor = new Cursor(options);
    this.hoverStyles = options.emulateHover ? new HoverEmulator() : null;
    this.touch = new TouchEmulator(options, {
      ui,
      hover: this.hoverStyles,
      onTap: (detail) => this.emit('tap', detail),
    });
    this.filter = new PointFilter(options.smoothing);

    this.position = null;
    this.velocity = { x: 0, y: 0 };
    this.pinching = false;
    this.lastFrameAt = 0;
  }

  mount(parent) {
    this.cursor.mount(parent);
  }

  emit(type, detail) {
    this.onEvent?.(type, detail);
  }

  /**
   * One tracked frame.
   *
   * @param {Array<{x:number,y:number}>} landmarks  normalized to the camera frame
   * @param {number} now      timestamp, ms
   * @param {number} aspect   camera frame width / height
   */
  consume(landmarks, now, aspect = 1) {
    const dt = this.lastFrameAt ? (now - this.lastFrameAt) / 1000 : 1 / 60;
    this.lastFrameAt = now;

    const point = controlPoint(landmarks);
    const region = this.options.region;
    // Mirror, then stretch the usable slice of the frame across the viewport.
    const nx = clamp01((1 - point.x - region.x) / (1 - 2 * region.x));
    const ny = clamp01((point.y - region.y) / (1 - 2 * region.y));

    const smoothed = this.filter.filter(
      nx * window.innerWidth,
      ny * window.innerHeight,
      dt,
    );

    const previous = this.position;
    this.position = smoothed;
    this.velocity = previous
      ? { x: smoothed.x - previous.x, y: smoothed.y - previous.y }
      : { x: 0, y: 0 };

    this.cursor.setVisible(true);
    this.cursor.update(smoothed.x, smoothed.y, this.velocity.x, this.velocity.y, now);

    // Pinch, with hysteresis so a hand hovering near the threshold stays put.
    const ratio = pinchRatio(landmarks, aspect);
    const { on, off } = this.options.pinch;
    const pinching = this.pinching ? ratio < off : ratio < on;

    if (pinching && !this.pinching) {
      this.pinching = true;
      this.cursor.setPressed(true);
      this.touch.press(smoothed.x, smoothed.y, now);
      this.emit('press', { x: smoothed.x, y: smoothed.y });
    } else if (!pinching && this.pinching) {
      this.pinching = false;
      this.cursor.setPressed(false);
      this.touch.release(smoothed.x, smoothed.y, now);
      this.emit('release', { x: smoothed.x, y: smoothed.y });
    }

    if (this.pinching) {
      this.touch.drag(smoothed.x, smoothed.y, now);
    } else {
      this.touch.move(smoothed.x, smoothed.y);
    }

    // `ratio` is published so a page can show what the pinch actually measures
    // — the only practical way to tune the threshold to a particular hand.
    const detail = { x: smoothed.x, y: smoothed.y, pinching: this.pinching, ratio };
    this.emit('move', detail);
    return detail;
  }

  /** The hand left the frame, or tracking stopped. */
  release() {
    if (this.position) this.touch.cancel(this.position.x, this.position.y);
    else this.touch.cancel();

    this.pinching = false;
    this.position = null;
    this.lastFrameAt = 0;
    this.filter.reset();
    this.cursor.setPressed(false);
    this.cursor.setVisible(false);
  }

  reset() {
    this.filter.reset();
    this.cursor.reset();
    this.lastFrameAt = 0;
  }

  /** Rebuilds the filter so smoothing can be tuned while tracking is running. */
  setSmoothing(smoothing) {
    this.options.smoothing = { ...this.options.smoothing, ...smoothing };
    this.filter = new PointFilter(this.options.smoothing);
    this.lastFrameAt = 0;
  }

  /** Mirrors the page's :hover rules. Called once the camera is live, by which
   *  point late-loading stylesheets have generally settled. */
  prepareHoverStyles() {
    this.hoverStyles?.build();
  }

  destroy() {
    this.touch.destroy();
    this.cursor.destroy();
    this.hoverStyles?.destroy();
  }
}
