/**
 * Turns cursor movement plus pinch state into page interaction.
 *
 * The model is a touch screen, per the spec: tap to activate, press and drag to
 * scroll the page or whatever element is under the cursor, with a fling on
 * release.
 */

const SCROLLABLE = /(auto|scroll|overlay)/;
const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

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

/** Nearest ancestor that can actually scroll, falling back to the document. */
function scrollTargetFor(el) {
  let node = el;
  while (node && node !== document.documentElement && node !== document.body) {
    if (node.nodeType === 1) {
      const style = getComputedStyle(node);
      const canY =
        SCROLLABLE.test(style.overflowY) && node.scrollHeight - node.clientHeight > 1;
      const canX =
        SCROLLABLE.test(style.overflowX) && node.scrollWidth - node.clientWidth > 1;
      if (canY || canX) return { node, canX, canY };
    }
    node = node.parentElement || node.getRootNode()?.host || null;
  }
  const doc = document.scrollingElement || document.documentElement;
  return {
    node: doc,
    canX: doc.scrollWidth - doc.clientWidth > 1,
    canY: doc.scrollHeight - doc.clientHeight > 1,
  };
}

function scrollBy({ node, canX, canY }, dx, dy) {
  const top = node.scrollTop - (canY ? dy : 0);
  const left = node.scrollLeft - (canX ? dx : 0);
  try {
    node.scrollTo({ top, left, behavior: 'instant' });
  } catch {
    node.scrollTop = top;
    node.scrollLeft = left;
  }
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

export class TouchEmulator {
  /**
   * @param {object} options    resolved config
   * @param {object} hooks
   * @param {ShadowRoot} hooks.shadowRoot  the trackpad's own root, so taps on
   *                                       its buttons are handled directly
   *                                       instead of being synthesized
   * @param {Function} [hooks.onTap]
   */
  constructor(options, { shadowRoot, onTap } = {}) {
    this.options = options;
    this.shadowRoot = shadowRoot;
    this.onTap = onTap;

    this.hovered = null;
    this.pressing = false;
    this.dragging = false;
    this.origin = null;
    this.last = null;
    this.velocity = { x: 0, y: 0 };
    this.scrollTarget = null;
    this.momentumFrame = null;
    this.internalHover = null;
  }

  /**
   * What is under the cursor, and whether that is the trackpad itself.
   *
   * `deepElementFromPoint` walks into our own shadow root too, so the check for
   * "internal" is simply whether the result lives inside it. Asking the shadow
   * root directly would not work: `ShadowRoot.elementFromPoint` retargets, and
   * happily hands back elements from the host page.
   */
  resolve(x, y) {
    const el = deepElementFromPoint(x, y);
    return { el, internal: Boolean(el && this.shadowRoot?.contains(el)) };
  }

  /** Keeps hover styles and pointer-position listeners on the page in sync. */
  move(x, y) {
    const { el, internal } = this.resolve(x, y);
    this.setInternalHover(internal ? el.closest?.('button') : null);

    if (internal || !el) {
      this.leaveHovered(x, y);
      return;
    }

    if (el !== this.hovered) {
      this.leaveHovered(x, y);
      this.hovered = el;
      firePointer(el, 'pointerover', x, y, { buttons: this.pressing ? 1 : 0 });
      fireMouse(el, 'mouseover', x, y, { buttons: this.pressing ? 1 : 0 });
      el.dispatchEvent(
        new MouseEvent('mouseenter', { ...eventInit(x, y), bubbles: false, cancelable: false }),
      );
    }

    firePointer(el, 'pointermove', x, y, { buttons: this.pressing ? 1 : 0 });
    fireMouse(el, 'mousemove', x, y, { buttons: this.pressing ? 1 : 0 });
  }

  /** CSS :hover never fires for a synthetic cursor, so fake it on our own buttons. */
  setInternalHover(button) {
    if (this.internalHover === button) return;
    this.internalHover?.classList.remove('hc-hover');
    button?.classList.add('hc-hover');
    this.internalHover = button || null;
  }

  leaveHovered(x, y) {
    const previous = this.hovered;
    if (!previous) return;
    this.hovered = null;
    firePointer(previous, 'pointerout', x, y, { buttons: 0 });
    fireMouse(previous, 'mouseout', x, y, { buttons: 0 });
    previous.dispatchEvent(
      new MouseEvent('mouseleave', { ...eventInit(x, y), bubbles: false, cancelable: false }),
    );
  }

  /** Pinch closed. */
  press(x, y, now) {
    this.stopMomentum();
    const { el, internal } = this.resolve(x, y);
    this.pressing = true;
    this.dragging = false;
    this.origin = { x, y, t: now, el, internal };
    this.last = { x, y, t: now };
    this.velocity = { x: 0, y: 0 };
    this.scrollTarget = internal || !el ? null : scrollTargetFor(el);
  }

  /** Cursor moved while the pinch is held. */
  drag(x, y) {
    if (!this.pressing) return;

    const dx = x - this.last.x;
    const dy = y - this.last.y;
    this.last = { x, y, t: this.last.t };

    // Exponential average keeps the fling velocity stable across jittery frames.
    this.velocity.x = this.velocity.x * 0.7 + dx * 0.3;
    this.velocity.y = this.velocity.y * 0.7 + dy * 0.3;

    if (!this.dragging) {
      const travel = Math.hypot(x - this.origin.x, y - this.origin.y);
      if (travel < this.options.drag.threshold) return;
      this.dragging = true;
      this.leaveHovered(x, y);
    }

    if (this.scrollTarget) scrollBy(this.scrollTarget, dx, dy);
  }

  /** Pinch released: either a tap or the end of a drag. */
  release(x, y, now) {
    if (!this.pressing) return;
    const origin = this.origin;
    this.pressing = false;
    this.origin = null;

    if (this.dragging) {
      this.dragging = false;
      this.startMomentum();
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
      // Our own controls: let the DOM do the work.
      const target = el.closest?.('button');
      if (target && !target.disabled) target.click();
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

  startMomentum() {
    const { friction, minVelocity, maxVelocity } = this.options.drag;
    const clamp = (v) => Math.max(-maxVelocity, Math.min(maxVelocity, v));
    let vx = clamp(this.velocity.x);
    let vy = clamp(this.velocity.y);
    const target = this.scrollTarget;
    if (!target || Math.hypot(vx, vy) < minVelocity) return;

    const step = () => {
      vx *= friction;
      vy *= friction;
      if (Math.hypot(vx, vy) < minVelocity) {
        this.momentumFrame = null;
        return;
      }
      scrollBy(target, vx, vy);
      this.momentumFrame = requestAnimationFrame(step);
    };
    this.momentumFrame = requestAnimationFrame(step);
  }

  stopMomentum() {
    if (this.momentumFrame !== null) {
      cancelAnimationFrame(this.momentumFrame);
      this.momentumFrame = null;
    }
  }

  /** The hand left the frame: drop everything without firing a tap. */
  cancel(x = 0, y = 0) {
    this.stopMomentum();
    this.pressing = false;
    this.dragging = false;
    this.origin = null;
    this.scrollTarget = null;
    this.setInternalHover(null);
    this.leaveHovered(x, y);
  }

  destroy() {
    this.cancel();
  }
}
