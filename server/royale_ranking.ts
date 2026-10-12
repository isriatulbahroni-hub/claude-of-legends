// The battle royale's ranking (ADR 0031) and the result each person is
// told at the end. One life ranks the last standing first, then the
// fallen, the last to fall first; a place is known the moment a champion
// is out. Respawn ranks by takedowns scored (the score leader's counts
// double, src/sim/royale/types.ts), fewer deaths first on a tie, and the
// places are known when the last light goes out; a drop-in is also ranked
// on what every seat scored since they landed (windowStanding). In Crews
// (ADR 0034) the crews are ranked and every seat sits with its crew: One
// life's crew is placed once its last champion fell, the last crew
// standing first; Respawn's crews by every takedown their champions scored
// (RoyaleState.crewScores), fewer deaths first on a tie. Pure over the
// mode's state.

import type { RoyaleResult } from '../src/net/royale_wire';
import { byCrews } from '../src/sim/royale/crews';
import type { RoyaleState } from '../src/sim/royale/types';

// The seats as the ranking reads them, in seat order.
export interface RankedSeat {
  unitId: number;
  name: string;
  championId: string;
  bot: boolean;
  deaths: number;
  // The seat's crew (the sim's team), read in Crews only.
  team?: number;
}

// The mode's state as the ranking reads it; the crews' fields are read in
// Crews only (a state without them is Solo's).
type RankState = Pick<RoyaleState, 'variant' | 'stage' | 'scores' | 'eliminated' | 'winnerId'> &
  Partial<Pick<RoyaleState, 'crew' | 'crewScores' | 'crewsOut' | 'winnerTeam'>>;

const teamOf = (s: RankedSeat): number => s.team ?? s.unitId;
const crewScore = (state: RankState, team: number | undefined): number =>
  team === undefined ? 0 : (state.crewScores?.get(team) ?? 0);

// The crews, by team, best first (Crews only): One life the winning crew,
// the crews still standing by their score, then the crews out, the last
// out first; Respawn the winning crew once known, then by the crew's
// score, its deaths, the lower team.
export function crewRanking(state: RankState, seats: readonly RankedSeat[]): number[] {
  const teams = [...new Set(seats.map(teamOf))].sort((a, b) => a - b);
  const deaths = new Map<number, number>();
  for (const s of seats) deaths.set(teamOf(s), (deaths.get(teamOf(s)) ?? 0) + s.deaths);
  const score = (team: number): number => crewScore(state, team);
  const byScore = (a: number, b: number): number =>
    score(b) - score(a) || (deaths.get(a) ?? 0) - (deaths.get(b) ?? 0) || a - b;
  const winner = state.winnerTeam ?? null;
  const crewsOut = state.crewsOut ?? [];
  const first = winner !== null && teams.includes(winner) ? [winner] : [];
  if (state.variant === 'respawn') {
    return [...first, ...teams.filter((t) => t !== winner).sort(byScore)];
  }
  const out = new Set(crewsOut);
  const standing = teams.filter((t) => t !== winner && !out.has(t)).sort(byScore);
  const fallen = [...crewsOut].reverse().filter((t) => t !== winner);
  return [...first, ...standing, ...fallen];
}

// Every seat's unit id, best first.
export function royaleRanking(state: RankState, seats: readonly RankedSeat[]): number[] {
  const score = (id: number): number => state.scores.get(id) ?? 0;
  const deaths = new Map(seats.map((s) => [s.unitId, s.deaths]));
  const byScore = (a: number, b: number): number =>
    score(b) - score(a) || (deaths.get(a) ?? 0) - (deaths.get(b) ?? 0) || a - b;
  if ((state.crew ?? 1) > 1) {
    const outAt = new Map(state.eliminated.map((id, i) => [id, i]));
    const within = (a: number, b: number): number => {
      if (state.variant === 'respawn') return byScore(a, b);
      const oa = outAt.get(a);
      const ob = outAt.get(b);
      if (oa === undefined && ob === undefined) return byScore(a, b);
      if (oa === undefined) return -1;
      if (ob === undefined) return 1;
      return ob - oa;
    };
    const champions = seats.map((s) => ({ id: s.unitId, team: teamOf(s) }));
    return byCrews(crewRanking(state, seats), champions, within);
  }
  const winner = state.winnerId;
  if (state.variant === 'respawn') {
    const rest = seats
      .map((s) => s.unitId)
      .filter((id) => id !== winner)
      .sort(byScore);
    return winner !== null && deaths.has(winner) ? [winner, ...rest] : rest;
  }
  const out = new Set(state.eliminated);
  const standing = seats
    .map((s) => s.unitId)
    .filter((id) => id !== winner && !out.has(id))
    .sort(byScore);
  const fallen = [...state.eliminated].reverse().filter((id) => id !== winner);
  return [...(winner !== null && deaths.has(winner) ? [winner] : []), ...standing, ...fallen];
}

