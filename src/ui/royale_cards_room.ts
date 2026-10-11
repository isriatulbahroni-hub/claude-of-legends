// Where the battle royale HUD's lines stand while the Graft cards are open
// (the HUD's root carries br-cards-open, ui/royale_hud_grafts.ts): the
// cards and the lines must not draw over each other.
// - The kill feed stands under the row: at the top right, the row ran
//   36 px into the feed's column at 1280x720, most of it at 960x540, and
//   on a phone the feed's first line reached the row's foot.
// - On a desktop the mark's badge stands beside the Dusk's line, in its
//   short word, and the win line and the Dusk's pill share their row under
//   the count: stacked they reached the cards' title.
// - An announcement takes the title's line, smaller, and the title steps
//   aside while it shows: at 112 px (70 px on a phone) it passed over the
//   title and the row. A spotlight's call (ABLAZE, LAST LIGHT) is said
//   there too, held like a kept line, and one on screen when the cards
//   open goes.
// - The drop's banner, over the title and the row at 96 px (66 px on a
//   phone), folds to its seconds under the top line: the landing is
//   picked when the cards come.
// - A phone played by taps shows one notice at a time over its bar, under
//   the Later button.
// Pure: the numbers, the boxes they make on a screen at interface size 1
// for a test to check, and the stylesheet ui/royale_hud_grafts.ts mounts.

import {
  cardsBox,
  DESK_TOP_PX,
  PHONE_TITLE_H_PX,
  PHONE_TOP_PX,
  TITLE_H_PX,
  titleBox,
} from './royale_grafts';
import {
  BOLD_EM_PER_CHAR,
  COMPACT_FEED_LINE_H_PX,
  COMPACT_FEED_TOP_PCT,
  COMPACT_FEED_TOP_PX,
  COMPACT_TOP_HEAD_H_PX,
  compactFeedTop,
  FEED_LINE_H_PX,
  FEED_MAX_W_PX,
  FEED_RIGHT_PX,
  type ScreenBox,
  TOP_HEAD_H_PX,
  TOP_LINE_TOP_PX,
  topLineBox,
} from './royale_layout';

// The feed's top this far under the cards' row; on a desktop it keeps two
// lines and the fold (over the map in the corner at 960x540 with more), on
// a phone its newest line (over the ability buttons' level marks with
// more).
export const FEED_UNDER_CARDS_PX = 8;
export const COMPACT_FEED_UNDER_CARDS_PX = 6;
export const FEED_OPEN_LINES = 3;
export const COMPACT_FEED_OPEN_LINES = 1;

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

// The top line at its fullest while the cards are open: on a desktop the
// head (the badge beside the Dusk's line, no taller than it), then the win
// line and the pill on one line of OPEN_MARKS_H_PX; a phone's is the same
// as ever (its row, the win line and the pill under it), the cards
// standing under it (ui/royale_grafts.ts PHONE_TOP_PX).
export const OPEN_MARKS_H_PX = 26;
export const TOP_LINE_GAP_PX = 4;

export function openTopLineBox(width: number, compact: boolean): ScreenBox {
  const box = topLineBox(width, compact);
  if (compact) return box;
  return { ...box, bottom: TOP_LINE_TOP_PX + TOP_HEAD_H_PX + TOP_LINE_GAP_PX + OPEN_MARKS_H_PX };
}

// An announcement while the cards are open: on the title's line, at the
// title's size, on one line as wide as the row (on a phone clear of the
// map at the top right, which the thumb controls put there); a longer one
// is cut short rather than wrapped over the row.
export const OPEN_ANNOUNCE_FONT_PX = 19;
export const COMPACT_OPEN_ANNOUNCE_FONT_PX = 15;
export const COMPACT_OPEN_ANNOUNCE_MAX_W_PX = 580;
// The announcement's letter spacing and its fade (ui/hud.ts .hud-announce).
export const ANNOUNCE_SPACING_PX = 1;
export const ANNOUNCE_FADE_S = 0.3;

export function openAnnounceMaxWidth(width: number, compact: boolean): number {
  const row = cardsBox(width, compact);
  const across = row.right - row.left;
  return compact ? Math.min(across, COMPACT_OPEN_ANNOUNCE_MAX_W_PX) : across;
}

export function openAnnounceBox(width: number, compact: boolean): ScreenBox {
  const half = openAnnounceMaxWidth(width, compact) / 2;
  const title = titleBox(width, compact);
  return { left: width / 2 - half, top: title.top, right: width / 2 + half, bottom: title.bottom };
}

// How wide a line is said there, bold, its spacing counted.
export function openAnnounceWidth(text: string, compact: boolean): number {
  const font = compact ? COMPACT_OPEN_ANNOUNCE_FONT_PX : OPEN_ANNOUNCE_FONT_PX;
  return text.length * (font * BOLD_EM_PER_CHAR + ANNOUNCE_SPACING_PX);
}

// A call while the cards are open: a spotlight's is said on the
// announcement's line instead, kept for its hold so the next call waits.
export function openCall<T extends { spotlight?: boolean; keep?: boolean }>(
  call: T,
  cardsOpen: boolean,
): T {
  return cardsOpen && call.spotlight ? { ...call, spotlight: false, keep: true } : call;
}

// The drop's seconds while the cards are open, under the head of the top
// line (the drop shows no badge and no pill).
export const DROP_CHIP_H_PX = 26;
export const COMPACT_DROP_CHIP_H_PX = 22;
export const DROP_CHIP_W_PX = 64;

export function dropChipTop(compact: boolean): number {
  return TOP_LINE_TOP_PX + (compact ? COMPACT_TOP_HEAD_H_PX : TOP_HEAD_H_PX) + TOP_LINE_GAP_PX;
}

