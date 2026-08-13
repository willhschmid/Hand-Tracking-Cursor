import { ICONS } from './icons.js';
import { SIZE } from './tokens.js';
import { drawSkeleton } from './skeleton.js';
import { HAND_GRAPHIC } from './hand-graphic.js';

/**
 * The trackpad card: the pre-enabled prompt, the live camera preview and the
 * minimized side tab, plus the skeleton overlay drawn on top of the feed.
 */
export class Panel {
  constructor(options, handlers) {
    this.options = options;
    this.handlers = handlers;
    this.state = 'idle';
    this.mini = Boolean(options.minimized);

    this.root = document.createElement('div');
    this.root.className = 'hc-root';
    this.root.dataset.position = options.position;
    this.root.dataset.state = this.state;
    this.root.dataset.mini = String(this.mini);

    // The dock is the card and its tab together, and the only thing that moves:
    // putting the trackpad away slides the pair sideways until the card is off
    // the screen and the tab is against the edge of it. The two shades under
    // them are what casts the shadow — see the stylesheet.
    this.root.innerHTML = `
      <div class="hc-dock">
        <div class="hc-shade hc-shade--card" aria-hidden="true"></div>
        <div class="hc-shade hc-shade--tab" aria-hidden="true"></div>
        <div class="hc-panel" role="region" aria-label="Hand tracking trackpad">
          <div class="hc-stage">
            <video class="hc-video" playsinline muted autoplay></video>
            <canvas class="hc-overlay" aria-hidden="true"></canvas>
            <div class="hc-scrim" aria-hidden="true"></div>
            <div class="hc-illo"><img class="hc-illo-img" src="${HAND_GRAPHIC}" alt="" width="${SIZE.illoWidth}" height="${SIZE.illoHeight}" draggable="false" /></div>
          </div>
          <p class="hc-copy"></p>
          <button class="hc-cta" type="button"></button>
          <button class="hc-corner hc-corner--tl" type="button"></button>
        </div>
        <button class="hc-tab" type="button">
          <span class="hc-tab-notch" aria-hidden="true">${ICONS.notch}</span>
          <span class="hc-tab-dot" aria-hidden="true"></span>
          ${ICONS.chevron}
        </button>
      </div>
      <p class="hc-sr" role="status" aria-live="polite"></p>
    `;

    const q = (sel) => this.root.querySelector(sel);
    this.panel = q('.hc-panel');
    this.video = q('.hc-video');
    this.canvas = q('.hc-overlay');
    this.copy = q('.hc-copy');
    this.cta = q('.hc-cta');
    this.cornerLeft = q('.hc-corner--tl');
    this.tab = q('.hc-tab');
    this.status = q('.hc-sr');

    this.ctx = this.canvas.getContext('2d');
    this.canvasSize = { width: 0, height: 0, dpr: 0 };

    this.cornerLeft.innerHTML = ICONS.videocamOff;
    this.cornerLeft.title = options.strings.disable;
    this.cornerLeft.setAttribute('aria-label', options.strings.disable);

    this.cta.addEventListener('click', (event) => handlers.onToggleCamera(event));
    // The whole tab is the affordance, in both directions. It is on the card
    // whether the card is out or away, so it is the only control the size needs
    // — the corner button that used to duplicate it inside the card is gone.
    this.tab.addEventListener('click', () => handlers.onToggleSize());
    this.cornerLeft.addEventListener('click', () => handlers.onStop());

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
    const loading = this.state === 'loading';
    const live = this.state === 'live';

    this.copy.textContent =
      this.state === 'error' ? this.message || s.failed : s.intro;

    const label = loading ? s.starting : this.state === 'error' ? s.retry : s.enable;
    this.cta.innerHTML =
      (loading ? '<span class="hc-spinner"></span>' : ICONS.videocam) +
      `<span>${label}</span>`;
    this.cta.disabled = loading;

    // The chevron does not turn around with the state — it points the way the
    // card lies, which is the same direction either way — so the label is the
    // only thing that says which way this goes.
    const sizeLabel = this.mini ? s.expand : s.minimize;
    this.tab.title = sizeLabel;
    this.tab.setAttribute('aria-label', sizeLabel);

    this.status.textContent = live
      ? 'Hand tracking is on.'
      : this.state === 'error'
        ? this.message || s.failed
        : '';
  }

  attachStream(stream) {
    this.video.srcObject = stream;
    return this.video.play().catch(() => {
      /* autoplay of a muted local stream is allowed; ignore spurious rejects */
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
      y: offsetY + p.y * drawHeight,
    }));

    drawSkeleton(this.ctx, points, { pinching });
  }

  destroy() {
    this.detachStream();
    this.root.remove();
  }
}
