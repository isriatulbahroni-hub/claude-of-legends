// Where the battle royale HUD's lines stand while the Graft cards are open
// (the HUD's root carries br-cards-open, ui/royale_hud_grafts.ts): the
// cards' row and the lines must not draw over each other. The kill feed
// stands under the row, with its newest lines and its fold: at the top
// right, the row ran 36 px into the feed's column at 1280x720, most of it
// at 960x540, and on a phone the feed's first line reached the row's foot.
// Pure: the numbers, the boxes they make on a screen at interface size 1
// for a test to check, and the stylesheet ui/royale_hud_grafts.ts mounts.

import { cardsBox } from './royale_grafts';
import {
  COMPACT_FEED_LINE_H_PX,
  COMPACT_FEED_TOP_PCT,
  COMPACT_FEED_TOP_PX,
  compactFeedTop,
  FEED_LINE_H_PX,
  FEED_MAX_W_PX,
  FEED_RIGHT_PX,
  type ScreenBox,
} from './royale_layout';

// The feed's top this far under the cards' row; on a desktop it keeps two
// lines and the fold (over the map in the corner at 960x540 with more), on
// a phone its newest line and the fold (over the ability buttons' level
// marks with more).
export const FEED_UNDER_CARDS_PX = 8;
export const COMPACT_FEED_UNDER_CARDS_PX = 6;
export const FEED_OPEN_LINES = 3;
export const COMPACT_FEED_OPEN_LINES = 2;

// The feed's top while the cards are open: under the row, and on a phone
// played by taps never above where it stands anyway.
export function openFeedTop(height: number, compact: boolean, thumbs: boolean): number {
  const row = cardsBox(0, compact).bottom;
  if (!compact) return row + FEED_UNDER_CARDS_PX;
  const under = row + COMPACT_FEED_UNDER_CARDS_PX;
  return thumbs ? under : Math.max(under, compactFeedTop(height, false));
}

export function openFeedBox(
  width: number,
  height: number,
  compact: boolean,
  thumbs = false,
): ScreenBox {
  const top = openFeedTop(height, compact, thumbs);
  const lines = compact
    ? COMPACT_FEED_OPEN_LINES * COMPACT_FEED_LINE_H_PX
    : FEED_OPEN_LINES * FEED_LINE_H_PX;
  return {
    left: width - FEED_RIGHT_PX - FEED_MAX_W_PX,
    top,
    right: width - FEED_RIGHT_PX,
    bottom: top + lines,
  };
}

const SAFE_TOP = 'var(--safe-top, env(safe-area-inset-top, 0px))';

// The rules, keyed on the HUD root's classes: a desktop, a phone played by
// taps, a phone with the thumb controls. Of the feed's lines, the ones
// past the first FEED_OPEN_LINES - 1 go; the fold, appended last, stays.
export function cardsRoomCss(): string {
  const open = '.hud.br-cards-open';
  const desk = `${open}:not(.compact)`;
  const taps = `${open}.compact:not(.thumbs)`;
  const thumbs = `${open}.compact.thumbs`;
  const phoneUnder = cardsBox(0, true).bottom + COMPACT_FEED_UNDER_CARDS_PX;
  return [
    `${desk} .br-feed { top: calc(${openFeedTop(0, false, false)}px + ${SAFE_TOP}); }`,
    `${taps} .br-feed { top: max(calc(${COMPACT_FEED_TOP_PCT}% + ${COMPACT_FEED_TOP_PX}px), ` +
      `calc(${phoneUnder}px + ${SAFE_TOP})); }`,
    `${thumbs} .br-feed { top: calc(${phoneUnder}px + ${SAFE_TOP}); }`,
    `${desk} .br-feed-line:not(.fold):nth-child(n + ${FEED_OPEN_LINES}) { display: none; }`,
    `${open}.compact .br-feed-line:not(.fold):nth-child(n + ${COMPACT_FEED_OPEN_LINES}) ` +
      '{ display: none; }',
  ].join('\n');
}
