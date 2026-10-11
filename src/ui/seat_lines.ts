// A seat changing hands while the match plays, as the kill feed says it
// (server/seat_change.ts sends it to everyone else in the match): a person
// took a bot's seat, took their own seat back, or left it to a bot. The
// battle royale's feed (ui/royale_hud_moments.ts), the 5v5's (ui/hud.ts)
// and the spectator's (game/spectate.ts) draw the same words: the name
// the match already shows, then what happened. Pure.

import type { ServerMsg } from '../net/protocol';
import type { TeamId } from '../sim/types';

export type SeatLineKind = 'joined' | 'back' | 'left';

export interface SeatLine {
  kind: SeatLineKind;
  name: string;
  // What happened, after the name.
  words: string;
  // The seat's team, for the 5v5's colors.
  team: TeamId;
}

// The longest name a match shows (server/account_name.ts NAME_MAX, a
// Guest's "Wanderer 0000" under it), for the feed's room; a longer one
// would be cut short on screen, never here.
export const SEAT_NAME_MAX = 16;

// How long a line stays in the 5v5's and the spectator's feed,
// milliseconds: a kill line's while (ui/hud.ts pushKills).
export const SEAT_LINE_MS = 6000;

// How many seat lines a feed shows at once: several people dropping in
// together (or coming back after a dropped connection) leave the newest
// ones, never a column of them over the fight's lines.
export const SEAT_LINES_MAX = 2;

// The seat lines past SEAT_LINES_MAX, of those standing oldest first (the
// 5v5's and the spectator's feeds append): the ones to take down.
export function seatLinesPast<T>(standing: readonly T[]): T[] {
  return standing.slice(0, Math.max(0, standing.length - SEAT_LINES_MAX));
}

// Short enough that a Guest's line in the 5v5's feed on a phone stays
// clear of the team score (tests/seat_lines.test.ts).
export const SEAT_WORDS = {
  joined: 'joined the match',
  back: 'is back in the match',
  left: 'left, a bot plays on',
  // A coach's seat (ADR 0013): their own bot was playing it already.
  leftOwn: 'left, their bot plays on',
} as const;

// The line a server message makes, or null when it is none (another
// message, or a seat with no name to show).
export function seatLine(msg: ServerMsg): SeatLine | null {
  if (msg.t !== 'player_joined' && msg.t !== 'player_back' && msg.t !== 'player_left') {
    return null;
  }
  const name = typeof msg.name === 'string' ? msg.name.trim() : '';
  if (name === '') return null;
  const team = typeof msg.team === 'number' ? msg.team : 0;
  if (msg.t === 'player_joined') return { kind: 'joined', name, words: SEAT_WORDS.joined, team };
  if (msg.t === 'player_back') return { kind: 'back', name, words: SEAT_WORDS.back, team };
  const words = msg.own === 1 ? SEAT_WORDS.leftOwn : SEAT_WORDS.left;
  return { kind: 'left', name, words, team };
}

// The whole line as one string, for a test or a screen reader.
export function seatLineText(line: SeatLine): string {
  return `${line.name} ${line.words}`;
}
