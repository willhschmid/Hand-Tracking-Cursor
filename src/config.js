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
     * How much of the remaining distance the page closes each 60fps frame while
     * dragging. Landmarks arrive slower than the screen repaints — on a phone,
     * far slower — so applying each one the instant it lands makes the page
     * lurch and stall. Easing toward the target instead spreads that into
     * something continuous. 1 disables the smoothing.
     */
    follow: 0.22,
    /** Fling decay, written per 60fps frame but applied over real time. */
    friction: 0.94,
    /** Fling limits, in CSS px per second. */
    minVelocity: 24,
    maxVelocity: 3600,
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
