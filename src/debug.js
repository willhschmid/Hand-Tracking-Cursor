/**
 * On-screen diagnostics.
 *
 * Scroll jank has two very different causes that look identical from the
 * outside, and telling them apart needs numbers from the actual device:
 *
 *   1. Landmarks arriving slower than the screen repaints. The scroll runner
 *      handles this — `paint` stays near the display rate while `track` is low.
 *
 *   2. The main thread being saturated by model inference. Then nothing on the
 *      main thread runs at display rate, including the scroll runner, and no
 *      amount of easing helps. The tell is `paint` collapsing to roughly
 *      `track`, with `worst frame` far above 16ms.
 *
 * Enable with `debug: true`, or by putting `handcursor-debug` anywhere in the
 * page URL — which works on a phone, where there is no console to reach for.
 */

const WINDOW = 60;

class Rolling {
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
}

const ROWS = [
  ['paint', 'repaints per second — the rate the screen can actually update'],
  ['track', 'landmark frames per second'],
  ['model', 'milliseconds per inference, mean / worst'],
  ['frame', 'milliseconds between repaints, median / 95th'],
  ['worst', 'longest gap between repaints'],
  ['blocked', 'share of repaints later than 32ms'],
  ['scroll', 'scroll writes per second, and mean step'],
];

export class DebugOverlay {
  constructor() {
    this.inference = new Rolling();
    this.frameGaps = new Rolling();
    this.scrollSteps = new Rolling();

    this.paintCount = 0;
    this.trackCount = 0;
    this.scrollCount = 0;
    this.blockedCount = 0;
    this.lastPaintAt = 0;
    this.lastReportAt = 0;
    this.running = false;

    this.el = document.createElement('div');
    this.el.className = 'hc-debug';
    this.el.innerHTML = ROWS.map(
      ([key, title]) =>
        `<div class="hc-debug-row" title="${title}">` +
        `<span>${key}</span><b data-k="${key}">—</b></div>`,
    ).join('');
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

    if (!this.lastReportAt) this.lastReportAt = now;
    const elapsed = now - this.lastReportAt;
    if (elapsed < 500) return;

    const perSecond = (n) => Math.round((n * 1000) / elapsed);
    this.set('paint', `${perSecond(this.paintCount)}/s`);
    this.set('track', `${perSecond(this.trackCount)}/s`);
    this.set(
      'model',
      this.inference.values.length
        ? `${this.inference.mean.toFixed(0)} / ${this.inference.max.toFixed(0)}ms`
        : '—',
    );
    this.set(
      'frame',
      `${this.frameGaps.percentile(0.5).toFixed(0)} / ${this.frameGaps.percentile(0.95).toFixed(0)}ms`,
    );
    this.set('worst', `${this.frameGaps.max.toFixed(0)}ms`);

    const blocked = this.paintCount ? (this.blockedCount / this.paintCount) * 100 : 0;
    this.set('blocked', `${blocked.toFixed(0)}%`, blocked > 20);
    this.set(
      'scroll',
      this.scrollCount
        ? `${perSecond(this.scrollCount)}/s ${this.scrollSteps.mean.toFixed(1)}px`
        : '—',
    );

    this.paintCount = 0;
    this.trackCount = 0;
    this.scrollCount = 0;
    this.blockedCount = 0;
    this.lastReportAt = now;
  }

  set(key, value, warn = false) {
    const node = this.el.querySelector(`[data-k="${key}"]`);
    if (!node) return;
    node.textContent = value;
    node.classList.toggle('is-warn', warn);
  }

  destroy() {
    this.stop();
    this.el.remove();
  }
}
