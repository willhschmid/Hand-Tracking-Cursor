import { DEFAULTS, mergeOptions } from './config.js';
import { CSS } from './styles.js';
import { FONT_URL } from './tokens.js';
import { Panel } from './panel.js';
import { Cursor } from './cursor.js';
import { TouchEmulator } from './pointer.js';
import { PointFilter } from './one-euro.js';
import { controlPoint, pinchRatio } from './landmarks.js';
import { closeCamera, createHandLandmarker, openCamera } from './hand-model.js';

/** How long the hand can be missing before the cursor fades out. */
const HAND_TIMEOUT = 400;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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

    this.cursor = new Cursor(this.options);
    this.cursor.mount(this.panel.root);

    this.touch = new TouchEmulator(this.options, {
      shadowRoot: this.shadow,
      onTap: (detail) => this.emit('tap', detail),
    });

    this.filter = new PointFilter(this.options.smoothing);

    this.running = false;
    this.starting = false;
    this.destroyed = false;
    this.stream = null;
    this.landmarker = null;
    this.frame = null;
    this.lastVideoTime = -1;
    this.lastFrameAt = 0;
    this.lastHandAt = 0;
    this.pinching = false;
    this.position = null;
    this.velocity = { x: 0, y: 0 };

    this.applyStyleVariables();
    this.onKeyDown = this.onKeyDown.bind(this);
    this.tick = this.tick.bind(this);
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
          createHandLandmarker({
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
      this.lastFrameAt = 0;
      this.filter.reset();
      this.cursor.reset();
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
    this.pinching = false;
    this.position = null;

    this.touch.cancel();
    this.cursor.setVisible(false);
    this.cursor.reset();
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
    this.touch.destroy();
    this.cursor.destroy();
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

    let landmarks = null;
    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      try {
        const result = this.landmarker.detectForVideo(video, now);
        landmarks = result?.landmarks?.[0] ?? null;
      } catch {
        // A dropped frame is not worth tearing the session down for.
        landmarks = null;
      }
      this.lastLandmarks = landmarks;
    } else {
      landmarks = this.lastLandmarks ?? null;
    }

    if (landmarks) {
      this.lastHandAt = now;
      this.consumeHand(landmarks, now, video);
    } else if (now - this.lastHandAt > HAND_TIMEOUT) {
      this.releaseHand();
    }

    this.panel.drawHand(this.lastLandmarks, this.pinching);
  }

  consumeHand(landmarks, now, video) {
    const aspect = video.videoWidth / video.videoHeight;
    const dt = this.lastFrameAt ? (now - this.lastFrameAt) / 1000 : 1 / 60;
    this.lastFrameAt = now;

    const point = controlPoint(landmarks);
    const region = this.options.region;
    // Mirror, then stretch the usable slice of the frame across the viewport.
    const nx = clamp01(((1 - point.x) - region.x) / (1 - 2 * region.x));
    const ny = clamp01((point.y - region.y) / (1 - 2 * region.y));

    const raw = { x: nx * window.innerWidth, y: ny * window.innerHeight };
    const smoothed = this.filter.filter(raw.x, raw.y, dt);

    const previous = this.position;
    this.position = smoothed;
    this.velocity = previous
      ? { x: smoothed.x - previous.x, y: smoothed.y - previous.y }
      : { x: 0, y: 0 };

    this.cursor.setVisible(true);
    this.cursor.update(smoothed.x, smoothed.y, this.velocity.x, this.velocity.y, now);

    // Pinch, with hysteresis so a hand hovering near the threshold stays put.
    const ratio = pinchRatio(landmarks, aspect);
    const { on, off } = this.options.pinch;
    const pinching = this.pinching ? ratio < off : ratio < on;

    if (pinching && !this.pinching) {
      this.pinching = true;
      this.cursor.setPressed(true);
      this.touch.press(smoothed.x, smoothed.y, now);
      this.emit('press', { x: smoothed.x, y: smoothed.y });
    } else if (!pinching && this.pinching) {
      this.pinching = false;
      this.cursor.setPressed(false);
      this.touch.release(smoothed.x, smoothed.y, now);
      this.emit('release', { x: smoothed.x, y: smoothed.y });
    }

    if (this.pinching) {
      this.touch.drag(smoothed.x, smoothed.y, now);
    } else {
      this.touch.move(smoothed.x, smoothed.y);
    }

    this.emit('move', { x: smoothed.x, y: smoothed.y, pinching: this.pinching });
  }

  releaseHand() {
    if (this.position) {
      this.touch.cancel(this.position.x, this.position.y);
    }
    this.lastLandmarks = null;
    this.pinching = false;
    this.position = null;
    this.lastFrameAt = 0;
    this.filter.reset();
    this.cursor.setPressed(false);
    this.cursor.setVisible(false);
  }
}
