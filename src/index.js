import { HandCursorController } from './controller.js';
import { DEFAULTS } from './config.js';

export const VERSION = '1.0.0';

let current = null;

/**
 * Creates (or replaces) the trackpad and adds it to the page.
 * @param {object} [options] see DEFAULTS in config.js
 */
export function init(options = {}) {
  current?.destroy();
  current = new HandCursorController(options);
  current.mount(options.container || document.body);
  return current;
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
  if (script?.dataset.manual !== undefined) return;
  const options = optionsFromScript(script);
  const run = () => {
    if (!current) init(options);
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
