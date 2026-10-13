// The win line (CONTEXT.md: Win card): a small line under the battle
// royale's top line that says, all match long, what wins it and where the
// viewer stands. Respawn: "Most takedowns wins · 4:12 left · you are 11th",
// the time until the last light goes out and the own rank (the count line
// above qualifies a drop-in's, "since you landed"). One life: "Last one
// standing wins · 23 left". In Crews (ADR 0034) the crews': "Top crew
// wins · 4:12 left · your crew is 3rd", "Last crew standing wins · 5 left"
// (the crews; the count line above names them, alone on a phone), no wider
// than Solo's. On a
// phone (`compact`) the line shares its row
// with the Dusk's pill and leaves the rank to the count beside the Dusk
// line, which carries it there; on a desktop the pill takes its place
// while it shows (winLineAside).
// Nothing during the drop (the drop's banner asks where to land, and the
// cards' seconds stand there) and nothing once the match is over. Pure:
// ui/royale_win_view.ts draws it.

import type { SnapRoyale } from '../net/royale_wire';
import { clockText, ordinal } from './royale_text';

// Its size and padding, a desktop's and a phone's, and the gap to the
// Dusk's pill beside it on a phone (ui/royale_win_view.ts).
export const WIN_LINE_PX = 11.5;
export const WIN_LINE_PAD_PX = 8;
export const WIN_COMPACT_LINE_PX = 10.5;
export const WIN_COMPACT_LINE_PAD_PX = 7;
export const WIN_ROW_GAP_PX = 6;
// The widest average letter of its bold face, in ems, as Chrome drew the
// line in the widest face it had (DejaVu Sans).
export const WIN_LINE_EM_PER_CHAR = 0.6;

export const RESPAWN_WINS = 'Most takedowns wins';
export const ONE_LIFE_WINS = 'Last one standing wins';
export const CREW_RESPAWN_WINS = 'Top crew wins';
export const CREW_ONE_LIFE_WINS = 'Last crew standing wins';

export function winLine(
  r: Pick<SnapRoyale, 'v' | 'st' | 'end' | 'alive' | 'rk' | 'cw'>,
  time: number,
  compact = false,
): string | null {
  if (r.st !== 'play') return null;
  if (r.v === 'one_life') {
    // On a phone the count beside the Dusk line already says the crews
    // left (royale_text.ts crewCountLine), and the row has no room for both.
    if (r.cw) return compact ? CREW_ONE_LIFE_WINS : `${CREW_ONE_LIFE_WINS} · ${r.cw.n} left`;
    return `${ONE_LIFE_WINS} · ${r.alive} left`;
  }
  const parts = [r.cw ? CREW_RESPAWN_WINS : RESPAWN_WINS, `${clockText(r.end - time)} left`];
  if (!compact && r.rk !== undefined && r.rk > 0) {
    parts.push(r.cw ? `your crew is ${ordinal(r.rk)}` : `you are ${ordinal(r.rk)}`);
  }
  return parts.join(' · ');
}

// Whether the line steps aside for the Dusk's pill: on a desktop with the
// Graft cards shut the two stack under the head, and with the mark's
// badge they reached 138 px, into the announcements' band at 112
// (ui/royale_layout.ts announceBox); the pill alone says what matters
// then. A phone's row and the open cards' row hold both side by side.
export function winLineAside(v: {
  compact: boolean;
  cardsOpen: boolean;
  burning: boolean;
}): boolean {
  return v.burning && !v.compact && !v.cardsOpen;
}
