/**
 * Scroll application, decoupled from the hand-tracking frame rate.
 *
 * Landmarks arrive as fast as the model can produce them, which on a phone can
 * be 15-20fps against a 60Hz display. Applying each frame's delta the moment it
 * arrives makes the page advance in one large step and then sit still for two
 * or three repaints — measurably a 25px jump followed by two dead frames, which
 * reads as skipping rather than scrolling.
 *
 * So the tracker only ever records where the hand has been, timestamped. This
 * runner owns a requestAnimationFrame loop at display rate, and draws the hand's
 * path from a point slightly in the past — reading between the two landmarks
 * either side of it rather than guessing at the ones it does not have.
 *
 * That distinction is the whole point. Closing a fraction of the remaining
 * distance each frame, which is the obvious way to fill the gap, is smooth in
 * position but ragged in speed: every landmark lands as a burst that decays over
 * the next few repaints. Speed is what the eye reads as jumpiness. Interpolating
 * turns a hand moving at a constant speed into a page moving at a constant
 * speed, exactly, whatever rate the tracker manages. It costs one landmark
 * interval of lag.
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

/**
 * Rounds to the device's pixel grid rather than the CSS one.
 *
 * iOS snaps scroll offsets to physical pixels, so handing it a continuously
 * varying fraction makes that snapping visible. Rounding to whole CSS pixels
 * avoids it but overshoots: on a 3x phone it throws away two thirds of the
 * precision the screen actually has, which quantizes a slow scroll into steps
 * three times bigger than they need to be.
 */
function snap(value) {
  const dpr = window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}

/** Moves a scroll container by a delta expressed as cursor movement. */
function applyScroll({ node, canX, canY }, dx, dy) {
  const top = snap(node.scrollTop - (canY ? dy : 0));
  const left = snap(node.scrollLeft - (canX ? dx : 0));
  try {
    node.scrollTo({ top, left, behavior: 'instant' });
  } catch {
    node.scrollTop = top;
    node.scrollLeft = left;
  }
}

/**
 * Time constant of the fling decay. `friction` is written as a per-60fps-frame
 * figure because that is how it reads, so the equivalent continuous decay time
 * falls out of it.
 */
function decayTau(friction) {
  return -1 / (60 * Math.log(friction));
}

/**
 * How far a throw should coast, from the speed it left the hand at.
 *
 * An exponential decay from v0 travels exactly v0 * tau in total, which is what
 * keeps a browser-animated throw covering the same ground as one animated frame
 * by frame.
 */
function throwDistance(velocity, friction, scale) {
  return velocity * decayTau(friction) * scale;
}

/**
 * How much of a frame's own elapsed time the render head may spend correcting
 * its position in the hand's path. 5% is far too little to see and still
 * converges within a second.
 */
const HEAD_DRIFT = 0.05;

export class ScrollRunner {
  constructor(options, debug) {
    this.options = options;
    this.debug = debug;
    this.target = null;
    // Where the hand has asked the page to be, and where it has actually got
    // to, both as a running total since the drag began. Their difference is
    // what the page still owes.
    this.askedX = 0;
    this.askedY = 0;
    this.appliedX = 0;
    this.appliedY = 0;
    // The last second or so of the hand's path, timestamped, which is what the
    // resampler reads between.
    this.path = [];
    // Smoothed gap between landmark frames, in ms, and the point in the path
    // currently being drawn — a clock of its own, trailing real time.
    this.interval = 0;
    this.head = 0;
    // True while the hand is still feeding the path, which is the only time it
    // makes sense to guess at where the next landmark will be.
    this.live = false;
    // Fling velocity, in CSS px per second so it does not depend on how fast
    // either the tracker or the display happens to be running.
    this.velocityX = 0;
    this.velocityY = 0;
    this.flinging = false;
    this.frame = null;
    this.lastFrameAt = 0;
    this.restoreBehavior = null;
    this.lastRetargetAt = 0;
    this.tick = this.tick.bind(this);
  }