// A crew's place once it is known, else null (Crews only): One life, when
// the crew is out or has won; Respawn, at the end. Out of `crews`.
export function crewPlaceOf(state: RankState, crews: number, team: number): number | null {
  if (state.variant !== 'one_life') return null;
  if (state.winnerTeam === team) return 1;
  const k = (state.crewsOut ?? []).indexOf(team);
  return k >= 0 ? crews - k : null;
}

// The recipient's crew's rank and the gap in takedowns to the crew above
// it, or for the first its lead over the second (Crews' Respawn top line).
export function crewRankAndGap(
  state: RankState,
  seats: readonly RankedSeat[],
  team: number,
): { rank: number; gap: number } | null {
  const order = crewRanking(state, seats);
  const i = order.indexOf(team);
  if (i < 0) return null;
  const score = (t: number | undefined): number => crewScore(state, t);
  const own = score(team);
  const gap = i === 0 ? own - score(order[1]) : score(order[i - 1]) - own;
  return { rank: i + 1, gap: Math.max(0, gap) };
}

// A seat's place once it is known, else null: One life, when the champion
// is out or has won; Respawn, at the end.
export function placeOf(state: RankState, seatCount: number, unitId: number): number | null {
  if (state.variant === 'one_life') {
    if (state.winnerId === unitId) return 1;
    const k = state.eliminated.indexOf(unitId);
    if (k >= 0) return seatCount - k;
    return null;
  }
  return null;
}

// Respawn's standing as the HUD's top line tells it (src/ui/royale_text.ts
// countLine): the seat's rank in the ranking, and the gap in takedowns to
// the seat above it, or for the first its lead over the second. Null for a
// seat not in the ranking.
export function rankAndGap(
  state: RankState,
  seats: readonly RankedSeat[],
  unitId: number,
): { rank: number; gap: number } | null {
  return rankAndGapIn(royaleRanking(state, seats), state, unitId);
}

// The same, over a ranking already made (one per tick for every viewer).
export function rankAndGapIn(
  ranking: readonly number[],
  state: Pick<RoyaleState, 'scores'>,
  unitId: number,
): { rank: number; gap: number } | null {
  const i = ranking.indexOf(unitId);
  if (i < 0) return null;
  const score = (id: number | undefined): number =>
    id === undefined ? 0 : (state.scores.get(id) ?? 0);
  const own = score(unitId);
  const gap = i === 0 ? own - score(ranking[1]) : score(ranking[i - 1]) - own;
  return { rank: i + 1, gap: Math.max(0, gap) };
}

// Respawn's standing since a drop-in landed (server/royale_match.ts
// RoyalePlayer.window): each seat's takedowns scored since then, its score
// less the one it held at the landing (`base`, a seat it does not hold
// counting from zero, never below zero), ranked the way a table of ties
// reads, one more than the seats with more. The gap is to the next better
// score, or for the first its lead over the next; aboveId is the seat
// holding that next better score, the lowest id on a tie, and null for the
// first. Out of every seat of the match (`of`).
export interface WindowStanding {
  rank: number;
  of: number;
  score: number;
  gap: number;
  aboveId: number | null;
}

export function windowStanding(
  scores: ReadonlyMap<number, number>,
  base: ReadonlyMap<number, number>,
  seatIds: readonly number[],
  unitId: number,
): WindowStanding {
  const since = (id: number): number => Math.max(0, (scores.get(id) ?? 0) - (base.get(id) ?? 0));
  const own = since(unitId);
  let more = 0;
  let next: number | null = null;
  let aboveId: number | null = null;
  let runnerUp = 0;
  for (const id of seatIds) {
    if (id === unitId) continue;
    const s = since(id);
    if (s > own) {
      more += 1;
      if (next === null || s < next || (s === next && aboveId !== null && id < aboveId)) {
        next = s;
        aboveId = id;
      }
    } else if (s > runnerUp) {
      runnerUp = s;
    }
  }
  return {
    rank: 1 + more,
    of: seatIds.length,
    score: own,
    gap: next !== null ? next - own : own - runnerUp,
    aboveId,
  };
}

// A line's Respawn best (ADR 0033): the most takedowns one seat scored in
// a match, a whole number. Past this it is junk, not a match.
export const RESPAWN_BEST_MAX = 1000;

// A best as it is read from disk or a tally: a whole number from 0 to
// RESPAWN_BEST_MAX, and 0 for anything that is not a number.
export function wholeBest(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(RESPAWN_BEST_MAX, Math.floor(v)));
}

// The tally a Respawn seat's best is judged on (ADR 0033): its takedowns
// since landing for a drop-in, the whole match's otherwise. The rule the
// end card counts by (src/ui/royale_result.ts respawnTally).
export function respawnSeatTally(result: RoyaleResult): number {
  return result.window?.score ?? result.score;
}

