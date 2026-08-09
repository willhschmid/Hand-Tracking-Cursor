import { ScrollRunner, scrollTargetFor } from './scroll.js';

/**
 * Turns cursor movement plus pinch state into page interaction.
 *
 * The model is a touch screen, per the spec: tap to activate, press and drag to
 * scroll the page or whatever element is under the cursor, with a fling on
 * release.
 */

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

const SECOND = 1000;

/** Walks through open shadow roots to find the element actually under a point. */
export function deepElementFromPoint(x, y) {
  let el = document.elementFromPoint(x, y);
  while (el?.shadowRoot) {
    const inner = el.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === el) break;
    el = inner;
  }
  return el;
}

function eventInit(x, y, extra) {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: (window.screenX || 0) + x,
    screenY: (window.screenY || 0) + y,
    ...extra,
  };
}

const POINTER = { pointerId: 1, pointerType: 'touch', isPrimary: true, width: 1, height: 1 };

function firePointer(el, type, x, y, extra) {
  el.dispatchEvent(new PointerEvent(type, eventInit(x, y, { ...POINTER, ...extra })));
}

function fireMouse(el, type, x, y, extra) {
  el.dispatchEvent(new MouseEvent(type, eventInit(x, y, extra)));
}

/**
 * The trackpad's own chrome, which must never receive synthesized page events.
 * Two implementations exist: the script-tag build points it at its shadow root,
 * and the extension points it at the iframe the card lives in.
 *
 * @typedef {object} OwnUi
 * @property {(el: Element|null) => boolean} contains  is this element ours?
 * @property {(el: Element|null, x: number, y: number) => void} hover
 * @property {(el: Element|null, x: number, y: number) => void} tap
 */

export class TouchEmulator {
  /**
   * @param {object} options    resolved config
   * @param {object} hooks
   * @param {OwnUi} [hooks.ui]  the trackpad's own chrome
   * @param {Function} [hooks.onTap]
   */
  constructor(options, { ui, onTap, hover, debug } = {}) {
    this.options = options;
    this.ui = ui;
    this.onTap = onTap;
    this.hoverStyles = hover;

    this.hovered = null;
    this.pressing = false;
    this.dragging = false;
    this.origin = null;
    this.last = null;
    this.velocity = { x: 0, y: 0 };
    this.scrollTarget = null;
    this.scroller = new ScrollRunner(options, debug);
  }

  /**
   * What is under the cursor, and whether that is the trackpad itself.
   *
   * `deepElementFromPoint` walks into open shadow roots, including our own, so
   * the ownership question is just "does the UI claim this element". Asking a
   * shadow root directly would not work: `ShadowRoot.elementFromPoint`
   * retargets, and happily hands back elements from the host page.
   */
  resolve(x, y) {
    const el = deepElementFromPoint(x, y);
    return { el, internal: Boolean(this.ui?.contains(el)) };
  }

  /** Keeps hover styles and pointer-position listeners on the page in sync. */
  move(x, y) {
    const { el, internal } = this.resolve(x, y);
    this.ui?.hover(internal ? el : null, x, y);

    if (internal || !el) {
      this.leaveHovered(x, y);
      return;
    }

    if (el !== this.hovered) {
      this.leaveHovered(x, y);
      this.hovered = el;
      this.hoverStyles?.set(el);
      firePointer(el, 'pointerover', x, y, { buttons: this.pressing ? 1 : 0 });
      fireMouse(el, 'mouseover', x, y, { buttons: this.pressing ? 1 : 0 });
      el.dispatchEvent(
        new MouseEvent('mouseenter', { ...eventInit(x, y), bubbles: false, cancelable: false }),
      );
    }

    firePointer(el, 'pointermove', x, y, { buttons: this.pressing ? 1 : 0 });
    fireMouse(el, 'mousemove', x, y, { buttons: this.pressing ? 1 : 0 });
  }

  leaveHovered(x, y) {
    const previous = this.hovered;
    if (!previous) return;
    this.hovered = null;
    this.hoverStyles?.clear();
    firePointer(previous, 'pointerout', x, y, { buttons: 0 });
    fireMouse(previous, 'mouseout', x, y, { buttons: 0 });
    previous.dispatchEvent(
      new MouseEvent('mouseleave', { ...eventInit(x, y), bubbles: false, cancelable: false }),
    );
  }