  /** Throws away the hand's path and everything measured from it. */
  resetPath() {
    this.askedX = 0;
    this.askedY = 0;
    this.appliedX = 0;
    this.appliedY = 0;
    this.path = [];
    this.interval = 0;
    this.head = 0;
    this.live = false;
  }

  setTarget(target) {
    if (target !== this.target) {
      this.resetPath();
      this.releaseBehavior();
    }
    this.target = target;
    if (!target) return;

    this.debug?.recordTarget(target.node, usesSmoothScroll(target.node));
    this.debug?.beginTrace(target.node);
    this.lastRetargetAt = 0;
    // `native` mode wants the browser's smooth scrolling, so it must not be
    // suppressed there.
    if (this.options.drag.mode === 'write' || this.options.drag.mode === 'hybrid') {
      if (!this.restoreBehavior) this.restoreBehavior = suppressSmoothScroll(target.node);
    }
  }

  releaseBehavior() {
    this.restoreBehavior?.();
    this.restoreBehavior = null;
  }

  /**
   * The hand moved. Records where it now wants the page.
   *
   * `native` hands the distance straight to the browser; `write` and `hybrid`
   * both track the hand themselves, because during a drag latency is far more
   * noticeable than anything else — the page should sit under the hand, not
   * arrive after it.
   *
   * `now` is the timestamp the hand was *sampled* at, not the moment this runs.
   * They are not the same: between the two sits a MediaPipe inference, which
   * takes tens of milliseconds on a phone and a different number of them every
   * frame. Timing the path by arrival would stamp that variation onto a
   * distance that was measured without it, and report a hand moving at a
   * constant speed as one lurching between speeds.
   */
  push(dx, dy, now) {
    if (!this.target) return;
    this.flinging = false;
    this.live = true;

    const previous = this.path.at(-1);
    if (previous) {
      const gap = now - previous.t;
      // A first frame, or a stall while something else hogged the thread,
      // describes neither the tracker's cadence nor anything worth smoothing
      // towards, so it is left out of the average.
      if (gap >= 8 && gap <= 250) {
        this.interval = this.interval ? this.interval * 0.7 + gap * 0.3 : gap;
      }
    }

    if (this.path.length === 0) {
      // A drag's first landmark arrives with nothing behind it to read between,
      // so without an anchor its whole delta lands in a single frame — a lurch,
      // followed by dead frames until the path fills. The anchor is dated one
      // assumed gap in the past, deliberately a long one: guessing the hand
      // slower than it really is makes the drag ease in and then catch up,
      // where guessing it faster makes it start with a jump.
      const assumed = this.options.drag.resampleMax;
      this.path.push({ t: now - assumed, x: this.askedX, y: this.askedY });
    }

    this.askedX += dx;
    this.askedY += dy;
    this.path.push({ t: now, x: this.askedX, y: this.askedY });
    // One second of history is far more than the delay ever reads back.
    while (this.path.length > 2 && now - this.path[0].t > 1000) this.path.shift();

    if (this.options.drag.mode === 'native') this.retarget();
    else this.start();
  }

  /**
   * How far behind the hand the page is rendered, in ms.
   *
   * Deliberately a little longer than one landmark interval. Reading between
   * two samples needs a sample on each side, so the render point has to sit
   * behind the newest one — and inference time varies enough frame to frame
   * that aiming at exactly one interval would keep running off the end.
   */
  delay() {
    const { resample, resampleMin, resampleMax } = this.options.drag;
    // Before a cadence has been measured, assume the slowest one rather than a
    // typical one: too short a delay runs off the end of the path immediately,
    // which is the stutter this exists to avoid.
    if (!this.interval) return resampleMax;
    return Math.max(resampleMin, Math.min(resampleMax, this.interval * resample));
  }

