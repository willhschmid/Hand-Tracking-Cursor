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
   */
  pinch: { on: 0.42, off: 0.55 },
  /** A press shorter and tighter than this counts as a tap. */
  tap: { maxDuration: 500, maxTravel: 14 },
  /** Press-and-drag scrolling, with a touch-style fling on release. */
  drag: { threshold: 10, friction: 0.94, minVelocity: 0.4, maxVelocity: 60 },
  /** The playful bit: the arrow leans into the direction it travels. */
  rotation: {
    enabled: true,
    minSpeed: 0.35,
    smoothing: 0.2,
    idleDelay: 350,
    returnSmoothing: 0.08
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
  cornerButton: 24,
  iconSize: 16,
  ctaHeight: 32,
  ctaPadX: 12,
  ctaGap: 8,
  miniCta: 32
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
  justify-content: center;
  gap: ${SIZE.gap}px;
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
  gap: 0;
}

.hc-root[data-state="live"] .hc-panel {
  padding: 0;
  gap: 0;
  background: ${COLOR.black};
}

/* ---------------------------------------------------------------- stage -- */

.hc-stage {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hc-root[data-state="live"] .hc-stage,
.hc-root[data-mini="true"] .hc-stage {
  position: absolute;
  inset: 0;
  flex: none;
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

.hc-illo-svg { width: 100%; height: 100%; overflow: visible; }

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

.hc-root[data-state="live"] .hc-corner {
  color: ${COLOR.white};
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
}

.hc-root[data-state="live"] .hc-corner:hover,
.hc-root[data-state="live"] .hc-corner.hc-hover { background: rgba(255, 255, 255, 0.16); }

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

.hc-mini-cta svg { width: 18px; height: 18px; }
.hc-mini-cta:hover,
.hc-mini-cta.hc-hover { background: ${COLOR.darkGreen}; }
.hc-mini-cta:active { transform: scale(0.94); }

.hc-root[data-mini="true"] .hc-mini-cta { display: inline-flex; }

.hc-root[data-mini="true"][data-state="live"] .hc-mini-cta {
  background: ${COLOR.white};
  color: ${COLOR.iconDark};
}

.hc-root[data-mini="true"][data-state="live"] .hc-mini-cta:hover,
.hc-root[data-mini="true"][data-state="live"] .hc-mini-cta.hc-hover {
  background: ${COLOR.lightGray};
}

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
  width: var(--hc-cursor-w, 18px);
  aspect-ratio: 13 / 21;
  /* The arrow tip sits at the element's origin, so rotation and the tapped
     scale both pivot on the exact point being addressed. */
  transform-origin: 0 0;
  color: ${COLOR.black};
  opacity: 0;
  will-change: transform, opacity;
  transition: opacity 160ms linear;
}

.hc-cursor svg { width: 100%; height: 100%; overflow: visible; }

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
var svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
var CAMERA_BODY = '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.6 21 7v10l-5-3.6z"/>';
var ICONS = {
  videocam: svg(CAMERA_BODY),
  videocamOff: svg(`${CAMERA_BODY}<path d="M3.5 3.5 20.5 20.5"/>`),
  // Two corner brackets pulled in toward the middle. The 6-unit offset from the
  // centre line keeps them from merging into a plus sign at 16px.
  collapse: svg('<path d="M15 3v6h6"/><path d="M9 21v-6H3"/>'),
  // The same brackets pushed back out to the edges.
  expand: svg('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/>')
};
var ARROW_REST_ANGLE = -112;
var ARROW_SVG = '<svg viewBox="0 0 13 21" aria-hidden="true" focusable="false"><path d="M0 0 0 16.8 4.3 13 6.8 19.3 9.6 18.2 7.1 12 12 11.6Z" fill="currentColor" stroke="rgba(255,255,255,0.92)" stroke-width="1.1" stroke-linejoin="round" paint-order="stroke fill"/></svg>';
var ARROW_ASPECT = 21 / 13;

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
var PALM = [0, 5, 9, 13, 17];
var CANONICAL_HAND = [
  [0.5, 0.95],
  // 0  wrist
  [0.67, 0.87],
  // 1  thumb cmc
  [0.79, 0.75],
  // 2  thumb mcp
  [0.86, 0.64],
  // 3  thumb ip
  [0.91, 0.54],
  // 4  thumb tip
  [0.58, 0.53],
  // 5  index mcp
  [0.61, 0.37],
  // 6  index pip
  [0.62, 0.27],
  // 7  index dip
  [0.63, 0.17],
  // 8  index tip
  [0.47, 0.51],
  // 9  middle mcp
  [0.47, 0.33],
  // 10
  [0.47, 0.22],
  // 11
  [0.47, 0.12],
  // 12 middle tip
  [0.36, 0.53],
  // 13 ring mcp
  [0.33, 0.36],
  // 14
  [0.32, 0.25],
  // 15
  [0.31, 0.16],
  // 16 ring tip
  [0.26, 0.58],
  // 17 pinky mcp
  [0.21, 0.45],
  // 18
  [0.19, 0.36],
  // 19
  [0.17, 0.28]
  // 20 pinky tip
].map(([x, y]) => ({ x, y }));
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
function handIllustration() {
  const S = 100;
  const pt = (i) => CANONICAL_HAND[i];
  const at = (i) => `${(pt(i).x * S).toFixed(2)} ${(pt(i).y * S).toFixed(2)}`;
  const bones = CONNECTIONS.map(([a, b]) => `M${at(a)}L${at(b)}`).join("");
  const palm = `M${PALM.map(at).join("L")}Z`;
  const tips = [4, 8, 12, 16, 20].map((i) => `<circle cx="${(pt(i).x * S).toFixed(2)}" cy="${(pt(i).y * S).toFixed(2)}" r="6"/>`).join("");
  const joints = CANONICAL_HAND.map(
    (p) => `<rect x="${(p.x * S - 1.6).toFixed(2)}" y="${(p.y * S - 1.6).toFixed(2)}" width="3.2" height="3.2"/>`
  ).join("");
  const skin = "#E4E4E4";
  return `<svg class="hc-illo-svg" viewBox="0 0 ${S} ${S}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><g fill="${skin}"><path d="${palm}"/>${tips}<path d="${bones}" fill="none" stroke="${skin}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></g><path d="${bones}" fill="none" stroke="${COLOR.purple}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M${at(INDEX_TIP)}L${at(THUMB_TIP)}" fill="none" stroke="${COLOR.green}" stroke-width="1.4" stroke-dasharray="3 3" stroke-linecap="round"/><g fill="${COLOR.purple}">${joints}</g></svg>`;
}

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
          <div class="hc-illo">${handIllustration()}</div>
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
var shortestDelta = (from, to) => ((to - from) % 360 + 540) % 360 - 180;
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
      const speed = Math.hypot(vx, vy);
      if (speed >= rotation.minSpeed) {
        this.lastMoveAt = now;
        const heading = Math.atan2(vy, vx) * 180 / Math.PI;
        const target = heading - ARROW_REST_ANGLE;
        this.angle += shortestDelta(this.angle, target) * rotation.smoothing;
      } else if (now - this.lastMoveAt > rotation.idleDelay) {
        this.angle += shortestDelta(this.angle, 0) * rotation.returnSmoothing;
      }
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
    this.emit("move", { x: smoothed.x, y: smoothed.y, pinching: this.pinching });
    return { x: smoothed.x, y: smoothed.y, pinching: this.pinching };
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
export {
  DEFAULTS,
  HandCursorController,
  VERSION,
  index_default as default,
  destroy,
  init,
  instance
};
