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

await page.evaluate(() => window.hc.setMinimized(true));
await page.waitForTimeout(400);
const mini = await shadow('.hc-panel');
const miniCta = await shadow('.hc-mini-cta');
check(
  'minimized trackpad is 106x106',
  mini.width === 106 && mini.height === 106,
  `${mini.width}x${mini.height}`,
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

check(
  'minimized camera button is 32x32, 8px radius, inset 4px',
  miniCta.width === 32 &&
    miniCta.height === 32 &&
    miniCta.radius === '8px' &&
    miniCta.left - mini.left === 4 &&
    mini.bottom - miniCta.bottom === 4,
  JSON.stringify(miniCta),
);
await page.evaluate(() => window.hc.setMinimized(false));
await page.waitForTimeout(400);

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
  const cx = rect.left + rect.width / 2;
  let cy = rect.top + rect.height / 2;
  for (let i = 0; i < 40; i++) window.feed(...window.toCamera(cx, cy), false);
  window.feed(...window.toCamera(cx, cy), true);
  for (let i = 0; i < 60; i++) {
    cy -= 3;
    window.feed(...window.toCamera(cx, cy), true);
  }
  window.feed(...window.toCamera(cx, cy), false);
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
  const cx = 850;
  let cy = 400;
  for (let i = 0; i < 40; i++) window.feed(...window.toCamera(cx, cy), false);
  window.feed(...window.toCamera(cx, cy), true);
  for (let i = 0; i < 50; i++) {
    cy -= 4;
    window.feed(...window.toCamera(cx, cy), true);
  }
  // Sampled a beat after the drag, once the runner has caught up, then again
  // after the fling has played out.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const during = window.scrollY;
  window.feed(...window.toCamera(cx, cy), false);
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
check('the camera-off control appears when live', cornerLeft.display !== 'none', cornerLeft.display);

const miniLive = await page.evaluate(async () => {
  window.hc.setMinimized(true);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const sr = document.querySelector('[data-hand-cursor]').shadowRoot;
  const read = () => ({
    greenButton: getComputedStyle(sr.querySelector('.hc-mini-cta')).display,
    cameraOff: getComputedStyle(sr.querySelector('.hc-corner--tl')).display,
    expand: getComputedStyle(sr.querySelector('.hc-corner--tr')).display,
  });
  const live = read();
  window.hc.panel.setState('idle');
  const idle = read();
  window.hc.panel.setState('live');
  return { live, idle };
});
check(
  'minimized while live shows only the camera-off icon, no green button',
  miniLive.live.greenButton === 'none' &&
    miniLive.live.cameraOff !== 'none' &&
    miniLive.live.expand !== 'none',
  JSON.stringify(miniLive.live),
);
check(
  'minimized before enabling still shows the green button',
  miniLive.idle.greenButton !== 'none' && miniLive.idle.cameraOff === 'none',
  JSON.stringify(miniLive.idle),
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
    `biggest single-repaint jump ${slow.biggestJump}px — ${JSON.stringify(slow)}`,
  );
  check(
    `${label}: slow tracking is nearly as smooth as fast`,
    slow.stalled / slow.frames < fast.stalled / fast.frames + 0.15,
    `slow ${slow.stalled}/${slow.frames} vs fast ${fast.stalled}/${fast.frames}`,
  );
  check(`${label}: no errors during the drag`, errors.length === 0, errors.join(' | '));
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
