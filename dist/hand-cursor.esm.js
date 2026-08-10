/*! hand-tracking-cursor v1.0.0 | MIT | https://github.com/willhschmid/Hand-Tracking-Cursor */

// src/config.js
var DEFAULTS = {
  /** Where the trackpad sits: bottom-left (spec), bottom-right, top-left, top-right. */
  position: "bottom-left",
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
  zIndex: 2147483e3,
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
  smoothing: { minCutoff: 1.4, beta: 0.015, dCutoff: 1 },
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
    mode: "write",
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
    maxVelocity: 3600
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
    selector: "[data-hc-grab]",
    /**
     * Computed cursors that mean "this moves". A page that draws `grab` or
     * `move` under the pointer is telling the user it can be picked up, which
     * makes it the most reliable signal there is.
     */
    cursors: [
      "grab",
      "grabbing",
      "move",
      "all-scroll",
      "col-resize",
      "row-resize",
      "ew-resize",
      "ns-resize",
      "nesw-resize",
      "nwse-resize"
    ],
    /**
     * Treat `touch-action: none` as a drag handle. Libraries set it so the
     * browser does not scroll while they drag, which makes it a good tell.
     * Never applied to `body` or the document element, where it describes the
     * whole page rather than a handle.
     */
    touchAction: true,
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
    holdDelay: 0
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
    smoothing: 0.12
  },
  /** Cursor sizing. `pressScale` is the tapped state from the spec. */
  cursor: { scale: 1, pressScale: 0.85 },
  /** MediaPipe assets. Point these at your own host to avoid third-party CDNs. */
  cdn: {
    vision: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs",
    wasm: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
    model: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
  },
  /** 'GPU' falls back to 'CPU' automatically when WebGL is unavailable. */
  delegate: "GPU",
  /** Copy, exposed so the trackpad can be localized. */
  strings: {
    intro: "Use hand tracking to control your cursor. Video never leaves your device.",
    enable: "Enable Camera",
    starting: "Starting\u2026",
    retry: "Try Again",
    minimize: "Minimize hand tracking",
    expand: "Expand hand tracking",
    disable: "Turn camera off",
    insecure: "Camera access needs a secure (https) connection.",
    denied: "Camera permission was denied. Allow access and try again.",
    missing: "No camera was found on this device.",
    model: "The hand tracking model could not load. Check your connection.",
    failed: "Hand tracking could not start. Please try again."
  }
};
var isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
function mergeOptions(base, overrides) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isPlainObject(overrides)) return out;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === void 0) continue;
    out[key] = isPlainObject(value) && isPlainObject(base?.[key]) ? mergeOptions(base[key], value) : value;
  }
  return out;
}

// src/tokens.js
var COLOR = {
  green: "#00CA48",
  darkGreen: "#008630",
  red: "#FF4040",
  purple: "#FB79FF",
  yellow: "#FFC44F",
  white: "#FFFFFF",
  lightGray: "#F6F6F6",
  border: "#EBEBEB",
  mediumGray: "#D9D9D9",
  toggleGray: "#C5C5C6",
  iconDark: "#1C1B1F",
  black: "#000000",
  textPrimary: "rgba(0, 0, 0, 1)",
  textSecondary: "rgba(0, 0, 0, 0.6)",
  textTertiary: "rgba(0, 0, 0, 0.4)",
  divider: "rgba(0, 0, 0, 0.08)"
};
var RADIUS = {
  button: 8,
  card: 12
};
var TYPE = {
  family: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  label: { size: 12, weight: 500, leading: 16 },
  body: { size: 12, weight: 400, leading: 16 }
};
var SIZE = {
  panelWidth: 260,
  panelHeight: 200,
  miniSize: 106,
  pad: 12,
  gap: 12,
  cornerInset: 4,
  cornerButton: 32,
  iconSize: 24,
  ctaHeight: 32,
  ctaPadX: 12,
  ctaGap: 8,
  miniCta: 32,
  /** The hand illustration on the pre-enabled card. */
  illoWidth: 66,
  illoHeight: 98
};
var FONT_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap";

// src/styles.js
var CSS = `
:host {
  all: initial;
}

.hc-root {
  position: fixed;
  inset: 0;
  z-index: var(--hc-z, 2147483000);
  pointer-events: none;
  font-family: ${TYPE.family};
  -webkit-font-smoothing: antialiased;
  color: ${COLOR.textPrimary};
}

.hc-root * { box-sizing: border-box; }

/* ---------------------------------------------------------------- panel -- */

.hc-panel {
  position: absolute;
  pointer-events: auto;
  width: ${SIZE.panelWidth}px;
  height: ${SIZE.panelHeight}px;
  padding: ${SIZE.pad}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  background: ${COLOR.lightGray};
  border-radius: ${RADIUS.card}px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px ${COLOR.divider},
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.08);
  transition:
    width 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
    height 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color 200ms linear,
    opacity 200ms linear;
}

.hc-root[data-position$="-left"]  .hc-panel { left: var(--hc-margin); }
.hc-root[data-position$="-right"] .hc-panel { right: var(--hc-margin); }
.hc-root[data-position^="bottom"] .hc-panel { bottom: var(--hc-margin); }
.hc-root[data-position^="top"]    .hc-panel { top: var(--hc-margin); }

.hc-root[data-mini="true"] .hc-panel {
  width: ${SIZE.miniSize}px;
  height: ${SIZE.miniSize}px;
  padding: 0;
}

.hc-root[data-state="live"] .hc-panel {
  padding: 0;
  background: ${COLOR.lightGray};
}

/* ---------------------------------------------------------------- stage -- */

.hc-stage {
  position: relative;
  /* Fixed at the illustration's size; the card distributes what is left over.
     A 98px illustration, two lines of copy and a 32px button do not leave room
     for 12px gaps inside 200px, so the gaps are what give. */
  flex: 0 0 auto;
  width: ${SIZE.illoWidth}px;
  height: ${SIZE.illoHeight}px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hc-root[data-state="live"] .hc-stage,
.hc-root[data-mini="true"] .hc-stage {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
}

.hc-video,
.hc-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: none;
}

.hc-video {
  object-fit: cover;
  transform: scaleX(-1);
  filter: var(--hc-video-filter, none);
  /* Knocked right back so the dark icons and the skeleton stay legible over
     the #F6F6F6 card behind it. */
  opacity: var(--hc-video-opacity, 0.15);
}

.hc-root[data-state="live"] .hc-video,
.hc-root[data-state="live"] .hc-overlay { display: block; }

.hc-illo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.hc-root[data-state="live"] .hc-illo { display: none; }
.hc-root[data-mini="true"] .hc-illo { padding: 10px; }

.hc-illo-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

/* ----------------------------------------------------------------- copy -- */

.hc-copy {
  flex: none;
  margin: 0;
  max-width: 100%;
  text-align: center;
  font-size: ${TYPE.body.size}px;
  font-weight: ${TYPE.body.weight};
  line-height: ${TYPE.body.leading}px;
  letter-spacing: -0.01em;
  color: ${COLOR.textSecondary};
}

.hc-root[data-state="error"] .hc-copy { color: ${COLOR.red}; }

.hc-root[data-state="live"] .hc-copy,
.hc-root[data-mini="true"] .hc-copy { display: none; }

/* ------------------------------------------------------------------ cta -- */

.hc-cta {
  flex: none;
  appearance: none;
  border: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${SIZE.ctaGap}px;
  height: ${SIZE.ctaHeight}px;
  padding: 0 ${SIZE.ctaPadX}px;
  border-radius: ${RADIUS.button}px;
  background: ${COLOR.green};
  color: ${COLOR.white};
  font-family: inherit;
  font-size: ${TYPE.label.size}px;
  font-weight: ${TYPE.label.weight};
  line-height: ${TYPE.label.leading}px;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background-color 150ms linear, transform 120ms ease-out;
}

.hc-cta:hover,
.hc-cta.hc-hover { background: ${COLOR.darkGreen}; }
.hc-cta:active { transform: scale(0.97); }
.hc-cta[disabled] { opacity: 0.7; cursor: default; }

.hc-cta svg { width: ${SIZE.iconSize}px; height: ${SIZE.iconSize}px; flex: none; }

.hc-root[data-state="live"] .hc-cta,
.hc-root[data-mini="true"] .hc-cta { display: none; }

/* -------------------------------------------------------- corner button -- */

.hc-corner,
.hc-mini-cta {
  position: absolute;
  appearance: none;
  border: 0;
  padding: 0;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  color: ${COLOR.iconDark};
}

.hc-corner {
  width: ${SIZE.cornerButton}px;
  height: ${SIZE.cornerButton}px;
  border-radius: ${RADIUS.button}px;
  transition: background-color 150ms linear;
}

.hc-corner svg { width: ${SIZE.iconSize}px; height: ${SIZE.iconSize}px; }
.hc-corner:hover,
.hc-corner.hc-hover { background: ${COLOR.divider}; }

.hc-corner--tr { top: ${SIZE.cornerInset}px; right: ${SIZE.cornerInset}px; display: inline-flex; }
.hc-corner--tl { top: ${SIZE.cornerInset}px; left: ${SIZE.cornerInset}px; }

.hc-root[data-state="live"] .hc-corner--tl { display: inline-flex; }

/* ------------------------------------------------------- minimized cta -- */

.hc-mini-cta {
  left: ${SIZE.cornerInset}px;
  bottom: ${SIZE.cornerInset}px;
  width: ${SIZE.miniCta}px;
  height: ${SIZE.miniCta}px;
  border-radius: ${RADIUS.button}px;
  background: ${COLOR.green};
  color: ${COLOR.white};
  transition: background-color 150ms linear, transform 120ms ease-out;
}

.hc-mini-cta svg { width: ${SIZE.iconSize}px; height: ${SIZE.iconSize}px; }
.hc-mini-cta:hover,
.hc-mini-cta.hc-hover { background: ${COLOR.darkGreen}; }
.hc-mini-cta:active { transform: scale(0.94); }

.hc-root[data-mini="true"] .hc-mini-cta { display: inline-flex; }

/* Once the camera is on, the only control in the minimized card is the
   camera-off icon in the top left. The green button is the pre-enabled
   affordance and has nothing left to offer here. */
.hc-root[data-mini="true"][data-state="live"] .hc-mini-cta { display: none; }

.hc-root[data-mini="true"][data-state="loading"] .hc-mini-cta { opacity: 0.7; }

/* -------------------------------------------------------------- spinner -- */

.hc-spinner {
  width: ${SIZE.iconSize}px;
  height: ${SIZE.iconSize}px;
  flex: none;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: ${COLOR.white};
  animation: hc-spin 700ms linear infinite;
}

@keyframes hc-spin { to { transform: rotate(360deg); } }

/* --------------------------------------------------------------- cursor -- */

.hc-cursor {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--hc-cursor-w, 20px);
  aspect-ratio: 1;
  /* The arrow tip sits at the element's origin, so rotation and the tapped
     scale both pivot on the exact point being addressed. */
  transform-origin: 0 0;
  color: ${COLOR.black};
  opacity: 0;
  will-change: transform, opacity;
  transition: opacity 160ms linear;
}

/* display:block matters here: an inline svg sits on a text baseline and picks
   up descender space, which made the element taller than its aspect-ratio. */
.hc-cursor svg { display: block; width: 100%; height: 100%; overflow: visible; }

.hc-cursor[data-visible="true"] { opacity: 1; }

/* ---------------------------------------------------------------- debug -- */

.hc-debug {
  position: fixed;
  top: 8px;
  left: 8px;
  pointer-events: none;
  min-width: 168px;
  padding: 8px 10px;
  border-radius: ${RADIUS.button}px;
  background: rgba(0, 0, 0, 0.82);
  color: ${COLOR.white};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 15px;
  font-variant-numeric: tabular-nums;
}

.hc-debug-row { display: flex; justify-content: space-between; gap: 12px; }
.hc-debug-row span { opacity: 0.55; }
.hc-debug-row b { font-weight: 500; }
.hc-debug-row b.is-warn { color: ${COLOR.yellow}; }

.hc-debug-trace {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  max-width: 240px;
}

.hc-debug-trace span { display: block; opacity: 0.55; }

.hc-debug-trace code {
  display: block;
  font: inherit;
  word-spacing: 2px;
  line-height: 14px;
  overflow-wrap: anywhere;
}

/* ------------------------------------------------------------------ a11y -- */

.hc-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.hc-root :focus-visible {
  outline: 2px solid ${COLOR.green};
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .hc-panel,
  .hc-cta,
  .hc-mini-cta,
  .hc-corner { transition-duration: 1ms; }
  .hc-spinner { animation-duration: 2s; }
}
`;

