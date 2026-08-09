/**
 * Scroll application, decoupled from the hand-tracking frame rate.
 *
 * Landmarks arrive as fast as the model can produce them, which on a phone can
 * be 15-20fps against a 60Hz display. Applying each frame's delta the moment it
 * arrives makes the page advance in one large step and then sit still for two
 * or three repaints — measurably a 25px jump followed by two dead frames, which
 * reads as skipping rather than scrolling.
 *
 * So the tracker only ever states where the page *should* be. This runner owns
 * a requestAnimationFrame loop at display rate and eases toward that, which
 * turns one big step into several small ones and costs about 50ms of lag.
 *
 * The same loop runs the release fling, so the two never fight for the
 * scroll position.
 */

const SCROLLABLE = /(auto|scroll|overlay)/;

/** Nearest ancestor that can actually scroll, falling back to the document. */
export function scrollTargetFor(el) {
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

/**
 * Suppresses CSS `scroll-behavior: smooth` on the element we are about to drive.
 *
 * This is the difference between scrolling and lurching. A page with
 * `scroll-behavior: smooth` set in its stylesheet turns *every* programmatic
 * scroll into an animation. Driving one of those sixty times a second means
 * sixty animations, each interrupting the one before it, and the page skips
 * instead of moving.
 *
 * Passing `behavior: 'instant'` is supposed to opt out, but support is uneven —
 * Safari in particular — and the `scrollTop` fallback below honours the CSS
 * unconditionally. An inline style outranks the stylesheet everywhere, so this
 * works regardless. It is put back when the gesture ends, leaving the page's own
 * smooth anchor scrolling alone.
 */
function suppressSmoothScroll(node) {
  const target = node === document.scrollingElement ? document.documentElement : node;
  const previous = target.style.scrollBehavior;
  target.style.setProperty('scroll-behavior', 'auto', 'important');
  return () => {
    // Priority passed explicitly, so the `important` flag set above is cleared
    // rather than inherited by the restored value.
    if (previous) target.style.setProperty('scroll-behavior', previous, '');
    else target.style.removeProperty('scroll-behavior');
  };
}

/** True when the page asked for smooth scrolling, for the diagnostics panel. */
export function usesSmoothScroll(node) {
  const target = node === document.scrollingElement ? document.documentElement : node;
  return getComputedStyle(target).scrollBehavior === 'smooth';
}

/** Moves a scroll container by a delta expressed as cursor movement. */
function applyScroll({ node, canX, canY }, dx, dy) {
  // Rounded to whole pixels: iOS snaps scroll offsets to the device grid, and
  // feeding it a continuously varying fraction makes that snapping visible.
  const top = Math.round(node.scrollTop - (canY ? dy : 0));
  const left = Math.round(node.scrollLeft - (canX ? dx : 0));
  try {
    node.scrollTo({ top, left, behavior: 'instant' });
  } catch {
    node.scrollTop = top;
    node.scrollLeft = left;
  }
}

export class ScrollRunner {
  constructor(options, debug) {
    this.options = options;
    this.debug = debug;
    this.target = null;
    // Distance the hand has asked for but the page has not travelled yet.
    this.pendingX = 0;
    this.pendingY = 0;
    // Fling velocity, in CSS px per second so it does not depend on how fast
    // either the tracker or the display happens to be running.
    this.velocityX = 0;
    this.velocityY = 0;
    this.flinging = false;
    this.frame = null;
    this.lastFrameAt = 0;
    this.restoreBehavior = null;
    this.tick = this.tick.bind(this);
  }

  setTarget(target) {
    if (target !== this.target) {
      this.pendingX = 0;
      this.pendingY = 0;
      this.releaseBehavior();
    }
    this.target = target;
    if (target && !this.restoreBehavior) {
      this.restoreBehavior = suppressSmoothScroll(target.node);
      this.debug?.recordTarget(target.node, usesSmoothScroll(target.node));
    }
  }

  releaseBehavior() {
    this.restoreBehavior?.();
    this.restoreBehavior = null;
  }

  /** The hand moved. Adds to what the page still owes. */
  push(dx, dy) {
    if (!this.target) return;
    this.flinging = false;
    this.pendingX += dx;
    this.pendingY += dy;
    this.start();
  }

  /** Pinch released while moving: carry on under momentum. */
  fling(velocityX, velocityY) {
    const { minVelocity, maxVelocity } = this.options.drag;
    const clamp = (v) => Math.max(-maxVelocity, Math.min(maxVelocity, v));
    // Whatever the hand asked for and did not get yet is folded into the throw,
    // so nothing is silently dropped at the moment of release.
    this.velocityX = clamp(velocityX);
    this.velocityY = clamp(velocityY);
    if (Math.hypot(this.velocityX, this.velocityY) < minVelocity) return;
    this.flinging = true;
    this.start();
  }

  start() {
    if (this.frame !== null) return;
    this.lastFrameAt = 0;
    this.frame = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.flinging = false;
    this.pendingX = 0;
    this.pendingY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.releaseBehavior();
  }

  tick(now) {
    this.frame = null;
    if (!this.target) return;

    // First frame has no interval to measure; a tab returning from the
    // background can report a huge one. Both would jolt the page.
    const dt = this.lastFrameAt ? Math.min((now - this.lastFrameAt) / 1000, 1 / 20) : 1 / 60;
    this.lastFrameAt = now;

    let dx = 0;
    let dy = 0;

    if (this.flinging) {
      const { friction, minVelocity } = this.options.drag;
      // `friction` is written as a per-frame figure at 60fps because that is how
      // it reads, but it is applied over real time so the throw decays the same
      // on a 120Hz display as on a 30Hz one.
      const decay = friction ** (dt * 60);
      this.velocityX *= decay;
      this.velocityY *= decay;
      dx = this.velocityX * dt;
      dy = this.velocityY * dt;
      if (Math.hypot(this.velocityX, this.velocityY) < minVelocity) {
        this.flinging = false;
      }
    } else {
      // Close a fraction of the remaining distance, framerate-independently.
      const follow = this.options.drag.follow;
      const k = follow >= 1 ? 1 : 1 - (1 - follow) ** (dt * 60);
      dx = this.pendingX * k;
      dy = this.pendingY * k;
      this.pendingX -= dx;
      this.pendingY -= dy;
      if (Math.abs(this.pendingX) < 0.01) this.pendingX = 0;
      if (Math.abs(this.pendingY) < 0.01) this.pendingY = 0;
    }

    if (dx || dy) {
      applyScroll(this.target, dx, dy);
      this.debug?.recordScroll(dy || dx);
    }

    const idle =
      !this.flinging && this.pendingX === 0 && this.pendingY === 0;
    if (idle) this.releaseBehavior();
    else this.frame = requestAnimationFrame(this.tick);
  }

  /** Distance the page still owes, so a release can fold it into the fling. */
  get pending() {
    return { x: this.pendingX, y: this.pendingY };
  }
}
