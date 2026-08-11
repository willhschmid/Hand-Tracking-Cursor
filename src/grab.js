import { fireDrag, fireMouse, firePointer } from './events.js';

/**
 * Picking up an element and moving it, rather than scrolling the page under it.
 *
 * There is no single way a web page says "this can be dragged", so this looks
 * for the three that exist:
 *
 *   - `draggable="true"`, the HTML5 mechanism, which wants its own
 *     dragstart/dragover/drop sequence rather than pointer events.
 *   - A drag handle a library set up, which is invisible in the markup. What
 *     those do have in common is CSS: `cursor: grab` or `move` to say so to the
 *     user, and `touch-action: none` to stop the browser scrolling instead of
 *     letting the library drag. Both are strong signals, and both are readable.
 *   - Whatever the page names explicitly through `grab.selector`.
 *
 * The pointer events below are the same ones a touchscreen produces, so a
 * library that works on a phone works here without knowing anything about hand
 * tracking. The HTML5 sequence is synthesized separately because the browser
 * only generates it for real drags.
 */

/** Cursors that mean "this moves", as opposed to "this is a link". */
export const GRAB_CURSORS = [
  'grab',
  'grabbing',
  'move',
  'all-scroll',
  'col-resize',
  'row-resize',
  'ew-resize',
  'ns-resize',
  'nesw-resize',
  'nwse-resize',
];

const SCROLLABLE = /(auto|scroll|overlay)/;

/**
 * Whether this element is a scroll container with somewhere to scroll.
 *
 * Such an element is never claimed as a drag handle on CSS evidence alone.
 * `touch-action: none` on something that scrolls is far more likely to be a
 * tweak to how it scrolls than an offer to drag it, and mistaking the two costs
 * the page a scroller it cannot get back — the guard matters most for exactly
 * the kind of element it is hardest to notice, a modal's inner content. A page
 * that really does want one dragged can still say so outright, with `draggable`
 * or `grab.selector`, both of which are checked before this.
 */
function scrolls(node) {
  const style = getComputedStyle(node);
  return (
    (SCROLLABLE.test(style.overflowY) && node.scrollHeight - node.clientHeight > 1) ||
    (SCROLLABLE.test(style.overflowX) && node.scrollWidth - node.clientWidth > 1)
  );
}

/**
 * The outermost element still showing this cursor — the one that declared it,
 * rather than a descendant that merely inherited it.
 *
 * Null when the value reaches `body` or the document element, which means the
 * page set it on everything rather than offering a handle.
 */
function cursorOwner(node, cursor) {
  let owner = node;
  while (owner.parentElement) {
    const parent = owner.parentElement;
    if (getComputedStyle(parent).cursor !== cursor) return owner;
    if (parent === document.body || parent === document.documentElement) return null;
    owner = parent;
  }
  return null;
}

/**
 * The nearest ancestor of `el` that can be picked up, or null.
 *
 * `body` and the document element are never matched by the CSS heuristics: a
 * page that sets `touch-action: none` at the root is saying something about the
 * whole document rather than offering a handle, and treating that as a grab
 * would make the page impossible to scroll. An explicit `draggable` attribute
 * or selector still counts anywhere.
 */
export function grabbableFrom(el, options) {
  const { selector, cursors, touchAction } = options;
  const styled = new Set(cursors);
  let node = el;
  while (node && node.nodeType === 1) {
    const html5 = node.getAttribute?.('draggable') === 'true';
    if (html5) return { node, html5: true };
    if (selector && node.matches?.(selector)) return { node, html5: false };

    const root = node === document.body || node === document.documentElement;
    if (!root && !scrolls(node)) {
      const style = getComputedStyle(node);
      // `cursor` is inherited, so the deepest element under the pointer always
      // reports it and every child of a handle looks like one. What is being
      // looked for is the element the value came *from*: that is the thing that
      // moves, and a label inside a card should carry the card. Climbing to it
      // is also what keeps a page-wide `cursor: move` from making the whole
      // document a drag handle — the origin is `body`, so it is rejected.
      if (styled.has(style.cursor)) {
        // Tested on the element the cursor came from, not the one the walk
        // started at: an inherited `move` on a scroll container reaches every
        // child, and the child scrolls nothing itself.
        const owner = cursorOwner(node, style.cursor);
        if (owner && !scrolls(owner)) return { node: owner, html5: false };
      }
      // `touch-action` does not inherit, so it needs none of that.
      if (touchAction && style.touchAction === 'none') return { node, html5: false };
    }

    node = node.parentElement || node.getRootNode()?.host || null;
  }
  return null;
}

