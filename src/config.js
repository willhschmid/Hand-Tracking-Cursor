/** Default options. Every value is overridable through `HandCursor.init(options)`. */
export const DEFAULTS = {
  /** Where the trackpad sits: bottom-left (spec), bottom-right, top-left, top-right. */
  position: 'bottom-left',
  /** Distance from the viewport edges, in px. */
  margin: 16,
  /** Ask for the camera as soon as the script loads. Usually blocked without a gesture. */
  autoStart: false,
  /** Start in the 106x106 minimized card. */
  minimized: false,
  /** Desaturate the preview, as drawn in the design system. */
  grayscale: true,
  /** Inject the Inter webfont if the page does not already ship it. */
  font: true,
  /** Hide the OS cursor while a hand is being tracked. */
  hideNativeCursor: false,
  /** Mirror the page's CSS :hover rules so they respond to the hand cursor. */
  emulateHover: true,
  /** Stacking order of the overlay root. */
  zIndex: 2147483000,
  /** Hands to track. Only the first one drives the cursor. */
  numHands: 1,
  /**
   * Show the on-screen diagnostics panel. Also enabled by putting
   * `handcursor-debug` anywhere in the page URL, which is the only practical
   * way to read these numbers on a phone.
   */
  debug: false,
  /**
   * Cap on how often the model runs, in frames per second. 0 leaves it at the
   * camera's rate. Inference is synchronous on the main thread, so on a slow
   * device it can starve requestAnimationFrame — and then nothing else can run
   * smoothly either. Capping it trades tracking responsiveness for a main
   * thread that has room to paint.
   */
  maxTrackingFps: 0,

  /** Camera constraints handed to getUserMedia. */
  camera: { width: 640, height: 480, frameRate: 30 },

  /**
   * The slice of the camera frame that maps onto the viewport. 0.15 means the
   * outer 15% on each edge is dead space, so the corners stay reachable without
   * the hand leaving frame.
   */
  region: { x: 0.15, y: 0.15 },

  /** 1€ filter — low lag when moving fast, low jitter when holding still. */
  smoothing: { minCutoff: 1.4, beta: 0.015, dCutoff: 1.0 },

  /**
   * Pinch distance (thumb tip to index tip) as a fraction of hand size, with
   * hysteresis so a hovering hand does not chatter between states.
   *
   * Fractions, not millimetres, so the gesture works at any distance from the
   * camera. For scale: the landmarks sit at the centre of each fingertip, so
   * even with the pads pressed together the ratio bottoms out near 0.15 rather
   * than 0 — there is not much room below this before pinching stops
   * registering at all. `handcursor:move` reports the live ratio if you want to
   * measure your own hand and pick a number.
   */
  pinch: { on: 0.22, off: 0.32 },

  /**
   * A press shorter and tighter than this counts as a tap. Both numbers are
   * generous compared to a touchscreen: a pinch held in mid-air always drifts a
   * little, and the gesture itself takes longer than a finger on glass.
   */
  tap: { maxDuration: 800, maxTravel: 32 },

  /**
   * Press-and-drag scrolling, with a touch-style fling on release.
   *
   * `threshold` and `holdDelay` are what keep a tap from turning into a scroll:
   * the pinch has to travel a real distance *and* be held past the moment of
   * pinching before anything scrolls.
   */
  drag: {
    threshold: 34,
    holdDelay: 140,
    /**
     * Travel that skips `holdDelay` outright. Pinch drift is small and slow, so
     * a hand that has already covered this much cannot be settling into a tap —
     * and a flick that has to sit out the delay first is exactly what makes the
     * page feel like it starts after the gesture instead of with it.
     */
    holdEscape: 70,
    /**
     * How the scroll is actually applied.
     *
     *   'write'  — set the scroll position every animation frame, throw
     *              included. Direct, but the writes can stutter on iOS.
     *   'native' — hand everything to the browser as smooth scrolls. Smooth,
     *              but the page arrives after the hand rather than under it:
     *              the wait is the retarget interval plus the browser's own
     *              easing, and the easing is not ours to shorten.
     *   'hybrid' — track the hand directly during the drag, then hand the
     *              throw to the browser. Latency matters during a drag and
     *              smoothness matters during a throw, and this is the
     *              combination that gets both.
     */
    mode: 'write',
    /** How often `native` mode re-aims at the hand, in ms. */
    retargetMs: 70,
    /** Multiplies how far a throw coasts. 1 matches the frame-by-frame decay. */
    flingScale: 1,
    /**
     * Set to 1 to apply every landmark the instant it lands, turning the
     * resampling below off. Only sensible when the tracker is keeping up with
     * the display; below that it stutters, which is what the resampler exists
     * to fix.
     */
    follow: 0.22,
    /**
     * How far behind the hand the page is drawn, as a multiple of the measured
     * gap between landmarks, clamped to the millisecond bounds below.
     *
     * Landmarks arrive at 15-25fps against a 60Hz display, so most repaints
     * have no new information. Rather than guess at one, the runner draws the
     * hand's path slightly in the past and reads between the two samples either
     * side — which turns a hand moving at a constant speed into a page moving
     * at a constant speed, whatever the tracker is doing.
     *
     * It has to be more than 1: reading between two samples needs one on each
     * side, and inference time varies enough that aiming at exactly one
     * interval keeps running off the end of the path. Raise it if the page
     * still ripples, lower it for less lag.
     */
    resample: 1.35,
    resampleMin: 24,
    resampleMax: 90,
    /**
     * How far back a release looks to work out how fast the hand was going, in
     * ms. Wide enough to survive the frame or two it takes for a pinch to read
     * as open, narrow enough that stopping still means stopping.
     */
    velocityWindow: 120,
    /**
     * Fling decay, written per 60fps frame but applied over real time.
     *
     * A throw travels its release speed multiplied by the decay's time
     * constant, which this works out to about half a second — near enough to
     * UIScrollView's own deceleration that a flick carries as far as the
     * touchscreen the gesture is imitating. Raise it towards 1 for a longer
     * coast, lower it for a shorter one.
     */
    friction: 0.967,
    /** Fling limits, in CSS px per second. */
    minVelocity: 24,
    maxVelocity: 3600,
  },

  /**
   * Picking an element up and carrying it, rather than scrolling the page under
   * it.
   *
   * A page has no single way of saying "this can be dragged", so three are
   * looked for: the `draggable` attribute, the CSS a drag library leaves behind
   * on its handles, and whatever `selector` names.
   */
  grab: {
    enabled: true,
    /**
     * Extra selector for handles a library sets up in JavaScript and does not
     * advertise in the markup or the CSS.
     */
    selector: '[data-hc-grab]',
    /**
     * Computed cursors that mean "this moves". A page that draws `grab` or
     * `move` under the pointer is telling the user it can be picked up, which
     * makes it the most reliable signal there is.
     */
    cursors: [
      'grab',
      'grabbing',
      'move',
      'all-scroll',
      'col-resize',
      'row-resize',
      'ew-resize',
      'ns-resize',
      'nesw-resize',
      'nwse-resize',
    ],
    /**
     * Treat `touch-action: none` as a drag handle. Libraries set it so the
     * browser does not scroll while they drag, which makes it a good tell.
     * Never applied to `body` or the document element, where it describes the
     * whole page rather than a handle.
     */
    touchAction: true,
    /**
     * How long a pinch on a held element can last and still count as a tap, in
     * ms. Longer than this and the gesture was a drag.
     *
     * Length is the only thing that decides it. Distance is deliberately not
     * consulted: the element is picked up and follows the hand the instant the
     * pinch closes, so *every* press moves it a little, and a hand holding a
     * pinch in mid-air drifts further than a finger on glass ever does. Judging
     * a tap by how far it travelled meant a deliberate press on something
     * draggable kept being read as a drag.
     *
     * It has to be generous, because it is not timing the gesture you make. It
     * times the gap between the pinch closing past `pinch.on` and opening past
     * `pinch.off`, and that band is deliberately wide so a hovering hand does
     * not chatter — so the fingers have to travel back out through all of it
     * before the release even registers. A tap that feels instantaneous is
     * routinely half a second by the time both edges have been crossed.
     *
     * The `gesture` row in the diagnostics panel reports the real figure for
     * your own hand, which is the only way to set this honestly.
     *
     * The trade is that a genuinely quick flick — an element thrown some
     * distance and released inside this window — also registers as a tap.
     * Lower this if that happens; raise it if presses are not landing.
     */
    tapDuration: 700,
    /** Synthesize the HTML5 dragstart/dragover/drop sequence for `draggable`. */
    html5: true,
    /**
     * How long the pinch must be held before a drag on something draggable
     * carries it rather than scrolling, in ms.
     *
     * 0 means it always carries it, which is what a mouse does. Raise it for a
     * scrolling list of draggable cards: then a quick pinch-drag scrolls and
     * only a held one picks a card up, the same way a touchscreen settles the
     * conflict. 300 is a normal long-press.
     */
    holdDelay: 0,
  },

  /**
   * The playful bit: the arrow leans into the direction it travels, capped so
   * it sways rather than spins.
   */
  rotation: {
    enabled: true,
    maxAngle: 22,
    gain: 1.8,
    minSpeed: 0.6,
    smoothing: 0.12,
  },

  /** Cursor sizing. `pressScale` is the tapped state from the spec. */
  cursor: { scale: 1, pressScale: 0.85 },

  /** MediaPipe assets. Point these at your own host to avoid third-party CDNs. */
  cdn: {
    vision:
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs',
    wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
    model:
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
  /** 'GPU' falls back to 'CPU' automatically when WebGL is unavailable. */
  delegate: 'GPU',

  /** Copy, exposed so the trackpad can be localized. */
  strings: {
    intro: 'Use hand tracking to control your cursor. Video never leaves your device.',
    enable: 'Enable Camera',
    starting: 'Starting…',
    retry: 'Try Again',
    minimize: 'Minimize hand tracking',
    expand: 'Expand hand tracking',
    disable: 'Turn camera off',
    insecure: 'Camera access needs a secure (https) connection.',
    denied: 'Camera permission was denied. Allow access and try again.',
    missing: 'No camera was found on this device.',
    model: 'The hand tracking model could not load. Check your connection.',
    failed: 'Hand tracking could not start. Please try again.',
  },
};

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep-merges user options over the defaults without mutating either. */
export function mergeOptions(base, overrides) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isPlainObject(overrides)) return out;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    out[key] =
      isPlainObject(value) && isPlainObject(base?.[key])
        ? mergeOptions(base[key], value)
        : value;
  }
  return out;
}