// How close the near miss of the end card is: the seat just above, when
// it was no more than this many takedowns ahead.
export const NEAR_MISS_BY = 2;

// The places of every seat at the end, from the ranking.
export function finalPlaces(ranking: readonly number[]): Map<number, number> {
  return new Map(ranking.map((id, i) => [id, i + 1]));
}

// How many of the top a result shows.
export const RESULT_TOP = 10;

// The result told at the end. Respawn adds, for a drop-in (`windowBase`,
// every seat's score when they landed), the standing since then; and for
// every seat the near miss: the seat just above, in that window, else in
// the whole match, when it was within NEAR_MISS_BY takedowns. The place is
// the whole match's either way. One life's result has neither.
export function royaleResult(
  state: RankState,
  seats: readonly RankedSeat[],
  unitId: number,
  windowBase: ReadonlyMap<number, number> | null = null,
): RoyaleResult {
  if ((state.crew ?? 1) > 1) return crewResult(state, seats, unitId);
  const ranking = royaleRanking(state, seats);
  const byId = new Map(seats.map((s) => [s.unitId, s]));
  const known = placeOf(state, seats.length, unitId);
  const place = known ?? ranking.indexOf(unitId) + 1;
  const winner = state.winnerId !== null ? (byId.get(state.winnerId)?.name ?? null) : null;
  const score = (id: number): number => state.scores.get(id) ?? 0;
  const result: RoyaleResult = {
    t: 'royale_result',
    v: state.variant,
    place: place > 0 ? place : seats.length,
    of: seats.length,
    score: score(unitId),
    winner,
    top: ranking.slice(0, RESULT_TOP).flatMap((id) => {
      const s = byId.get(id);
      return s ? [{ name: s.name, championId: s.championId, score: score(id), bot: s.bot }] : [];
    }),
  };
  if (state.variant !== 'respawn') return result;
  let above: { id: number; by: number } | null = null;
  if (windowBase) {
    const ids = seats.map((s) => s.unitId);
    const w = windowStanding(state.scores, windowBase, ids, unitId);
    result.window = { rank: w.rank, of: w.of, score: w.score };
    if (w.aboveId !== null) above = { id: w.aboveId, by: w.gap };
  } else {
    const id = ranking[ranking.indexOf(unitId) - 1];
    if (id !== undefined) above = { id, by: score(id) - score(unitId) };
  }
  // A tie is no takedown short: the near miss counts from one.
  const name = above ? byId.get(above.id)?.name : undefined;
  if (above && name !== undefined && above.by >= 1 && above.by <= NEAR_MISS_BY) {
    result.gap = { name, by: above.by };
  }
  return result;
}

// The result in Crews (ADR 0034): the place is the recipient's crew's, out
// of the crews; the score its own takedowns; the top the best whole crews
// that fit RESULT_TOP rows, each row with its crew's place; the crew block
// the crew's takedowns, its other champions in rank order, and the names of
// the winning crew. No window and no near miss: a crew's standing counts
// from the drop.
function crewResult(state: RankState, seats: readonly RankedSeat[], unitId: number): RoyaleResult {
  const ranking = royaleRanking(state, seats);
  const order = crewRanking(state, seats);
  const byId = new Map(seats.map((s) => [s.unitId, s]));
  const own = byId.get(unitId);
  const team = own ? teamOf(own) : -1;
  const known = crewPlaceOf(state, order.length, team);
  const place = known ?? order.indexOf(team) + 1;
  const crewPlace = new Map(order.map((t, i) => [t, i + 1]));
  const score = (id: number): number => state.scores.get(id) ?? 0;
  const row = (id: number) => {
    const s = byId.get(id)!;
    return { name: s.name, championId: s.championId, score: score(id), bot: s.bot };
  };
  const size = state.crew === 3 ? 3 : 5;
  const rows = Math.max(1, Math.floor(RESULT_TOP / size)) * size;
  const inCrew = (id: number, t: number | null | undefined): boolean => {
    const s = byId.get(id);
    return s !== undefined && t !== null && t !== undefined && teamOf(s) === t;
  };
  const winners = ranking.filter((id) => inCrew(id, state.winnerTeam)).map((id) => row(id).name);
  return {
    t: 'royale_result',
    v: state.variant,
    place: place > 0 ? place : order.length,
    of: order.length,
    score: score(unitId),
    winner: state.winnerId !== null ? (byId.get(state.winnerId)?.name ?? null) : null,
    top: ranking
      .slice(0, rows)
      .map((id) => ({ ...row(id), cr: crewPlace.get(teamOf(byId.get(id)!)) ?? order.length })),
    crew: {
      size,
      score: crewScore(state, team),
      mates: ranking.filter((id) => id !== unitId && inCrew(id, team)).map(row),
      winners,
      winnerScore: crewScore(state, state.winnerTeam ?? undefined),
    },
  };
}