  /**
   * Where the hand had asked the page to be at time `t`, read between the two
   * landmarks either side of it.
   *
   * This is the whole trick. Landmarks arrive at 15-25fps against a 60Hz
   * display, so most repaints have no new information — and closing a fraction
   * of the remaining distance each time, which is the obvious way to fill the
   * gap, makes the page lunge when a landmark lands and coast between them.
   * That is smooth in position but ragged in speed, and speed is what the eye
   * reads as jumpiness.
   *
   * Interpolating instead means a hand moving at a constant speed produces a
   * page moving at a constant speed, exactly, whatever the tracker is doing.
   */
  /**
   * Moves the render head on by one frame and says where it now is.
   *
   * The head trails real time by `delay()`, but it must not be *computed* from
   * it every frame. That delay comes from a running average of the gap between
   * landmarks, so it shifts by a few milliseconds whenever the tracker's
   * cadence does — and subtracting a moving number from a steady clock drags
   * the whole path back and forth underneath the head. Measured on an
   * otherwise perfectly even scroll, that alone turned steady 7.8px steps into
   * a stream swinging between 6.2 and 12.3.
   *
   * So the head keeps its own clock, advanced by exactly the time the frame
   * took, and is only nudged toward where it ideally belongs by a few percent
   * of a frame at a time.
   */
  advanceHead(now, elapsed) {
    const ideal = now - this.delay();
    if (!this.head) {
      this.head = ideal;
      return this.head;
    }
    this.head += elapsed;
    const limit = elapsed * HEAD_DRIFT;
    const drift = ideal - this.head;
    this.head += Math.max(-limit, Math.min(limit, drift));
    return this.head;
  }

