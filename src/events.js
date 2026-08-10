/**
 * Synthesized input events.
 *
 * Everything the cursor does to the page is a dispatched event, so these are
 * built to look like the real thing: the full pointer/mouse pair a browser
 * sends, with real coordinates, `composed` so they cross shadow boundaries, and
 * `bubbles` so listeners on `document` see them.
 *
 * They are still untrusted events, which the platform treats differently in two
 * ways worth knowing about. They cannot drive browser chrome — an iOS URL bar
 * will not collapse for one — and they cannot operate UA-implemented widget
 * internals such as a range input's thumb. Anything the page implements itself
 * responds normally.
 */

export function eventInit(x, y, extra) {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: (window.screenX || 0) + x,
    screenY: (window.screenY || 0) + y,
    ...extra,
  };
}

const POINTER = { pointerId: 1, pointerType: 'touch', isPrimary: true, width: 1, height: 1 };

export function firePointer(el, type, x, y, extra) {
  el.dispatchEvent(new PointerEvent(type, eventInit(x, y, { ...POINTER, ...extra })));
}

export function fireMouse(el, type, x, y, extra) {
  el.dispatchEvent(new MouseEvent(type, eventInit(x, y, extra)));
}

/**
 * One HTML5 drag event. Returns false when the target called
 * `preventDefault()`, which for `dragover` is how a drop zone says it will
 * accept the drop.
 */
export function fireDrag(el, type, x, y, dataTransfer) {
  return el.dispatchEvent(new DragEvent(type, eventInit(x, y, { dataTransfer })));
}
