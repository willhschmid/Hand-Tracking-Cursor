/*! hand-tracking-cursor v1.0.0 | MIT | https://github.com/willhschmid/Hand-Tracking-Cursor */
var HandCursor = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    DEFAULTS: () => DEFAULTS,
    HandCursorController: () => HandCursorController,
    VERSION: () => VERSION,
    default: () => index_default,
    destroy: () => destroy,
    init: () => init,
    instance: () => instance
  });

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
      friction: 0.94,
      minVelocity: 0.4,
      maxVelocity: 60
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
    control: 4,
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
  border-radius: ${RADIUS.card}px;
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
  border-radius: ${RADIUS.control}px;
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
  border-radius: ${RADIUS.card}px;
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

  // src/pointer.js
  var SCROLLABLE = /(auto|scroll|overlay)/;
  var FOCUSABLE = "a[href], button, input, select, textarea, summary, [tabindex]";
  function deepElementFromPoint(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el?.shadowRoot) {
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  }
  function scrollTargetFor(el) {
    let node = el;
    while (node && node !== document.documentElement && node !== document.body) {
      if (node.nodeType === 1) {
        const style = getComputedStyle(node);
        const canY = SCROLLABLE.test(style.overflowY) && node.scrollHeight - node.clientHeight > 1;
        const canX = SCROLLABLE.test(style.overflowX) && node.scrollWidth - node.clientWidth > 1;
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
  function scrollBy({ node, canX, canY }, dx, dy) {
    const top = node.scrollTop - (canY ? dy : 0);
    const left = node.scrollLeft - (canX ? dx : 0);
    try {
      node.scrollTo({ top, left, behavior: "instant" });
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
  var TouchEmulator = class {
    /**
     * @param {object} options    resolved config
     * @param {object} hooks
     * @param {OwnUi} [hooks.ui]  the trackpad's own chrome
     * @param {Function} [hooks.onTap]
     */
    constructor(options, { ui, onTap, hover } = {}) {
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
      this.momentumFrame = null;
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
      this.stopMomentum();
      const { el, internal } = this.resolve(x, y);
      this.pressing = true;
      this.dragging = false;
      this.origin = { x, y, t: now, el, internal };
      this.last = { x, y };
      this.velocity = { x: 0, y: 0 };
      this.scrollTarget = internal || !el ? null : scrollTargetFor(el);
    }
    /** Cursor moved while the pinch is held. */
    drag(x, y, now) {
      if (!this.pressing) return;
      const dx = x - this.last.x;
      const dy = y - this.last.y;
      this.last = { x, y };
      this.velocity.x = this.velocity.x * 0.7 + dx * 0.3;
      this.velocity.y = this.velocity.y * 0.7 + dy * 0.3;
      if (!this.dragging) {
        const { threshold, holdDelay } = this.options.drag;
        if (now - this.origin.t < holdDelay) return;
        const travel = Math.hypot(x - this.origin.x, y - this.origin.y);
        if (travel < threshold) return;
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
        this.ui.tap(el, x, y);
        this.onTap?.({ x, y, target: el, internal: true });
        return;
      }
      firePointer(el, "pointerdown", x, y, { buttons: 1, button: 0 });
      fireMouse(el, "mousedown", x, y, { buttons: 1, button: 0 });
      const focusTarget = el.closest?.(FOCUSABLE);
      if (focusTarget) {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch {
        }
      } else if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur?.();
      }
      firePointer(el, "pointerup", x, y, { buttons: 0, button: 0 });
      fireMouse(el, "mouseup", x, y, { buttons: 0, button: 0 });
      fireMouse(el, "click", x, y, { buttons: 0, button: 0, detail: 1 });
      this.onTap?.({ x, y, target: el, internal: false });
    }
    startMomentum() {
      const { friction, minVelocity, maxVelocity } = this.options.drag;
      const clamp2 = (v) => Math.max(-maxVelocity, Math.min(maxVelocity, v));
      let vx = clamp2(this.velocity.x);
      let vy = clamp2(this.velocity.y);
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
    constructor(options, { ui, onEvent } = {}) {
      this.options = options;
      this.onEvent = onEvent;
      this.cursor = new Cursor(options);
      this.hoverStyles = options.emulateHover ? new HoverEmulator() : null;
      this.touch = new TouchEmulator(options, {
        ui,
        hover: this.hoverStyles,
        onTap: (detail) => this.emit("tap", detail)
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
      this.driver = new CursorDriver(this.options, {
        ui: shadowUi(this.shadow),
        onEvent: (type, detail) => this.emit(type, detail)
      });
      this.driver.mount(this.panel.root);
      this.running = false;
      this.starting = false;
      this.destroyed = false;
      this.stream = null;
      this.landmarker = null;
      this.frame = null;
      this.lastVideoTime = -1;
      this.lastHandAt = 0;
      this.lastLandmarks = null;
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
      if (video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = video.currentTime;
        try {
          const result = this.landmarker.detectForVideo(video, now);
          this.lastLandmarks = result?.landmarks?.[0] ?? null;
        } catch {
          this.lastLandmarks = null;
        }
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
    current = new HandCursorController(options);
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
  return __toCommonJS(index_exports);
})();
