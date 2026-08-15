import { HandCursorController } from './controller.js';
import { DEFAULTS, mergeOptions } from './config.js';

export const VERSION = '1.0.0';

let current = null;

/**
 * Whatever was written on the script tag, kept so that a later init() call can
 * build on it rather than throw it away. The tag is the page's baseline and the
 * snippet is the page changing its mind about part of it.
 */
let scriptOptions = {};

/**
 * Creates (or replaces) the trackpad and adds it to the page.
 * @param {object} [options] see DEFAULTS in config.js
 */
export function init(options = {}) {
  current?.destroy();
  // `handcursor-debug` anywhere in the URL turns the diagnostics on. There is no
  // console to open on a phone, which is exactly where the numbers are needed.
  const urlDebug =
    typeof location !== 'undefined' && location.href.includes('handcursor-debug');
  const settings = mergeOptions(scriptOptions, urlDebug ? { ...options, debug: true } : options);
  const controller = new HandCursorController(settings);
  current = controller;

  /*
   * The snippet that configures this usually sits under the script tag in the
   * body, where there is a body to mount into. In the head there is not — the
   * document has not reached it yet — and this used to throw on appendChild and
   * leave the page with no trackpad at all. Waiting costs the head case one
   * event and the body case nothing.
   *
   * The instance is registered before the wait either way, so the automatic
   * mount below stands down immediately rather than racing this one.
   */
  const parent = options.container || document.body;
  if (parent) {
    controller.mount(parent);
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        // Unless something has replaced it in the meantime, in which case that
        // one is the page's trackpad and this one was thrown away.
        if (current === controller) controller.mount(document.body);
      },
      { once: true },
    );
  }
  return controller;
}

/** The instance currently on the page, if any. */
export function instance() {
  return current;
}

export function destroy() {
  current?.destroy();
  current = null;
}

const BOOLEAN_KEYS = new Set([
  'autoStart',
  'minimized',
  'grayscale',
  'font',
  'hideNativeCursor',
]);

const NUMBER_KEYS = new Set(['margin', 'zIndex', 'numHands']);

/**
 * Reads configuration off the script tag, so the whole thing can be driven
 * without writing any JavaScript:
 *
 *   <script src="hand-cursor.js" data-position="bottom-right" data-margin="24"></script>
 */
function optionsFromScript(script) {
  if (!script) return {};
  const options = {};
  // `dataset` already camel-cases the attribute names for us.
  for (const [key, rawValue] of Object.entries(script.dataset)) {
    if (key === 'manual') continue;
    if (key === 'model' || key === 'vision' || key === 'wasm') {
      options.cdn = { ...options.cdn, [key]: rawValue };
    } else if (BOOLEAN_KEYS.has(key)) {
      options[key] = rawValue !== 'false';
    } else if (NUMBER_KEYS.has(key)) {
      const value = Number(rawValue);
      if (Number.isFinite(value)) options[key] = value;
    } else {
      options[key] = rawValue;
    }
  }
  return options;
}

function autoMount(script) {
  scriptOptions = optionsFromScript(script);
  if (script?.dataset.manual !== undefined) return;
  const run = () => {
    // Nothing to do if a snippet under the tag has already made one. That is
    // the whole mechanism: the page's own init() wins by getting there first,
    // and it inherits the tag's settings through scriptOptions.
    if (!current) init();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}

if (typeof document !== 'undefined') {
  autoMount(document.currentScript);
}

export { DEFAULTS, HandCursorController };
export default { init, instance, destroy, DEFAULTS, VERSION };
