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
- [Dragging elements](#dragging-elements)
- [Options](#options)
- [JavaScript API](#javascript-api)
- [Events](#events)
- [How it works](#how-it-works)
- [Diagnosing jank](#diagnosing-jank)
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

**`scroll-behavior: smooth`.** Handled, and worth knowing about. That CSS rule
turns *every* programmatic scroll into an animation, so driving one sixty times
a second means sixty animations each interrupting the last, and the page barely
moves. `behavior: 'instant'` is meant to opt out but is not honoured everywhere
— notably on iOS, where every browser is WebKit underneath. The scroll runner
therefore forces `scroll-behavior: auto` with an inline style while it drives,
and puts your value back when the gesture ends, so anchor links keep animating.

**Smooth-scroll libraries.** Lenis, Locomotive and friends are fine. In their
default native-scroll mode they observe the scroll position rather than owning
it, so they simply follow along; the test suite runs its scroll checks against
a real Lenis instance to keep it that way. If a library is configured to
transform a wrapper instead of scrolling natively, it will not see these
scrolls — point `drag.follow` at `1` and drive the library from
`handcursor:move` yourself.

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
| Pinch and drag on something draggable | Picks it up and carries it — see [Dragging elements](#dragging-elements) |
| Pinch and drag anywhere else | Scrolls whatever is under the cursor — the page, or a single scrollable element — and flings on release |
| Hand leaves frame | The cursor fades out and any press is cancelled |
| <kbd>Esc</kbd> | Turns the camera off |

Taps dispatch a full `pointerdown` → `mousedown` → `pointerup` → `mouseup` →
`click` sequence with real coordinates, and move focus, so buttons, links, form
controls and framework event handlers all behave normally.

### The tab, and putting the card away

The tab is a part of the card rather than a state of it. It hangs off the side —
24 wide, level with the card's bottom, flat where it meets the card and carrying
the card's 12px radius on the other three corners — and it is there whether the
card is out or away. It holds a chevron lying the way the card does, and once
the camera is on, a green dot above it: the tab grows from 64 to 80 tall to make
room.

Putting the trackpad away slides the card and its tab sideways, far enough to
take the card off the screen — the width of the card plus the margin it sits at,
276px at the defaults — which leaves the tab, the part that hangs past the
card's edge, against the edge of the screen. 400ms on easeInOutQuart. One
transform on one wrapper, so nothing inside lays out again on the way: measured
every frame across a slide, the card stays 260x200, its padding stays 12, the
paragraph stays 236 wide at its original height and the illustration does not
move.

That is the whole reason for sliding rather than resizing. A card that animated
from 260 wide to 24 re-wrapped its copy line by line on the way down — 236px
and two lines to 45px and twelve — squeezed the button beside it, snapped its
padding to zero on the first frame while the box was still full size, and ended
as a 24x64 hole over a 66x98 illustration with a quarter of it showing. Every
one of those needed its own correction, and each correction had to be timed
against the resize to the millisecond. Sliding needs none of them.

The fillet at the top of the tab is a 6x6 square with a quarter circle taken
out, in the card's own colour, sitting in the right angle where the tab meets
the card's side. It turns the step into a curve running out of one and into the
other, so the two boxes read as one shape.

The card carries a shadow and no border. There was a `rgba(0, 0, 0, 0.08)`
hairline around it, which also turned out to be the only reason the two shadows
below needed clipping where they met: both shades drew it, and the pixel where
they crossed at the shared corner got it twice. With the hairline gone the seam
measures flat.

The shadow is cast from a pair of empty elements underneath both surfaces rather
than from the card and the tab themselves, and it has to be that way round.
Given to them directly, each one's shadow lands on the other's face — the tab
draws a soft dark band down the card where they meet, and the seam the fillet
exists to hide comes straight back as a shadow. Cast from underneath, every
shadow falling inside the silhouette is covered by the surface above it and only
the part that reaches the page is ever seen. The card's shade is clipped flat on
the side the tab is on, on the card's own timing: the card stops with that edge
on zero, so anything it cast past that edge would land back on the screen as a
24px smudge running down the edge of the page, next to a tab that is meant to be
the only thing left.

The camera preview fades into the card over its last 24px — the width of the
tab, which is where the spec's 90.43% comes from. The preview runs to the edge
of the card and the tab carries on out of it in flat #F6F6F6, so without the
fade the video stops dead against the tab and cuts the shape in two. The fade
sits above the skeleton as well as the video: a bone crossing the last 24px
should go with the picture rather than sit sharp on top of a fade.

The preview itself is never hidden, whatever the card is doing. It is the frame
source the model reads every tick, and tracking has to keep running while the
card is away — which is most of the time it is being used. What does get hidden,
once the slide has finished, is everything in the card the keyboard could still
reach out there.

The tab is the only size control there is, in both directions: it puts the card
away and it brings it back. The corner button that used to duplicate it inside
the card is gone. Turning the camera off is still the card's own control, or
<kbd>Esc</kbd>, which works either way.

All of it follows `position`. Anchoring the trackpad right hangs the tab off the
card's left, turns the fillet, the rounding, the chevron and the preview's fade
around with it, and slides the card off the other side of the screen.

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

## Dragging elements

A pinch-drag that starts on something draggable carries it instead of scrolling
the page underneath it. Nothing needs adding to the page for the common cases.

There is no single way a page says "this can be dragged", so three are looked
for, in this order:

| Signal | Covers |
| --- | --- |
| `draggable="true"` | HTML5 drag and drop |
| `cursor: grab` / `move` / `col-resize` and friends | Anything that tells the user it moves |
| `touch-action: none` | Drag libraries, which set it so the browser does not scroll while they drag |
| `grab.selector` | Whatever the other three miss |

The CSS signals are read a little carefully, because both of them can be true of
things that are not handles. `cursor` is inherited, so what counts is the
element the value came *from* — which is also what makes grabbing a card by its
label carry the card — and a value originating on `body` is a page-wide style
rather than an offer. And an element that scrolls is never claimed on CSS
evidence alone: `touch-action: none` on a scroll container is far more likely to
be a tweak to how it scrolls than an invitation to drag it, and getting that
wrong costs the page a scrollable region. `draggable` and `grab.selector` are
checked first and always win.

The pointer events sent are the same ones a touchscreen produces —
`pointerdown`, a stream of `pointermove`, `pointerup`, each with its mouse-event
twin — so a library that already works on a phone works here without knowing
anything about hand tracking. dnd-kit, Sortable, interact.js and hand-rolled
`mousedown` handlers all fall into this group.

`draggable="true"` is different: the browser only produces the HTML5 sequence
for real drags, so it is synthesized separately —  `dragstart`, `dragenter` /
`dragover` / `dragleave` as the cursor crosses targets, then `drop` and
`dragend`. A zone accepts the drop the normal way, by cancelling `dragover`; if
nothing accepts it, `dragend` fires without a `drop`, exactly as a mouse drag
would behave.

The press lands the moment the pinch closes, not when the drag is recognised —
the same as a mouse button. A library shows its held state straight away, and
the element follows from the first pixel rather than sitting still through
`drag.threshold` and then jumping to catch up.

What the threshold still decides is whether the gesture ends as a click or a
drag, which is settled on release, and when the HTML5 sequence opens — because
`mousedown` alone never starts a drag and drop in a browser either. So a pinch
and release without moving is a click on the card, exactly as it is with a
mouse.

Hover stays on for the whole drag, as it does under a mouse: the cursor has not
left the element, it is carrying it. Dropping it partway through fires
`mouseleave` and strips the mirrored hover styles from the element *and* its
ancestors, so a card with any hover state at all — a lift, a shadow, a colour —
visibly snaps out of it a beat after the pinch.

### Clicking something that can also be dragged

A button that doubles as a drag handle is the hard case, and **how long the
pinch lasted is the only thing that separates the two**. Released inside
`grab.tapDuration` it is a click; held past it, a drag.

Distance is deliberately not consulted. It cannot be: the element is picked up
the instant the pinch closes and follows the hand from there, so *every* press
moves it a little, and a pinch held in mid-air drifts further than a finger on
glass ever does. Judging a tap by how far it travelled meant a deliberate press
on something draggable kept being read as a drag.

The one thing still checked is that the press and the release belong to the same
element — letting go somewhere else is not a click, the same rule a browser
applies to a mouse.

`grab.tapDuration` measures from the pinch closing past `pinch.on` to it opening
past `pinch.off`, not the gesture you think you are making. That band is
deliberately wide so a hovering hand does not chatter, and the fingers have to
travel back out through all of it before the release registers — so the number
on the clock runs a little longer than the tap feels.

Do not guess at it. Put `handcursor-debug` in the URL, press the thing a few
times, and read the `gesture` row: it reports the duration, the travel and the
verdict for the last press. If deliberate presses are showing up as `drag`, that
row says by how much.

### Why the click arrives a moment late

Drag libraries suppress the click that follows a drag — otherwise dragging a
card would also open it. They decide "this was a drag" from a movement
threshold measured in a pixel or two, which a mouse clears easily and a hand
holding a pinch in mid-air never does. So *every* press looks like a drag to
them, and the click they swallow is the one that was meant to work.

They swallow it on a short timer, because with a mouse the click follows the
release in the same tick. GSAP's Draggable, read from its source and then
measured: anything over **2px** of travel is a drag, and any click inside
**50ms** of that drag ending is stopped dead. A press drifting 3px was enough to
lose it; 0px was the only case that worked.

Ours is not a mouse click and does not have to arrive in that tick, so it waits
`grab.clickDelay` — 80ms — and lands after the suppression window has passed.
On a gesture that already took half a second, the wait is not visible. The test
suite loads a real GSAP Draggable and checks both halves: a press reaches the
click handler, and a drag moves the card without clicking it.

### Why isn't my element draggable?

Ask directly:

```js
HandCursor.instance().grabbableFrom(document.querySelector('.card'));
// → { node: div.card, html5: false }   or   null
```

If it comes back `null` for something a library does make draggable, name it:

```js
HandCursor.init({ grab: { selector: '.card, [data-rbd-drag-handle-draggable-id]' } });
```

### A scrolling list of draggable cards

These two wants conflict, and the conflict is real rather than a bug: a
pinch-drag starting on a card either moves the card or scrolls the list, and it
cannot do both. By default the card wins, which is what a mouse does.

If the list needs to scroll by hand as well, require a hold:

```js
HandCursor.init({ grab: { holdDelay: 300 } });
```

Then a quick pinch-drag scrolls and only a held one picks a card up — the same
way a touchscreen settles it. Whichever starts first keeps the gesture.

### What this cannot do

Synthesized events are untrusted, and two things on the web only respond to real
ones. Browser chrome is the first: an iOS URL bar will not collapse for a
synthetic scroll. UA-implemented widget internals are the second, so the thumb
of a native `<input type="range">` will not move — a slider a page draws itself
will.

Dragging past the edge of the viewport does not auto-scroll the page, so a drop
target has to be on screen when you start.

### Events

```js
document.addEventListener('handcursor:grab', (e) => e.detail.target);
document.addEventListener('handcursor:drop', (e) => e.detail.dropped);
```

---

## Options

Every value below is a default; pass any subset to `init()`.

```js
HandCursor.init({
  position: 'bottom-left',   // bottom-left | bottom-right | top-left | top-right
  margin: 16,                // distance from the viewport edges, px
  autoStart: false,          // request the camera immediately
  minimized: false,          // start with the card slid off, tab only
  grayscale: true,           // desaturate the preview
  font: true,                // load Inter if the page does not already have it
  hideNativeCursor: false,   // hide the OS pointer while tracking
  emulateHover: true,        // mirror the page's CSS :hover rules (see above)
  zIndex: 2147483000,
  numHands: 1,
  container: document.body,  // where the overlay is mounted
  debug: false,              // on-screen diagnostics; see Diagnosing jank
  maxTrackingFps: 0,         // 0 = the camera's rate. Lower frees the main thread

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
    holdEscape: 70,          // px of travel that skips holdDelay outright
    mode: 'write',           // 'write' | 'native' | 'hybrid' — see Diagnosing jank
    retargetMs: 70,          // native mode: how often it re-aims at the hand
    flingScale: 1,           // multiplies how far a throw coasts
    follow: 0.22,            // set to 1 to turn the resampling below off
    resample: 1.35,          // lag behind the hand, in landmark intervals
    resampleMin: 24,         // ms
    resampleMax: 90,         // ms
    velocityWindow: 120,     // ms of history a release reads its speed from
    friction: 0.967,         // fling decay, per 60fps frame, applied over real time
    minVelocity: 24,         // px/s — below this a fling stops
    maxVelocity: 3600,       // px/s
  },

  // Picking an element up rather than scrolling the page under it.
  grab: {
    enabled: true,
    selector: '[data-hc-grab]',   // extra handles a library does not advertise
    tapDuration: 300,             // ms a pinch can last and still count as a tap
    clickDelay: 80,               // ms to wait after release before the click
    cursors: ['grab', 'move', …], // computed cursors that mean "this moves"
    touchAction: true,            // treat touch-action:none as a handle
    html5: true,                  // synthesize dragstart/dragover/drop too
    holdDelay: 0,                 // ms to hold before grabbing; see above
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
cursor.setMinimized(true); // slide the card off, leaving the tab
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
| `handcursor:grab` | `x`, `y`, `target` — an element has been picked up |
| `handcursor:drop` | `x`, `y`, `target`, `dropped` — and put down again |
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
5. **Scrolling.** Landmarks arrive as fast as the model manages, which on a
   phone can be 15-20fps against a 60Hz display. Applying each frame's delta on
   arrival makes the page jump and then stall for two repaints — a staircase
   that reads as skipping. The tracker only states where the page *should* be;
   a separate display-rate loop eases toward it, at the cost of ~50ms of lag.
   The same loop runs the release fling, so the two never fight over the scroll
   position.
6. **Sway.** The arrow leans by horizontal *speed*, not by the direction of the
   velocity vector. Pointing it along `atan2(vy, vx)` is the obvious approach
   and is unusable: the direction of a near-zero vector is noise, so a hand
   holding still whips the cursor through every angle.
7. **Pinch.** Thumb-to-index distance is measured as a fraction of hand size, so
   it works at any distance from the camera. Separate on/off thresholds stop a
   hovering hand from chattering.
8. **Interaction.** A short, tight pinch is a tap; a pinch that travels becomes a
   scroll on the nearest scrollable ancestor, with exponential-decay momentum on
   release.

The whole UI lives in a shadow root, so host page CSS cannot reach it and its
styles cannot leak out.

---

## Diagnosing jank

Scroll or cursor stutter has two causes that feel identical and need opposite
fixes. Put `handcursor-debug` anywhere in the page URL — no console needed,
which matters on a phone — and a panel appears in the top left:

| Row | Means |
| --- | --- |
| `paint` | repaints per second: the rate the screen can actually update |
| `track` | landmark frames per second |
| `model` | milliseconds per inference, mean / worst |
| `frame` | milliseconds between repaints, median / 95th |
| `worst` | longest gap between repaints |
| `blocked` | share of repaints later than 32ms — turns yellow above 20% |
| `scroll` | scroll writes per second, and the mean step |
| `target` | what is being scrolled, and whether its CSS asked for smooth |
| `gesture` | the last press: how long the pinch was held, how far the hand moved, and what it was read as |

Read it while dragging:

- **`paint` near 60 and `track` low** — normal. Landmarks are slow but the page
  still repaints, and `scroll` should also read near 60/s. Scrolling is smooth.
- **`paint` collapsed to roughly `track`, `blocked` high, `model` large** — the
  main thread is saturated by inference. Nothing on it can run at display rate,
  so no amount of scroll smoothing will help. Cap the model with
  `maxTrackingFps: 15` (or lower) to buy back headroom; the cursor becomes a
  little less responsive and everything else gets smoother.
- **`scroll` far below `paint`** — the scroll runner is being starved
  specifically. Worth reporting.

### The trace

The panel's last block records the scroll movement of every repaint during the
most recent drag, and freezes it afterwards so it can be read or screenshotted.
Aggregates say how bad it is; only the sequence says what shape it is, and the
shape names the cause:

| Trace | Cause |
| --- | --- |
| `11 8 6 11 8 6` | healthy — continuous movement every frame |
| `25 0 0 25 0 0` | quantized to the landmark rate |
| `0 0 0 90 0 0` | something is batching or animating the writes |
| `6 6 -30 6 6` | something else is moving the scroll position too |
| `5 0 5 0 0 5 0` | frames are being dropped |

### If per-frame writes are the problem

`drag.mode: 'native'` is a different strategy: rather than writing a scroll
position every frame, it hands the distance to the browser as a single smooth
scroll and lets the browser animate it.

```js
HandCursor.init({ drag: { mode: 'native' } });
```

This matters most on iOS, where the scroll position lives on a different thread
from JavaScript and every write has to be synchronised across. A browser-run
animation happens on that side of the boundary — the same reason the cursor,
which is a composited transform, stays smooth when the page does not. The cost
is latency: the page trails the hand by `retargetMs` plus the browser's own
easing, and that easing is not ours to shorten. Measured on a 1400px/s flick,
the page had travelled 188px by the time the hand let go, against 395px in
`write` mode — the page arrives after the hand rather than under it.

`drag.mode: 'hybrid'` splits the difference: the hand is tracked directly during
the drag, where latency is what you notice, and the throw is handed to the
browser, where smoothness is. Use it if the jank only shows up during the throw.

### Tuning the feel

Three numbers decide whether a scroll feels immediate.

`holdDelay` is the pause before a press can become a scroll, and it exists so a
deliberate tap stays a tap. It is also the most likely reason a scroll feels
like it starts after the gesture. `holdEscape` is the way out: travel that far
and the delay is skipped, on the grounds that pinch drift is small and slow, so
a hand already moving that fast cannot be settling into a tap. Lower it for a
hair-trigger scroll, raise it if flicks are stealing taps.

`friction` sets how far a throw carries. A throw travels its release speed times
the decay's time constant, which is `-1 / (60 * ln(friction))` seconds — 0.5s at
the default, so a hand leaving at 1400px/s coasts about 700px. `flingScale`
multiplies that if you want the same decay curve over a different distance.

`velocityWindow` is how far back a release looks to decide how fast the hand was
going. A pinch does not open instantly, so release is detected a frame or two
after the fingers start parting; reading only the last frame would throw away
most of a flick. Widen it if throws feel weaker than the gesture, narrow it if
the page keeps coasting after you have visibly stopped.

### If the page skips but an inner scroller does not

The tell: on the same phone, a modal's `overflow: auto` element scrolls
perfectly while the page underneath skips — and on desktop both are fine.

On iOS the page's scroll offset lives in the UI process, not the one running
JavaScript. A write is a message that commits a moment later, and a read taken
straight afterwards can still return the old value. `scrollTop = scrollTop -
delta` once a frame is then a read-modify-write loop against a value that has
not caught up: one frame reads a stale offset and re-asks for the target it
already asked for, so nothing moves; the next reads a fresh one and moves twice
as far. Dead frame, double step, dead frame — while the cursor, a composited
transform that round-trips nowhere, glides. A nested `overflow: auto` element
keeps its offset in the same process as the script, so it never misbehaves.

The runner therefore takes ownership of the offset when a gesture starts,
writes absolute positions it tracks itself, and never reads the container's
back. It clamps to the container's own range rather than leaving that to the
browser, so dragging past the end cannot run the tracked value off into space.

Under a fixture that makes reads lag three frames behind writes, the old
read-modify-write loop moved 159px where the gesture asked for 636, stalling on
a fifth of all repaints. Tracking the position instead moves the full distance
with no stalls.

The `commit` row in the diagnostics panel reports this directly: how far the
browser's answer trails what was just written, and how often it had not moved
at all. On a platform that commits synchronously both read 0.

One thing this does *not* fix, and cannot: on iOS the URL bar collapses when you
scroll with a finger, and does not when the cursor scrolls. Browser chrome
responds only to real touch gestures, and synthetic events are untrusted by
design — no script can drive it. It is a visible reminder that these are
programmatic scrolls, which is the same fact that makes the commit behaviour
above matter, but it is not itself a cause of jank.

### If the scroll ripples

A page that never stalls and never lurches can still read as jumpy, and the
cause is speed rather than position. Landmarks arrive at 15-25fps against a 60Hz
display, so most repaints have no new information. Filling those gaps by closing
a fraction of the remaining distance each frame — the obvious way — makes every
landmark land as a burst that decays over the repaints after it. The page is
always moving, and always changing how fast.

Instead the runner keeps the hand's path, timestamped, and draws it from a point
`resample` intervals in the past, reading between the two landmarks either side.
A hand at a constant speed then produces a page at a constant speed, exactly.
Measured as how much one repaint's step differs from the one before it, a 15fps
tracker with 35% jitter went from 38% to 1%, which is the same figure a 60fps
tracker scores.

Two details matter more than they look:

- The path is timestamped with **when the hand was seen**, not when the scroll
  code ran. Between those sits a MediaPipe inference, tens of milliseconds and a
  different number of them every frame. Timing by arrival stamps that variation
  onto a distance measured without it, and reports a hand moving at a constant
  speed as one lurching between speeds.
- The point being drawn runs on **its own clock**, advanced by each frame's own
  elapsed time and nudged toward the ideal offset by at most 5% of a frame.
  Recomputing it as `now - delay` every frame sounds equivalent, but `delay`
  moves with a running average of the landmark gap, and subtracting a moving
  number from a steady clock drags the whole path back and forth underneath the
  render point. On an otherwise perfect scroll that alone turned steady 7.8px
  steps into a stream swinging between 6.2 and 12.3.

`handcursor-debug` in the URL shows the per-repaint `scroll` trace these numbers
come from.

`target` names the element being scrolled. It reads `page` for the document, or
the element's tag and id. If it says `SMOOTH` in yellow, that element's CSS asks
for smooth scrolling; the runner suppresses it while dragging, but it is useful
confirmation of what you are looking at.

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
| Radius | 8px buttons and controls, 12px cards and the tab's page-facing side |
| Trackpad | 260 × 200, 12px padding, 4px corner insets |
| Side tab | 24 × 64 off the card's edge, 80 tall once the camera is on, on a 6px fillet |
| Illustration | 66 × 98 on the pre-enabled card |
| Icons | 24 × 24 Material Symbols in 32 × 32 buttons — the camera-off control filled `#FF4040` with a white icon |
| Live preview | Camera at 15% opacity over the `#F6F6F6` card, so icons stay legible |

Icons are the supplied Material Symbols assets (`videocam`, `videocam_off`),
inlined in `src/icons.js` and drawn in `currentColor`. The tab's chevron and
the fillet beside it are the supplied SVGs, on their own 16 x 48 and 6 x 6
boxes rather than the 24px grid. The cursor arrow is the supplied 32 × 32 SVG, with its viewBox
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
  pointer.js      taps and gesture state
  scroll.js       display-rate scrolling and the fling
  hover.js        CSS :hover emulation
  debug.js        on-screen diagnostics
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
