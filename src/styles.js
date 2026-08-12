import { COLOR, RADIUS, SIDETAB, SIZE, TYPE } from './tokens.js';

/**
 * All styles live inside the shadow root, so nothing here can be reached by —
 * or leak into — the host page's CSS.
 */
export const CSS = `
:host {
  all: initial;
}

.hc-root {
  position: fixed;
  inset: 0;
  z-index: var(--hc-z, 2147483000);
  pointer-events: none;
  font-family: ${TYPE.family};
  -webkit-font-smoothing: antialiased;
  color: ${COLOR.textPrimary};
}

.hc-root * { box-sizing: border-box; }

/* ---------------------------------------------------------------- panel -- */

.hc-panel {
  position: absolute;
  pointer-events: auto;
  width: ${SIZE.panelWidth}px;
  height: ${SIZE.panelHeight}px;
  padding: ${SIZE.pad}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  background: ${COLOR.lightGray};
  border-radius: ${RADIUS.card}px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px ${COLOR.divider},
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.08);
  transition:
    width 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
    height 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color 200ms linear,
    opacity 200ms linear;
}

.hc-root[data-position$="-left"]  .hc-panel { left: var(--hc-margin); }
.hc-root[data-position$="-right"] .hc-panel { right: var(--hc-margin); }
.hc-root[data-position^="bottom"] .hc-panel { bottom: var(--hc-margin); }
.hc-root[data-position^="top"]    .hc-panel { top: var(--hc-margin); }


.hc-root[data-state="live"] .hc-panel {
  padding: 0;
  background: ${COLOR.lightGray};
}

/* ---------------------------------------------------------------- stage -- */

.hc-stage {
  position: relative;
  /* Fixed at the illustration's size; the card distributes what is left over.
     A 98px illustration, two lines of copy and a 32px button do not leave room
     for 12px gaps inside 200px, so the gaps are what give. */
  flex: 0 0 auto;
  width: ${SIZE.illoWidth}px;
  height: ${SIZE.illoHeight}px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hc-root[data-state="live"] .hc-stage {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
}

.hc-video,
.hc-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: none;
}

.hc-video {
  object-fit: cover;
  transform: scaleX(-1);
  filter: var(--hc-video-filter, none);
  /* Knocked right back so the dark icons and the skeleton stay legible over
     the #F6F6F6 card behind it. */
  opacity: var(--hc-video-opacity, 0.15);
}

.hc-root[data-state="live"] .hc-video,
.hc-root[data-state="live"] .hc-overlay { display: block; }

.hc-illo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.hc-root[data-state="live"] .hc-illo { display: none; }

.hc-illo-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

/* ----------------------------------------------------------------- copy -- */

.hc-copy {
  flex: none;
  margin: 0;
  max-width: 100%;
  text-align: center;
  font-size: ${TYPE.body.size}px;
  font-weight: ${TYPE.body.weight};
  line-height: ${TYPE.body.leading}px;
  letter-spacing: -0.01em;
  color: ${COLOR.textSecondary};
}

.hc-root[data-state="error"] .hc-copy { color: ${COLOR.red}; }

.hc-root[data-state="live"] .hc-copy,
.hc-root[data-mini="true"] .hc-copy { display: none; }

/* ------------------------------------------------------------------ cta -- */

.hc-cta {
  flex: none;
  appearance: none;
  border: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${SIZE.ctaGap}px;
  height: ${SIZE.ctaHeight}px;
  padding: 0 ${SIZE.ctaPadX}px;
  border-radius: ${RADIUS.button}px;
  background: ${COLOR.green};
  color: ${COLOR.white};
  font-family: inherit;
  font-size: ${TYPE.label.size}px;
  font-weight: ${TYPE.label.weight};
  line-height: ${TYPE.label.leading}px;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background-color 150ms linear, transform 120ms ease-out;
}

.hc-cta:hover,
.hc-cta.hc-hover { background: ${COLOR.darkGreen}; }
.hc-cta:active { transform: scale(0.97); }
.hc-cta[disabled] { opacity: 0.7; cursor: default; }

.hc-cta svg { width: ${SIZE.iconSize}px; height: ${SIZE.iconSize}px; flex: none; }

.hc-root[data-state="live"] .hc-cta,
.hc-root[data-mini="true"] .hc-cta { display: none; }

/* -------------------------------------------------------- corner button -- */

.hc-corner {
  position: absolute;
  appearance: none;
  border: 0;
  padding: 0;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  color: ${COLOR.iconDark};
}

.hc-corner {
  width: ${SIZE.cornerButton}px;
  height: ${SIZE.cornerButton}px;
  border-radius: ${RADIUS.button}px;
  transition: background-color 150ms linear;
}

.hc-corner svg { width: ${SIZE.iconSize}px; height: ${SIZE.iconSize}px; }
.hc-corner:hover,
.hc-corner.hc-hover { background: ${COLOR.divider}; }

.hc-corner--tr { top: ${SIZE.cornerInset}px; right: ${SIZE.cornerInset}px; display: inline-flex; }
.hc-corner--tl { top: ${SIZE.cornerInset}px; left: ${SIZE.cornerInset}px; }

.hc-root[data-state="live"] .hc-corner--tl { display: inline-flex; }

/* ------------------------------------------------------------- side tab -- */

/*
 * Minimized, the card becomes a tab on the edge of the screen: flush against
 * it, flat on that side and fully rounded on the side facing the page. The
 * width and height transitions on the panel carry it both ways, so it grows
 * and shrinks rather than cutting between the two.
 *
 * Nothing else survives at 24px wide — no preview, no controls. The tab itself
 * is the button, and the only thing it can mean is "open me". Turning the
 * camera off moves back to the expanded card, where there is room to say so.
 */

.hc-root[data-mini="true"] .hc-panel {
  width: ${SIDETAB.width}px;
  height: ${SIDETAB.height}px;
  padding: 0;
}

/* The green dot is an extra row, so the tab grows to hold it. */
.hc-root[data-mini="true"][data-state="live"] .hc-panel {
  height: ${SIDETAB.liveHeight}px;
}

.hc-root[data-mini="true"][data-position$="-left"] .hc-panel {
  left: 0;
  border-radius: 0 ${SIDETAB.radius}px ${SIDETAB.radius}px 0;
}

.hc-root[data-mini="true"][data-position$="-right"] .hc-panel {
  right: 0;
  border-radius: ${SIDETAB.radius}px 0 0 ${SIDETAB.radius}px;
}

.hc-root[data-mini="true"] .hc-stage,
.hc-root[data-mini="true"] .hc-corner,
.hc-root[data-mini="true"][data-state="live"] .hc-corner--tl { display: none; }

.hc-tab {
  position: absolute;
  inset: 0;
  appearance: none;
  border: 0;
  margin: 0;
  padding: ${SIDETAB.pad}px 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${SIDETAB.gap}px;
  background: transparent;
  color: ${COLOR.iconDark};
  cursor: pointer;
}

.hc-root[data-mini="true"] .hc-tab { display: flex; }

.hc-tab svg {
  display: block;
  width: ${SIDETAB.iconWidth}px;
  height: ${SIDETAB.iconHeight}px;
  flex: none;
}

/* The chevron points into the page, so it turns around when the tab does. */
.hc-root[data-position$="-right"] .hc-tab svg { transform: scaleX(-1); }

.hc-tab-dot {
  display: none;
  flex: none;
  width: ${SIDETAB.dot}px;
  height: ${SIDETAB.dot}px;
  border-radius: 50%;
  background: ${COLOR.green};
}

.hc-root[data-state="live"] .hc-tab-dot { display: block; }

/* -------------------------------------------------------------- spinner -- */

.hc-spinner {
  width: ${SIZE.iconSize}px;
  height: ${SIZE.iconSize}px;
  flex: none;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: ${COLOR.white};
  animation: hc-spin 700ms linear infinite;
}

@keyframes hc-spin { to { transform: rotate(360deg); } }

/* --------------------------------------------------------------- cursor -- */

.hc-cursor {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--hc-cursor-w, 20px);
  aspect-ratio: 1;
  /* The arrow tip sits at the element's origin, so rotation and the tapped
     scale both pivot on the exact point being addressed. */
  transform-origin: 0 0;
  color: ${COLOR.black};
  opacity: 0;
  will-change: transform, opacity;
  transition: opacity 160ms linear;
}

/* display:block matters here: an inline svg sits on a text baseline and picks
   up descender space, which made the element taller than its aspect-ratio. */
.hc-cursor svg { display: block; width: 100%; height: 100%; overflow: visible; }

.hc-cursor[data-visible="true"] { opacity: 1; }

/* ---------------------------------------------------------------- debug -- */

.hc-debug {
  position: fixed;
  top: 8px;
  left: 8px;
  pointer-events: none;
  min-width: 168px;
  padding: 8px 10px;
  border-radius: ${RADIUS.button}px;
  background: rgba(0, 0, 0, 0.82);
  color: ${COLOR.white};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 15px;
  font-variant-numeric: tabular-nums;
}

.hc-debug-row { display: flex; justify-content: space-between; gap: 12px; }
.hc-debug-row span { opacity: 0.55; }
.hc-debug-row b { font-weight: 500; }
.hc-debug-row b.is-warn { color: ${COLOR.yellow}; }

.hc-debug-trace {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  max-width: 240px;
}

.hc-debug-trace span { display: block; opacity: 0.55; }

.hc-debug-trace code {
  display: block;
  font: inherit;
  word-spacing: 2px;
  line-height: 14px;
  overflow-wrap: anywhere;
}

/* ------------------------------------------------------------------ a11y -- */

.hc-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.hc-root :focus-visible {
  outline: 2px solid ${COLOR.green};
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .hc-panel,
  .hc-cta,
  .hc-corner { transition-duration: 1ms; }
  .hc-spinner { animation-duration: 2s; }
}
`;
