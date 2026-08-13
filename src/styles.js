import { COLOR, FADE_MS, RADIUS, SIDETAB, SIZE, SLIDE, SLIDE_MS, TYPE } from './tokens.js';

/**
 * The card and the tab are two boxes making one silhouette, so the shadow is
 * written once and cast twice, from a pair of empty elements underneath both of
 * them.
 *
 * It has to be done that way round. Given to the card and the tab directly,
 * each one's shadow lands on the other's face: the tab draws a soft dark band
 * down the card where they meet, and the seam that the fillet exists to hide
 * comes straight back as a shadow. Cast from underneath, every shadow that
 * falls inside the silhouette is covered by the surface above it, and only the
 * part that reaches the page is ever seen.
 */
const SHADOW = `
    0 0 0 1px ${COLOR.divider},
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.08)`;

/**
 * The fade over the right-hand edge of the camera preview, exactly as the spec
 * gives it: transparent until 90.43% of the card, which is the last 24px of
 * 260 — the width of the tab.
 *
 * That is what it is for. The preview runs to the edge of the card, the tab
 * carries on out of it in flat #F6F6F6, and without this the video stops dead
 * against the tab and cuts the shape in two.
 */
const scrim = (deg) =>
  `linear-gradient(${deg}deg, rgba(246, 246, 246, 0) 90.43%, ${COLOR.lightGray} 100%)`;

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
  /* The tab's height, read by the tab and by the shade that casts its shadow.
     One value, so the two cannot come apart. */
  --hc-tab-h: ${SIDETAB.height}px;
  /* The card is square where the tab covers it and rounded everywhere else. */
  --hc-card-radius: ${RADIUS.card}px ${RADIUS.card}px 0 ${RADIUS.card}px;
  --hc-tab-radius: 0 ${RADIUS.card}px ${RADIUS.card}px 0;
}

.hc-root[data-state="live"] { --hc-tab-h: ${SIDETAB.liveHeight}px; }

.hc-root[data-position$="-right"] {
  --hc-card-radius: ${RADIUS.card}px ${RADIUS.card}px ${RADIUS.card}px 0;
  --hc-tab-radius: ${RADIUS.card}px 0 0 ${RADIUS.card}px;
}

.hc-root * { box-sizing: border-box; }

/* ----------------------------------------------------------------- dock -- */

/*
 * The card and its tab, and the only thing that moves.
 *
 * Putting the trackpad away slides the pair far enough sideways to take the
 * card off the screen, which leaves the tab — the one part hanging past the
 * card's edge — sitting against that edge. Nothing resizes and nothing fades:
 * the distance is the width of the card plus the margin it sits at, so the
 * card's outer edge lands exactly on zero.
 */
.hc-dock {
  position: absolute;
  width: ${SIZE.panelWidth}px;
  height: ${SIZE.panelHeight}px;
  transition: transform ${SLIDE};
}

.hc-root[data-position$="-left"]  .hc-dock { left: var(--hc-margin); }
.hc-root[data-position$="-right"] .hc-dock { right: var(--hc-margin); }
.hc-root[data-position^="bottom"] .hc-dock { bottom: var(--hc-margin); }
.hc-root[data-position^="top"]    .hc-dock { top: var(--hc-margin); }

.hc-root[data-mini="true"][data-position$="-left"] .hc-dock {
  transform: translateX(calc(-1 * (var(--hc-margin) + ${SIZE.panelWidth}px)));
}

.hc-root[data-mini="true"][data-position$="-right"] .hc-dock {
  transform: translateX(calc(var(--hc-margin) + ${SIZE.panelWidth}px));
}

/* ---------------------------------------------------------------- shade -- */

.hc-shade {
  position: absolute;
  pointer-events: none;
  box-shadow: ${SHADOW};
}

.hc-shade--card {
  inset: 0;
  border-radius: var(--hc-card-radius);
  /*
   * Clipped flat against the side the tab is on, by the end of the slide.
   *
   * The card stops with that edge on zero, so anything it casts past it lands
   * back on the screen: a 24px smudge running the height of the card down the
   * edge of the page, next to a tab that is supposed to be the only thing left.
   * Cutting it on the card's own timing keeps the shadow while the card is
   * still on screen and has taken it away by the time the card is not.
   */
  transition: clip-path ${SLIDE};
}

.hc-root[data-position$="-left"]  .hc-shade--card { clip-path: inset(-40px -40px -40px -40px); }
.hc-root[data-position$="-right"] .hc-shade--card { clip-path: inset(-40px -40px -40px -40px); }
.hc-root[data-mini="true"][data-position$="-left"]  .hc-shade--card { clip-path: inset(-40px 0 -40px -40px); }
.hc-root[data-mini="true"][data-position$="-right"] .hc-shade--card { clip-path: inset(-40px -40px -40px 0); }

.hc-shade--tab {
  bottom: 0;
  width: ${SIDETAB.width}px;
  height: var(--hc-tab-h);
  border-radius: var(--hc-tab-radius);
  transition: height ${SLIDE};
}

/*
 * Cut back by the width of the hairline on the side facing the card, where the
 * two shades share an edge. Both of them draw that hairline, and the one pixel
 * where they cross at the bottom corner gets it twice — 222 against 209, on the
 * one row, which is small but is a mark on an edge that should be a straight
 * line. Nothing is lost: that side of the tab is covered by the card.
 */
