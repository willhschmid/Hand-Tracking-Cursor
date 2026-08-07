/**
 * CSS `:hover` emulation.
 *
 * Synthetic pointer events reach JavaScript listeners, but `:hover` is owned by
 * the browser and only ever follows the real pointer — so on a page whose
 * affordances are pure CSS, the hand cursor would glide over everything without
 * a flicker of feedback.
 *
 * The fix is to mirror the page's own hover rules: every `x:hover` rule is
 * cloned as `x[data-hc-hover]`, and the attribute is put on the hovered element
 * and its ancestors (real `:hover` matches the whole chain, not just the leaf).
 * Specificity is unchanged — an attribute selector and a pseudo-class both
 * count the same — and the clones are appended last, so they win ties.
 *
 * Stylesheets from another origin cannot be read unless they were served with
 * CORS headers. Those are skipped, which is the one case where hover feedback
 * stays missing.
 */

const ATTR = 'data-hc-hover';

const mirror = (selector) => selector.replace(/:hover\b/g, `[${ATTR}]`);

function collect(rules, out) {
  for (const rule of rules) {
    if (rule.selectorText) {
      if (rule.selectorText.includes(':hover')) {
        out.push(`${mirror(rule.selectorText)}{${rule.style.cssText}}`);
      }
    } else if (rule.media) {
      const inner = [];
      collect(rule.cssRules, inner);
      if (inner.length) out.push(`@media ${rule.conditionText}{${inner.join('')}}`);
    } else if (rule.conditionText && rule.cssRules) {
      const inner = [];
      collect(rule.cssRules, inner);
      if (inner.length) out.push(`@supports ${rule.conditionText}{${inner.join('')}}`);
    }
  }
}

export class HoverEmulator {
  constructor() {
    this.style = null;
    this.chain = [];
    this.sheetCount = -1;
    this.warned = false;
    this.observer = null;
  }

  /** Scans the page's stylesheets and (re)writes the mirrored rules. */
  build() {
    const rules = [];
    let blocked = 0;

    for (const sheet of document.styleSheets) {
      // Our own mirror sheet, and anything we cannot read.
      if (sheet.ownerNode === this.style) continue;
      try {
        collect(sheet.cssRules, rules);
      } catch {
        blocked += 1;
      }
    }

    if (blocked && !this.warned) {
      this.warned = true;
      console.info(
        `[hand-cursor] ${blocked} cross-origin stylesheet(s) could not be read, ` +
          'so their :hover styles will not respond to the hand cursor.',
      );
    }

    if (!this.style) {
      this.style = document.createElement('style');
      this.style.setAttribute('data-hand-cursor-hover', '');
    }
    this.style.textContent = rules.join('\n');
    // Last in the document, so it wins ties against the rule it mirrors.
    document.head.appendChild(this.style);
    this.sheetCount = document.styleSheets.length;

    if (!this.observer) this.watch();
  }

  /** Rebuilds when a single-page app swaps its styles in. */
  watch() {
    let pending = 0;
    this.observer = new MutationObserver(() => {
      if (document.styleSheets.length === this.sheetCount) return;
      clearTimeout(pending);
      pending = setTimeout(() => this.build(), 250);
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /** Marks `el` and its ancestors as hovered. */
  set(el) {
    if (this.chain[0] === el) return;

    const next = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      next.push(node);
    }

    for (const node of this.chain) {
      if (!next.includes(node)) node.removeAttribute(ATTR);
    }
    for (const node of next) node.setAttribute(ATTR, '');
    this.chain = next;
  }

  clear() {
    for (const node of this.chain) node.removeAttribute(ATTR);
    this.chain = [];
  }

  destroy() {
    this.clear();
    this.observer?.disconnect();
    this.observer = null;
    this.style?.remove();
    this.style = null;
  }
}