// src/icons.js
var symbol = (d) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="${d}" fill="currentColor"/></svg>`;
var ICONS = {
  videocam: symbol(
    "M4 20C3.45 20 2.97917 19.8042 2.5875 19.4125C2.19583 19.0208 2 18.55 2 18V6C2 5.45 2.19583 4.97917 2.5875 4.5875C2.97917 4.19583 3.45 4 4 4H16C16.55 4 17.0208 4.19583 17.4125 4.5875C17.8042 4.97917 18 5.45 18 6V10.5L21.15 7.35C21.3167 7.18333 21.5 7.14167 21.7 7.225C21.9 7.30833 22 7.46667 22 7.7V16.3C22 16.5333 21.9 16.6917 21.7 16.775C21.5 16.8583 21.3167 16.8167 21.15 16.65L18 13.5V18C18 18.55 17.8042 19.0208 17.4125 19.4125C17.0208 19.8042 16.55 20 16 20H4ZM4 18H16V6H4V18Z"
  ),
  videocamOff: symbol(
    "M18.0002 10.5L21.1502 7.35001C21.3169 7.18334 21.5002 7.14167 21.7002 7.22501C21.9002 7.30834 22.0002 7.46667 22.0002 7.70001V16.3C22.0002 16.5333 21.9002 16.6917 21.7002 16.775C21.5002 16.8583 21.3169 16.8167 21.1502 16.65L18.0002 13.5C18.0002 13.7833 17.9044 14.0208 17.7127 14.2125C17.521 14.4042 17.2835 14.5 17.0002 14.5C16.7169 14.5 16.4794 14.4042 16.2877 14.2125C16.096 14.0208 16.0002 13.7833 16.0002 13.5V6.00001H9.0002C8.66686 6.00001 8.41686 5.89584 8.2502 5.68751C8.08353 5.47917 8.0002 5.25001 8.0002 5.00001C8.0002 4.75001 8.08353 4.52084 8.2502 4.31251C8.41686 4.10417 8.66686 4.00001 9.0002 4.00001H16.0002C16.5502 4.00001 17.021 4.19584 17.4127 4.58751C17.8044 4.97917 18.0002 5.45001 18.0002 6.00001V10.5ZM19.8502 22.65L1.3502 4.15001C1.16686 3.96667 1.0752 3.73334 1.0752 3.45001C1.0752 3.16667 1.16686 2.93334 1.3502 2.75001C1.53353 2.56667 1.76686 2.47501 2.0502 2.47501C2.33353 2.47501 2.56686 2.56667 2.7502 2.75001L21.2502 21.25C21.4335 21.4333 21.5252 21.6667 21.5252 21.95C21.5252 22.2333 21.4335 22.4667 21.2502 22.65C21.0669 22.8333 20.8335 22.925 20.5502 22.925C20.2669 22.925 20.0335 22.8333 19.8502 22.65ZM4.0002 4.00001L6.0002 6.00001H4.0002V18H16.0002V16L18.0002 18C18.0002 18.55 17.8044 19.0208 17.4127 19.4125C17.021 19.8042 16.5502 20 16.0002 20H4.0002C3.4502 20 2.97936 19.8042 2.5877 19.4125C2.19603 19.0208 2.0002 18.55 2.0002 18V6.00001C2.0002 5.45001 2.19603 4.97917 2.5877 4.58751C2.97936 4.19584 3.4502 4.00001 4.0002 4.00001Z"
  ),
  collapse: symbol(
    "M9.92658 15H6.91499C6.63057 15 6.39215 14.9042 6.19974 14.7125C6.00734 14.5208 5.91113 14.2833 5.91113 14C5.91113 13.7167 6.00734 13.4792 6.19974 13.2875C6.39215 13.0958 6.63057 13 6.91499 13H10.9304C11.2149 13 11.4533 13.0958 11.6457 13.2875C11.8381 13.4792 11.9343 13.7167 11.9343 14V18C11.9343 18.2833 11.8381 18.5208 11.6457 18.7125C11.4533 18.9042 11.2149 19 10.9304 19C10.646 19 10.4076 18.9042 10.2152 18.7125C10.0228 18.5208 9.92658 18.2833 9.92658 18V15ZM15.9497 9H18.9613C19.2458 9 19.4842 9.09583 19.6766 9.2875C19.869 9.47917 19.9652 9.71667 19.9652 10C19.9652 10.2833 19.869 10.5208 19.6766 10.7125C19.4842 10.9042 19.2458 11 18.9613 11H14.9459C14.6615 11 14.423 10.9042 14.2306 10.7125C14.0382 10.5208 13.942 10.2833 13.942 10V6C13.942 5.71667 14.0382 5.47917 14.2306 5.2875C14.423 5.09583 14.6615 5 14.9459 5C15.2303 5 15.4687 5.09583 15.6611 5.2875C15.8535 5.47917 15.9497 5.71667 15.9497 6V9Z"
  ),
  expand: symbol(
    "M7 17H10C10.2833 17 10.5208 17.0958 10.7125 17.2875C10.9042 17.4792 11 17.7167 11 18C11 18.2833 10.9042 18.5208 10.7125 18.7125C10.5208 18.9042 10.2833 19 10 19H6C5.71667 19 5.47917 18.9042 5.2875 18.7125C5.09583 18.5208 5 18.2833 5 18V14C5 13.7167 5.09583 13.4792 5.2875 13.2875C5.47917 13.0958 5.71667 13 6 13C6.28333 13 6.52083 13.0958 6.7125 13.2875C6.90417 13.4792 7 13.7167 7 14V17ZM17 7H14C13.7167 7 13.4792 6.90417 13.2875 6.7125C13.0958 6.52083 13 6.28333 13 6C13 5.71667 13.0958 5.47917 13.2875 5.2875C13.4792 5.09583 13.7167 5 14 5H18C18.2833 5 18.5208 5.09583 18.7125 5.2875C18.9042 5.47917 19 5.71667 19 6V10C19 10.2833 18.9042 10.5208 18.7125 10.7125C18.5208 10.9042 18.2833 11 18 11C17.7167 11 17.4792 10.9042 17.2875 10.7125C17.0958 10.5208 17 10.2833 17 10V7Z"
  )
};
var ARROW_SVG = '<svg viewBox="9.6 9.6 14 14" fill="none" aria-hidden="true" focusable="false"><path d="M9.40234 11.3525C8.91256 10.1281 10.1281 8.91256 11.3525 9.40234L22.6514 13.9219C23.9484 14.441 23.8937 16.2954 22.5684 16.7373L18.4326 18.1162C18.2833 18.166 18.166 18.2833 18.1162 18.4326L16.7373 22.5684C16.2954 23.8937 14.441 23.9484 13.9219 22.6514L9.40234 11.3525Z" fill="#111111" stroke="white"/></svg>';

// src/landmarks.js
var WRIST = 0;
var THUMB_TIP = 4;
var INDEX_TIP = 8;
var MIDDLE_MCP = 9;
var CONNECTIONS = [
  // thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // index
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // middle
  [9, 10],
  [10, 11],
  [11, 12],
  // ring
  [13, 14],
  [14, 15],
  [15, 16],
  // pinky
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // knuckle bridge across the palm
  [5, 9],
  [9, 13],
  [13, 17]
];
function distance(a, b, aspect) {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
function handScale(points, aspect = 1) {
  return Math.max(
    distance(points[WRIST], points[MIDDLE_MCP], aspect),
    1e-4
  );
}
function pinchRatio(points, aspect = 1) {
  return distance(points[THUMB_TIP], points[INDEX_TIP], aspect) / handScale(points, aspect);
}
function controlPoint(points) {
  const a = points[THUMB_TIP];
  const b = points[INDEX_TIP];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// src/skeleton.js
var JOINT = 3.2;
var BONE = 1.6;
function drawSkeleton(ctx, points, { pinching = false } = {}) {
  const stroke = pinching ? COLOR.green : COLOR.purple;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke;
  ctx.lineWidth = BONE;
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    ctx.moveTo(points[a].x, points[a].y);
    ctx.lineTo(points[b].x, points[b].y);
  }
  ctx.stroke();
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

// src/hand-graphic.js
var HAND_GRAPHIC = "data:image/png;base64,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";

// src/panel.js
var Panel = class {
  constructor(options, handlers) {
    this.options = options;
    this.handlers = handlers;
    this.state = "idle";
    this.mini = Boolean(options.minimized);
    this.root = document.createElement("div");
    this.root.className = "hc-root";
    this.root.dataset.position = options.position;
    this.root.dataset.state = this.state;
    this.root.dataset.mini = String(this.mini);
    this.root.innerHTML = `
      <div class="hc-panel" role="region" aria-label="Hand tracking trackpad">
        <div class="hc-stage">
          <video class="hc-video" playsinline muted autoplay></video>
          <canvas class="hc-overlay" aria-hidden="true"></canvas>
          <div class="hc-illo"><img class="hc-illo-img" src="${HAND_GRAPHIC}" alt="" width="${SIZE.illoWidth}" height="${SIZE.illoHeight}" draggable="false" /></div>
        </div>
        <p class="hc-copy"></p>
        <button class="hc-cta" type="button"></button>
        <button class="hc-corner hc-corner--tl" type="button"></button>
        <button class="hc-corner hc-corner--tr" type="button"></button>
        <button class="hc-mini-cta" type="button"></button>
      </div>
      <p class="hc-sr" role="status" aria-live="polite"></p>
    `;
    const q = (sel) => this.root.querySelector(sel);
    this.panel = q(".hc-panel");
    this.video = q(".hc-video");
    this.canvas = q(".hc-overlay");
    this.copy = q(".hc-copy");
    this.cta = q(".hc-cta");
    this.cornerLeft = q(".hc-corner--tl");
    this.cornerRight = q(".hc-corner--tr");
    this.miniCta = q(".hc-mini-cta");
    this.status = q(".hc-sr");
    this.ctx = this.canvas.getContext("2d");
    this.canvasSize = { width: 0, height: 0, dpr: 0 };
    this.cornerLeft.innerHTML = ICONS.videocamOff;
    this.cornerLeft.title = options.strings.disable;
    this.cornerLeft.setAttribute("aria-label", options.strings.disable);
    this.cta.addEventListener("click", (event) => handlers.onToggleCamera(event));
    this.miniCta.addEventListener("click", (event) => handlers.onToggleCamera(event));
    this.cornerLeft.addEventListener("click", () => handlers.onStop());
    this.cornerRight.addEventListener("click", () => handlers.onToggleSize());
    this.render();
  }
  mount(parent) {
    parent.appendChild(this.root);
  }
  setState(state, message) {
    this.state = state;
    this.root.dataset.state = state;
    this.message = message;
    this.render();
  }
  setMini(mini) {
    this.mini = mini;
    this.root.dataset.mini = String(mini);
    this.render();
  }
  render() {
    const s = this.options.strings;
    const loading = this.state === "loading";
    const live = this.state === "live";
    this.copy.textContent = this.state === "error" ? this.message || s.failed : s.intro;
    const label = loading ? s.starting : this.state === "error" ? s.retry : s.enable;
    this.cta.innerHTML = (loading ? '<span class="hc-spinner"></span>' : ICONS.videocam) + `<span>${label}</span>`;
    this.cta.disabled = loading;
    this.miniCta.innerHTML = live ? ICONS.videocamOff : ICONS.videocam;
    const miniLabel = live ? s.disable : s.enable;
    this.miniCta.title = miniLabel;
    this.miniCta.setAttribute("aria-label", miniLabel);
    this.miniCta.disabled = loading;
    const sizeLabel = this.mini ? s.expand : s.minimize;
    this.cornerRight.innerHTML = this.mini ? ICONS.expand : ICONS.collapse;
    this.cornerRight.title = sizeLabel;
    this.cornerRight.setAttribute("aria-label", sizeLabel);
    this.status.textContent = live ? "Hand tracking is on." : this.state === "error" ? this.message || s.failed : "";
  }
  attachStream(stream) {
    this.video.srcObject = stream;
    return this.video.play().catch(() => {
    });
  }
  detachStream() {
    this.video.srcObject = null;
    this.clearOverlay();
  }
  /** Sizes the backing store to the card and returns its CSS-pixel box. */
  syncCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return null;
    const size = this.canvasSize;
    if (size.width !== width || size.height !== height || size.dpr !== dpr) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.canvasSize = { width, height, dpr };
    }
    return { width, height, dpr };
  }
  clearOverlay() {
    if (!this.canvas.width) return;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  /**
   * Draws the skeleton over the preview. `landmarks` are normalized to the
   * camera frame; the same object-fit: cover mapping the video uses is applied
   * here so the bones land on the hand.
   */
  drawHand(landmarks, pinching) {
    const box = this.syncCanvas();
    if (!box) return;
    const { videoWidth: vw, videoHeight: vh } = this.video;
    this.ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
    this.ctx.clearRect(0, 0, box.width, box.height);
    if (!landmarks || !vw || !vh) return;
    const scale = Math.max(box.width / vw, box.height / vh);
    const drawWidth = vw * scale;
    const drawHeight = vh * scale;
    const offsetX = (box.width - drawWidth) / 2;
    const offsetY = (box.height - drawHeight) / 2;
    const points = landmarks.map((p) => ({
      // The preview is mirrored, so the overlay mirrors with it.
      x: offsetX + (1 - p.x) * drawWidth,
      y: offsetY + p.y * drawHeight
    }));
    drawSkeleton(this.ctx, points, { pinching });
  }
  destroy() {
    this.detachStream();
    this.root.remove();
  }
};

// src/cursor.js
var clamp = (v, min, max) => v < min ? min : v > max ? max : v;
var Cursor = class {
  constructor(options) {
    this.options = options;
    this.el = document.createElement("div");
    this.el.className = "hc-cursor";
    this.el.setAttribute("aria-hidden", "true");
    this.el.innerHTML = ARROW_SVG;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.scale = options.cursor.scale;
    this.visible = false;
    this.pressed = false;
    this.lastMoveAt = 0;
    this.reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      const target = Math.abs(vx) < rotation.minSpeed ? 0 : clamp(vx * rotation.gain, -rotation.maxAngle, rotation.maxAngle);
      this.angle += (target - this.angle) * rotation.smoothing;
    } else {
      this.angle = 0;
    }
    const targetScale = this.pressed ? this.options.cursor.pressScale : this.options.cursor.scale;
    this.scale += (targetScale - this.scale) * 0.35;
    this.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${this.angle.toFixed(2)}deg) scale(${this.scale.toFixed(3)})`;
  }
  reset() {
    this.angle = 0;
    this.scale = this.options.cursor.scale;
    this.pressed = false;
  }
  destroy() {
    this.el.remove();
  }
};