  /** Pinch closed. */
  press(x, y, now) {
    this.scroller.stop();
    const { el, internal } = this.resolve(x, y);
    this.pressing = true;
    this.dragging = false;
    this.origin = { x, y, t: now, el, internal };
    this.last = { x, y, t: now };
    this.velocity = { x: 0, y: 0 };
    this.scrollTarget = internal || !el ? null : scrollTargetFor(el);
    this.scroller.setTarget(this.scrollTarget);
  }

  /** Cursor moved while the pinch is held. */
  drag(x, y, now) {
    if (!this.pressing) return;

    const dx = x - this.last.x;
    const dy = y - this.last.y;
    // Landmark frames are not evenly spaced, so velocity is measured against
    // real elapsed time rather than counted per frame. Otherwise a fling thrown
    // at 20fps would travel three times as far as the same gesture at 60fps.
    const dt = Math.max(now - this.last.t, 1) / SECOND;
    this.last = { x, y, t: now };

    // Exponential average keeps the fling velocity stable across jittery frames.
    this.velocity.x = this.velocity.x * 0.7 + (dx / dt) * 0.3;
    this.velocity.y = this.velocity.y * 0.7 + (dy / dt) * 0.3;

    if (!this.dragging) {
      const { threshold, holdDelay } = this.options.drag;
      // Closing the pinch moves the hand, so the first moments of every press
      // carry drift that has nothing to do with intent. Waiting that out is
      // what lets a deliberate tap stay a tap.
      if (now - this.origin.t < holdDelay) return;
      const travel = Math.hypot(x - this.origin.x, y - this.origin.y);
      if (travel < threshold) return;

      this.dragging = true;
      this.leaveHovered(x, y);
      // Fall through, so this frame scrolls by its own delta only. The distance
      // spent crossing the threshold is deliberately not applied — otherwise
      // the content would lurch by `threshold` px the instant a drag begins.
    }

    // Hand off to the display-rate runner rather than scrolling here: this
    // method is called at whatever rate the model manages, which is not the
    // rate the screen repaints.
    this.scroller.push(dx, dy);
  }

  /** Pinch released: either a tap or the end of a drag. */
  release(x, y, now) {
    if (!this.pressing) return;
    const origin = this.origin;
    this.pressing = false;
    this.origin = null;

    if (this.dragging) {
      this.dragging = false;
      // Fold in whatever the page has not caught up on yet, so the throw starts
      // from where the hand actually was.
      const pending = this.scroller.pending;
      this.scroller.fling(
        this.velocity.x + pending.x / SECOND,
        this.velocity.y + pending.y / SECOND,
      );
      return;
    }

    const travel = Math.hypot(x - origin.x, y - origin.y);
    const duration = now - origin.t;
    const { maxDuration, maxTravel } = this.options.tap;
    if (travel > maxTravel || duration > maxDuration) return;

    this.tap(origin.x, origin.y);
  }

  tap(x, y) {
    const { el, internal } = this.resolve(x, y);
    if (!el) return;

    if (internal) {
      this.ui.tap(el, x, y);
      this.onTap?.({ x, y, target: el, internal: true });
      return;
    }

    firePointer(el, 'pointerdown', x, y, { buttons: 1, button: 0 });
    fireMouse(el, 'mousedown', x, y, { buttons: 1, button: 0 });

    const focusTarget = el.closest?.(FOCUSABLE);
    if (focusTarget) {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        /* focus is best effort */
      }
    } else if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur?.();
    }

    firePointer(el, 'pointerup', x, y, { buttons: 0, button: 0 });
    fireMouse(el, 'mouseup', x, y, { buttons: 0, button: 0 });
    fireMouse(el, 'click', x, y, { buttons: 0, button: 0, detail: 1 });

    this.onTap?.({ x, y, target: el, internal: false });
  }


  /** The hand left the frame: drop everything without firing a tap. */
  cancel(x = 0, y = 0) {
    this.scroller.stop();
    this.pressing = false;
    this.dragging = false;
    this.origin = null;
    this.scrollTarget = null;
    this.ui?.hover(null, x, y);
    this.leaveHovered(x, y);
  }

  destroy() {
    this.cancel();
  }
}