.hc-root[data-position$="-left"]  .hc-shade--tab { left: 100%;  clip-path: inset(-40px -40px -40px 1px); }
.hc-root[data-position$="-right"] .hc-shade--tab { right: 100%; clip-path: inset(-40px 1px -40px -40px); }

/* ---------------------------------------------------------------- panel -- */

.hc-panel {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  padding: ${SIZE.pad}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  background: ${COLOR.lightGray};
  border-radius: var(--hc-card-radius);
  overflow: hidden;
}

.hc-root[data-mini="true"] .hc-panel { pointer-events: none; }

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

/*
 * The fade over the preview's outer edge, so the video runs out into the card's
 * own colour where the tab carries on out of it.
 *
 * Above the skeleton as well as the video: a bone crossing the last 24px should
 * go with the picture, not sit sharp on top of a fade.
 */
.hc-scrim {
  position: absolute;
  inset: 0;
  display: none;
  pointer-events: none;
  background: ${scrim(90)};
}

.hc-root[data-position$="-right"] .hc-scrim { background: ${scrim(270)}; }
.hc-root[data-state="live"] .hc-scrim { display: block; }

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
  width: 100%;
  text-align: center;
  font-size: ${TYPE.body.size}px;
  font-weight: ${TYPE.body.weight};
  line-height: ${TYPE.body.leading}px;
  letter-spacing: -0.01em;
  color: ${COLOR.textSecondary};
}

.hc-root[data-state="error"] .hc-copy { color: ${COLOR.red}; }

.hc-root[data-state="live"] .hc-copy { display: none; }

/* ------------------------------------------------------------------ cta -- */

.hc-cta {
  flex: none;
  appearance: none;
  white-space: nowrap;
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

.hc-root[data-state="live"] .hc-cta { display: none; }

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

.hc-corner--tl { top: ${SIZE.cornerInset}px; left: ${SIZE.cornerInset}px; }

.hc-root[data-state="live"] .hc-corner--tl { display: inline-flex; }

/* ------------------------------------------------------------- side tab -- */

/*
 * The tab hangs off the side of the card, level with its bottom, and never goes
 * away. Expanded it is the handle on the edge of the card; slid off, it is the
 * whole trackpad as far as the screen is concerned — which is why it is a real
 * part of the card and not something the minimized state grows into.
 *
 * It is also the only size control there is. At 24px wide there is no room for
 * anything inside it, and no other thing it could mean.
 */
.hc-tab {
  position: absolute;
  bottom: 0;
  width: ${SIDETAB.width}px;
  height: var(--hc-tab-h);
  appearance: none;
  border: 0;
  margin: 0;
  /* The 4px either side of the chevron the spec asks for, and the 8px above
     and below that the tab's height is built out of. */
  padding: ${SIDETAB.pad}px ${(SIDETAB.width - SIDETAB.iconWidth) / 2}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${SIDETAB.gap}px;
  background: ${COLOR.lightGray};
  border-radius: var(--hc-tab-radius);
  color: ${COLOR.iconDark};
  cursor: pointer;
  transition: height ${SLIDE};
}

.hc-root[data-position$="-left"]  .hc-tab { left: 100%; }
.hc-root[data-position$="-right"] .hc-tab { right: 100%; }

/*
 * The fillet, sitting in the right angle above the tab where it meets the side
 * of the card: same colour, quarter circle bitten out of it, so the card runs
 * into the tab on a curve instead of a step.
 */
.hc-tab-notch {
  position: absolute;
  bottom: 100%;
  width: ${SIDETAB.notch}px;
  height: ${SIDETAB.notch}px;
  color: ${COLOR.lightGray};
}

.hc-root[data-position$="-left"]  .hc-tab-notch { left: 0; }
.hc-root[data-position$="-right"] .hc-tab-notch { right: 0; transform: scaleX(-1); }

.hc-tab-notch svg { display: block; width: 100%; height: 100%; }

/* A child, not a descendant: the fillet is an svg inside the tab too, and it is
   6x6, not 16x48. */
.hc-tab > svg {
  display: block;
  width: ${SIDETAB.iconWidth}px;
  height: ${SIDETAB.iconHeight}px;
  flex: none;
}

/* The chevron lies the way the card does, so it turns around when the tab moves
   to the other edge. It does not turn around with the state: the card is off
   that way whether it is out or away. */
.hc-root[data-position$="-left"] .hc-tab > svg { transform: scaleX(-1); }

/*
 * Nothing inside the card follows it off the screen as far as the keyboard is
 * concerned. Held back until the slide has finished so nothing vanishes in
 * transit, and never applied to the stage: the preview in there is the frame
 * source the model reads every tick, and tracking has to keep running while the
 * card is away, which is most of the time it is being used.
 */
.hc-cta,
.hc-corner {
  transition: visibility 0s;
}

.hc-root[data-mini="true"] .hc-cta,
.hc-root[data-mini="true"] .hc-corner {
  visibility: hidden;
  transition: visibility 0s linear ${SLIDE_MS}ms;
}

.hc-tab-dot {
  display: none;
  flex: none;
  /* Centred across the tab, unlike the chevron, which the spec puts 8px from
     either side rather than hard against one. */
  align-self: center;
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
  transition: opacity ${FADE_MS}ms linear;
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
  .hc-dock,
  .hc-shade,
  .hc-tab { transition-duration: 1ms; }
  .hc-spinner { animation-duration: 2s; }
}
`;