/** A live hold on one element: pressed at once, dragged if the hand moves. */
export class Grab {
  /**
   * @param {{node: Element, html5: boolean}} target  what would be carried
   * @param {Element} on    the deepest element under the cursor
   * @param {number} x
   * @param {number} y
   * @param {boolean} useHtml5
   */
  constructor(target, on, x, y, useHtml5) {
    this.node = target.node;
    this.html5 = target.html5 && useHtml5;
    this.started = false;
    this.over = null;
    this.canDrop = false;
    this.dataTransfer = null;

    // Pressed the moment the pinch closes, exactly as a mouse button does, so
    // a library shows its grabbed state straight away and the element is under
    // the hand from the first pixel. Waiting for the drag to be recognised
    // first is what leaves it sitting still and then jumping.
    //
    // Dispatched on the element actually under the cursor rather than the
    // draggable itself: a button inside a card has to receive its own press,
    // and everything bubbles up to the card regardless.
    this.pressed = on || this.node;
    firePointer(this.pressed, 'pointerdown', x, y, { buttons: 1, button: 0 });
    fireMouse(this.pressed, 'mousedown', x, y, { buttons: 1, button: 0 });
  }

  /**
   * The hand has moved far enough that this is a drag rather than a press.
   *
   * Only now does the HTML5 sequence open, because that is when a browser
   * opens it too — `mousedown` alone never starts a drag and drop.
   */
  start(x, y) {
    if (this.started) return;
    this.started = true;
    if (!this.html5) return;
    try {
      this.dataTransfer = new DataTransfer();
    } catch {
      // Older engines cannot construct one. Pointer events alone still work.
      return;
    }
    this.dataTransfer.effectAllowed = 'all';
    fireDrag(this.node, 'dragstart', x, y, this.dataTransfer);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {Element|null} under  what the cursor is over, excluding our own UI
   */
  move(x, y, under) {
    // Libraries listen on the document, and a source element a library has
    // detached mid-drag no longer bubbles anywhere. Falling back to whatever is
    // under the cursor keeps the stream reaching them either way.
    const to = under || (this.pressed.isConnected ? this.pressed : document);
    firePointer(to, 'pointermove', x, y, { buttons: 1 });
    fireMouse(to, 'mousemove', x, y, { buttons: 1 });
    if (!this.dataTransfer) return;

    fireDrag(this.node, 'drag', x, y, this.dataTransfer);
    if (under !== this.over) {
      if (this.over) fireDrag(this.over, 'dragleave', x, y, this.dataTransfer);
      if (under) fireDrag(under, 'dragenter', x, y, this.dataTransfer);
      this.over = under;
    }
    // A drop zone accepts the drop by cancelling `dragover`, so the return
    // value is the answer to "would this drop land".
    this.canDrop = under ? !fireDrag(under, 'dragover', x, y, this.dataTransfer) : false;
  }

  /**
   * Whether letting go here counts as a click on what was pressed.
   *
   * Asked of the geometry first, and only then of the hit test. A drag library
   * routinely lifts the element into an overlay, or leaves a placeholder in the
   * layout and renders a clone under the cursor — so what `elementFromPoint`
   * returns at release is very often something the page built a moment ago and
   * not anything that was pressed. Demanding the same element back means a
   * quick pinch on exactly those elements never registers as a click, which
   * looks from the outside like every press being read as a drag.
   *
   * An element that has been lifted out of the layout entirely has no box left
   * to test, and nothing to say about where it went. That gets the benefit of
   * the doubt: the gesture was short enough to be a press, so it is one.
   */
  clicks(x, y, under) {
    if (
      under &&
      (this.pressed === under || this.pressed.contains(under) || under.contains(this.pressed))
    ) {
      return true;
    }
    const box = this.pressed.getBoundingClientRect?.();
    if (!box || (box.width === 0 && box.height === 0)) return true;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }

  /** Let go. Returns whether the element was dropped on something. */
  end(x, y, under) {
    const to = under || (this.pressed.isConnected ? this.pressed : document);
    firePointer(to, 'pointerup', x, y, { buttons: 0, button: 0 });
    fireMouse(to, 'mouseup', x, y, { buttons: 0, button: 0 });
    const dropped = Boolean(this.dataTransfer && this.over && this.canDrop);
    if (this.dataTransfer) {
      if (dropped) fireDrag(this.over, 'drop', x, y, this.dataTransfer);
      fireDrag(this.node, 'dragend', x, y, this.dataTransfer);
    }
    return dropped;
  }

  /**
   * Something else has taken the gesture over — the hand left the frame, or a
   * scroll won. Put everything down without dropping it.
   */
  cancel(x, y) {
    const to = this.pressed.isConnected ? this.pressed : document;
    firePointer(to, 'pointercancel', x, y, { buttons: 0 });
    if (this.dataTransfer) {
      if (this.over) fireDrag(this.over, 'dragleave', x, y, this.dataTransfer);
      fireDrag(this.node, 'dragend', x, y, this.dataTransfer);
    }
  }
}
