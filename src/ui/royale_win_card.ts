// The win card (CONTEXT.md: Win card): on a battle royale champion's
// landing, the drop's end or a drop-in's Arrival, a short card says what
// wins the match and the three things that lead there, for a few seconds,
// and goes; its close button sends it sooner. A person on the seat sees
// it, never a viewer of a replay or a coach. While it shows, the first
// steps wait (ui/royale_steps.ts): they would say the same at the same
// moment, the Dusk's step the card's own last line. Once it has gone they
// run as they ran from the landing, their landing counted from its going,
// so the fight's step still comes first. Pure: the words, the card's
// clock, and where it stands; ui/royale_win_view.ts draws it.

import type { RoyaleVariant } from '../sim/royale/types';
import type { ScreenBox } from './royale_layout';

export interface WinCardWords {
  title: string;
  lines: readonly string[];
}

const CARDS: Readonly<Record<RoyaleVariant, WinCardWords>> = {
  respawn: {
    title: 'Most takedowns when the light goes out wins',
    lines: [
      'Fight champions for takedowns',
      'Open caches for your build',
      'Stay in the light: the Dusk burns',
    ],
  },
  one_life: {
    title: 'Last one standing wins',
    lines: [
      'One life: a fall ends your match',
      'Open caches for your build',
      'Stay in the light: the Dusk burns',
    ],
  },
};

// In Crews (ADR 0034): the crew wins or falls as one.
const CREW_CARDS: Readonly<Record<RoyaleVariant, WinCardWords>> = {
  respawn: {
    title: 'The crew with the most takedowns wins',
    lines: [
      'Your crew shares its sight and score',
      'Open caches for your build',
      'Stay in the light: the Dusk burns',
    ],
  },
  one_life: {
    title: 'Last crew standing wins',
    lines: [
      'One life: then you watch your crew',
      'Open caches for your build',
      'Stay in the light: the Dusk burns',
    ],
  },
};

export function winCardWords(v: RoyaleVariant, crews = false): WinCardWords {
  return (crews ? CREW_CARDS : CARDS)[v];
}

// The close button's name, for a screen reader.
export const WIN_CARD_CLOSE = 'Close';

// How long the card shows, counted while nothing covers it (the pause
// menu, the wash of a death, the Graft cards opened again, a phone's
// spotlight); and how long after the landing it may still come up, past
// which the moment has gone and the win line says it instead.
export const WIN_CARD_S = 8;
export const WIN_CARD_LATE_S = 20;

export interface WinCardState {
  // Off for good: not a person on the seat, gone, or closed.
  done: boolean;
  // Match time of the landing, once seen.
  landedAt: number | null;
  // Seconds shown so far, and the time of the last update it showed at.
  shown: number;
  last: number | null;
  // Match time it went, for the first steps' landing.
  endedAt: number | null;
}

// A card for a person on the seat; none for anyone else.
export function winCardStart(playing: boolean): WinCardState {
  return { done: !playing, landedAt: null, shown: 0, last: null, endedAt: null };
}

function end(s: WinCardState, time: number): WinCardState {
  return { ...s, done: true, last: null, endedAt: time };
}

// One update: `landed` once the champion is down (ui/royale_steps.ts
// sinceLanding is not null), `covered` while something stands over it.
export function stepWinCard(
  s: WinCardState,
  v: { time: number; landed: boolean; covered: boolean },
): WinCardState {
  if (s.done || !v.landed) return s;
  const landedAt = s.landedAt ?? v.time;
  if (v.time - landedAt >= WIN_CARD_LATE_S) return end({ ...s, landedAt }, v.time);
  if (v.covered) return { ...s, landedAt, last: null };
  const shown = s.shown + (s.last === null ? 0 : Math.max(0, v.time - s.last));
  const next = { ...s, landedAt, shown, last: v.time };
  return shown >= WIN_CARD_S ? end(next, v.time) : next;
}

// Whether the card shows now.
export function winCardUp(s: WinCardState, covered: boolean): boolean {
  return !s.done && s.landedAt !== null && !covered;
}

// The close button.
export function closeWinCard(s: WinCardState, time: number): WinCardState {
  return s.done ? s : end(s, time);
}

// The first steps wait while the card is still to come or up, and count
// their landing from its going: `since` is the seconds since the landing
// (null before it), and the answer the steps' own, null while they wait.
export function stepsLanding(s: WinCardState, since: number | null, time: number): number | null {
  if (since === null) return null;
  if (!s.done) return null;
  return s.endedAt === null ? since : Math.min(since, Math.max(0, time - s.endedAt));
}

// Whether the card holds the first steps: still to come or up.
export function holdsSteps(s: WinCardState): boolean {
  return !s.done;
}

