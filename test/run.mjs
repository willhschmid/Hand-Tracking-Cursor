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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

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
  'CTA is 32px tall, green, 12px radius',
  cta.height === 32 && cta.background === 'rgb(0, 202, 72)' && cta.radius === '12px',
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
check(
  'minimized camera button is 32x32, inset 4px',
  miniCta.width === 32 &&
    miniCta.height === 32 &&
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
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
});
check(
  'cursor rotates toward its direction of travel',
  Math.abs(rotation - 112) < 25,
  `${rotation}deg, expected ~112deg`,
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

const elementScroll = await page.evaluate(() => {
  const box = document.getElementById('box');
  box.scrollTop = 0;
  const rect = box.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  let cy = rect.top + rect.height / 2;
  for (let i = 0; i < 40; i++) window.feed(...window.toCamera(cx, cy), false);
  window.feed(...window.toCamera(cx, cy), true);
  for (let i = 0; i < 30; i++) {
    cy -= 2;
    window.feed(...window.toCamera(cx, cy), true);
  }
  const scrolled = box.scrollTop;
  window.feed(...window.toCamera(cx, cy), false);
  return { scrolled, page: window.scrollY };
});
check(
  'pinch-drag scrolls the element under the cursor',
  elementScroll.scrolled > 30,
  JSON.stringify(elementScroll),
);
check('the page stays put while an element scrolls', elementScroll.page === 0);

const pageScroll = await page.evaluate(async () => {
  window.scrollTo(0, 0);
  const cx = 850;
  let cy = 400;
  for (let i = 0; i < 40; i++) window.feed(...window.toCamera(cx, cy), false);
  window.feed(...window.toCamera(cx, cy), true);
  for (let i = 0; i < 30; i++) {
    cy -= 3;
    window.feed(...window.toCamera(cx, cy), true);
  }
  const during = window.scrollY;
  window.feed(...window.toCamera(cx, cy), false);
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { during, after: window.scrollY };
});
check('pinch-drag scrolls the page', pageScroll.during > 40, JSON.stringify(pageScroll));
check(
  'releasing a drag flings the page',
  pageScroll.after > pageScroll.during,
  JSON.stringify(pageScroll),
);

const clicksAfterDrag = await page.evaluate(() => document.getElementById('out').textContent);
check('a drag does not also fire a click', clicksAfterDrag === '1', clicksAfterDrag);

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
