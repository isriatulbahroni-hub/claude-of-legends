// A seat changing hands while the match plays (ADR 0025): a person took a
// bot's seat, took their held seat back, or left it to a bot. Everyone
// else in the match is told, the people playing and the spectators alike,
// by the name the match already shows and the seat's team, nothing more:
// no account, no Guest key, no connection. The person it is about is not
// told about themself, and nobody is told once the match is decided.
// Pure: the 5v5 (server/main.ts, through matchSeatSends) and the battle
// royale (server/royale_service.ts) hand in who is in the match and send
// what it answers.
//
// Nothing here reaches the sim or a bot's observation, and nothing of it is
// recorded in the replay: a replay keeps what steered the sim, and the
// handover itself is there already (bot_off, bot_on in src/net/replay.ts),
// so REPLAY_VERSION does not move. On the wire these are the typed
// messages player_joined, player_back and player_left
// (src/net/protocol.ts), which a client that does not know one ignores.

import type { ServerMsg } from '../src/net/protocol';
import type { TeamId } from '../src/sim/types';

export type SeatChange = 'joined' | 'back' | 'left';

export interface ChangedSeat {
  // The name the match shows for the person: their account's or their
  // Guest name.
  name: string;
  team: TeamId;
  // Leaving a seat whose own bot was already playing (a coach's, ADR 0013):
  // that bot plays on rather than a house bot.
  ownBot?: boolean;
}

export type SeatChangeMsg = Extract<
  ServerMsg,
  { t: 'player_joined' } | { t: 'player_back' } | { t: 'player_left' }
>;

export function seatChangeMsg(change: SeatChange, seat: ChangedSeat): SeatChangeMsg {
  const { name, team } = seat;
  if (change === 'joined') return { t: 'player_joined', name, team };
  if (change === 'back') return { t: 'player_back', name, team };
  return { t: 'player_left', name, team, ...(seat.ownBot ? { own: 1 as const } : {}) };
}

// Who hears of it: everyone in `audience` (the match's people and its
// spectators, by connection) but `about`, the person it is about, each
// once; nobody once the match is decided.
export function seatChangeSends(
  change: SeatChange,
  seat: ChangedSeat,
  audience: Iterable<number>,
  about: number | null,
  playing: boolean,
): { to: number; msg: SeatChangeMsg }[] {
  if (!playing) return [];
  const msg = seatChangeMsg(change, seat);
  const told = new Set<number>();
  const out: { to: number; msg: SeatChangeMsg }[] = [];
  for (const to of audience) {
    if (to === about || told.has(to)) continue;
    told.add(to);
    out.push({ to, msg });
  }
  return out;
}

// The 5v5's match (server/match.ts) as a seat change reads it.
export interface SeatChangeMatch {
  readonly players: ReadonlyMap<number, unknown>;
  readonly spectators: ReadonlyMap<number, unknown>;
  readonly sim: { readonly winner: number | null };
  buildScore(): ServerMsg;
}

// A seat of the 5v5 changed hands: the line to everyone else in it, the
// people playing and the spectators, then the scoreboard to everyone in
// it, the seat's new name and its "(bot)" mark with it, rather than at the
// next regular one. A coach's seat (Match.handleDisconnect's coach) leaves
// its own bot playing.
export function matchSeatSends(
  match: SeatChangeMatch,
  change: SeatChange,
  seat: ChangedSeat & { coach?: boolean },
  about: number,
): { to: number; msg: ServerMsg }[] {
  if (match.sim.winner !== null) return [];
  const audience = [...match.players.keys(), ...match.spectators.keys()];
  const told = { name: seat.name, team: seat.team, ownBot: seat.ownBot || seat.coach };
  const out: { to: number; msg: ServerMsg }[] = [];
  out.push(...seatChangeSends(change, told, audience, about, true));
  const score = match.buildScore();
  for (const to of new Set(audience)) out.push({ to, msg: score });
  return out;
}
