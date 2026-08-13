/**
 * Material Symbols, 24px grid, drawn in `currentColor` so the CSS decides the
 * colour. The exported SVGs are the supplied assets with the full-bleed alpha
 * mask dropped — it covered the whole viewBox and clipped nothing.
 */

const symbol = (d) =>
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">' +
  `<path d="${d}" fill="currentColor"/></svg>`;

export const ICONS = {
  /**
   * The side tab's chevron. Its own 16x48 box rather than the 24px grid the
   * others sit on, because it is drawn to the tab's proportions.
   */
  chevron:
    '<svg viewBox="0 0 16 48" fill="none" aria-hidden="true" focusable="false">' +
    '<path d="M3.89864 6.12617C4.65749 5.79418 5.54205 6.13992 5.87422 6.89864L12.173 ' +
    '21.2961C12.7877 22.7013 12.7877 24.2991 12.173 25.7043L5.87422 40.1018C5.54205 ' +
    '40.8605 4.65748 41.2062 3.89864 40.8742C3.13992 40.542 2.79418 39.6575 3.12617 ' +
    '38.8986L9.425 24.5022C9.70433 23.8635 9.70433 23.1369 9.425 22.4982L3.12617 ' +
    '8.10176C2.79418 7.34291 3.13992 6.45834 3.89864 6.12617Z" fill="currentColor"/></svg>',

  /**
   * The fillet under the tab's top corner. Not an icon so much as a piece of
   * the card: a 6x6 square with a quarter circle taken out of it, which turns
   * the right angle where the tab meets the card into a curve running out of
   * one and into the other. Drawn in currentColor so it stays the card's own
   * colour rather than a second copy of it.
   */
  notch:
    '<svg viewBox="0 0 6 6" fill="none" aria-hidden="true" focusable="false">' +
    '<path d="M0 0C0 3.31371 2.68629 6 6 6L0 6L0 0Z" fill="currentColor"/></svg>',

  videocam: symbol(
    'M4 20C3.45 20 2.97917 19.8042 2.5875 19.4125C2.19583 19.0208 2 18.55 2 18V6C2 5.45 ' +
      '2.19583 4.97917 2.5875 4.5875C2.97917 4.19583 3.45 4 4 4H16C16.55 4 17.0208 4.19583 ' +
      '17.4125 4.5875C17.8042 4.97917 18 5.45 18 6V10.5L21.15 7.35C21.3167 7.18333 21.5 ' +
      '7.14167 21.7 7.225C21.9 7.30833 22 7.46667 22 7.7V16.3C22 16.5333 21.9 16.6917 21.7 ' +
      '16.775C21.5 16.8583 21.3167 16.8167 21.15 16.65L18 13.5V18C18 18.55 17.8042 19.0208 ' +
      '17.4125 19.4125C17.0208 19.8042 16.55 20 16 20H4ZM4 18H16V6H4V18Z',
  ),

  videocamOff: symbol(
    'M18.0002 10.5L21.1502 7.35001C21.3169 7.18334 21.5002 7.14167 21.7002 7.22501C21.9002 ' +
      '7.30834 22.0002 7.46667 22.0002 7.70001V16.3C22.0002 16.5333 21.9002 16.6917 21.7002 ' +
      '16.775C21.5002 16.8583 21.3169 16.8167 21.1502 16.65L18.0002 13.5C18.0002 13.7833 ' +
      '17.9044 14.0208 17.7127 14.2125C17.521 14.4042 17.2835 14.5 17.0002 14.5C16.7169 14.5 ' +
      '16.4794 14.4042 16.2877 14.2125C16.096 14.0208 16.0002 13.7833 16.0002 13.5V6.00001H9.0002' +
      'C8.66686 6.00001 8.41686 5.89584 8.2502 5.68751C8.08353 5.47917 8.0002 5.25001 8.0002 ' +
      '5.00001C8.0002 4.75001 8.08353 4.52084 8.2502 4.31251C8.41686 4.10417 8.66686 4.00001 ' +
      '9.0002 4.00001H16.0002C16.5502 4.00001 17.021 4.19584 17.4127 4.58751C17.8044 4.97917 ' +
      '18.0002 5.45001 18.0002 6.00001V10.5ZM19.8502 22.65L1.3502 4.15001C1.16686 3.96667 ' +
      '1.0752 3.73334 1.0752 3.45001C1.0752 3.16667 1.16686 2.93334 1.3502 2.75001C1.53353 ' +
      '2.56667 1.76686 2.47501 2.0502 2.47501C2.33353 2.47501 2.56686 2.56667 2.7502 2.75001' +
      'L21.2502 21.25C21.4335 21.4333 21.5252 21.6667 21.5252 21.95C21.5252 22.2333 21.4335 ' +
      '22.4667 21.2502 22.65C21.0669 22.8333 20.8335 22.925 20.5502 22.925C20.2669 22.925 ' +
      '20.0335 22.8333 19.8502 22.65ZM4.0002 4.00001L6.0002 6.00001H4.0002V18H16.0002V16' +
      'L18.0002 18C18.0002 18.55 17.8044 19.0208 17.4127 19.4125C17.021 19.8042 16.5502 20 ' +
      '16.0002 20H4.0002C3.4502 20 2.97936 19.8042 2.5877 19.4125C2.19603 19.0208 2.0002 ' +
      '18.55 2.0002 18V6.00001C2.0002 5.45001 2.19603 4.97917 2.5877 4.58751C2.97936 4.19584 ' +
      '3.4502 4.00001 4.0002 4.00001Z',
  ),
};

/**
 * The cursor arrow.
 *
 * The supplied file is 32x32 with the arrow occupying the middle ~14 units and
 * its point at (9.6, 9.6). The viewBox is retargeted so that point sits exactly
 * at the element's origin — the CSS anchors position, rotation and the tapped
 * scale there, so the tip stays pinned to the coordinate being addressed. The
 * white outline that falls outside the box still draws, because the element
 * sets `overflow: visible`.
 */
export const ARROW_SVG =
  '<svg viewBox="9.6 9.6 14 14" fill="none" aria-hidden="true" focusable="false">' +
  '<path d="M9.40234 11.3525C8.91256 10.1281 10.1281 8.91256 11.3525 9.40234L22.6514 ' +
  '13.9219C23.9484 14.441 23.8937 16.2954 22.5684 16.7373L18.4326 18.1162C18.2833 18.166 ' +
  '18.166 18.2833 18.1162 18.4326L16.7373 22.5684C16.2954 23.8937 14.441 23.9484 13.9219 ' +
  '22.6514L9.40234 11.3525Z" fill="#111111" stroke="white"/>' +
  '</svg>';
