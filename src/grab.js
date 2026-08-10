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
    if (!root) {
      const style = getComputedStyle(node);
      // `cursor` is inherited, so the deepest element under the pointer always
      // reports it and every child of a handle looks like one. What is being
      // looked for is the element the value came *from*: that is the thing that
      // moves, and a label inside a card should carry the card. Climbing to it
      // is also what keeps a page-wide `cursor: move` from making the whole
      // document a drag handle — the origin is `body`, so it is rejected.
      if (styled.has(style.cursor)) {
        const owner = cursorOwner(node, style.cursor);
        if (owner) return { node: owner, html5: false };
      }
      // `touch-action` does not inherit, so it needs none of that.
      if (touchAction && style.touchAction === 'none') return { node, html5: false };
    }

    node = node.parentElement || node.getRootNode()?.host || null;
  }
  return null;
}

/** A live drag of one element. */
export class Grab {
  /**
   * @param {{node: Element, html5: boolean}} target  what is being picked up
   * @param {number} x  where the pinch closed — not where it is now
   * @param {number} y
   */
  constructor(target, x, y, useHtml5) {
    this.node = target.node;
    this.over = null;
    this.canDrop = false;
    this.dataTransfer = null;

    if (target.html5 && useHtml5) {
      try {
        this.dataTransfer = new DataTransfer();
      } catch {
        // Older engines cannot construct one. Pointer events alone still work.
        this.dataTransfer = null;
      }
    }

    // Opened at the point the pinch closed rather than the point the drag was
    // recognised, so a library measuring from its own pointerdown holds the
    // element where it was actually grabbed. The element then jumps forward by
    // the recognition threshold on the first move, which is exactly what a
    // touchscreen does with an activation distance.
    firePointer(this.node, 'pointerdown', x, y, { buttons: 1, button: 0 });
    fireMouse(this.node, 'mousedown', x, y, { buttons: 1, button: 0 });
    if (this.dataTransfer) {
      this.dataTransfer.effectAllowed = 'all';
      fireDrag(this.node, 'dragstart', x, y, this.dataTransfer);
    }
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
    const to = this.node.isConnected ? this.node : under || document;
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

  /** Let go. Returns whether the element was dropped on something. */
  end(x, y) {
    const to = this.node.isConnected ? this.node : this.over || document;
    firePointer(to, 'pointerup', x, y, { buttons: 0, button: 0 });
    fireMouse(to, 'mouseup', x, y, { buttons: 0, button: 0 });
    const dropped = Boolean(this.dataTransfer && this.over && this.canDrop);
    if (this.dataTransfer) {
      if (dropped) fireDrag(this.over, 'drop', x, y, this.dataTransfer);
      fireDrag(this.node, 'dragend', x, y, this.dataTransfer);
    }
    return dropped;
  }

  /** The hand left the frame. Put everything down without dropping it. */
  cancel(x, y) {
    const to = this.node.isConnected ? this.node : document;
    firePointer(to, 'pointercancel', x, y, { buttons: 0 });
    if (this.dataTransfer) {
      if (this.over) fireDrag(this.over, 'dragleave', x, y, this.dataTransfer);
      fireDrag(this.node, 'dragend', x, y, this.dataTransfer);
    }
  }
}
