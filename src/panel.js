import { ICONS } from './icons.js';
import { drawSkeleton, handIllustration } from './skeleton.js';

/**
 * The trackpad card: the pre-enabled prompt, the live camera preview and the
 * 106x106 minimized state, plus the skeleton overlay drawn on top of the feed.
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
    this.panel = q('.hc-panel');
    this.video = q('.hc-video');
    this.canvas = q('.hc-overlay');
    this.copy = q('.hc-copy');
    this.cta = q('.hc-cta');
    this.cornerLeft = q('.hc-corner--tl');
    this.cornerRight = q('.hc-corner--tr');
    this.miniCta = q('.hc-mini-cta');
    this.status = q('.hc-sr');

    this.ctx = this.canvas.getContext('2d');
    this.canvasSize = { width: 0, height: 0, dpr: 0 };

    this.cornerLeft.innerHTML = ICONS.videocamOff;
    this.cornerLeft.title = options.strings.disable;
    this.cornerLeft.setAttribute('aria-label', options.strings.disable);

    this.cta.addEventListener('click', (event) => handlers.onToggleCamera(event));
    this.miniCta.addEventListener('click', (event) => handlers.onToggleCamera(event));
    this.cornerLeft.addEventListener('click', () => handlers.onStop());
    this.cornerRight.addEventListener('click', () => handlers.onToggleSize());

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

    this.miniCta.innerHTML = live ? ICONS.videocamOff : ICONS.videocam;
    const miniLabel = live ? s.disable : s.enable;
    this.miniCta.title = miniLabel;
    this.miniCta.setAttribute('aria-label', miniLabel);
    this.miniCta.disabled = loading;

    const sizeLabel = this.mini ? s.expand : s.minimize;
    this.cornerRight.innerHTML = this.mini ? ICONS.expand : ICONS.collapse;
    this.cornerRight.title = sizeLabel;
    this.cornerRight.setAttribute('aria-label', sizeLabel);

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