// Where the card stands, at interface size 1 (ui/royale_layout.ts counts
// the rest of the HUD the same way). On a desktop at the left, under the
// first steps' place (they wait while it shows) and under the band the
// announcements take, its right edge WIN_CLEAR_MIDDLE_PX short of the
// middle where the champion stands. On a phone in the column left of the
// champion: with the thumb controls past the touch bar at the left edge
// and under their hints, played by taps from the edge, under the
// announcement's line; above the notices either way. Neither stands over
// the Graft cards, which fold for the first seconds after the landing and
// make it step aside when opened again, nor under a phone's spotlight.
export const WIN_DESK_LEFT_PX = 12;
export const WIN_DESK_TOP_PX = 200;
export const WIN_DESK_W_PX = 432;
export const WIN_CLEAR_MIDDLE_PX = 72;
export const WIN_TAPS_LEFT_PX = 12;
export const WIN_TAPS_TOP_PX = 96;
export const WIN_THUMBS_LEFT_PX = 82;
export const WIN_THUMBS_TOP_PX = 121;
export const WIN_PHONE_CLEAR_MIDDLE_PX = 66;

// The card's type and frame: the title and the lines' sizes and line
// heights, the gap between them, the padding (the title keeps the close
// button's room on its right) and the border, a desktop's and a phone's.
export interface WinCardType {
  titlePx: number;
  titleLh: number;
  linePx: number;
  lineLh: number;
  gap: number;
  padX: number;
  padY: number;
  close: number;
  border: number;
}

export const WIN_DESK_TYPE: WinCardType = {
  titlePx: 14,
  titleLh: 18,
  linePx: 13,
  lineLh: 18,
  gap: 4,
  padX: 12,
  padY: 8,
  close: 24,
  border: 5,
};

export const WIN_PHONE_TYPE: WinCardType = {
  titlePx: 13,
  titleLh: 16,
  linePx: 11.5,
  lineLh: 15,
  gap: 3,
  padX: 10,
  padY: 6,
  close: 22,
  border: 5,
};

// A bold system face's widest average letter in ems (ui/royale_layout.ts
// BOLD_EM_PER_CHAR), and the lines' semibold one.
export const WIN_TITLE_EM_PER_CHAR = 0.64;
export const WIN_LINE_EM_PER_CHAR = 0.58;

export function winCardWidth(width: number, compact: boolean, thumbs: boolean): number {
  if (!compact) return Math.min(WIN_DESK_W_PX, width / 2 - WIN_CLEAR_MIDDLE_PX - WIN_DESK_LEFT_PX);
  const left = thumbs ? WIN_THUMBS_LEFT_PX : WIN_TAPS_LEFT_PX;
  return width / 2 - WIN_PHONE_CLEAR_MIDDLE_PX - left;
}

const linesOf = (text: string, px: number, em: number, room: number): number =>
  Math.max(1, Math.ceil((text.length * px * em) / room));

// How many lines the title takes in a card `cardW` wide, at the widest
// letters a system face draws.
export function winTitleLines(words: WinCardWords, cardW: number, t: WinCardType): number {
  const room = cardW - 2 * t.padX - t.border - t.close;
  return linesOf(words.title, t.titlePx, WIN_TITLE_EM_PER_CHAR, room);
}

export function winCardHeight(words: WinCardWords, cardW: number, t: WinCardType): number {
  const room = cardW - 2 * t.padX - t.border;
  const lines = words.lines.reduce(
    (n, l) => n + linesOf(l, t.linePx, WIN_LINE_EM_PER_CHAR, room),
    0,
  );
  return 2 * t.padY + 2 + winTitleLines(words, cardW, t) * t.titleLh + t.gap + lines * t.lineLh;
}

export function winCardBox(
  width: number,
  compact: boolean,
  thumbs: boolean,
  words: WinCardWords,
): ScreenBox {
  const w = winCardWidth(width, compact, thumbs);
  const left = !compact ? WIN_DESK_LEFT_PX : thumbs ? WIN_THUMBS_LEFT_PX : WIN_TAPS_LEFT_PX;
  const top = !compact ? WIN_DESK_TOP_PX : thumbs ? WIN_THUMBS_TOP_PX : WIN_TAPS_TOP_PX;
  const h = winCardHeight(words, w, compact ? WIN_PHONE_TYPE : WIN_DESK_TYPE);
  return { left, top, right: left + w, bottom: top + h };
}

const SAFE_LEFT = 'var(--safe-left, env(safe-area-inset-left, 0px))';

// The card's width as CSS, on a desktop and on a phone (the stage's safe
// area to the left counted as the box counts none).
export function winCardWidthCss(compact: boolean, thumbs: boolean): string {
  if (!compact) {
    return `min(${WIN_DESK_W_PX}px, calc(50% - ${WIN_CLEAR_MIDDLE_PX + WIN_DESK_LEFT_PX}px - ${SAFE_LEFT}))`;
  }
  const left = thumbs ? WIN_THUMBS_LEFT_PX : WIN_TAPS_LEFT_PX;
  return `calc(50% - ${WIN_PHONE_CLEAR_MIDDLE_PX + left}px - ${SAFE_LEFT})`;
}
