// The win line (CONTEXT.md: Win card): a small line under the battle
// royale's top line that says, all match long, what wins it and where the
// viewer stands. Respawn: "Most takedowns wins · 4:12 left · you are 11th",
// the time until the last light goes out and the own rank (the count line
// above qualifies a drop-in's, "since you landed"). One life: "Last one
// standing wins · 23 left". On a phone (`compact`) the line shares its row
// with the Dusk's pill and leaves the rank to the count beside the Dusk
// line, which carries it there; on a desktop the pill stands under it.
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

export function winLine(
  r: Pick<SnapRoyale, 'v' | 'st' | 'end' | 'alive' | 'rk'>,
  time: number,
  compact = false,
): string | null {
  if (r.st !== 'play') return null;
  if (r.v === 'one_life') return `${ONE_LIFE_WINS} · ${r.alive} left`;
  const parts = [RESPAWN_WINS, `${clockText(r.end - time)} left`];
  if (!compact && r.rk !== undefined && r.rk > 0) parts.push(`you are ${ordinal(r.rk)}`);
  return parts.join(' · ');
}
