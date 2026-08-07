# Hand Tracking Cursor

A hand tracking cursor you can drop onto any website with one `<script>` tag.

Point at the screen to move the cursor. Touch your index finger to your thumb to
click. Hold the pinch and drag to scroll. Everything runs on-device through
[MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) —
the camera stream never leaves the browser.

```html
<script src="https://cdn.jsdelivr.net/gh/willhschmid/Hand-Tracking-Cursor@main/dist/hand-cursor.min.js"></script>
```

That is the whole integration. The trackpad card appears in the bottom-left
corner, asks for the camera, and takes over from there.

---

## Contents

- [Install](#install)
- [Gestures](#gestures)
- [Options](#options)
- [JavaScript API](#javascript-api)
- [Events](#events)
- [How it works](#how-it-works)
- [Design system](#design-system)
- [Self-hosting the MediaPipe assets](#self-hosting-the-mediapipe-assets)
- [Browser support](#browser-support)
- [Privacy](#privacy)
- [Development](#development)

---

## Install

### Script tag

```html
<script src="/path/to/hand-cursor.min.js"></script>
```

The script mounts itself on load. Configure it right on the tag:

```html
<script
  src="/path/to/hand-cursor.min.js"
  data-position="bottom-right"
  data-margin="24"
  data-minimized="true"
></script>
```

Add `data-manual` to skip the automatic mount and call `HandCursor.init()`
yourself.

### Adding it to a site you already have

Drop the tag in before `</body>` and you are done — there is no init code, no
CSS to include and no markup to add. Two things to check on a real site:

**Serve over HTTPS.** Cameras are blocked on plain `http://`. The trackpad says
so explicitly rather than failing silently.

**Content Security Policy.** If your site sends one, the MediaPipe runtime and
model need to be allowed through:

```
script-src  'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval';
connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com;
worker-src  'self' blob:;
```

Host the assets yourself (see below) and those all collapse back to `'self'`.

One caveat on hover: the `:hover` mirroring reads your stylesheets, which works
for any CSS served from your own origin. Stylesheets on a third-party CDN
without CORS headers cannot be read, so their hover rules will not respond.

### npm

```bash
npm install hand-tracking-cursor
```

```js
import HandCursor from 'hand-tracking-cursor';

HandCursor.init({ position: 'bottom-left' });
```

Module builds never auto-mount — call `init()` when you are ready.

---

## Gestures

| Gesture | What happens |
| --- | --- |
| Open hand, move around | The cursor tracks across the viewport and leans up to 22° into its direction of travel |
| Index finger meets thumb | Click. The skeleton turns green and the cursor scales down while held |
| Pinch and drag up / down | Scrolls whatever is under the cursor — the page, or a single scrollable element — and flings on release |
| Hand leaves frame | The cursor fades out and any press is cancelled |
| <kbd>Esc</kbd> | Turns the camera off |

Taps dispatch a full `pointerdown` → `mousedown` → `pointerup` → `mouseup` →
`click` sequence with real coordinates, and move focus, so buttons, links, form
controls and framework event handlers all behave normally.

### Hover

CSS `:hover` is owned by the browser and only ever follows the real pointer, so
a synthetic cursor cannot trigger it — which would leave a page whose
affordances are pure CSS feeling completely dead.

The library works around this: on start it reads the page's own stylesheets and
mirrors every `x:hover` rule as `x[data-hc-hover]`, then sets that attribute on
the hovered element and its ancestors. Specificity is unchanged, so your styles
behave exactly as written. Stylesheets from another origin cannot be read
without CORS headers and are skipped — you will see a console note naming how
many. Your own site's CSS is always readable. Turn it off with
`emulateHover: false`.

JavaScript hover listeners need none of this: `pointerover` / `mouseover` /
`mousemove` are dispatched as the cursor travels.

---

## Options

Every value below is a default; pass any subset to `init()`.

```js
HandCursor.init({
  position: 'bottom-left',   // bottom-left | bottom-right | top-left | top-right
  margin: 16,                // distance from the viewport edges, px
  autoStart: false,          // request the camera immediately
  minimized: false,          // start as the 106x106 card
  grayscale: true,           // desaturate the preview
  font: true,                // load Inter if the page does not already have it
  hideNativeCursor: false,   // hide the OS pointer while tracking
  emulateHover: true,        // mirror the page's CSS :hover rules (see above)
  zIndex: 2147483000,
  numHands: 1,
  container: document.body,  // where the overlay is mounted

  camera: { width: 640, height: 480, frameRate: 30 },

  // Slice of the camera frame mapped onto the viewport. 0.15 leaves the outer
  // 15% as dead space so the screen corners stay reachable.
  region: { x: 0.15, y: 0.15 },

  // 1€ filter. Raise minCutoff for a snappier cursor, lower it for a calmer one.
  smoothing: { minCutoff: 1.4, beta: 0.015, dCutoff: 1.0 },

  // Pinch distance as a fraction of hand size, with hysteresis. Fractions
  // rather than millimetres, so it works at any distance from the camera.
  // The landmarks sit at the centre of each fingertip, so even with the pads
  // touching the ratio bottoms out near 0.15 — there is not much room below
  // this. `handcursor:move` reports the live ratio so you can measure yours.
  pinch: { on: 0.22, off: 0.32 },

  // A press shorter and tighter than this is a tap. Both are generous next to a
  // touchscreen: a pinch held in mid-air always drifts.
  tap: { maxDuration: 800, maxTravel: 32 },

  // What keeps a tap from becoming a scroll: the pinch must travel a real
  // distance *and* be held past the moment of pinching before anything scrolls.
  drag: {
    threshold: 34,           // px of travel before a scroll starts
    holdDelay: 140,          // ms the pinch must be held first
    friction: 0.94,
    minVelocity: 0.4,
    maxVelocity: 60,
  },

  rotation: {
    enabled: true,
    maxAngle: 22,            // degrees; the arrow sways, it never spins
    gain: 1.8,               // degrees per px/frame of horizontal speed
    minSpeed: 0.6,           // px/frame deadzone
    smoothing: 0.12,
  },

  cursor: { scale: 1, pressScale: 0.85 },

  cdn: { vision: '…', wasm: '…', model: '…' },
  delegate: 'GPU',           // falls back to CPU automatically

  strings: { /* every string in the UI — see src/config.js */ },
});
```

Rotation is skipped automatically when the visitor has
`prefers-reduced-motion: reduce` set.

### Script-tag equivalents

Top-level options map to `data-` attributes: `data-position`, `data-margin`,
`data-minimized`, `data-grayscale`, `data-auto-start`, `data-font`,
`data-hide-native-cursor`, `data-emulate-hover`, `data-z-index`, `data-num-hands`, plus
`data-vision`, `data-wasm` and `data-model` for the MediaPipe assets. Booleans
are true unless the value is exactly `"false"`.

---

## JavaScript API

```js
const cursor = HandCursor.init(options);

cursor.start();            // request the camera and begin tracking
cursor.stop();             // release the camera, return to the idle card
cursor.setMinimized(true); // collapse to the 106x106 card
cursor.destroy();          // remove everything from the page

HandCursor.instance();     // the live instance, or null
HandCursor.destroy();
HandCursor.VERSION;
```

`start()` must be called from a user gesture in most browsers — that is what the
**Enable Camera** button is for.

---

## Events

All events fire on `document` and carry the instance in `detail.instance`.

| Event | `detail` |
| --- | --- |
| `handcursor:start` | — |
| `handcursor:stop` | — |
| `handcursor:move` | `x`, `y`, `pinching`, `ratio` |
| `handcursor:press` | `x`, `y` |
| `handcursor:release` | `x`, `y` |
| `handcursor:tap` | `x`, `y`, `target`, `internal` |
| `handcursor:minimize` / `handcursor:expand` | — |
| `handcursor:error` | `error`, `message` |

```js
document.addEventListener('handcursor:tap', (event) => {
  console.log('tapped', event.detail.target);
});
```

`handcursor:move` fires every tracked frame — keep its listeners cheap. Its
`ratio` is the live pinch measurement, which is the practical way to tune
`pinch.on` to a particular hand: hold your fingers where you want a click to
register, watch the number, and set the threshold just above it. The test page
does exactly that in its HUD.

---

## How it works

1. **Tracking.** MediaPipe's `HandLandmarker` runs on the video stream in
   `VIDEO` mode and returns 21 landmarks per frame.
2. **Control point.** The cursor follows the midpoint between the thumb tip and
   the index tip. Both tips move toward each other during a pinch, so their
   midpoint stays put and the cursor does not jump at the moment of the click.
3. **Mapping.** Coordinates are mirrored, then the middle 70% of the frame is
   stretched across the viewport so the corners stay reachable without the hand
   leaving frame.
4. **Smoothing.** A [1€ filter](https://gery.casiez.net/1euro/) removes jitter
   while the hand is still without adding lag while it moves.
5. **Sway.** The arrow leans by horizontal *speed*, not by the direction of the
   velocity vector. Pointing it along `atan2(vy, vx)` is the obvious approach
   and is unusable: the direction of a near-zero vector is noise, so a hand
   holding still whips the cursor through every angle.
6. **Pinch.** Thumb-to-index distance is measured as a fraction of hand size, so
   it works at any distance from the camera. Separate on/off thresholds stop a
   hovering hand from chattering.
7. **Interaction.** A short, tight pinch is a tap; a pinch that travels becomes a
   scroll on the nearest scrollable ancestor, with exponential-decay momentum on
   release.

The whole UI lives in a shadow root, so host page CSS cannot reach it and its
styles cannot leak out.

---

## Design system

Built to the *Hand Tracking Cursor Design System* (August 2026). Tokens live in
[`src/tokens.js`](src/tokens.js).

| | |
| --- | --- |
| Typeface | Inter, Regular (400) and Medium (500), 12px / 16px |
| Green | `#00CA48` — primary actions, active states, the pinched skeleton |
| Dark green | `#008630` — hover |
| Purple | `#FB79FF` — the hand skeleton |
| Red | `#FF4040` — errors |
| Light gray | `#F6F6F6` — card surface |
| Icon dark | `#1C1B1F` — icon strokes |
| Radius | 4px controls, 8px buttons, 12px cards |
| Trackpad | 260 × 200, 12px padding, 4px corner insets |
| Minimized | 106 × 106; the green camera button appears only before the camera is on |
| Illustration | 66 × 98 on the pre-enabled card |
| Icons | 24 × 24 Material Symbols in `#1C1B1F`, in 32 × 32 buttons |
| Live preview | Camera at 15% opacity over the `#F6F6F6` card, so icons stay legible |

Icons are the supplied Material Symbols assets (`videocam`, `videocam_off`,
`collapse_content`, `expand_content`), inlined in `src/icons.js` and drawn in
`currentColor`. The cursor arrow is the supplied 32 × 32 SVG, with its viewBox
retargeted so the arrow's point sits exactly at the element origin — position,
rotation and the tapped scale all pivot there, so the tip stays pinned to the
coordinate being addressed.

The hand on the pre-enabled card is `assets/hand-graphic.png`, inlined as a data
URI so the library stays a single file with no external requests. The bytes are
copied verbatim — base64 is an encoding, not a compression, so what renders is
exactly the source file. Re-run `node scripts/embed-illustration.mjs` after
changing the artwork.

That artwork is most of the bundle: ~100kB minified, ~63kB gzipped, against
~10kB for the code. Do not be tempted to quantize it — the soft grey gradients
band under a reduced palette and read as pixelation at card size, however clean
the side-by-side looks at full resolution. If you need the bundle small, host
the PNG yourself and swap the `<img>` source rather than degrading it.

One measurement note: a 98px illustration, two lines of copy and a 32px button
cannot sit inside a 200px card with 12px gaps. The outer padding is held at 12px
and the two internal gaps settle at 7px each. Growing the card to 210px would
restore the 12px rhythm.

---

## Self-hosting the MediaPipe assets

By default the WASM runtime comes from jsDelivr and the model from Google's
storage bucket. To keep everything on your own origin:

```bash
npm install @mediapipe/tasks-vision
cp -r node_modules/@mediapipe/tasks-vision/wasm public/mediapipe/wasm
cp node_modules/@mediapipe/tasks-vision/vision_bundle.mjs public/mediapipe/
curl -o public/mediapipe/hand_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
```

```js
HandCursor.init({
  cdn: {
    vision: '/mediapipe/vision_bundle.mjs',
    wasm: '/mediapipe/wasm',
    model: '/mediapipe/hand_landmarker.task',
  },
});
```

Serve `.wasm` as `application/wasm`. A `Content-Security-Policy` will need
`script-src` and `connect-src` entries for wherever those files live, plus
`wasm-unsafe-eval`.

---

## Browser support

Chrome / Edge 100+, Firefox 100+, Safari 15.4+ — anything with WebAssembly SIMD,
`getUserMedia` and shadow DOM. The model runs on the GPU through WebGL and falls
back to CPU automatically.

The camera needs a secure context: `https://`, or `http://localhost` during
development. The trackpad says so explicitly if it is loaded over plain HTTP.

---

## Privacy

Frames go from the camera to a WASM model in the same tab and nowhere else.
Nothing is uploaded, recorded or stored. The only network requests the library
makes are for the MediaPipe runtime and model (both cacheable and self-hostable)
and, if `font` is left on, the Inter webfont. Stopping the trackpad stops every
media track, which turns the camera indicator light off.

---

## Development

```bash
npm install
npm run dev        # build, then serve the test page at http://localhost:8080/demo/
npm run watch      # rebuild on change
npm test           # browser tests (npx playwright install chromium first)
```

`npm run dev` serves over `http://localhost`, which counts as a secure context,
so the camera works locally.

### The test page

`demo/` is a working bench rather than a showcase. It has buttons at three
sizes, a twelve-target precision grid, CSS-only hover cards, panels that scroll
independently of the page, a nested scroller, a horizontal strip, form controls,
in-page links, thirty numbered bands to fling past, a live event log, and a HUD
showing cursor position, pinch state, frame rate and what is under the cursor.

The calibration section changes the running instance as you drag, and prints the
matching `HandCursor.init()` snippet — tune it there, then paste the result into
your own site.

The tests feed synthetic landmarks straight into the controller, so they cover
everything downstream of the model — coordinate mapping, smoothing, pinch
detection, taps, drag-scrolling, momentum, the skeleton colours and the panel's
measurements — without needing a camera. Set `CHROMIUM_PATH` to reuse a browser
you already have.

```
src/
  index.js        public API, script-tag config, auto-mount
  controller.js   camera, model and the per-frame loop
  panel.js        the trackpad card and its states
  cursor.js       the arrow: rotation and press scaling
  driver.js       landmarks in, page interaction out (shared entry point)
  pointer.js      taps, drag-scrolling and momentum
  hover.js        CSS :hover emulation
  hand-graphic.js generated — see scripts/embed-illustration.mjs
  hand-model.js   MediaPipe loading and camera access
  landmarks.js    hand topology, pinch and control-point math
  skeleton.js     canvas overlay and the static illustration
  one-euro.js     the smoothing filter
  styles.js       shadow-root CSS
  tokens.js       design tokens
  icons.js        inline icons and the cursor arrow
```

---

## License

MIT