// src/events.js
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
    ...extra
  };
}
var POINTER = { pointerId: 1, pointerType: "touch", isPrimary: true, width: 1, height: 1 };
function firePointer(el, type, x, y, extra) {
  el.dispatchEvent(new PointerEvent(type, eventInit(x, y, { ...POINTER, ...extra })));
}
function fireMouse(el, type, x, y, extra) {
  el.dispatchEvent(new MouseEvent(type, eventInit(x, y, extra)));
}
function fireDrag(el, type, x, y, dataTransfer) {
  return el.dispatchEvent(new DragEvent(type, eventInit(x, y, { dataTransfer })));
}

// src/grab.js
var SCROLLABLE = /(auto|scroll|overlay)/;
function scrolls(node) {
  const style = getComputedStyle(node);
  return SCROLLABLE.test(style.overflowY) && node.scrollHeight - node.clientHeight > 1 || SCROLLABLE.test(style.overflowX) && node.scrollWidth - node.clientWidth > 1;
}
function cursorOwner(node, cursor) {
  let owner = node;
  while (owner.parentElement) {
    const parent = owner.parentElement;
    if (getComputedStyle(parent).cursor !== cursor) return owner;
    if (parent === document.body || parent === document.documentElement) return null;
    owner = parent;
  }
  return null;
}
function grabbableFrom(el, options) {
  const { selector, cursors, touchAction } = options;
  const styled = new Set(cursors);
  let node = el;
  while (node && node.nodeType === 1) {
    const html5 = node.getAttribute?.("draggable") === "true";
    if (html5) return { node, html5: true };
    if (selector && node.matches?.(selector)) return { node, html5: false };
    const root = node === document.body || node === document.documentElement;
    if (!root && !scrolls(node)) {
      const style = getComputedStyle(node);
      if (styled.has(style.cursor)) {
        const owner = cursorOwner(node, style.cursor);
        if (owner && !scrolls(owner)) return { node: owner, html5: false };
      }
      if (touchAction && style.touchAction === "none") return { node, html5: false };
    }
    node = node.parentElement || node.getRootNode()?.host || null;
  }
  return null;
}
var Grab = class {
  /**
   * @param {{node: Element, html5: boolean}} target  what would be carried
   * @param {Element} on    the deepest element under the cursor
   * @param {number} x
   * @param {number} y
   * @param {boolean} useHtml5
   */
  constructor(target, on, x, y, useHtml5) {
    this.node = target.node;
    this.html5 = target.html5 && useHtml5;
    this.started = false;
    this.over = null;
    this.canDrop = false;
    this.dataTransfer = null;
    this.pressed = on || this.node;
    firePointer(this.pressed, "pointerdown", x, y, { buttons: 1, button: 0 });
    fireMouse(this.pressed, "mousedown", x, y, { buttons: 1, button: 0 });
  }
  /**
   * The hand has moved far enough that this is a drag rather than a press.
   *
   * Only now does the HTML5 sequence open, because that is when a browser
   * opens it too — `mousedown` alone never starts a drag and drop.
   */
  start(x, y) {
    if (this.started) return;
    this.started = true;
    if (!this.html5) return;
    try {
      this.dataTransfer = new DataTransfer();
    } catch {
      return;
    }
    this.dataTransfer.effectAllowed = "all";
    fireDrag(this.node, "dragstart", x, y, this.dataTransfer);
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {Element|null} under  what the cursor is over, excluding our own UI
   */
  move(x, y, under) {
    const to = under || (this.pressed.isConnected ? this.pressed : document);
    firePointer(to, "pointermove", x, y, { buttons: 1 });
    fireMouse(to, "mousemove", x, y, { buttons: 1 });
    if (!this.dataTransfer) return;
    fireDrag(this.node, "drag", x, y, this.dataTransfer);
    if (under !== this.over) {
      if (this.over) fireDrag(this.over, "dragleave", x, y, this.dataTransfer);
      if (under) fireDrag(under, "dragenter", x, y, this.dataTransfer);
      this.over = under;
    }
    this.canDrop = under ? !fireDrag(under, "dragover", x, y, this.dataTransfer) : false;
  }
  /** Let go. Returns whether the element was dropped on something. */
  end(x, y, under) {
    const to = under || (this.pressed.isConnected ? this.pressed : document);
    firePointer(to, "pointerup", x, y, { buttons: 0, button: 0 });
    fireMouse(to, "mouseup", x, y, { buttons: 0, button: 0 });
    const dropped = Boolean(this.dataTransfer && this.over && this.canDrop);
    if (this.dataTransfer) {
      if (dropped) fireDrag(this.over, "drop", x, y, this.dataTransfer);
      fireDrag(this.node, "dragend", x, y, this.dataTransfer);
    }
    return dropped;
  }
  /**
   * Something else has taken the gesture over — the hand left the frame, or a
   * scroll won. Put everything down without dropping it.
   */
  cancel(x, y) {
    const to = this.pressed.isConnected ? this.pressed : document;
    firePointer(to, "pointercancel", x, y, { buttons: 0 });
    if (this.dataTransfer) {
      if (this.over) fireDrag(this.over, "dragleave", x, y, this.dataTransfer);
      fireDrag(this.node, "dragend", x, y, this.dataTransfer);
    }
  }
};

// src/scroll.js
var SCROLLABLE2 = /(auto|scroll|overlay)/;
function scrollTargetFor(el) {
  let node = el;
  while (node && node !== document.documentElement && node !== document.body) {
    if (node.nodeType === 1) {
      const style = getComputedStyle(node);
      const canY = SCROLLABLE2.test(style.overflowY) && node.scrollHeight - node.clientHeight > 1;
      const canX = SCROLLABLE2.test(style.overflowX) && node.scrollWidth - node.clientWidth > 1;
      if (canY || canX) return { node, canX, canY };
    }
    node = node.parentElement || node.getRootNode()?.host || null;
  }
  const doc = document.scrollingElement || document.documentElement;
  return {
    node: doc,
    canX: doc.scrollWidth - doc.clientWidth > 1,
    canY: doc.scrollHeight - doc.clientHeight > 1
  };
}
function suppressSmoothScroll(node) {
  const target = node === document.scrollingElement ? document.documentElement : node;
  const previous = target.style.scrollBehavior;
  target.style.setProperty("scroll-behavior", "auto", "important");
  return () => {
    if (previous) target.style.setProperty("scroll-behavior", previous, "");
    else target.style.removeProperty("scroll-behavior");
  };
}
function usesSmoothScroll(node) {
  const target = node === document.scrollingElement ? document.documentElement : node;
  return getComputedStyle(target).scrollBehavior === "smooth";
}
function snap(value) {
  const dpr = window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}
function scrollRange(node) {
  return {
    x: Math.max(0, node.scrollWidth - node.clientWidth),
    y: Math.max(0, node.scrollHeight - node.clientHeight)
  };
}
function decayTau(friction) {
  return -1 / (60 * Math.log(friction));
}
function throwDistance(velocity, friction, scale) {
  return velocity * decayTau(friction) * scale;
}
var HEAD_CAP = 0.05;
var HEAD_GAIN = 0.15;
var ScrollRunner = class {
  constructor(options, debug) {
    this.options = options;
    this.debug = debug;
    this.target = null;
    this.askedX = 0;
    this.askedY = 0;
    this.appliedX = 0;
    this.appliedY = 0;
    this.path = [];
    this.interval = 0;
    this.head = 0;
    this.positionX = 0;
    this.positionY = 0;
    this.live = false;
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
    this.claimPosition();
    this.debug?.recordTarget(target.node, usesSmoothScroll(target.node));
    this.debug?.beginTrace(target.node);
    this.lastRetargetAt = 0;
    if (this.options.drag.mode === "write" || this.options.drag.mode === "hybrid") {
      if (!this.restoreBehavior) this.restoreBehavior = suppressSmoothScroll(target.node);
    }
  }
  releaseBehavior() {
    this.restoreBehavior?.();
    this.restoreBehavior = null;
  }
  /**
   * Takes ownership of the container's scroll position for the gesture.
   *
   * From here until the gesture ends the runner writes absolute offsets it
   * tracks itself, and never reads the container's back.
   *
   * That is not a micro-optimisation. On iOS the page's scroll offset lives in
   * the UI process, not this one: a write is a message that commits a moment
   * later, and a read taken straight afterwards can still return the old value.
   * `scrollTop = scrollTop - delta` every frame is then a read-modify-write
   * loop against a value that has not caught up — the frame reads a stale
   * offset, computes the same target it already asked for, and the page does
   * not move. The frame after reads a fresh one and moves twice as far. Dead
   * frame, double step, dead frame: the page skips while the cursor, a
   * composited transform that never round-trips anywhere, glides.
   *
   * It also explains what is smooth. A nested `overflow: auto` element keeps
   * its offset in this process, so reading it back is exact and this loop
   * never misbehaves — which is why a modal's inner scroller stays smooth on
   * the same phone that skips on the page itself.
   */
  claimPosition() {
    if (!this.target) return;
    this.positionX = this.target.node.scrollLeft;
    this.positionY = this.target.node.scrollTop;
  }
  /**
   * Writes the position the gesture has arrived at, moved by (dx, dy) of cursor
   * travel.
   *
   * The intended position is clamped to the container's own range rather than
   * left to the browser to clamp, so dragging past the end cannot run the
   * tracked value off into space and leave the page unresponsive on the way
   * back.
   */
  applyScroll(dx, dy) {
    const { node, canX, canY } = this.target;
    const range = scrollRange(node);
    if (canY) this.positionY = Math.max(0, Math.min(range.y, this.positionY - dy));
    if (canX) this.positionX = Math.max(0, Math.min(range.x, this.positionX - dx));
    const top = snap(this.positionY);
    const left = snap(this.positionX);
    try {
      node.scrollTo({ top, left, behavior: "instant" });
    } catch {
      node.scrollTop = top;
      node.scrollLeft = left;
    }
    if (this.debug) this.debug.recordCommit(top, canY ? node.scrollTop : node.scrollLeft);
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
      if (gap >= 8 && gap <= 250) {
        this.interval = this.interval ? this.interval * 0.7 + gap * 0.3 : gap;
      }
    }
    if (this.path.length === 0) {
      const assumed = this.options.drag.resampleMax;
      this.path.push({ t: now - assumed, x: this.askedX, y: this.askedY });
    }
    this.askedX += dx;
    this.askedY += dy;
    this.path.push({ t: now, x: this.askedX, y: this.askedY });
    while (this.path.length > 2 && now - this.path[0].t > 1e3) this.path.shift();
    if (this.options.drag.mode === "native") this.retarget();
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
    const limit = elapsed * HEAD_CAP;
    const drift = (ideal - this.head) * HEAD_GAIN;
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
      const span2 = previous ? last.t - previous.t : 0;
      if (!this.live || !previous || span2 <= 0) return { x: last.x, y: last.y };
      const over = Math.min(t - last.t, this.options.drag.resampleMax) / span2;
      return {
        x: last.x + (last.x - previous.x) * over,
        y: last.y + (last.y - previous.y) * over
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
  retarget(force = false, behavior = "smooth") {
    const now = performance.now();
    const { retargetMs } = this.options.drag;
    if (!force && now - this.lastRetargetAt < retargetMs) return true;
    this.lastRetargetAt = now;
    const { node, canX, canY } = this.target;
    const range = scrollRange(node);
    if (canY) {
      this.positionY = Math.max(0, Math.min(range.y, this.positionY - this.remainingY));
    }
    if (canX) {
      this.positionX = Math.max(0, Math.min(range.x, this.positionX - this.remainingX));
    }
    const top = snap(this.positionY);
    const left = snap(this.positionX);
    try {
      node.scrollTo({ top, left, behavior });
    } catch {
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
    const clamp2 = (v) => Math.max(-maxVelocity, Math.min(maxVelocity, v));
    const vx = clamp2(velocityX);
    const vy = clamp2(velocityY);
    const slow = Math.hypot(vx, vy) < minVelocity;
    this.live = false;
    if (mode === "native" || mode === "hybrid") {
      if (!slow) {
        this.askedX += throwDistance(vx, friction, flingScale);
        this.askedY += throwDistance(vy, friction, flingScale);
      }
      this.releaseBehavior();
      if (this.retarget(true, "smooth")) {
        this.stop();
        return;
      }
    }
    if (slow) return;
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
    const elapsed = this.lastFrameAt ? Math.min(now - this.lastFrameAt, 50) : 1e3 / 60;
    const dt = elapsed / 1e3;
    this.lastFrameAt = now;
    let dx = 0;
    let dy = 0;
    if (this.flinging) {
      const { friction, minVelocity } = this.options.drag;
      const decay = friction ** (dt * 60);
      this.velocityX *= decay;
      this.velocityY *= decay;
      dx = this.velocityX * dt;
      dy = this.velocityY * dt;
      if (Math.hypot(this.velocityX, this.velocityY) < minVelocity) {
        this.flinging = false;
      }
    } else if (this.options.drag.follow >= 1) {
      dx = this.remainingX;
      dy = this.remainingY;
      this.appliedX = this.askedX;
      this.appliedY = this.askedY;
    } else {
      const at = this.positionAt(this.advanceHead(now, elapsed));
      dx = at.x - this.appliedX;
      dy = at.y - this.appliedY;
      this.appliedX = at.x;
      this.appliedY = at.y;
    }
    if (dx || dy) {
      this.applyScroll(dx, dy);
      this.debug?.recordScroll(dy || dx);
    }
    const settled = Math.abs(this.remainingX) < 1e-3 && Math.abs(this.remainingY) < 1e-3;
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
};

// src/pointer.js
var FOCUSABLE = "a[href], button, input, select, textarea, summary, [tabindex]";
var SECOND = 1e3;
function deepElementFromPoint(x, y) {
  let el = document.elementFromPoint(x, y);
  while (el?.shadowRoot) {
    const inner = el.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === el) break;
    el = inner;
  }
  return el;
}
var TouchEmulator = class {
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
      firePointer(el, "pointerover", x, y, { buttons: this.pressing ? 1 : 0 });
      fireMouse(el, "mouseover", x, y, { buttons: this.pressing ? 1 : 0 });
      el.dispatchEvent(
        new MouseEvent("mouseenter", { ...eventInit(x, y), bubbles: false, cancelable: false })
      );
    }
    firePointer(el, "pointermove", x, y, { buttons: this.pressing ? 1 : 0 });
    fireMouse(el, "mousemove", x, y, { buttons: this.pressing ? 1 : 0 });
  }
  leaveHovered(x, y) {
    const previous = this.hovered;
    if (!previous) return;
    this.hovered = null;
    this.hoverStyles?.clear();
    firePointer(previous, "pointerout", x, y, { buttons: 0 });
    fireMouse(previous, "mouseout", x, y, { buttons: 0 });
    previous.dispatchEvent(
      new MouseEvent("mouseleave", { ...eventInit(x, y), bubbles: false, cancelable: false })
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
    const immediate = Boolean(this.grabTarget) && grab.holdDelay === 0;
    this.scrollTarget = internal || !el || immediate ? null : scrollTargetFor(el);
    this.scroller.setTarget(this.scrollTarget);
    if (immediate) this.beginGrab(x, y, el);
  }
  /** True once the pinch has moved far enough, and been held long enough. */
  pastDragGate(x, y, now) {
    const { threshold, holdDelay, holdEscape } = this.options.drag;
    const travel = Math.hypot(x - this.origin.x, y - this.origin.y);
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
    const keep = this.options.drag.velocityWindow * 2;
    while (this.samples.length > 2 && now - this.samples[0].t > keep) this.samples.shift();
    if (this.grab) {
      if (!this.dragging && this.pastDragGate(x, y, now)) {
        this.dragging = true;
        this.leaveHovered(x, y);
        this.grab.start(x, y);
      }
      this.dragElement(x, y);
      return;
    }
    if (!this.dragging) {
      if (!this.pastDragGate(x, y, now)) return;
      this.dragging = true;
      this.leaveHovered(x, y);
    }
    if (this.grabTarget && !this.scrolled) {
      if (now - this.origin.t >= this.options.grab.holdDelay) {
        this.beginGrab(x, y, this.resolve(x, y).el);
        this.grab.start(x, y);
        this.dragElement(x, y);
        return;
      }
    }
    this.scrolled = true;
    this.scroller.push(dx, dy, now);
  }
  /** Takes hold of the element under the cursor. */
  beginGrab(x, y, el) {
    this.scroller.stop();
    this.scrollTarget = null;
    this.grab = new Grab(this.grabTarget, el, x, y, this.options.grab.html5);
    this.onGrab?.({ type: "start", target: this.grab.node, x, y });
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
      if (!wasDrag && this.isTap(origin, x, y, now)) this.click(grab.pressed, origin.x, origin.y);
      this.onGrab?.({ type: "end", target: grab.node, dropped, x, y });
      return;
    }
    this.grabTarget = null;
    if (this.dragging) {
      this.dragging = false;
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
    return Math.hypot(x - origin.x, y - origin.y) <= maxTravel && now - origin.t <= maxDuration;
  }
  /** Moves focus and fires the click, the tail end of every tap. */
  click(el, x, y) {
    const focusTarget = el.closest?.(FOCUSABLE);
    if (focusTarget) {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
      }
    } else if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur?.();
    }
    fireMouse(el, "click", x, y, { buttons: 0, button: 0, detail: 1 });
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
    firePointer(el, "pointerdown", x, y, { buttons: 1, button: 0 });
    fireMouse(el, "mousedown", x, y, { buttons: 1, button: 0 });
    firePointer(el, "pointerup", x, y, { buttons: 0, button: 0 });
    fireMouse(el, "mouseup", x, y, { buttons: 0, button: 0 });
    this.click(el, x, y);
  }
  /** The hand left the frame: drop everything without firing a tap. */
  cancel(x = 0, y = 0) {
    this.scroller.stop();
    if (this.grab) {
      this.grab.cancel(x, y);
      this.onGrab?.({ type: "end", target: this.grab.node, dropped: false, x, y });
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
};

// src/one-euro.js
function smoothingFactor(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}
var LowPass = class {
  constructor() {
    this.value = null;
  }
  filter(x, alpha) {
    this.value = this.value === null ? x : alpha * x + (1 - alpha) * this.value;
    return this.value;
  }
  reset() {
    this.value = null;
  }
};
var OneEuroFilter = class {
  constructor({ minCutoff = 1, beta = 0, dCutoff = 1 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
  }
  filter(value, dt) {
    if (!(dt > 0)) dt = 1 / 60;
    const previous = this.x.value;
    const derivative = previous === null ? 0 : (value - previous) / dt;
    const edx = this.dx.filter(derivative, smoothingFactor(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, smoothingFactor(cutoff, dt));
  }
  reset() {
    this.x.reset();
    this.dx.reset();
  }
};
var PointFilter = class {
  constructor(options) {
    this.fx = new OneEuroFilter(options);
    this.fy = new OneEuroFilter(options);
  }
  filter(x, y, dt) {
    return { x: this.fx.filter(x, dt), y: this.fy.filter(y, dt) };
  }
  reset() {
    this.fx.reset();
    this.fy.reset();
  }
};

// src/hover.js
var ATTR = "data-hc-hover";
var mirror = (selector) => selector.replace(/:hover\b/g, `[${ATTR}]`);
function collect(rules, out) {
  for (const rule of rules) {
    if (rule.selectorText) {
      if (rule.selectorText.includes(":hover")) {
        out.push(`${mirror(rule.selectorText)}{${rule.style.cssText}}`);
      }
    } else if (rule.media) {
      const inner = [];
      collect(rule.cssRules, inner);
      if (inner.length) out.push(`@media ${rule.conditionText}{${inner.join("")}}`);
    } else if (rule.conditionText && rule.cssRules) {
      const inner = [];
      collect(rule.cssRules, inner);
      if (inner.length) out.push(`@supports ${rule.conditionText}{${inner.join("")}}`);
    }
  }
}
var HoverEmulator = class {
  constructor() {
    this.style = null;
    this.chain = [];
    this.sheetCount = -1;
    this.warned = false;
    this.observer = null;
  }
  /** Scans the page's stylesheets and (re)writes the mirrored rules. */
  build() {
    const rules = [];
    let blocked = 0;
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode === this.style) continue;
      try {
        collect(sheet.cssRules, rules);
      } catch {
        blocked += 1;
      }
    }
    if (blocked && !this.warned) {
      this.warned = true;
      console.info(
        `[hand-cursor] ${blocked} cross-origin stylesheet(s) could not be read, so their :hover styles will not respond to the hand cursor.`
      );
    }
    if (!this.style) {
      this.style = document.createElement("style");
      this.style.setAttribute("data-hand-cursor-hover", "");
    }
    this.style.textContent = rules.join("\n");
    document.head.appendChild(this.style);
    this.sheetCount = document.styleSheets.length;
    if (!this.observer) this.watch();
  }
  /** Rebuilds when a single-page app swaps its styles in. */
  watch() {
    let pending = 0;
    this.observer = new MutationObserver(() => {
      if (document.styleSheets.length === this.sheetCount) return;
      clearTimeout(pending);
      pending = setTimeout(() => this.build(), 250);
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  /** Marks `el` and its ancestors as hovered. */
  set(el) {
    if (this.chain[0] === el) return;
    const next = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      next.push(node);
    }
    for (const node of this.chain) {
      if (!next.includes(node)) node.removeAttribute(ATTR);
    }
    for (const node of next) node.setAttribute(ATTR, "");
    this.chain = next;
  }
  clear() {
    for (const node of this.chain) node.removeAttribute(ATTR);
    this.chain = [];
  }
  destroy() {
    this.clear();
    this.observer?.disconnect();
    this.observer = null;
    this.style?.remove();
    this.style = null;
  }
};

// src/driver.js
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
var CursorDriver = class {
  /**
   * @param {object} options            resolved config
   * @param {object} hooks
   * @param {import('./pointer.js').OwnUi} hooks.ui  the trackpad's own chrome
   * @param {Function} [hooks.onEvent]  (type, detail) for every gesture
   */
  constructor(options, { ui, onEvent, debug } = {}) {
    this.options = options;
    this.onEvent = onEvent;
    this.debug = debug;
    this.cursor = new Cursor(options);
    this.hoverStyles = options.emulateHover ? new HoverEmulator() : null;
    this.touch = new TouchEmulator(options, {
      ui,
      debug,
      hover: this.hoverStyles,
      onTap: (detail) => this.emit("tap", detail),
      onGrab: ({ type, ...detail }) => this.emit(type === "start" ? "grab" : "drop", detail)
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
    this.debug?.recordTracked();
    const dt = this.lastFrameAt ? (now - this.lastFrameAt) / 1e3 : 1 / 60;
    this.lastFrameAt = now;
    const point = controlPoint(landmarks);
    const region = this.options.region;
    const nx = clamp01((1 - point.x - region.x) / (1 - 2 * region.x));
    const ny = clamp01((point.y - region.y) / (1 - 2 * region.y));
    const smoothed = this.filter.filter(
      nx * window.innerWidth,
      ny * window.innerHeight,
      dt
    );
    const previous = this.position;
    this.position = smoothed;
    this.velocity = previous ? { x: smoothed.x - previous.x, y: smoothed.y - previous.y } : { x: 0, y: 0 };
    this.cursor.setVisible(true);
    this.cursor.update(smoothed.x, smoothed.y, this.velocity.x, this.velocity.y, now);
    const ratio = pinchRatio(landmarks, aspect);
    const { on, off } = this.options.pinch;
    const pinching = this.pinching ? ratio < off : ratio < on;
    if (pinching && !this.pinching) {
      this.pinching = true;
      this.cursor.setPressed(true);
      this.touch.press(smoothed.x, smoothed.y, now);
      this.emit("press", { x: smoothed.x, y: smoothed.y });
    } else if (!pinching && this.pinching) {
      this.pinching = false;
      this.cursor.setPressed(false);
      this.touch.release(smoothed.x, smoothed.y, now);
      this.emit("release", { x: smoothed.x, y: smoothed.y });
    }
    if (this.pinching) {
      this.touch.drag(smoothed.x, smoothed.y, now);
    } else {
      this.touch.move(smoothed.x, smoothed.y);
    }
    const detail = { x: smoothed.x, y: smoothed.y, pinching: this.pinching, ratio };
    this.emit("move", detail);
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
};

// src/debug.js
var WINDOW = 60;
var Rolling = class {
  constructor() {
    this.values = [];
  }
  push(value) {
    this.values.push(value);
    if (this.values.length > WINDOW) this.values.shift();
  }
  get mean() {
    if (!this.values.length) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }
  percentile(p) {
    if (!this.values.length) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  }
  get max() {
    return this.values.length ? Math.max(...this.values) : 0;
  }
};
var ROWS = [
  ["paint", "repaints per second \u2014 the rate the screen can actually update"],
  ["track", "landmark frames per second"],
  ["model", "milliseconds per inference, mean / worst"],
  ["frame", "milliseconds between repaints, median / 95th"],
  ["worst", "longest gap between repaints"],
  ["blocked", "share of repaints later than 32ms"],
  ["scroll", "scroll writes per second, and mean step"],
  [
    "commit",
    "how far the browser\u2019s reported scroll offset trails what was just written, and how often it had not moved at all. Anything but 0 means this platform commits scrolls asynchronously"
  ],
  ["target", "what is being scrolled, and whether its CSS asked for smooth"]
];
var DebugOverlay = class {
  constructor() {
    this.inference = new Rolling();
    this.frameGaps = new Rolling();
    this.scrollSteps = new Rolling();
    this.commitLag = new Rolling();
    this.staleReads = 0;
    this.commitReads = 0;
    this.lastReported = null;
    this.paintCount = 0;
    this.trackCount = 0;
    this.scrollCount = 0;
    this.blockedCount = 0;
    this.lastPaintAt = 0;
    this.lastReportAt = 0;
    this.running = false;
    this.targetLabel = "";
    this.targetSmooth = false;
    this.trace = [];
    this.traceNode = null;
    this.lastScrollTop = null;
    this.tracing = false;
    this.el = document.createElement("div");
    this.el.className = "hc-debug";
    this.el.innerHTML = ROWS.map(
      ([key, title]) => `<div class="hc-debug-row" title="${title}"><span>${key}</span><b data-k="${key}">\u2014</b></div>`
    ).join("") + '<div class="hc-debug-trace"><span>per-frame scroll</span><code data-k="trace">drag the page to record</code></div>';
    this.tick = this.tick.bind(this);
  }
  mount(parent) {
    parent.appendChild(this.el);
    this.start();
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.lastPaintAt = 0;
    this.lastReportAt = 0;
    requestAnimationFrame(this.tick);
  }
  stop() {
    this.running = false;
  }
  /** One inference, in milliseconds. */
  recordInference(ms) {
    this.inference.push(ms);
  }
  /** One frame of landmarks delivered. */
  recordTracked() {
    this.trackCount += 1;
  }
  /** One scroll write, with the distance moved. */
  recordScroll(step) {
    this.scrollCount += 1;
    this.scrollSteps.push(Math.abs(step));
  }
  /**
   * What the container reported back immediately after being written to.
   *
   * On a platform that commits scrolls asynchronously — iOS, where the page's
   * offset lives in another process — this trails the written value, and any
   * code that reads the offset back to compute the next one will stutter. The
   * runner does not do that, but the number is worth showing: it is the
   * difference between a page that skips and one that does not, and it can
   * only be measured on the device itself.
   */
  recordCommit(written, reported) {
    this.commitReads += 1;
    this.commitLag.push(Math.abs(written - reported));
    if (this.lastReported !== null && reported === this.lastReported) {
      this.staleReads += 1;
    }
    this.lastReported = reported;
  }
  /**
   * Which element is being scrolled, and whether its stylesheet asked for
   * smooth scrolling — the single most likely reason a page lurches while
   * everything else on it stays smooth.
   */
  /** Starts a fresh recording; called when a drag takes hold of a container. */
  beginTrace(node) {
    this.traceNode = node;
    this.trace = [];
    this.lastScrollTop = null;
    this.tracing = true;
  }
  /** Freezes the recording so it can be read, and screenshotted, afterwards. */
  endTrace() {
    this.tracing = false;
  }
  recordTarget(node, smooth) {
    const name = node === document.scrollingElement || node === document.documentElement ? "page" : node.tagName.toLowerCase() + (node.id ? `#${node.id}` : "");
    this.targetLabel = `${name} ${smooth ? "SMOOTH" : "auto"}`;
    this.targetSmooth = smooth;
  }
  /**
   * Runs its own animation frame loop rather than piggy-backing on the tracker,
   * so it measures what the browser manages rather than what we ask for.
   */
  tick(now) {
    if (!this.running) return;
    requestAnimationFrame(this.tick);
    if (this.lastPaintAt) {
      const gap = now - this.lastPaintAt;
      this.frameGaps.push(gap);
      this.paintCount += 1;
      if (gap > 32) this.blockedCount += 1;
    }
    this.lastPaintAt = now;
    if (this.tracing && this.traceNode) {
      const top = this.traceNode.scrollTop;
      if (this.lastScrollTop !== null) {
        this.trace.push(Math.round(top - this.lastScrollTop));
        if (this.trace.length > 240) this.trace.shift();
      }
      this.lastScrollTop = top;
    }
    if (!this.lastReportAt) this.lastReportAt = now;
    const elapsed = now - this.lastReportAt;
    if (elapsed < 500) return;
    const perSecond = (n) => Math.round(n * 1e3 / elapsed);
    this.set("paint", `${perSecond(this.paintCount)}/s`);
    this.set("track", `${perSecond(this.trackCount)}/s`);
    this.set(
      "model",
      this.inference.values.length ? `${this.inference.mean.toFixed(0)} / ${this.inference.max.toFixed(0)}ms` : "\u2014"
    );
    this.set(
      "frame",
      `${this.frameGaps.percentile(0.5).toFixed(0)} / ${this.frameGaps.percentile(0.95).toFixed(0)}ms`
    );
    this.set("worst", `${this.frameGaps.max.toFixed(0)}ms`);
    const blocked = this.paintCount ? this.blockedCount / this.paintCount * 100 : 0;
    this.set("blocked", `${blocked.toFixed(0)}%`, blocked > 20);
    this.set(
      "scroll",
      this.scrollCount ? `${perSecond(this.scrollCount)}/s ${this.scrollSteps.mean.toFixed(1)}px` : "\u2014"
    );
    const stale = this.commitReads ? this.staleReads / this.commitReads * 100 : 0;
    this.set(
      "commit",
      this.commitReads ? `${this.commitLag.mean.toFixed(1)}px lag, ${stale.toFixed(0)}% stale` : "\u2014",
      this.commitLag.mean > 1
    );
    this.set("target", this.targetLabel || "\u2014", Boolean(this.targetSmooth));
    if (this.trace.length) {
      const first = this.trace.findIndex((d) => d !== 0);
      const active = first === -1 ? this.trace : this.trace.slice(first);
      const node = this.el.querySelector('[data-k="trace"]');
      if (node) node.textContent = active.slice(-44).join(" ");
    }
    this.paintCount = 0;
    this.trackCount = 0;
    this.scrollCount = 0;
    this.blockedCount = 0;
    this.staleReads = 0;
    this.commitReads = 0;
    this.lastReportAt = now;
  }
  set(key, value, warn = false) {
    const node = this.el.querySelector(`[data-k="${key}"]`);
    if (!node) return;
    node.textContent = value;
    node.classList.toggle("is-warn", warn);
  }
  destroy() {
    this.stop();
    this.el.remove();
  }
};

// src/hand-model.js
var visionModulePromise = null;
function loadVision(url) {
  if (!visionModulePromise) {
    const specifier = url;
    visionModulePromise = import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      specifier
    ).catch(
      (error) => {
        visionModulePromise = null;
        throw error;
      }
    );
  }
  return visionModulePromise;
}
async function createHandLandmarker({ cdn, numHands, delegate }) {
  const vision = await loadVision(cdn.vision);
  const fileset = await vision.FilesetResolver.forVisionTasks(cdn.wasm);
  const build = (which) => vision.HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: cdn.model, delegate: which },
    runningMode: "VIDEO",
    numHands,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  try {
    return await build(delegate);
  } catch (error) {
    if (delegate === "CPU") throw error;
    return build("CPU");
  }
}
async function loadModel(config) {
  try {
    return await createHandLandmarker(config);
  } catch (error) {
    console.error("[hand-cursor] could not load the MediaPipe model", error);
    throw Object.assign(
      error instanceof Error ? error : new Error(String(error)),
      { code: "model" }
    );
  }
}
async function openCamera({ width, height, frameRate }) {
  if (!window.isSecureContext) {
    throw Object.assign(new Error("insecure context"), { code: "insecure" });
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error("getUserMedia unavailable"), { code: "missing" });
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: frameRate }
      }
    });
  } catch (error) {
    const code = error?.name === "NotAllowedError" || error?.name === "SecurityError" ? "denied" : error?.name === "NotFoundError" || error?.name === "OverconstrainedError" ? "missing" : "failed";
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { code });
  }
  return stream;
}
function closeCamera(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

// src/controller.js
var HAND_TIMEOUT = 400;
var HandCursorController = class {
  constructor(userOptions = {}) {
    this.options = mergeOptions(DEFAULTS, userOptions);
    this.host = document.createElement("div");
    this.host.setAttribute("data-hand-cursor", "");
    this.shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    this.shadow.appendChild(style);
    this.panel = new Panel(this.options, {
      onToggleCamera: () => this.running ? this.stop() : this.start(),
      onStop: () => this.stop(),
      onToggleSize: () => this.setMinimized(!this.panel.mini)
    });
    this.panel.mount(this.shadow);
    this.debug = this.options.debug ? new DebugOverlay() : null;
    this.driver = new CursorDriver(this.options, {
      ui: shadowUi(this.shadow),
      debug: this.debug,
      onEvent: (type, detail) => this.emit(type, detail)
    });
    this.driver.mount(this.panel.root);
    this.debug?.mount(this.panel.root);
    this.running = false;
    this.starting = false;
    this.destroyed = false;
    this.stream = null;
    this.landmarker = null;
    this.frame = null;
    this.lastVideoTime = -1;
    this.lastHandAt = 0;
    this.lastLandmarks = null;
    this.lastInferenceAt = 0;
    this.applyStyleVariables();
    this.onKeyDown = this.onKeyDown.bind(this);
    this.tick = this.tick.bind(this);
  }
  /** Cursor position, or null when no hand is being tracked. */
  get position() {
    return this.driver.position;
  }
  get pinching() {
    return this.driver.pinching;
  }
  /**
   * What, if anything, a pinch on this element would pick up and why.
   *
   * Exposed because "the cursor scrolls my page instead of dragging my card" is
   * answerable in one call, and guessing at it from the outside is not:
   * `hc.grabbableFrom(document.querySelector('.card'))` returns the element
   * that would be carried, or null. Pass a `grab.selector` if it comes back
   * null for something a library does make draggable.
   */
  grabbableFrom(el) {
    return el ? grabbableFrom(el, this.options.grab) : null;
  }
  applyStyleVariables() {
    const { margin, zIndex, grayscale } = this.options;
    this.panel.root.style.setProperty("--hc-margin", `${margin}px`);
    this.panel.root.style.setProperty("--hc-z", String(zIndex));
    this.panel.root.style.setProperty(
      "--hc-video-filter",
      grayscale ? "grayscale(1)" : "none"
    );
  }
  mount(parent = document.body) {
    if (this.mounted) return this;
    parent.appendChild(this.host);
    this.mounted = true;
    if (this.options.font) this.injectFont();
    document.addEventListener("keydown", this.onKeyDown, true);
    if (this.options.autoStart) this.start();
    return this;
  }
  /** Loads Inter unless the page already provides it. */
  injectFont() {
    const already = document.fonts && typeof document.fonts.check === "function" && document.fonts.check("500 12px Inter");
    if (already || document.querySelector('link[href*="family=Inter"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_URL;
    link.setAttribute("data-hand-cursor-font", "");
    document.head.appendChild(link);
  }
  onKeyDown(event) {
    if (event.key === "Escape" && this.running) this.stop();
  }
  emit(type, detail) {
    document.dispatchEvent(
      new CustomEvent(`handcursor:${type}`, { detail: { ...detail, instance: this } })
    );
  }
  // ------------------------------------------------------------- lifecycle --
  async start() {
    if (this.running || this.starting || this.destroyed) return;
    this.starting = true;
    this.panel.setState("loading");
    try {
      const [stream, landmarker] = await Promise.all([
        openCamera(this.options.camera),
        this.landmarker ?? loadModel({
          cdn: this.options.cdn,
          numHands: this.options.numHands ?? 1,
          delegate: this.options.delegate
        })
      ]);
      if (this.destroyed) {
        closeCamera(stream);
        return;
      }
      this.stream = stream;
      this.landmarker = landmarker;
      await this.panel.attachStream(stream);
      this.running = true;
      this.starting = false;
      this.lastVideoTime = -1;
      this.driver.reset();
      this.driver.prepareHoverStyles();
      this.panel.setState("live");
      if (this.options.hideNativeCursor) {
        document.documentElement.style.setProperty("cursor", "none", "important");
      }
      this.frame = requestAnimationFrame(this.tick);
      this.emit("start", {});
    } catch (error) {
      this.starting = false;
      closeCamera(this.stream);
      this.stream = null;
      const strings = this.options.strings;
      const message = strings[error?.code] || strings.failed;
      this.panel.setState("error", message);
      this.emit("error", { error, message });
    }
  }
  stop() {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    closeCamera(this.stream);
    this.stream = null;
    this.running = false;
    this.starting = false;
    this.lastLandmarks = null;
    this.driver.release();
    this.driver.reset();
    this.panel.detachStream();
    this.panel.setState("idle");
    if (this.options.hideNativeCursor) {
      document.documentElement.style.removeProperty("cursor");
    }
    this.emit("stop", {});
  }
  setMinimized(mini) {
    this.panel.setMini(Boolean(mini));
    this.emit(mini ? "minimize" : "expand", {});
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.landmarker?.close?.();
    this.landmarker = null;
    this.debug?.destroy();
    this.driver.destroy();
    this.panel.destroy();
    this.host.remove();
    this.mounted = false;
  }
  // ------------------------------------------------------------- main loop --
  tick(now) {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);
    const video = this.panel.video;
    if (video.readyState < 2 || !video.videoWidth) return;
    const { maxTrackingFps } = this.options;
    const dueAt = maxTrackingFps > 0 ? this.lastInferenceAt + 1e3 / maxTrackingFps : 0;
    if (video.currentTime !== this.lastVideoTime && now >= dueAt) {
      this.lastVideoTime = video.currentTime;
      this.lastInferenceAt = now;
      const startedAt = this.debug ? performance.now() : 0;
      try {
        const result = this.landmarker.detectForVideo(video, now);
        this.lastLandmarks = result?.landmarks?.[0] ?? null;
      } catch {
        this.lastLandmarks = null;
      }
      this.debug?.recordInference(performance.now() - startedAt);
    }
    if (this.lastLandmarks) {
      this.lastHandAt = now;
      this.consumeHand(this.lastLandmarks, now, video);
    } else if (now - this.lastHandAt > HAND_TIMEOUT) {
      this.releaseHand();
    }
    this.panel.drawHand(this.lastLandmarks, this.pinching);
  }
  consumeHand(landmarks, now, video) {
    return this.driver.consume(landmarks, now, video.videoWidth / video.videoHeight);
  }
  releaseHand() {
    this.lastLandmarks = null;
    this.driver.release();
  }
};
function shadowUi(shadowRoot) {
  let hovered = null;
  const setHover = (button) => {
    if (hovered === button) return;
    hovered?.classList.remove("hc-hover");
    button?.classList.add("hc-hover");
    hovered = button || null;
  };
  return {
    contains: (el) => Boolean(el && shadowRoot.contains(el)),
    // CSS :hover never fires for a synthetic cursor, so fake it.
    hover: (el) => setHover(el?.closest?.("button") || null),
    tap: (el) => {
      const button = el?.closest?.("button");
      if (button && !button.disabled) button.click();
    }
  };
}

// src/index.js
var VERSION = "1.0.0";
var current = null;
function init(options = {}) {
  current?.destroy();
  const urlDebug = typeof location !== "undefined" && location.href.includes("handcursor-debug");
  current = new HandCursorController(urlDebug ? { ...options, debug: true } : options);
  current.mount(options.container || document.body);
  return current;
}
function instance() {
  return current;
}
function destroy() {
  current?.destroy();
  current = null;
}
var BOOLEAN_KEYS = /* @__PURE__ */ new Set([
  "autoStart",
  "minimized",
  "grayscale",
  "font",
  "hideNativeCursor"
]);
var NUMBER_KEYS = /* @__PURE__ */ new Set(["margin", "zIndex", "numHands"]);
function optionsFromScript(script) {
  if (!script) return {};
  const options = {};
  for (const [key, rawValue] of Object.entries(script.dataset)) {
    if (key === "manual") continue;
    if (key === "model" || key === "vision" || key === "wasm") {
      options.cdn = { ...options.cdn, [key]: rawValue };
    } else if (BOOLEAN_KEYS.has(key)) {
      options[key] = rawValue !== "false";
    } else if (NUMBER_KEYS.has(key)) {
      const value = Number(rawValue);
      if (Number.isFinite(value)) options[key] = value;
    } else {
      options[key] = rawValue;
    }
  }
  return options;
}
function autoMount(script) {
  if (script?.dataset.manual !== void 0) return;
  const options = optionsFromScript(script);
  const run = () => {
    if (!current) init(options);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}
if (typeof document !== "undefined") {
  autoMount(document.currentScript);
}
var index_default = { init, instance, destroy, DEFAULTS, VERSION };
export {
  DEFAULTS,
  HandCursorController,
  VERSION,
  index_default as default,
  destroy,
  init,
  instance
};