  positionAt(t) {
    const path = this.path;
    if (path.length === 0) return { x: this.appliedX, y: this.appliedY };
    const first = path[0];
    if (t <= first.t) return { x: first.x, y: first.y };
    const last = path.at(-1);
    if (t >= last.t) {
      const previous = path.at(-2);
      const span = previous ? last.t - previous.t : 0;
      // Off the end of the path, which happens whenever a landmark takes longer
      // than usual. Holding still until the next one arrives is what produces a
      // dead frame and then a catch-up jump — the exact stutter this is all
      // meant to remove — so carry on at the speed the hand was last going.
      // Capped, so a tracker that has actually died coasts to a stop instead of
      // running away, and corrected the moment a real landmark lands.
      if (!this.live || !previous || span <= 0) return { x: last.x, y: last.y };
      const over = Math.min(t - last.t, this.options.drag.resampleMax) / span;
      return {
        x: last.x + (last.x - previous.x) * over,
        y: last.y + (last.y - previous.y) * over,
      };
    }

    let i = path.length - 1;
    while (i > 0 && path[i - 1].t > t) i -= 1;
    const a = path[i - 1];
    const b = path[i];
    const span = b.t - a.t;
    const f = span > 0 ? (t - a.t) / span : 1;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  /**
   * The `native` strategy: hand the whole remaining distance to the browser as
   * one smooth scroll and let it animate, rather than writing a position every
   * frame.
   *
   * On iOS the scroll position lives on a separate thread from JavaScript, and
   * per-frame writes have to be synchronised across to it. A browser-run
   * animation happens on that side of the fence instead, which is the same
   * reason the cursor — a composited transform — stays smooth when the page
   * does not. The cost is latency: the page trails the hand by about the
   * retarget interval.
   */
  retarget(force = false, behavior = 'smooth') {
    const now = performance.now();
    const { retargetMs } = this.options.drag;
    if (!force && now - this.lastRetargetAt < retargetMs) return true;
    this.lastRetargetAt = now;

    const { node, canX, canY } = this.target;
    const top = snap(node.scrollTop - (canY ? this.remainingY : 0));
    const left = snap(node.scrollLeft - (canX ? this.remainingX : 0));
    try {
      node.scrollTo({ top, left, behavior });
    } catch {
      // Reported so the caller can coast frame by frame instead. Writing the
      // position here would teleport straight to the end of the throw.
      return false;
    }
    this.appliedX = this.askedX;
    this.appliedY = this.askedY;
    this.debug?.recordScroll(0);
    return true;
  }

  /**
   * Pinch released while moving: carry on under momentum.
   *
   * `velocity` is the hand's speed at the moment of release, in CSS px per
   * second, so the throw is proportional to how hard the gesture was pushed.
   */
  fling(velocityX, velocityY) {
    const { minVelocity, maxVelocity, mode, friction, flingScale } = this.options.drag;
    const clamp = (v) => Math.max(-maxVelocity, Math.min(maxVelocity, v));
    const vx = clamp(velocityX);
    const vy = clamp(velocityY);
    const slow = Math.hypot(vx, vy) < minVelocity;
    // No more landmarks are coming, so stop guessing past the end of the path.
    this.live = false;

    // `native` and `hybrid` let the browser animate the throw. The browser runs
    // that animation wherever it runs its own scrolling, which on iOS is not
    // the thread this code is on — the same reason a composited transform stays
    // smooth when per-frame writes do not.
    if (mode === 'native' || mode === 'hybrid') {
      if (!slow) {
        this.askedX += throwDistance(vx, friction, flingScale);
        this.askedY += throwDistance(vy, friction, flingScale);
      }
      // The behaviour override is for the direct writes during a drag; the
      // throw wants the browser's animation, so lift it first.
      this.releaseBehavior();
      if (this.retarget(true, 'smooth')) {
        // The browser owns the scroll position from here. `hybrid` drove the
        // drag itself, so its frame loop is still running and still holding the
        // hand's path — left alone it would spend the next frames dragging the
        // page back onto where the resampler had got to.
        this.stop();
        return;
      }
      // The browser refused to animate. Coast it frame by frame rather than
      // teleporting to the far end of the throw.
    }

    // Too gentle to throw. Leave the remaining distance alone so the runner can
    // finish delivering it, rather than snapping the page to a stop.
    if (slow) return;

    // The frame loop stops reading the hand's path once it is flinging, so the
    // distance the page had not caught up on yet has to be rolled into the
    // throw or it is simply lost. Dividing by tau turns a distance back into
    // the velocity that would cover it.
    const tau = decayTau(friction);
    this.velocityX = vx + this.remainingX / tau;
    this.velocityY = vy + this.remainingY / tau;
    this.appliedX = this.askedX;
    this.appliedY = this.askedY;
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
    this.resetPath();
    this.velocityX = 0;
    this.velocityY = 0;
    this.releaseBehavior();
  }

  tick(now) {
    this.frame = null;
    if (!this.target) return;

    // First frame has no interval to measure; a tab returning from the
    // background can report a huge one. Both would jolt the page.
    const elapsed = this.lastFrameAt ? Math.min(now - this.lastFrameAt, 50) : 1000 / 60;
    const dt = elapsed / 1000;
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
    } else if (this.options.drag.follow >= 1) {
      // Smoothing off: every landmark is applied the instant it lands, which is
      // what a tracker running at display rate wants and what a slower one
      // visibly stutters on.
      dx = this.remainingX;
      dy = this.remainingY;
      this.appliedX = this.askedX;
      this.appliedY = this.askedY;
    } else {
      // Read the hand's path a fixed distance in the past, so the page moves at
      // whatever speed the hand was moving then rather than in bursts as
      // landmarks land.
      const at = this.positionAt(this.advanceHead(now, elapsed));
      dx = at.x - this.appliedX;
      dy = at.y - this.appliedY;
      this.appliedX = at.x;
      this.appliedY = at.y;
    }

    if (dx || dy) {
      applyScroll(this.target, dx, dy);
      this.debug?.recordScroll(dy || dx);
    }

    // The resampler is still delivering for `delay` ms after the last landmark,
    // so "nothing left to apply" is the only thing that means finished.
    const settled =
      Math.abs(this.remainingX) < 0.001 && Math.abs(this.remainingY) < 0.001;
    if (!this.flinging && settled) {
      this.releaseBehavior();
      this.debug?.endTrace();
    } else this.frame = requestAnimationFrame(this.tick);
  }

  /** Distance the page still owes, so a release can fold it into the fling. */
  get remainingX() {
    return this.askedX - this.appliedX;
  }

  get remainingY() {
    return this.askedY - this.appliedY;
  }
}
