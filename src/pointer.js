import { eventInit, fireMouse, firePointer } from './events.js';
import { Grab, grabbableFrom } from './grab.js';
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
  constructor(options, { ui, onTap, onGrab, hover, debug } = {}) {
    this.options = options;
    this.ui = ui;
    this.onTap = onTap;
    this.onGrab = onGrab;
    this.hoverStyles = hover;

    this.hovered = null;
    this.pressing = false;
    this.dragging = false;
    this.origin = null;
    this.last = null;
    this.samples = [];
    this.scrollTarget = null;
    this.scrolled = false;
    // What the press landed on that could be picked up, and the drag of it once
    // one has started.
    this.grabTarget = null;
    this.grab = null;
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
    this.samples = [{ x, y, t: now }];

    const grab = this.options.grab;
    this.grabTarget = grab.enabled && el && !internal ? grabbableFrom(el, grab) : null;
    this.scrolled = false;

    // With no hold required the gesture is already a grab, so there is nothing
    // to scroll and nothing to wait for. Only the long-press mode has to keep
    // its options open, because there a quick drag is still a scroll.
    const immediate = Boolean(this.grabTarget) && grab.holdDelay === 0;
    this.scrollTarget = internal || !el || immediate ? null : scrollTargetFor(el);
    this.scroller.setTarget(this.scrollTarget);
    if (immediate) this.beginGrab(x, y, el);
  }

  /** True once the pinch has moved far enough, and been held long enough. */
  pastDragGate(x, y, now, threshold) {
    const { holdDelay, holdEscape } = this.options.drag;
    const travel = Math.hypot(x - this.origin.x, y - this.origin.y);
    // Closing the pinch moves the hand, so the first moments of every press
    // carry drift that has nothing to do with intent. Waiting that out is what
    // lets a deliberate tap stay a tap.
    //
    // A flick does not need waiting out, though: pinch drift is small and slow,
    // so travelling `holdEscape` this early is already unambiguous. Making a
    // fast gesture sit through the delay is what reads as the page starting
    // late.
    if (travel < holdEscape && now - this.origin.t < holdDelay) return false;
    return travel >= threshold;
  }

  /** Cursor moved while the pinch is held. */
  drag(x, y, now) {
    if (!this.pressing) return;

    const dx = x - this.last.x;
    const dy = y - this.last.y;
    this.last = { x, y, t: now };
    this.samples.push({ x, y, t: now });
    // Two windows' worth is plenty of history; the rest is only ever discarded.
    const keep = this.options.drag.velocityWindow * 2;
    while (this.samples.length > 2 && now - this.samples[0].t > keep) this.samples.shift();

    // Already holding something: it follows the hand from the first pixel,
    // with no threshold in the way. The gate below still runs, but only to
    // decide whether this ends as a click and when the HTML5 drag opens.
    if (this.grab) {
      // A held element gets more room than a scroll before the gesture is
      // called a drag. It is already following the hand, so the extra travel
      // costs nothing to look at — and it all comes back as room to click
      // something that can be dragged as well as pressed.
      if (!this.dragging && this.pastDragGate(x, y, now, this.options.grab.threshold)) {
        this.dragging = true;
        // Hover deliberately stays. The cursor has not left the element — it is
        // carrying it — and a mouse keeps `:hover` on what it drags. Dropping
        // it here fires mouseleave and strips the mirrored hover styles from
        // the element and its ancestors, so a card with any hover state at all
        // snaps out of it partway through the gesture: a flash, arriving a
        // beat after the pinch, which is the whole complaint about waiting for
        // the drag to be recognised.
        this.grab.start(x, y);
      }
      this.dragElement(x, y);
      return;
    }

    if (!this.dragging) {
      if (!this.pastDragGate(x, y, now, this.options.drag.threshold)) return;
      this.dragging = true;
      this.leaveHovered(x, y);
      // Fall through, so this frame scrolls by its own delta only. The distance
      // spent crossing the threshold is deliberately not applied — otherwise
      // the content would lurch by `threshold` px the instant a drag begins.
    }

    // A gesture is either carrying an element or scrolling, never both, and
    // whichever starts first keeps the gesture. Only the long-press mode gets
    // here with a grab target: without one, the grab opened on press.
    if (this.grabTarget && !this.scrolled) {
      if (now - this.origin.t >= this.options.grab.holdDelay) {
        this.beginGrab(x, y, this.resolve(x, y).el);
        this.grab.start(x, y);
        this.dragElement(x, y);
        return;
      }
      // Still inside the hold. Fall through and scroll; once that has started
      // the gesture is a scroll for good.
    }

    // Hand off to the display-rate runner rather than scrolling here: this
    // method is called at whatever rate the model manages, which is not the
    // rate the screen repaints. `now` goes with it, so the runner times the
    // path by when the hand was seen rather than when this happened to run.
    this.scrolled = true;
    this.scroller.push(dx, dy, now);
  }

  /** Takes hold of the element under the cursor. */
  beginGrab(x, y, el) {
    // The scroll runner may have been handed a target and suppressed the page's
    // smooth scrolling with it. Nothing is going to scroll now, so it has to be
    // told, or that override stays on the page.
    this.scroller.stop();
    this.scrollTarget = null;
    this.grab = new Grab(this.grabTarget, el, x, y, this.options.grab.html5);
    this.onGrab?.({ type: 'start', target: this.grab.node, x, y });
  }

  /** Carries the held element along with the hand. */
  dragElement(x, y) {
    const { el, internal } = this.resolve(x, y);
    this.grab.move(x, y, internal ? null : el);
  }

  /**
   * How fast the hand was travelling as it let go, in CSS px per second.
   *
   * Measured across a window rather than from the last pair of frames. A pinch
   * does not open instantly, so release is detected a frame or two after the
   * fingers start parting, and by then the hand is often slowing down or
   * already still. Reading the instantaneous speed at that moment throws away
   * most of the gesture: you push, and the page barely coasts.
   *
   * A window that has genuinely stopped moving still reports zero, so drag,
   * hold, release stops the page dead — which is what holding means.
   */
  releaseVelocity() {
    const last = this.samples.at(-1);
    if (!last) return { x: 0, y: 0 };
    const cutoff = last.t - this.options.drag.velocityWindow;
    // The sample straddling the cutoff is kept, so a slow tracker whose frames
    // are wider than the window still has two points to measure between.
    let i = this.samples.length - 1;
    while (i > 0 && this.samples[i - 1].t >= cutoff) i -= 1;
    const first = this.samples[Math.max(i - 1, 0)];
    const dt = (last.t - first.t) / SECOND;
    if (dt <= 0) return { x: 0, y: 0 };
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  }

  /** Pinch released: either a tap or the end of a drag. */
  release(x, y, now) {
    if (!this.pressing) return;
    const origin = this.origin;
    this.pressing = false;
    this.origin = null;

    if (this.grab) {
      const grab = this.grab;
      const wasDrag = this.dragging;
      this.grab = null;
      this.grabTarget = null;
      this.dragging = false;
      const { el, internal } = this.resolve(x, y);
      const dropped = grab.end(x, y, internal ? null : el);
      // A press that never became a drag is a click, exactly as it is with a
      // mouse. The pointerdown that opened the grab already stands in for the
      // one a tap would have fired, so only the click itself is left.
      // No travel or duration limit, unlike a tap. A browser has none either:
      // press and release on the same element and the click fires however far
      // the pointer wandered in between. The limits exist to stop a *scroll*
      // ending in a click, and nothing here is scrolling — so the only question
      // left is whether this became a drag.
      if (!wasDrag && grab.clicks(internal ? null : el)) {
        this.click(grab.pressed, origin.x, origin.y);
      }
      this.onGrab?.({ type: 'end', target: grab.node, dropped, x, y });
      return;
    }
    this.grabTarget = null;

    if (this.dragging) {
      this.dragging = false;
      // Hand speed only. The runner folds in whatever distance the page has not
      // caught up on yet, since it is the one that knows the decay rate.
      const velocity = this.releaseVelocity();
      this.scroller.fling(velocity.x, velocity.y);
      return;
    }

    if (!this.isTap(origin, x, y, now)) return;
    this.tap(origin.x, origin.y);
  }

  /** Short enough and still enough to have meant a click rather than a drag. */
  isTap(origin, x, y, now) {
    const { maxDuration, maxTravel } = this.options.tap;
    return (
      Math.hypot(x - origin.x, y - origin.y) <= maxTravel && now - origin.t <= maxDuration
    );
  }

  /** Moves focus and fires the click, the tail end of every tap. */
  click(el, x, y) {
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
    fireMouse(el, 'click', x, y, { buttons: 0, button: 0, detail: 1 });
    this.onTap?.({ x, y, target: el, internal: false });
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
    firePointer(el, 'pointerup', x, y, { buttons: 0, button: 0 });
    fireMouse(el, 'mouseup', x, y, { buttons: 0, button: 0 });
    this.click(el, x, y);
  }


  /** The hand left the frame: drop everything without firing a tap. */
  cancel(x = 0, y = 0) {
    this.scroller.stop();
    if (this.grab) {
      this.grab.cancel(x, y);
      this.onGrab?.({ type: 'end', target: this.grab.node, dropped: false, x, y });
      this.grab = null;
    }
    this.grabTarget = null;
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
