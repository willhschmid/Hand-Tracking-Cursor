/**
 * Browser tests.
 *
 * The MediaPipe model needs a real camera, so it is left out: the harness feeds
 * synthetic landmarks straight into the controller instead. That covers
 * everything downstream of the model — mapping, smoothing, pinch detection,
 * taps, drag-scrolling, momentum and the panel's layout.
 *
 *   npm run build && npm test
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8123;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
};

const server = createServer(async (req, res) => {
  const path = join(ROOT, normalize(new URL(req.url, 'http://localhost').pathname));
  try {
    let file = path;
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, {
      'content-type': `${TYPES[extname(file)] || 'text/plain'}; charset=utf-8`,
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(PORT, resolve));

// CHROMIUM_PATH lets CI reuse a browser it already has instead of downloading one.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });

const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

const results = [];
const check = (name, pass, detail = '') =>
  results.push({ name, pass, detail: pass ? '' : detail });

const shadow = (selector) =>
  page.evaluate(
    (sel) => {
      const el = document.querySelector('[data-hand-cursor]').shadowRoot.querySelector(sel);
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        text: el.textContent.trim(),
        width: box.width,
        height: box.height,
        left: box.left,
        top: box.top,
        bottom: box.bottom,
        right: box.right,
        display: style.display,
        background: style.backgroundColor,
        radius: style.borderRadius,
        filter: style.filter,
      };
    },
    selector,
  );

await page.goto(`http://localhost:${PORT}/test/harness.html`, { waitUntil: 'load' });

// ----------------------------------------------------------------- layout --

const panel = await shadow('.hc-panel');
check(
  'idle trackpad is 260x200',
  panel.width === 260 && panel.height === 200,
  `${panel.width}x${panel.height}`,
);
check(
  'trackpad sits bottom-left with a 16px margin',
  panel.left === 16 && 700 - panel.bottom === 16,
  `left ${panel.left}, bottom ${700 - panel.bottom}`,
);

const copy = await shadow('.hc-copy');
check(
  'intro copy matches the spec',
  copy.text === 'Use hand tracking to control your cursor. Video never leaves your device.',
  copy.text,
);

const cta = await shadow('.hc-cta');
check(
  'CTA is 32px tall, green, 8px radius',
  cta.height === 32 && cta.background === 'rgb(0, 202, 72)' && cta.radius === '8px',
  JSON.stringify(cta),
);
check('CTA reads "Enable Camera"', cta.text === 'Enable Camera', cta.text);

// The tab is a part of the card, not a state of it: it hangs off the edge,
// level with the bottom, and is there whether the card is out or away.
const tab = await shadow('.hc-tab');
check(
  'the tab hangs off the side of the card, 24 wide and level with its bottom',
  tab.width === 24 &&
    tab.height === 64 &&
    tab.left === panel.right &&
    tab.bottom === panel.bottom,
  `${tab.width}x${tab.height} at ${tab.left} (card ends ${panel.right}), bottom ${tab.bottom} v ${panel.bottom}`,
);
check(
  'the tab is flat against the card and rounded on the page side',
  tab.radius === '0px 12px 12px 0px',
  tab.radius,
);
// Square where the tab covers it. Left rounded, the card would show a 12px
// bite out of its own corner against the flat side of the tab.
check(
  'the card is square where the tab meets it, and rounded everywhere else',
  // Serialized short: the bottom-left corner is dropped when it matches the
  // top-right, so 12 12 0 12 comes back as three values.
  panel.radius === '12px 12px 0px',
  panel.radius,
);
const notch = await shadow('.hc-tab-notch');
check(
  'the fillet is 6x6, in the corner above the tab against the card',
  notch.width === 6 &&
    notch.height === 6 &&
    notch.left === tab.left &&
    notch.bottom === tab.top,
  JSON.stringify(notch),
);
const tabIcon = await shadow('.hc-tab > svg');
check(
  'the chevron is 16x48, inset 4px either side and 8px top and bottom',
  tabIcon.width === 16 &&
    tabIcon.height === 48 &&
    tabIcon.left - tab.left === 4 &&
    tab.right - tabIcon.right === 4 &&
    tabIcon.top - tab.top === 8 &&
    tab.bottom - tabIcon.bottom === 8,
  JSON.stringify(tabIcon),
);

await page.evaluate(() => window.hc.setMinimized(true));
await page.evaluate(() => window.settled());
const mini = await page.evaluate(() => {
  const root = document.querySelector('[data-hand-cursor]').shadowRoot;
  const card = root.querySelector('.hc-panel').getBoundingClientRect();
  const tab = root.querySelector('.hc-tab').getBoundingClientRect();
  return { cardRight: card.right, tab: [tab.left, tab.right, innerHeight - tab.bottom] };
});
check(
  'put away, the card is off the screen and the tab is against the edge',
  mini.cardRight === 0 && mini.tab[0] === 0 && mini.tab[1] === 24,
  JSON.stringify(mini),
);
check('the tab keeps its 16px off the bottom', mini.tab[2] === 16, `${mini.tab[2]}px`);

// Anchored to the other edge, the tab has to turn around with it — otherwise
// it hangs off the side the card slides towards and points out of the screen.
const mirrored = await page.evaluate(async () => {
  const root = document.querySelector('[data-hand-cursor]').shadowRoot;
  const host = root.querySelector('.hc-root');
  host.dataset.position = 'bottom-right';
  await window.settled();
  const card = root.querySelector('.hc-panel').getBoundingClientRect();
  const tab = root.querySelector('.hc-tab').getBoundingClientRect();
  const out = {
    cardLeft: innerWidth - card.left,
    tab: [innerWidth - tab.right, innerWidth - tab.left],
    radius: getComputedStyle(root.querySelector('.hc-tab')).borderRadius,
    flip: getComputedStyle(root.querySelector('.hc-tab > svg')).transform,
  };
  host.dataset.position = 'bottom-left';
  await window.settled();
  return out;
});
check(
  'anchored right, the whole thing mirrors and slides the other way',
  mirrored.cardLeft === 0 &&
    mirrored.tab[0] === 0 &&
    mirrored.tab[1] === 24 &&
    mirrored.radius === '12px 0px 0px 12px',
  JSON.stringify(mirrored),
);
check(
  'anchored right, the chevron points the other way',
  mirrored.flip === 'none',
  mirrored.flip,
);

// The tab is the whole affordance, and the only one: it is what puts the card
// away and what brings it back.
//
// Pressed where it is on the screen, not by calling click() on the element.
// Dispatching straight at the node skips hit testing, which is the one thing
// worth checking here: the overlay turns pointer events off so the page under
// the empty parts of it stays usable, and anything really there has to turn
// them back on. The tab did not, when it moved out of the card, and every test
// that poked the element itself still passed while nothing on screen worked.
const tabSpot = async () => {
  const box = await page.evaluate(() => {
    const b = document
      .querySelector('[data-hand-cursor]')
      .shadowRoot.querySelector('.hc-tab')
      .getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await page.mouse.click(box.x, box.y);
  await page.evaluate(() => window.settled());
  return page.evaluate(
    () =>
      document
        .querySelector('[data-hand-cursor]')
        .shadowRoot.querySelector('.hc-panel')
        .getBoundingClientRect().left,
  );
};
const clickedOut = await tabSpot();
const clickedAway = await tabSpot();
check(
  'clicking the tab where it sits takes the card out and puts it back',
  clickedOut === 16 && clickedAway === -260,
  `out at ${clickedOut}, away at ${clickedAway}`,
);
// Same question asked of the hit test directly, since that is what the hand
// cursor consults rather than the mouse.
const hitTest = await page.evaluate(async () => {
  const sr = document.querySelector('[data-hand-cursor]').shadowRoot;
  const at = () => {
    const b = sr.querySelector('.hc-tab').getBoundingClientRect();
    const hit = sr.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return hit ? hit.closest('.hc-tab') !== null : false;
  };
  const away = at();
  window.hc.setMinimized(false);
  await window.settled();
  const out = at();
  window.hc.setMinimized(true);
  await window.settled();
  return { away, out };
});
check(
  'the tab answers a hit test at its own coordinates, out or away',
  hitTest.away && hitTest.out,
  JSON.stringify(hitTest),
);

// The whole point of sliding rather than resizing: nothing inside the card has
// to lay out again on the way. The card that used to animate from 260 wide to
// 24 re-wrapped its copy line by line and squeezed the button beside it, and
// the illustration had to be scaled by hand to keep from being clipped.
const slide = await page.evaluate(async () => {
  const root = document.querySelector('[data-hand-cursor]').shadowRoot;
  const panel = root.querySelector('.hc-panel');
  const tab = root.querySelector('.hc-tab');
  const copy = root.querySelector('.hc-copy');
  const cta = root.querySelector('.hc-cta');
  const img = root.querySelector('.hc-illo-img');
  window.hc.setMinimized(false);
  await window.settled();

  const seen = [];
  let sampling = true;
  const sample = () => {
    if (!sampling) return;
    const p = panel.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    seen.push({
      card: [p.width, p.height],
      tab: [t.width, t.height, t.left],
      copy: [copy.getBoundingClientRect().width, copy.getBoundingClientRect().height],
      cta: cta.getBoundingClientRect().width,
      illo: [img.getBoundingClientRect().width, img.getBoundingClientRect().height],
      pad: parseFloat(getComputedStyle(panel).paddingTop),
    });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  window.hc.setMinimized(true);
  await new Promise((resolve) => setTimeout(resolve, 500));
  sampling = false;
  // To a hundredth of a pixel, not exactly: a box measured through a fractional
  // translate comes back as its two edges added to that offset and subtracted
  // again, so 236 arrives as 235.99999999999997 on some frames and 236 on
  // others. That is the float, not the layout.
  const same = (key) =>
    seen.every((s) =>
      [s[key]].flat().every((v, i) => Math.abs(v - [seen[0][key]].flat()[i]) < 0.01),
    );
  const xs = seen.map((s) => s.tab[2]);
  return {
    frames: seen.length,
    held: ['card', 'copy', 'cta', 'illo', 'pad'].filter(same),
    travel: xs[0] - xs[xs.length - 1],
    monotonic: xs.every((x, i) => i === 0 || x <= xs[i - 1] + 0.01),
    first: seen[0],
  };
});
check(
  'nothing inside the card resizes while it slides away',
  slide.frames > 5 &&
    slide.held.length === 5 &&
    slide.first.card[0] === 260 &&
    slide.first.pad === 12,
  `held ${slide.held.join(', ')} over ${slide.frames} frames`,
);
check(
  'the tab travels the card and its margin, one way, and stops on the edge',
  Math.abs(slide.travel - 276) < 0.5 && slide.monotonic,
  `moved ${slide.travel.toFixed(1)}px, monotonic ${slide.monotonic}`,
);

const illustration = await page.evaluate(() => {
  const img = document
    .querySelector('[data-hand-cursor]')
    .shadowRoot.querySelector('.hc-illo-img');
  return {
    inlined: img.src.startsWith('data:image/png;base64,'),
    natural: [img.naturalWidth, img.naturalHeight],
    complete: img.complete,
  };
});
check(
  'the pre-enabled card shows the supplied artwork, inlined',
  illustration.inlined && illustration.complete && illustration.natural[0] === 198,
  JSON.stringify(illustration),
);

await page.evaluate(() => window.hc.setMinimized(false));
await page.evaluate(() => window.settled());

// ---------------------------------------------------------------- cursor --

const move = await page.evaluate(() => {
  let last;
  for (let i = 0; i < 30; i++) last = window.feed(0.5, 0.5, false);
  const centre = last;
  for (let i = 0; i <= 20; i++) last = window.feed(0.5 - i * 0.01, 0.5, false);
  const visible = document
    .querySelector('[data-hand-cursor]')
    .shadowRoot.querySelector('.hc-cursor').dataset.visible;
  return { centre, end: last, visible };
});
check('cursor is visible while a hand is present', move.visible === 'true');
check(
  'centre of the frame maps to the centre of the viewport',
  Math.abs(move.centre.x - 500) < 3 && Math.abs(move.centre.y - 350) < 3,
  JSON.stringify(move.centre),
);
check(
  'view is mirrored: hand left, cursor right',
  move.end.x > move.centre.x + 200,
  JSON.stringify(move.end),
);

const rotation = await page.evaluate(() => {
  const el = document.querySelector('[data-hand-cursor]').shadowRoot.querySelector('.hc-cursor');
  const angle = () => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return (Math.atan2(m.b, m.a) * 180) / Math.PI;
  };

  // Sweeping right, then left.
  for (let i = 0; i <= 30; i++) window.feed(0.5 - i * 0.012, 0.5, false);
  const right = angle();
  for (let i = 0; i <= 30; i++) window.feed(0.14 + i * 0.012, 0.5, false);
  const left = angle();

  // Settle, then jitter by well under a pixel — the case that used to send the
  // arrow spinning, because atan2 of a near-zero velocity is noise.
  for (let i = 0; i < 60; i++) window.feed(0.5, 0.5, false);
  const still = angle();
  let worst = 0;
  for (let i = 0; i < 60; i++) {
    window.feed(0.5 + (i % 2 ? 0.0004 : -0.0004), 0.5 + (i % 3 ? 0.0004 : -0.0004), false);
    worst = Math.max(worst, Math.abs(angle()));
  }
  return { right, left, still, worst };
});
check(
  'cursor leans into travel, right and left',
  rotation.right > 4 && rotation.left < -4,
  JSON.stringify(rotation),
);
const maxAngle = await page.evaluate(() => window.hc.options.rotation.maxAngle);
check(
  `the lean is capped at the configured ${maxAngle} degrees`,
  Math.abs(rotation.right) <= maxAngle + 0.5 && Math.abs(rotation.left) <= maxAngle + 0.5,
  JSON.stringify(rotation),
);
check(
  'a still hand leaves the cursor upright',
  Math.abs(rotation.still) < 1,
  `${rotation.still}deg`,
);
check(
  'sub-pixel jitter does not swing the cursor',
  rotation.worst < 3,
  `worst ${rotation.worst.toFixed(1)}deg during jitter`,
);

const edges = await page.evaluate(() => {
  let a;
  for (let i = 0; i < 40; i++) a = window.feed(0.95, 0.95, false);
  let b;
  for (let i = 0; i < 40; i++) b = window.feed(0.05, 0.05, false);
  return { a, b };
});
check(
  'the viewport corners are reachable',
  edges.a.x < 2 && edges.a.y > 698 && edges.b.x > 998 && edges.b.y < 2,
  JSON.stringify(edges),
);

const press = await page.evaluate(() => {
  const el = document.querySelector('[data-hand-cursor]').shadowRoot.querySelector('.hc-cursor');
  const scale = () => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return Math.hypot(m.a, m.b);
  };
  for (let i = 0; i < 20; i++) window.feed(0.5, 0.5, false);
  const open = scale();
  for (let i = 0; i < 20; i++) window.feed(0.5, 0.5, true);
  const closed = scale();
  for (let i = 0; i < 20; i++) window.feed(0.5, 0.5, false);
  return { open, closed, released: scale() };
});
check(
  'cursor scales down while pressed',
  Math.abs(press.open - 1) < 0.02 && Math.abs(press.closed - 0.85) < 0.02,
  JSON.stringify(press),
);
check('cursor scale returns on release', Math.abs(press.released - 1) < 0.02, String(press.released));

// ------------------------------------------------------------ interaction --

const tap = await page.evaluate(() => {
  const box = document.getElementById('btn').getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  for (let i = 0; i < 40; i++) window.feed(...window.toCamera(cx, cy), false);
  const at = window.feed(...window.toCamera(cx, cy), false);
  window.feed(...window.toCamera(cx, cy), true);
  window.feed(...window.toCamera(cx, cy), true);
  window.feed(...window.toCamera(cx, cy), false);
  return { at, target: { cx, cy }, clicks: document.getElementById('out').textContent };
});
check('a pinch over a button fires a real click', tap.clicks === '1', JSON.stringify(tap));
check(
  'the cursor lands where the hand points',
  Math.abs(tap.at.x - tap.target.cx) < 6 && Math.abs(tap.at.y - tap.target.cy) < 6,
  `${JSON.stringify(tap.at)} vs ${JSON.stringify(tap.target)}`,
);

// Scrolling is applied by a display-rate animation loop rather than inline, so
// these need to let frames actually run before reading the result.
const settle = (ms = 500) =>
  page.evaluate((wait) => new Promise((resolve) => setTimeout(resolve, wait)), ms);

const elementScroll = await page.evaluate(async () => {
  const box = document.getElementById('box');
  box.scrollTop = 0;
  const rect = box.getBoundingClientRect();
  await window.pinchDrag({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    dy: -180,
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { scrolled: box.scrollTop, page: window.scrollY };
});
check(
  'pinch-drag scrolls the element under the cursor',
  elementScroll.scrolled > 80,
  JSON.stringify(elementScroll),
);
check('the page stays put while an element scrolls', elementScroll.page === 0);

const pageScroll = await page.evaluate(async () => {
  window.scrollTo(0, 0);
  const at = await window.pinchDrag({ x: 850, y: 400, dy: -200, release: false });
  // Sampled a beat after the drag, once the runner has caught up, then again
  // after the fling has played out.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const during = window.scrollY;
  window.feedNow(...window.toCamera(at.x, at.y), false);
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { during, after: window.scrollY };
});
check('pinch-drag scrolls the page', pageScroll.during > 40, JSON.stringify(pageScroll));
check(
  'releasing a drag flings the page',
  pageScroll.after > pageScroll.during,
  JSON.stringify(pageScroll),
);

const driftyTap = await page.evaluate(async () => {
  // A pinch that wanders 20px and releases quickly is a tap, not a scroll.
  // With the old 10px threshold this became a scroll and swallowed the click.
  // Back to the top first: the fling above left the button off-screen.
  window.scrollTo(0, 0);
  await new Promise((resolve) => setTimeout(resolve, 300));
  window.scrollTo(0, 0);

  const button = document.getElementById('btn');
  const before = Number(document.getElementById('out').textContent);
  const rect = button.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  let cy = rect.top + rect.height / 2;
  const scrollBefore = window.scrollY;

  for (let i = 0; i < 40; i++) window.feed(...window.toCamera(cx, cy), false);
  window.feed(...window.toCamera(cx, cy), true);
  for (let i = 0; i < 5; i++) {
    cy -= 4;
    window.feed(...window.toCamera(cx, cy), true);
  }
  window.feed(...window.toCamera(cx, cy), false);
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    clicked: Number(document.getElementById('out').textContent) - before,
    scrolled: window.scrollY - scrollBefore,
  };
});
check(
  'a pinch that drifts still counts as a tap',
  driftyTap.clicked === 1 && driftyTap.scrolled === 0,
  JSON.stringify(driftyTap),
);

const clicksAfterDrag = await page.evaluate(() => document.getElementById('out').textContent);
check('a drag does not also fire a click', clicksAfterDrag === '2', clicksAfterDrag);

const hover = await page.evaluate(() => {
  // CSS :hover only ever follows the real pointer, so the library mirrors the
  // page's hover rules onto an attribute it can set itself.
  window.hc.driver.prepareHoverStyles();
  const el = document.getElementById('hoverme');
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 40; i++) window.feed(...window.toCamera(cx, cy), false);
  const on = {
    marked: el.hasAttribute('data-hc-hover'),
    background: getComputedStyle(el).backgroundColor,
  };
  for (let i = 0; i < 40; i++) window.feed(...window.toCamera(5, 5), false);
  return {
    on,
    off: {
      marked: el.hasAttribute('data-hc-hover'),
      background: getComputedStyle(el).backgroundColor,
    },
  };
});
check(
  'CSS :hover styles respond to the hand cursor',
  hover.on.marked && hover.on.background === 'rgb(0, 202, 72)',
  JSON.stringify(hover.on),
);
check(
  'hover styles come back off when the cursor leaves',
  !hover.off.marked && hover.off.background === 'rgb(10, 20, 30)',
  JSON.stringify(hover.off),
);

const lost = await page.evaluate(() => {
  window.hc.releaseHand();
  return document.querySelector('[data-hand-cursor]').shadowRoot.querySelector('.hc-cursor')
    .dataset.visible;
});
check('the cursor hides when the hand leaves frame', lost === 'false', lost);

// ------------------------------------------------------------- live state --

await page.evaluate(async () => {
  // A canvas stream stands in for the camera.
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#777';
  ctx.fillRect(0, 0, 640, 480);
  await window.hc.panel.attachStream(canvas.captureStream(5));
  window.hc.panel.setState('live');
});
await page.waitForTimeout(300);

const live = await shadow('.hc-panel');
const video = await shadow('.hc-video');
const cornerLeft = await shadow('.hc-corner--tl');
check(
  'live trackpad keeps the 260x200 frame',
  live.width === 260 && live.height === 200,
  `${live.width}x${live.height}`,
);
check(
  'live trackpad keeps the 16px margin',
  live.left === 16 && 700 - live.bottom === 16,
  `left ${live.left}, bottom ${700 - live.bottom}`,
);
check('the camera-off control appears when live', cornerLeft.display !== 'none', cornerLeft.display);
check(
  'the corner icon buttons are 32x32 with an 8px radius',
  cornerLeft.width === 32 && cornerLeft.height === 32 && cornerLeft.radius === '8px',
  JSON.stringify(cornerLeft),
);

// The preview runs to the edge of the card and the tab carries on out of it in
// flat #F6F6F6, so the video has to fade into that colour rather than stopping
// dead against it. The spec puts the fade over the last 24px of the 260 — the
// width of the tab — which is where 90.43% comes from.
const scrim = await page.evaluate(() => {
  const sr = document.querySelector('[data-hand-cursor]').shadowRoot;
  const host = sr.querySelector('.hc-root');
  const read = () => getComputedStyle(sr.querySelector('.hc-scrim'));
  const left = { display: read().display, image: read().backgroundImage };
  host.dataset.position = 'bottom-right';
  const right = read().backgroundImage;
  host.dataset.position = 'bottom-left';
  return { ...left, right };
});
check(
  'the preview fades into the card over the tab’s width',
  scrim.display === 'block' &&
    scrim.image.includes('90.43%') &&
    scrim.image.includes('rgb(246, 246, 246)'),
  JSON.stringify(scrim.image),
);
check(
  'the fade turns around with the tab',
  scrim.image.includes('90deg') && scrim.right.includes('270deg'),
  `${scrim.image} / ${scrim.right}`,
);

const miniLive = await page.evaluate(async () => {
  window.hc.setMinimized(true);
  await window.settled();
  const sr = document.querySelector('[data-hand-cursor]').shadowRoot;
  const read = () => {
    const tab = sr.querySelector('.hc-tab').getBoundingClientRect();
    const dotStyle = getComputedStyle(sr.querySelector('.hc-tab-dot'));
    const dot = sr.querySelector('.hc-tab-dot').getBoundingClientRect();
    const icon = sr.querySelector('.hc-tab > svg').getBoundingClientRect();
    return {
      height: tab.height,
      dot: dotStyle.display === 'none' ? null : {
        size: [dot.width, dot.height],
        colour: dotStyle.backgroundColor,
        fromTop: dot.top - tab.top,
        sides: [dot.left - tab.left, tab.right - dot.right],
        toChevron: icon.top - dot.bottom,
      },
      // The card goes off the screen whole, and its controls go out of the
      // keyboard's reach with it — visibility, not opacity, and only once the
      // slide has finished so nothing disappears in transit.
      offScreen: sr.querySelector('.hc-panel').getBoundingClientRect().right,
      hidden: ['.hc-cta', '.hc-corner--tl'].map(
        (sel) => getComputedStyle(sr.querySelector(sel)).visibility,
      ),
      // The feed is never hidden, even here — it is what the model reads every
      // tick, and tracking is the whole point of putting the card away.
      previewRendered: sr.querySelector('.hc-video').getClientRects().length > 0,
      previewVisible: getComputedStyle(sr.querySelector('.hc-stage')).visibility,
    };
  };
  const live = read();
  window.hc.panel.setState('idle');
  await window.settled();
  const idle = read();
  window.hc.panel.setState('live');
  window.hc.setMinimized(false);
  await window.settled();
  return { live, idle };
});
check(
  'the tab grows to 80px when the camera is on',
  miniLive.live.height === 80 && miniLive.idle.height === 64,
  `live ${miniLive.live.height}, idle ${miniLive.idle.height}`,
);
check(
  'the green dot appears only once the camera is enabled',
  miniLive.live.dot !== null && miniLive.idle.dot === null,
  JSON.stringify({ live: miniLive.live.dot, idle: miniLive.idle.dot }),
);
check(
  'the dot is an 8px green circle, 8px from the top and centred',
  miniLive.live.dot &&
    miniLive.live.dot.size[0] === 8 &&
    miniLive.live.dot.size[1] === 8 &&
    miniLive.live.dot.colour === 'rgb(0, 202, 72)' &&
    miniLive.live.dot.fromTop === 8 &&
    miniLive.live.dot.sides[0] === 8 &&
    miniLive.live.dot.sides[1] === 8 &&
    miniLive.live.dot.toChevron === 8,
  JSON.stringify(miniLive.live.dot),
);
check(
  'put away, the card is off the screen and out of the keyboard’s reach',
  [miniLive.live, miniLive.idle].every(
    (s) => s.offScreen === 0 && s.hidden.every((v) => v === 'hidden'),
  ),
  JSON.stringify({ live: miniLive.live.hidden, idle: miniLive.idle.hidden }),
);
check(
  'the camera feed keeps rendering while minimized, so tracking survives',
  miniLive.live.previewRendered && miniLive.live.previewVisible === 'visible',
  `rendered ${miniLive.live.previewRendered}, visibility ${miniLive.live.previewVisible}`,
);
check('the preview is desaturated', video.filter.includes('grayscale'), video.filter);

const overlay = await page.evaluate(() => {
  const hc = window.hc;
  const points = window.makeHand(0.5, 0.5, false);
  hc.panel.drawHand(points, false);
  const canvas = hc.panel.canvas;
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let pink = 0;
  let green = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    if (data[i] > 200 && data[i + 1] < 180 && data[i + 2] > 200) pink++;
    if (data[i] < 120 && data[i + 1] > 150 && data[i + 2] < 140) green++;
  }
  hc.panel.drawHand(points, true);
  const pinched = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let pinkAfter = 0;
  let greenAfter = 0;
  for (let i = 0; i < pinched.length; i += 4) {
    if (pinched[i + 3] < 40) continue;
    if (pinched[i] > 200 && pinched[i + 1] < 180 && pinched[i + 2] > 200) pinkAfter++;
    if (pinched[i] < 120 && pinched[i + 1] > 150 && pinched[i + 2] < 140) greenAfter++;
  }
  return { pink, green, pinkAfter, greenAfter };
});
check(
  'the skeleton draws in purple with a green pinch line',
  overlay.pink > 100 && overlay.green > 5,
  JSON.stringify(overlay),
);
check(
  'the skeleton turns green while pinched',
  overlay.pinkAfter === 0 && overlay.greenAfter > overlay.green,
  JSON.stringify(overlay),
);

// ------------------------------------------------------- scroll smoothness --
//
// The regression this guards: scroll used to be applied once per landmark
// frame, so on a slow tracker the page advanced ~25px and then sat still for
// two repaints. Measured per repaint, that is a staircase; it reads as
// skipping. Scrolling now runs on its own display-rate loop, so a slow tracker
// should look almost the same as a fast one.

for (const lenis of [false, true]) {
  const smooth = await browser.newPage({ viewport: { width: 420, height: 800 } });
  const errors = [];
  smooth.on('pageerror', (error) => errors.push(error.message));
  await smooth.goto(
    `http://localhost:${PORT}/test/harness.html${lenis ? '?lenis=1' : ''}`,
    { waitUntil: 'load' },
  );
  const lenisOn = await smooth.evaluate(() => window.lenisReady);
  const slow = await smooth.evaluate(() => window.timedDrag({ trackingFps: 15 }));
  const fast = await smooth.evaluate(() => window.timedDrag({ trackingFps: 60 }));
  // A phone does not deliver landmarks on a metronome — inference takes a
  // different length of time every frame — so the uneven case is the real one.
  const uneven = await smooth.evaluate(() =>
    window.timedDrag({ trackingFps: 18, jitter: 0.35 }),
  );
  await smooth.close();

  const label = lenis ? 'with Lenis' : 'on a plain page';
  check(
    `${label}: Lenis presence matches the fixture`,
    lenisOn === lenis,
    `expected ${lenis}, got ${lenisOn}`,
  );
  check(
    `${label}: a 15fps tracker still scrolls something`,
    slow.scrolled > 200,
    JSON.stringify(slow),
  );
  check(
    `${label}: a 15fps tracker does not stall the page`,
    slow.stalled / slow.frames < 0.25,
    `${slow.stalled}/${slow.frames} repaints stood still — ${JSON.stringify(slow)}`,
  );
  check(
    `${label}: a 15fps tracker does not lurch`,
    slow.biggestJump < 20,
    `fastest repaint moved ${slow.biggestJump}px per frame — ${JSON.stringify(slow)}`,
  );
  check(
    `${label}: slow tracking is nearly as smooth as fast`,
    slow.stalled / slow.frames < fast.stalled / fast.frames + 0.15,
    `slow ${slow.stalled}/${slow.frames} vs fast ${fast.stalled}/${fast.frames}`,
  );
  // The complaint this measures is "jumpy" on a page that never stalls and
  // never lurches: a permanent ripple, because each landmark arrival used to
  // produce a burst that decayed over the repaints after it. Steps that differ
  // from their neighbour by a tenth are already imperceptible; it read 0.38
  // before the runner started interpolating the hand's path. What is left is
  // mostly sub-pixel rounding: a 7.8px step written onto a 1px grid dithers by
  // one pixel, which is 13% here and a third of that on a 3x phone.
  check(
    `${label}: a steady hand produces steady steps`,
    uneven.roughness < 0.12,
    `consecutive repaints differ by ${(uneven.roughness * 100).toFixed(0)}% of a step — ${JSON.stringify(uneven)}`,
  );
  check(
    `${label}: an uneven tracker is no rougher than a display-rate one`,
    uneven.roughness < fast.roughness + 0.08,
    `uneven ${uneven.roughness} vs 60fps ${fast.roughness}`,
  );
  check(`${label}: no errors during the drag`, errors.length === 0, errors.join(' | '));
}

// ------------------------------------------------ CSS scroll-behavior ------
//
// A page with `scroll-behavior: smooth` turns every programmatic scroll into an
// animation. Driven sixty times a second, each write interrupts the last and
// the page barely moves. `behavior: 'instant'` is meant to opt out, but support
// is uneven, so the runner forces the behaviour off with an inline style while
// it drives. This checks that in a browser that rejects `instant` — which is
// the situation that made a real device lurch while Chromium looked fine.

{
  const smooth = await browser.newPage({ viewport: { width: 420, height: 800 } });
  await smooth.addInitScript(() => {
    const real = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function (options) {
      if (options && typeof options === 'object' && options.behavior === 'instant') {
        throw new TypeError('behavior:instant not supported');
      }
      return real.apply(this, arguments);
    };
  });
  await smooth.goto(`http://localhost:${PORT}/test/harness.html?smooth=1`, {
    waitUntil: 'load',
  });

  const declared = await smooth.evaluate(
    () => document.documentElement.style.scrollBehavior,
  );
  const result = await smooth.evaluate(() => window.timedDrag({ trackingFps: 30 }));
  // The override is lifted when the runner goes idle, which is after the
  // release fling has played out, not when the drag ends.
  await smooth.waitForTimeout(1500);
  const afterwards = await smooth.evaluate(
    () => getComputedStyle(document.documentElement).scrollBehavior,
  );
  await smooth.close();

  check('the fixture really does ask for smooth scrolling', declared === 'smooth', declared);
  check(
    'a smooth-scroll page still scrolls when instant is unsupported',
    result.scrolled > 200,
    `only moved ${Math.round(result.scrolled)}px — ${JSON.stringify(result)}`,
  );
  check(
    'a smooth-scroll page does not lurch',
    result.stalled / Math.max(result.frames, 1) < 0.25 && result.biggestJump < 20,
    JSON.stringify(result),
  );
  check(
    "the page's own smooth scrolling is restored afterwards",
    afterwards === 'smooth',
    `left as ${afterwards}`,
  );
}

// ------------------------------------------------------ dragging elements --
//
// A page has no single way of saying "this can be dragged", so there is one
// fixture for each of the three that exist: the `draggable` attribute, a
// library-style handle wearing nothing but `cursor: grab` and
// `touch-action: none`, and a plain div that is neither.

{
  // These fixtures sit near the bottom of a 3000px page, several off-screen at
  // the top, so each has to be scrolled into view before it can be aimed at.
  const at = (id) => page.evaluate((sel) => window.spot(sel), id);

  // --- the library kind: pointer events, translated by the delta since down --
  const handle = await at('handle');
  const dragged = await page.evaluate(async (from) => {
    const before = window.scrollY;
    await window.pinchDrag({ x: from.x, y: from.y, dx: 120, dy: 40 });
    await new Promise((r) => setTimeout(r, 200));
    const el = document.getElementById('handle');
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { moved: [Math.round(m.e), Math.round(m.f)], scrolled: window.scrollY - before };
  }, handle);
  check(
    'a pinch-drag carries an element a library made draggable',
    dragged.moved[0] > 80 && dragged.moved[1] > 20,
    `moved ${JSON.stringify(dragged.moved)}, expected about [120, 40]`,
  );
  check(
    'carrying an element does not scroll the page underneath it',
    dragged.scrolled === 0,
    `page scrolled ${dragged.scrolled}px`,
  );

  // --- pressed on contact, and moving from the first pixel -----------------
  //
  // A mouse presses the instant the button goes down, and a drag library shows
  // its held state right then. Waiting for the drag to be recognised first
  // leaves the element sitting still through the threshold and then jumping to
  // catch up.
  const immediate = await page.evaluate(async () => {
    const el = document.getElementById('handle');
    el.style.transform = '';
    const from = await window.spot('handle');
    window.grabLog = [];

    for (let i = 0; i < 30; i++) window.feedNow(...window.toCamera(from.x, from.y), false);
    window.feedNow(...window.toCamera(from.x, from.y), true);
    await new Promise((r) => setTimeout(r, 40));
    const onPress = window.grabLog.slice();

    // Well under `drag.threshold`, which used to mean no movement at all.
    const nudge = 12;
    for (let i = 1; i <= 4; i++) {
      window.feedNow(...window.toCamera(from.x + (nudge * i) / 4, from.y), true);
      await new Promise((r) => setTimeout(r, 30));
    }
    const moved = Math.round(new DOMMatrix(getComputedStyle(el).transform).e);
    window.feedNow(...window.toCamera(from.x + nudge, from.y), false);
    await new Promise((r) => setTimeout(r, 100));
    el.style.transform = '';
    return { onPress, moved, nudge };
  });
  check(
    'the pinch takes hold of the element before it has moved at all',
    immediate.onPress.length === 1 && immediate.onPress[0] === 'pointerdown',
    JSON.stringify(immediate.onPress),
  );
  check(
    'a small movement moves the element by that much, not by the threshold',
    Math.abs(immediate.moved - immediate.nudge) <= 4,
    `hand moved ${immediate.nudge}px, element moved ${immediate.moved}px`,
  );

  // --- a press still lands when the library lifts the element away ----------
  const lifted = await page.evaluate(async () => {
    const from = await window.spot('lifted');
    window.grabLog = [];
    for (let i = 0; i < 30; i++) window.feedNow(...window.toCamera(from.x, from.y), false);
    window.feedNow(...window.toCamera(from.x, from.y), true);
    await new Promise((r) => setTimeout(r, 80));
    const covering = document.elementFromPoint(from.x, from.y)?.id ?? '(overlay)';
    window.feedNow(...window.toCamera(from.x, from.y), false);
    await new Promise((r) => setTimeout(r, 150));
    return { log: window.grabLog, covering };
  });
  check(
    'the fixture really does cover the element it lifted',
    lifted.covering !== 'lifted',
    `expected a clone over it, found ${lifted.covering}`,
  );
  check(
    'a press lands even when the library covers the element with a clone',
    lifted.log.includes('lifted-click'),
    JSON.stringify(lifted.log),
  );

  // --- and it keeps its hover state the whole way ---------------------------
  const hover = await page.evaluate(async () => {
    const el = document.getElementById('handle');
    el.style.transform = '';
    const from = await window.spot('handle');
    const shade = () => getComputedStyle(el).backgroundColor;

    for (let i = 0; i < 30; i++) window.feedNow(...window.toCamera(from.x, from.y), false);
    const hovered = shade();
    window.feedNow(...window.toCamera(from.x, from.y), true);

    // Sampled well past `drag.threshold`, which is where the hover used to be
    // dropped — mid-gesture, long after the pinch.
    let during = null;
    for (let i = 1; i <= 10; i++) {
      window.feedNow(...window.toCamera(from.x + i * 12, from.y), true);
      await new Promise((r) => setTimeout(r, 30));
      if (i === 8) during = shade();
    }
    window.feedNow(...window.toCamera(from.x + 120, from.y), false);
    await new Promise((r) => setTimeout(r, 150));
    el.style.transform = '';
    return { hovered, during };
  });
  check(
    'the fixture really does have a hover state',
    hover.hovered === 'rgb(0, 202, 72)',
    hover.hovered,
  );
  check(
    'an element keeps its hover state while being carried',
    hover.during === hover.hovered,
    `hovered ${hover.hovered}, mid-drag ${hover.during}`,
  );

  // --- carrying something is not clicking it -------------------------------
  const clickOnDrag = await page.evaluate(async () => {
    const el = document.getElementById('handle');
    el.style.transform = '';
    const from = await window.spot('handle');
    window.grabLog = [];
    // Comfortably past `grab.tapDuration`, so this is a drag by the only
    // measure that counts.
    await window.pinchDrag({ x: from.x, y: from.y, dx: 120, steps: 32 });
    await new Promise((r) => setTimeout(r, 200));
    el.style.transform = '';
    return window.grabLog;
  });
  check(
    'carrying an element does not also click it',
    clickOnDrag.includes('pointerdown') &&
      clickOnDrag.includes('pointerup') &&
      !clickOnDrag.includes('click'),
    JSON.stringify(clickOnDrag),
  );

  // --- clicking something that can also be dragged --------------------------
  //
  // The hard case: a button that is also a drag handle. How long the pinch
  // lasted is the only thing that separates the two. Distance says nothing,
  // because the element is picked up the instant the pinch closes and follows
  // the hand from there, so every press moves it — and a pinch held in mid-air
  // drifts further than a finger on glass ever does.
  const quick = await page.evaluate(async () => {
    const el = document.getElementById('handle');
    el.style.transform = '';
    const from = await window.spot('handle');
    window.grabLog = [];

    for (let i = 0; i < 30; i++) window.feedNow(...window.toCamera(from.x, from.y), false);
    window.feedNow(...window.toCamera(from.x, from.y), true);
    // A long way — far past anything a distance rule would have allowed — but
    // over and done with well inside the tap window.
    for (const d of [0, 25, 50, 75, 100]) {
      window.feedNow(...window.toCamera(from.x + d, from.y), true);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.feedNow(...window.toCamera(from.x + 100, from.y), false);
    await new Promise((r) => setTimeout(r, 150));
    el.style.transform = '';
    return window.grabLog;
  });
  check(
    'a quick pinch on a draggable clicks it, however far it travelled',
    quick.includes('click'),
    `moved 100px in 200ms and got ${JSON.stringify(quick)}`,
  );

  // The other side of the same rule: held is a drag, even standing still.
  const lingered = await page.evaluate(async () => {
    const el = document.getElementById('handle');
    el.style.transform = '';
    const from = await window.spot('handle');
    window.grabLog = [];

    for (let i = 0; i < 30; i++) window.feedNow(...window.toCamera(from.x, from.y), false);
    window.feedNow(...window.toCamera(from.x, from.y), true);
    const until = performance.now() + 1100;
    while (performance.now() < until) {
      window.feedNow(...window.toCamera(from.x + 3, from.y), true);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.feedNow(...window.toCamera(from.x + 3, from.y), false);
    await new Promise((r) => setTimeout(r, 150));
    el.style.transform = '';
    return window.grabLog;
  });
  check(
    'a pinch held past the tap window is a drag, not a click',
    !lingered.includes('click'),
    `held 1.1s barely moving and got ${JSON.stringify(lingered)}`,
  );

  // Letting go somewhere else is not a click, however short the gesture — the
  // press and the release have to belong to the same element.
  const elsewhere = await page.evaluate(async () => {
    await window.spot('card');
    const card = document.getElementById('card');
    const r = card.getBoundingClientRect();
    let clicked = 0;
    const count = () => { clicked += 1; };
    card.addEventListener('click', count);

    const x = r.left + r.width / 2;
    const y = r.bottom - 8;
    for (let i = 0; i < 30; i++) window.feedNow(...window.toCamera(x, y), false);
    window.feedNow(...window.toCamera(x, y), true);
    // Quick enough to be a tap, but let go off the card entirely.
    for (const d of [10, 20, 30, 40]) {
      window.feedNow(...window.toCamera(x, y + d), true);
      await new Promise((rs) => setTimeout(rs, 40));
    }
    window.feedNow(...window.toCamera(x, y + 40), false);
    await new Promise((rs) => setTimeout(rs, 150));
    card.removeEventListener('click', count);
    return { clicked, landedOn: document.elementFromPoint(x, y + 40)?.id };
  });
  check(
    'letting go off the element does not click it',
    elsewhere.clicked === 0 && elsewhere.landedOn !== 'card',
    JSON.stringify(elsewhere),
  );

  // --- the HTML5 kind: its own event sequence, which no pointer event implies --
  // Both read after a single scroll: measuring the second one separately would
  // scroll the page again and leave the first set of coordinates pointing
  // somewhere else.
  const { card, zone } = await page.evaluate(async () => {
    await window.spot('card');
    const box = (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    return { card: box('card'), zone: box('dropzone') };
  });
  const html5 = await page.evaluate(async ([from, to]) => {
    window.dragLog = [];
    document.getElementById('handle').style.transform = '';
    await window.pinchDrag({
      x: from.x,
      y: from.y,
      dx: to.x - from.x,
      dy: to.y - from.y,
      // Long enough to be a drag by the only measure there is. Under
      // `grab.tapDuration` this would be a press, and a press never opens the
      // HTML5 sequence — the same as `mousedown` alone in a browser.
      steps: 30,
    });
    await new Promise((r) => setTimeout(r, 200));
    return window.dragLog;
  }, [card, zone]);
  check(
    'an HTML5 draggable gets the full drag sequence',
    html5[0] === 'dragstart' &&
      html5.includes('dragenter') &&
      html5.includes('dragover') &&
      html5.at(-1) === 'dragend',
    JSON.stringify(html5),
  );
  check(
    'dropping on a zone that accepts it fires drop, before dragend',
    html5.includes('drop') && html5.indexOf('drop') === html5.length - 2,
    JSON.stringify(html5),
  );

  // --- and a plain element still scrolls, which is the thing not to break ----
  const plain = await at('plain');
  const stillScrolls = await page.evaluate(async (from) => {
    const before = window.scrollY;
    await window.pinchDrag({ x: from.x, y: from.y, dy: -160 });
    await new Promise((r) => setTimeout(r, 400));
    return window.scrollY - before;
  }, plain);
  check(
    'a drag on something not draggable still scrolls the page',
    stillScrolls > 80,
    `scrolled ${Math.round(stillScrolls)}px`,
  );

  // --- a tap on a draggable is still a tap, not a one-pixel drag ------------
  const cardAgain = await at('card');
  const tapped = await page.evaluate(async (from) => {
    window.dragLog = [];
    let clicked = 0;
    const card = document.getElementById('card');
    const count = () => { clicked += 1; };
    card.addEventListener('click', count);
    for (let i = 0; i < 30; i++) window.feedNow(...window.toCamera(from.x, from.y), false);
    window.feedNow(...window.toCamera(from.x, from.y), true);
    await new Promise((r) => setTimeout(r, 60));
    window.feedNow(...window.toCamera(from.x, from.y), false);
    await new Promise((r) => setTimeout(r, 100));
    card.removeEventListener('click', count);
    return { clicked, log: window.dragLog };
  }, cardAgain);
  check(
    'a tap on a draggable element still clicks it',
    tapped.clicked === 1 && tapped.log.length === 0,
    JSON.stringify(tapped),
  );

  // --- each CSS signal has to stand on its own ------------------------------
  const signals = await page.evaluate(() => {
    const make = (css) => {
      const el = document.createElement('div');
      el.style.cssText = `width:60px;height:60px;${css}`;
      document.getElementById('page').appendChild(el);
      const found = window.hc.grabbableFrom(el);
      el.remove();
      return found ? found.node === el : false;
    };
    return {
      touchAction: make('touch-action:none'),
      cursor: make('cursor:grab'),
      resize: make('cursor:col-resize'),
      neither: make('background:#eee'),
    };
  });
  check(
    'touch-action, a grab cursor and a resize cursor each mark a handle',
    signals.touchAction && signals.cursor && signals.resize,
    JSON.stringify(signals),
  );
  check('a plain element is not a handle', signals.neither === false);

  // A scroll container wearing the same CSS is a scroller, not a handle. This
  // is the expensive mistake: claim it and the page loses a scrollable region
  // with no way to get it back.
  const scroller = await page.evaluate(() => {
    const box = document.getElementById('box');
    box.style.touchAction = 'none';
    box.style.cursor = 'move';
    const asHandle = window.hc.grabbableFrom(box.querySelector('div'));
    box.style.touchAction = '';
    box.style.cursor = '';
    return asHandle;
  });
  check(
    'a scrollable element is not claimed as a handle by its CSS alone',
    scroller === null,
    `matched ${JSON.stringify(scroller)}`,
  );

  // --- the long-press mode, for a scrolling list of draggable cards ---------
  const longPress = await page.evaluate(async () => {
    const el = document.getElementById('handle');
    const settle = () => new Promise((r) => setTimeout(r, 400));
    const offset = () => Math.round(new DOMMatrix(getComputedStyle(el).transform).f);

    window.hc.options.grab.holdDelay = 300;
    el.style.transform = '';
    let from = await window.spot('handle');
    let before = window.scrollY;
    await window.pinchDrag({ x: from.x, y: from.y, dy: -160 });
    await settle();
    const quick = { moved: offset(), scrolled: window.scrollY - before };

    el.style.transform = '';
    from = await window.spot('handle');
    before = window.scrollY;
    await window.pinchDrag({ x: from.x, y: from.y, dy: -160, holdMs: 380 });
    await settle();
    const held = { moved: offset(), scrolled: window.scrollY - before };

    window.hc.options.grab.holdDelay = 0;
    el.style.transform = '';
    return { quick, held };
  });
  check(
    // What is being asked is which of the two the gesture became, and `moved`
    // is what answers it. The distance scrolled only has to be unmistakably
    // real — pinned to half the drag, it was sitting on its own boundary and
    // failed on a run that scrolled exactly 80.
    'with a hold required, a quick drag scrolls instead of grabbing',
    longPress.quick.scrolled > 40 && longPress.quick.moved === 0,
    JSON.stringify(longPress.quick),
  );
  check(
    'with a hold required, a held drag grabs instead of scrolling',
    longPress.held.moved < -80 && longPress.held.scrolled === 0,
    JSON.stringify(longPress.held),
  );

  // --- the CSS heuristics must not swallow the whole page -------------------
  const rootSafe = await page.evaluate(() => {
    document.body.style.touchAction = 'none';
    document.body.style.cursor = 'move';
    const found = window.hc.grabbableFrom(document.getElementById('plain'));
    document.body.style.touchAction = '';
    document.body.style.cursor = '';
    return found;
  });
  check(
    'touch-action and cursor on body are not treated as a drag handle',
    rootSafe === null,
    `matched ${JSON.stringify(rootSafe)}`,
  );
}

// ----------------------------------------------------- a real drag library --
//
// GSAP's Draggable, loaded for real rather than imitated, because the numbers
// that matter here could not have been guessed. It calls anything over 2px of
// pointer travel a drag, and then stops any click arriving within 50ms of that
// drag ending. A mouse clears neither bar; a hand holding a pinch in mid-air
// clears both on every single press, so every press was being swallowed.

{
  const gsapPage = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  gsapPage.on('pageerror', (error) => errors.push(error.message));
  await gsapPage.goto(`http://localhost:${PORT}/test/harness.html?gsap=1`, {
    waitUntil: 'load',
  });
  const loaded = await gsapPage.evaluate(() => window.gsapReady);

  const press = await gsapPage.evaluate(async () => {
    const from = await window.spot('gsapcard');
    window.gsapLog = [];
    for (let i = 0; i < 30; i++) window.feedNow(...window.toCamera(from.x, from.y), false);
    window.feedNow(...window.toCamera(from.x, from.y), true);
    // 30px of drift, which is nothing for a hand and fifteen times GSAP's bar,
    // over a span that stays well inside `grab.tapDuration` even under load.
    for (let i = 1; i <= 3; i++) {
      window.feedNow(...window.toCamera(from.x + i * 10, from.y), true);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.feedNow(...window.toCamera(from.x + 30, from.y), false);
    await new Promise((r) => setTimeout(r, 300));
    return window.gsapLog;
  });

  const dragged = await gsapPage.evaluate(async () => {
    const card = document.getElementById('gsapcard');
    const from = await window.spot('gsapcard');
    const before = card.getBoundingClientRect().left;
    window.gsapLog = [];
    await window.pinchDrag({ x: from.x, y: from.y, dx: 150, steps: 30 });
    await new Promise((r) => setTimeout(r, 300));
    return {
      log: window.gsapLog,
      moved: Math.round(card.getBoundingClientRect().left - before),
    };
  });
  await gsapPage.close();

  check('GSAP Draggable is really loaded', loaded === true, String(loaded));
  check(
    'a press on a GSAP Draggable reaches its click handler',
    press.includes('press') && press.includes('click'),
    JSON.stringify(press),
  );
  check(
    'a drag on a GSAP Draggable moves it and does not click it',
    dragged.moved > 100 && !dragged.log.includes('click'),
    JSON.stringify(dragged),
  );
  check('GSAP runs without errors', errors.length === 0, errors.join(' | '));
}

// ------------------------------------------- asynchronously committed scroll --
//
// On iOS the page's scroll offset lives in the UI process. A write is a message
// that commits a moment later, and a read taken straight afterwards can still
// return the old value. Any code that does `scrollTop = scrollTop - delta` each
// frame is then a read-modify-write loop against a value that has not caught
// up: one frame reads a stale offset and re-asks for a target it already asked
// for, so the page does not move, and the next reads a fresh one and moves
// twice as far. Dead frame, double step — the page skips while the cursor, a
// composited transform that round-trips nowhere, glides.
//
// Chromium commits synchronously, so this has to be simulated. The fixture
// makes the offset *read back* lag three frames behind the truth while the
// writes themselves land normally, which is exactly the shape of the problem.
// It reproduces the two things the same phone shows: an inner `overflow: auto`
// element stays smooth, because its offset lives in this process, while the
// page it sits on skips.

{
  const async_ = await browser.newPage({ viewport: { width: 420, height: 800 } });
  await async_.addInitScript(() => {
    const real = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    const history = new WeakMap();
    const LAG = 3;
    const pump = () => {
      const el = document.scrollingElement || document.documentElement;
      const seen = history.get(el) || [];
      seen.push(real.get.call(el));
      if (seen.length > LAG + 1) seen.shift();
      history.set(el, seen);
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true,
      set: real.set,
      get() {
        const seen = history.get(this);
        return seen && seen.length > LAG ? seen[0] : real.get.call(this);
      },
    });
  });
  await async_.goto(`http://localhost:${PORT}/test/harness.html`, { waitUntil: 'load' });
  // The lag is expressed in frames, so a few have to have gone by before the
  // fixture has any history to report from.
  await async_.waitForTimeout(200);

  const lagging = await async_.evaluate(() => {
    const el = document.scrollingElement;
    window.scrollTo(0, 400);
    // Proves the fixture is doing something before anything is concluded from it.
    return { reported: el.scrollTop, real: window.scrollY };
  });
  const result = await async_.evaluate(() => window.timedDrag({ trackingFps: 18, jitter: 0.35 }));
  await async_.close();

  check(
    'the fixture really does report a stale scroll offset',
    lagging.real === 400 && lagging.reported !== 400,
    JSON.stringify(lagging),
  );
  check(
    'a scroller that commits asynchronously still scrolls',
    result.scrolled > 200,
    `only moved ${Math.round(result.scrolled)}px — ${JSON.stringify(result)}`,
  );
  check(
    'a scroller that commits asynchronously does not skip',
    result.stalled / Math.max(result.frames, 1) < 0.1 && result.roughness < 0.15,
    JSON.stringify(result),
  );
}

// ------------------------------------------- browser-animated scroll modes --
//
// The alternative strategy: hand the distance to the browser as a smooth
// scroll rather than writing a position every frame. It exists because on iOS
// the scroll position lives on a different thread from JavaScript, so a
// browser-run animation can be smooth where per-frame writes are not.
// `hybrid` uses it for the throw only, and tracks the hand directly during the
// drag itself.

for (const mode of ['native', 'hybrid']) {
  const page2 = await browser.newPage({ viewport: { width: 420, height: 800 } });
  const errors = [];
  page2.on('pageerror', (error) => errors.push(error.message));
  await page2.goto(`http://localhost:${PORT}/test/harness.html?mode=${mode}`, {
    waitUntil: 'load',
  });
  const configured = await page2.evaluate(() => window.hc.options.drag.mode);
  const result = await page2.evaluate(() => window.timedDrag({ trackingFps: 15 }));
  await page2.waitForTimeout(600);
  const settled = await page2.evaluate(() => window.scrollY);
  await page2.close();

  check(`${mode} mode is what the fixture configured`, configured === mode, configured);
  check(
    `${mode} mode scrolls the page`,
    result.scrolled > 150,
    `moved ${Math.round(result.scrolled)}px — ${JSON.stringify(result)}`,
  );
  check(
    `${mode} mode keeps going after release`,
    settled >= result.scrolled - 1,
    `during ${Math.round(result.scrolled)}, settled ${Math.round(settled)}`,
  );
  check(`${mode} mode runs without errors`, errors.length === 0, errors.join(' | '));
}

// ---------------------------------------------------------------- the feel --
//
// Two complaints, measured separately, because they have separate causes.
//
// "It waits too long, almost like I scroll and then the page scrolls" — the
// hold delay that keeps a tap from becoming a scroll was also making a flick
// sit still for 140ms before anything moved.
//
// "It's missing any velocity where I can push and then it scrolls according to
// my speed" — the throw was not proportional to how fast the hand left. A
// release at twice the speed has to coast about twice as far, in every mode.

const travelled = {};
for (const mode of ['write', 'native', 'hybrid']) {
  const feel = await browser.newPage({ viewport: { width: 420, height: 800 } });
  await feel.goto(`http://localhost:${PORT}/test/harness.html?mode=${mode}`, {
    waitUntil: 'load',
  });
  const slow = await feel.evaluate(() => window.feelTest({ speed: 700 }));
  const fast = await feel.evaluate(() => window.feelTest({ speed: 1400 }));
  // Held still for half a second before letting go. `native` hands the drag to
  // the browser as an animation, and that animation is still running for a few
  // hundred milliseconds after the hand stops — long enough to be mistaken for
  // a throw if the hand lets go too soon after stopping.
  const held = await feel.evaluate(() =>
    window.feelTest({ speed: 1400, holdFrames: 16 }),
  );
  // Derived from the configured decay rather than hardcoded, so retuning the
  // feel does not mean rewriting the expectation.
  const { ideal, retargetMs } = await feel.evaluate(() => {
    const { friction, retargetMs: r } = window.hc.options.drag;
    return { ideal: 1400 * (-1 / (60 * Math.log(friction))), retargetMs: r };
  });
  await feel.close();

  // `native` cannot start before it has issued its first scroll, and it issues
  // those on a fixed cadence, so its floor is genuinely one interval higher.
  // Holding it to the same number as the modes that write every frame would be
  // measuring the cadence rather than the responsiveness.
  const promptly = 140 + (mode === 'native' ? retargetMs : 0);

  check(
    `${mode}: a flick starts the page moving promptly`,
    fast.latencyMs >= 0 && fast.latencyMs < promptly,
    `took ${fast.latencyMs}ms, allowed ${promptly}ms — ${JSON.stringify(fast)}`,
  );
  check(
    `${mode}: the throw carries the hand's speed`,
    fast.coasted > slow.coasted * 1.6,
    `700px/s threw ${slow.coasted}px, 1400px/s threw ${fast.coasted}px`,
  );
  // `native` is deliberately excluded: it is still catching up when the hand
  // lets go, so its "coasted" figure is the tail of the drag plus the throw.
  // The cross-mode check below covers it on total distance instead.
  if (mode !== 'native') {
    check(
      `${mode}: the throw is roughly the distance the decay implies`,
      fast.coasted > ideal * 0.7 && fast.coasted < ideal * 1.4,
      `expected ~${Math.round(ideal)}px, got ${fast.coasted}px`,
    );
  }
  travelled[mode] = fast.duringDrag + fast.coasted;
  check(
    `${mode}: stopping before letting go does not throw the page`,
    Math.abs(held.coasted) < 30,
    `coasted ${held.coasted}px after the hand had already stopped`,
  );
}

// Every mode follows the same hand and decays the same throw, so one gesture
// has to land in the same place whichever is driving. Where the split between
// "during the drag" and "after the release" falls is a property of the mode;
// the total is not. This is what caught the scroll runner reading the offset
// back before writing it: `native` was quietly losing a quarter of the drag,
// because each write aimed relative to an offset that had not caught up.
{
  const totals = Object.values(travelled);
  const spread = Math.max(...totals) / Math.min(...totals);
  check(
    'all three modes travel the same distance for the same gesture',
    spread < 1.12,
    Object.entries(travelled)
      .map(([m, d]) => `${m} ${Math.round(d)}px`)
      .join(', '),
  );
}

// `write` and `hybrid` drive the drag itself, so the page should stay under the
// hand rather than trailing it. This is the difference the user felt between
// the two strategies, so it is worth pinning down rather than inferring.
{
  const feel = await browser.newPage({ viewport: { width: 420, height: 800 } });
  await feel.goto(`http://localhost:${PORT}/test/harness.html?mode=hybrid`, {
    waitUntil: 'load',
  });
  const hybrid = await feel.evaluate(() => window.feelTest({ speed: 1400 }));
  await feel.goto(`http://localhost:${PORT}/test/harness.html?mode=native`, {
    waitUntil: 'load',
  });
  const native = await feel.evaluate(() => window.feelTest({ speed: 1400 }));
  await feel.close();

  check(
    'hybrid keeps the page under the hand better than native does',
    hybrid.duringDrag > native.duringDrag * 1.3,
    `hybrid ${hybrid.duringDrag}px vs native ${native.duringDrag}px by release`,
  );
}

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

// ------------------------------------------------------------------ report --

for (const { name, pass, detail } of results) {
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? `  — ${detail}` : ''}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