export function dropChipBox(width: number, compact: boolean): ScreenBox {
  const top = dropChipTop(compact);
  return {
    left: width / 2 - DROP_CHIP_W_PX / 2,
    top,
    right: width / 2 + DROP_CHIP_W_PX / 2,
    bottom: top + (compact ? COMPACT_DROP_CHIP_H_PX : DROP_CHIP_H_PX),
  };
}

// The top line's head during the drop: the Dusk's line and the count.
export function dropHeadBox(width: number, compact: boolean): ScreenBox {
  const box = topLineBox(width, compact);
  return { ...box, bottom: TOP_LINE_TOP_PX + (compact ? COMPACT_TOP_HEAD_H_PX : TOP_HEAD_H_PX) };
}

// A phone played by taps: the notices shown at once while the cards are
// open (ui/royale_layout.ts compactNotesBox).
export const COMPACT_NOTES_OPEN_SHOWN = 1;

const SAFE_TOP = 'var(--safe-top, env(safe-area-inset-top, 0px))';

// The rules, keyed on the HUD root's classes: a desktop, a phone played by
// taps, a phone with the thumb controls. Of the feed's lines, a desktop's
// past the first FEED_OPEN_LINES - 1 go and the fold, appended last,
// stays; a phone keeps its top line.
export function cardsRoomCss(): string {
  const open = '.hud.br-cards-open';
  const desk = `${open}:not(.compact)`;
  const phone = `${open}.compact`;
  const taps = `${open}.compact:not(.thumbs)`;
  const thumbs = `${open}.compact.thumbs`;
  const royaleDesk = '.hud.royale.br-cards-open:not(.compact)';
  const royalePhone = '.hud.royale.br-cards-open.compact';
  const phoneUnder = cardsBox(0, true).bottom + COMPACT_FEED_UNDER_CARDS_PX;
  return [
    // The feed.
    `${desk} .br-feed { top: calc(${openFeedTop(0, false, false)}px + ${SAFE_TOP}); }`,
    `${taps} .br-feed { top: max(calc(${COMPACT_FEED_TOP_PCT}% + ${COMPACT_FEED_TOP_PX}px), ` +
      `calc(${phoneUnder}px + ${SAFE_TOP})); }`,
    `${thumbs} .br-feed { top: calc(${phoneUnder}px + ${SAFE_TOP}); }`,
    `${desk} .br-feed-line:not(.fold):nth-child(n + ${FEED_OPEN_LINES}) { display: none; }`,
    `${phone} .br-feed-line:nth-child(n + ${COMPACT_FEED_OPEN_LINES + 1}) { display: none; }`,
    // A desktop's top line: the Dusk's line with the badge beside it, the
    // count, then the win line and the pill in their row (two empty breaks
    // between them, half the gap each side).
    `${desk} .br-top { flex-flow: row wrap; justify-content: center; ` +
      `gap: ${TOP_LINE_GAP_PX / 2}px 6px; }`,
    `${desk} .br-head { display: contents; }`,
    `${desk} .br-top::before, ${desk} .br-top::after { content: ''; flex-basis: 100%; height: 0; }`,
    `${desk} .br-top::before { order: 1; }`,
    `${desk} .br-count { order: 2; }`,
    `${desk} .br-top::after { order: 3; }`,
    `${desk} .br-leader { order: 0; }`,
    `${desk} .br-sub { order: 4; flex-direction: row; gap: 6px; }`,
    // The announcement on the title's line, the title aside while it
    // shows and back once it has faded.
    `${royaleDesk} .hud-announce, ${royalePhone} .hud-announce { ` +
      'width: max-content; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ' +
      'text-align: center; }',
    `${royaleDesk} .hud-announce { top: calc(${DESK_TOP_PX}px + ${SAFE_TOP}); ` +
      `font-size: ${OPEN_ANNOUNCE_FONT_PX}px; line-height: ${TITLE_H_PX}px; ` +
      `max-width: ${openAnnounceMaxWidth(0, false)}px; }`,
    `${royalePhone} .hud-announce { top: calc(${PHONE_TOP_PX}px + ${SAFE_TOP}); ` +
      `font-size: ${COMPACT_OPEN_ANNOUNCE_FONT_PX}px; line-height: ${PHONE_TITLE_H_PX}px; ` +
      `max-width: ${openAnnounceMaxWidth(0, true)}px; }`,
    `.br-grafts .ttl { transition: visibility 0s linear ${ANNOUNCE_FADE_S}s; }`,
    `${open}.announcing .br-grafts .ttl { visibility: hidden; transition: none; }`,
    // A spotlight on screen when the cards open.
    `${open} .br-spot { visibility: hidden; }`,
    // The drop's banner: its seconds alone, under the head.
    `${desk} .br-drop, ${phone} .br-drop { padding: 0; border: 0; background: none; ` +
      'box-shadow: none; }',
    `${open} .br-drop b { display: none; }`,
    `${desk} .br-drop { top: calc(${dropChipTop(false)}px + ${SAFE_TOP}); }`,
    `${phone} .br-drop { top: calc(${dropChipTop(true)}px + ${SAFE_TOP}); }`,
    `${desk} .br-drop span { font-size: 14px; padding: 3px 8px; min-width: 40px; }`,
    `${phone} .br-drop span { font-size: 12px; padding: 2px 7px; min-width: 34px; }`,
    // A phone played by taps: one notice.
    `${taps} .br-note:nth-last-child(n + ${COMPACT_NOTES_OPEN_SHOWN + 1}) { display: none; }`,
  ].join('\n');
}
