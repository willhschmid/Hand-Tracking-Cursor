import { DEFAULTS, mergeOptions } from './config.js';
import { CSS } from './styles.js';
import { FONT_URL } from './tokens.js';
import { Panel } from './panel.js';
import { CursorDriver } from './driver.js';
import { closeCamera, loadModel, openCamera } from './hand-model.js';

/** How long the hand can be missing before the cursor fades out. */
const HAND_TIMEOUT = 400;

/**
 * The single-page build: camera, model, trackpad and cursor all in one
 * document. The Chrome extension splits these across frames but reuses the same
 * Panel and CursorDriver.
 */
export class HandCursorController {
  constructor(userOptions = {}) {
    this.options = mergeOptions(DEFAULTS, userOptions);

    this.host = document.createElement('div');
    this.host.setAttribute('data-hand-cursor', '');
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    this.shadow.appendChild(style);

    this.panel = new Panel(this.options, {
      onToggleCamera: () => (this.running ? this.stop() : this.start()),
      onStop: () => this.stop(),
      onToggleSize: () => this.setMinimized(!this.panel.mini),
    });
    this.panel.mount(this.shadow);

    this.driver = new CursorDriver(this.options, {
      ui: shadowUi(this.shadow),
      onEvent: (type, detail) => this.emit(type, detail),
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
    this.panel.root.style.setProperty('--hc-margin', `${margin}px`);
    this.panel.root.style.setProperty('--hc-z', String(zIndex));
    this.panel.root.style.setProperty(
      '--hc-video-filter',
      grayscale ? 'grayscale(1)' : 'none',
    );
  }

  mount(parent = document.body) {
    if (this.mounted) return this;
    parent.appendChild(this.host);
    this.mounted = true;
    if (this.options.font) this.injectFont();
    document.addEventListener('keydown', this.onKeyDown, true);
    if (this.options.autoStart) this.start();
    return this;
  }

  /** Loads Inter unless the page already provides it. */
  injectFont() {
    const already =
      document.fonts &&
      typeof document.fonts.check === 'function' &&
      document.fonts.check('500 12px Inter');
    if (already || document.querySelector('link[href*="family=Inter"]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    link.setAttribute('data-hand-cursor-font', '');
    document.head.appendChild(link);
  }

  onKeyDown(event) {
    if (event.key === 'Escape' && this.running) this.stop();
  }

  emit(type, detail) {
    document.dispatchEvent(
      new CustomEvent(`handcursor:${type}`, { detail: { ...detail, instance: this } }),
    );
  }

  // ------------------------------------------------------------- lifecycle --

  async start() {
    if (this.running || this.starting || this.destroyed) return;
    this.starting = true;
    this.panel.setState('loading');

    try {
      const [stream, landmarker] = await Promise.all([
        openCamera(this.options.camera),
        this.landmarker ??
          loadModel({
            cdn: this.options.cdn,
            numHands: this.options.numHands ?? 1,
            delegate: this.options.delegate,
          }),
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
      this.panel.setState('live');
      if (this.options.hideNativeCursor) {
        document.documentElement.style.setProperty('cursor', 'none', 'important');
      }
      this.frame = requestAnimationFrame(this.tick);
      this.emit('start', {});
    } catch (error) {
      this.starting = false;
      closeCamera(this.stream);
      this.stream = null;
      const strings = this.options.strings;
      const message = strings[error?.code] || strings.failed;
      this.panel.setState('error', message);
      this.emit('error', { error, message });
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
    this.panel.setState('idle');
    if (this.options.hideNativeCursor) {
      document.documentElement.style.removeProperty('cursor');
    }
    this.emit('stop', {});
  }

  setMinimized(mini) {
    this.panel.setMini(Boolean(mini));
    this.emit(mini ? 'minimize' : 'expand', {});
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    document.removeEventListener('keydown', this.onKeyDown, true);
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
        // A dropped frame is not worth tearing the session down for.
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
}

/** Treats everything inside the trackpad's shadow root as our own chrome. */
function shadowUi(shadowRoot) {
  let hovered = null;
  const setHover = (button) => {
    if (hovered === button) return;
    hovered?.classList.remove('hc-hover');
    button?.classList.add('hc-hover');
    hovered = button || null;
  };

  return {
    contains: (el) => Boolean(el && shadowRoot.contains(el)),
    // CSS :hover never fires for a synthetic cursor, so fake it.
    hover: (el) => setHover(el?.closest?.('button') || null),
    tap: (el) => {
      const button = el?.closest?.('button');
      if (button && !button.disabled) button.click();
    },
  };
}
