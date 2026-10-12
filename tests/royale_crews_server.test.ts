// Crews on the server (ADR 0034): the seats in crews, the match of the size
// asked and the seat in the crew with the most people
// (server/royale_join.ts), the crews ranked and placed, the result in
// Crews (server/royale_ranking.ts), and the points: a crewmate is no
// opponent, the places are the crews', the whole winning crew is paid
// (server/royale_points.ts).

import { describe, expect, it } from 'vitest';
import { ACTIVE_END_TICKS } from '../server/points';
import { type BotSeatCandidate, chooseBotSeat, chooseRoyaleMatch } from '../server/royale_join';
import { RoyaleMatch } from '../server/royale_match';
import { placeReason, RoyalePoints, seatWeight } from '../server/royale_points';
import {
  crewPlaceOf,
  crewRankAndGap,
  crewRanking,
  type RankedSeat,
  royaleRanking,
  royaleResult,
} from '../server/royale_ranking';
import { royaleSeats } from '../server/royale_seats';
import type { ServerMsg } from '../src/net/protocol';
import type { RoyaleState } from '../src/sim/royale/types';
import { FakeRoyaleSim, fakeFactory, spot } from './royale_fake';

describe('the seats in crews', () => {
  it('seats the people first, every seat in its crew in seat order', () => {
    const people = [1, 2].map((id) => ({
      clientId: id,
      owner: id,
      name: `p${id}`,
      guest: false,
      pick: { championId: 'dain', sigils: ['riftstep', 'mend'] as [string, string], skin: 0 },
    }));
    const seats = royaleSeats(people, 9, 48, 3);
    expect(seats).toHaveLength(48);
    expect(seats.map((s) => s.team)).toEqual(
      Array.from({ length: 48 }, (_, i) => Math.floor(i / 3)),
    );
    expect(seats.slice(0, 2).map((s) => s.clientId)).toEqual([1, 2]);
    // Solo as before: every seat its own.
    expect(royaleSeats([], 9, 6).map((s) => s.team)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('joining a match of Crews', () => {
  const base = { stage: 'play' as const, time: 30, dropEndsAt: 10, endsAt: 610, openSeats: 10 };

  it('joins only a match of the size asked, Solo when unsaid', () => {
    const matches = [
      { ...base, matchId: 1, variant: 'respawn' as const, people: 5, closing: false },
      {
        ...base,
        matchId: 2,
        variant: 'respawn' as const,
        crew: 3 as const,
        people: 1,
        closing: false,
      },
      {
        ...base,
        matchId: 3,
        variant: 'respawn' as const,
        crew: 5 as const,
        people: 2,
        closing: false,
      },
    ];
    expect(chooseRoyaleMatch(matches, 'respawn')).toBe(1);
    expect(chooseRoyaleMatch(matches, 'respawn', 3)).toBe(2);
    expect(chooseRoyaleMatch(matches, 'respawn', 5)).toBe(3);
    expect(chooseRoyaleMatch(matches, 'one_life', 3)).toBeNull();
  });

  it('takes a seat in the crew with the most people before the champion picked', () => {
    const seat = (unitId: number, championId: string, crewPeople: number): BotSeatCandidate => ({
      unitId,
      championId,
      dead: false,
      out: false,
      crewPeople,
      level: 3,
      build: 0,
      grafts: 0,
    });
    const seats = [seat(4, 'vesk', 0), seat(8, 'torv', 2), seat(9, 'vesk', 1)];
    expect(chooseBotSeat(seats, 'vesk')).toBe(8);
    expect(chooseBotSeat(seats.slice(0, 1).concat(seats[2]!), 'vesk')).toBe(9);
    // Without crews, the champion picked first as before.
    expect(
      chooseBotSeat(
        seats.map(({ crewPeople: _, ...s }) => s),
        'vesk',
      ),
    ).toBe(4);
  });
});

type State = Pick<
  RoyaleState,
  | 'variant'
  | 'stage'
  | 'scores'
  | 'eliminated'
  | 'winnerId'
  | 'crew'
  | 'crewScores'
  | 'crewsOut'
  | 'winnerTeam'
>;

// Six seats in three crews of two (the rules read any size; a match plays
// three or five).
const seats: RankedSeat[] = [1, 2, 3, 4, 5, 6].map((unitId) => ({
  unitId,
  name: `s${unitId}`,
  championId: 'dain',
  bot: unitId !== 3,
  deaths: unitId === 1 ? 2 : 0,
  team: Math.floor((unitId - 1) / 2),
}));

function state(over: Partial<State> = {}): State {
  return {
    variant: 'respawn',
    stage: 'over',
    scores: new Map([
      [1, 3],
      [2, 1],
      [3, 2],
      [4, 0],
      [5, 4],
      [6, 0],
    ]),
    eliminated: [],
    winnerId: null,
    crew: 3,
    crewScores: new Map([
      [0, 4],
      [1, 2],
      [2, 4],
    ]),
    crewsOut: [],
    winnerTeam: null,
    ...over,
  };
}

describe('the crews ranked', () => {
  it('ranks Respawn crews by their score, then fewer deaths, the winner first', () => {
    // Crews 0 and 2 tie on 4; crew 0 died twice.
    expect(crewRanking(state(), seats)).toEqual([2, 0, 1]);
    expect(royaleRanking(state(), seats)).toEqual([5, 6, 1, 2, 3, 4]);
    expect(crewRanking(state({ winnerTeam: 0 }), seats)).toEqual([0, 2, 1]);
    expect(crewRankAndGap(state(), seats, 0)).toEqual({ rank: 2, gap: 0 });
    expect(crewRankAndGap(state(), seats, 1)).toEqual({ rank: 3, gap: 2 });
    expect(crewRankAndGap(state(), seats, 2)).toEqual({ rank: 1, gap: 0 });
  });

  it("places One life's crews as they fall, the last standing first", () => {
    const s = state({
      variant: 'one_life',
      crewsOut: [1, 0],
      winnerTeam: 2,
      eliminated: [3, 4, 2, 1],
    });
    expect(crewRanking(s, seats)).toEqual([2, 0, 1]);
    expect(crewPlaceOf(s, 3, 2)).toBe(1);
    expect(crewPlaceOf(s, 3, 0)).toBe(2);
    expect(crewPlaceOf(s, 3, 1)).toBe(3);
    // Within a crew, the one that fell last first.
    expect(royaleRanking(s, seats)).toEqual([5, 6, 1, 2, 4, 3]);
    // Still standing: no place yet.
    expect(crewPlaceOf(state({ variant: 'one_life', crewsOut: [1] }), 3, 0)).toBeNull();
  });

  it("tells a seat its crew's place, its crewmates and the winning crew", () => {
    const r = royaleResult(state({ winnerTeam: 2, winnerId: 5 }), seats, 3);
    expect(r.place).toBe(3);
    expect(r.of).toBe(3);
    expect(r.score).toBe(2);
    expect(r.crew).toEqual({
      size: 3,
      score: 2,
      mates: [{ name: 's4', championId: 'dain', score: 0, bot: true }],
      winners: ['s5', 's6'],
      winnerScore: 4,
    });
    expect(r.top.map((t) => t.cr)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(r.window).toBeUndefined();
  });
});

describe('points in Crews', () => {
  const seat = (clientId: number, unitId: number, team?: number) => ({
    clientId,
    owner: clientId * 10,
    unitId,
    lastCommandAt: ACTIVE_END_TICKS,
    ...(team !== undefined ? { team } : {}),
  });

  it('doubles only for a person on another crew', () => {
    const mates = [seat(1, 1, 0), seat(2, 2, 0)];
    expect(seatWeight(mates[0]!, mates)).toBe(1);
    expect(seatWeight(mates[0]!, [...mates, seat(3, 5, 2)])).toBe(2);
    // Solo: every other person.
    expect(seatWeight(seat(1, 1), [seat(1, 1), seat(2, 2)])).toBe(2);
  });

  it("pays the crews' places out of the crews: the top tenth and fifth", () => {
    expect(placeReason(1, 10)).toBe('last_standing');
    expect(placeReason(2, 10)).toBe('top_ten');
    expect(placeReason(3, 10)).toBeNull();
    expect(placeReason(3, 16)).toBe('top_ten');
    expect(placeReason(4, 16)).toBeNull();
  });

  it('pays every seat of the winning crew its end, a fallen one too', () => {
    const sim = new FakeRoyaleSim('respawn', 3);
    const a = sim.addChampion(0, 'fenn', spot(0, 4));
    const b = sim.addChampion(0, 'torv', spot(1, 4));
    const c = sim.addChampion(1, 'vesk', spot(2, 4));
    b.dead = true;
    sim.tickCount = ACTIVE_END_TICKS;
    const points = new RoyalePoints(sim, 'respawn', 2);
    const seats3 = [seat(1, a.id, 0), seat(2, b.id, 0), seat(3, c.id, 1)];
    points.observe(sim, [], seats3);
    const awards = points.observe(sim, [{ type: 'royale_end', winnerId: a.id }], seats3);
    expect(awards.map((x) => [x.clientId, x.reason])).toEqual([
      [1, 'best_score'],
      [2, 'best_score'],
    ]);
  });
});

describe('the snapshot in Crews', () => {
  it("tells the crews' count and score, the crew's rank, and the crewmates' picks apart", () => {
    const fake = fakeFactory();
    const person = {
      clientId: 1,
      owner: 1,
      name: 'p1',
      guest: false,
      pick: { championId: 'dain', sigils: ['riftstep', 'mend'] as [string, string], skin: 0 },
    };
    const match = new RoyaleMatch(1, 3, 'respawn', [person], fake.factory, 9, 3);
    const sim = fake.sims[0]!;
    const self = match.players.get(1)!.unitId;
    const ids = [...sim.units.values()].filter((u) => u.kind === 'champion').map((u) => u.id);
    // Its crewmates are the next two seats; the fourth is another crew's.
    for (const id of ids.slice(1, 4)) sim.pickDrop(id, spot(id, 9));
    const drop = match.snapshotFor(1) as Extract<ServerMsg, { t: 'snap' }>;
    expect(drop.royale?.cp).toHaveLength(2);
    expect(drop.royale?.picks).toHaveLength(1);
    expect(drop.royale?.cw).toEqual({ n: 3, s: 0 });
    sim.royale.stage = 'play';
    sim.royale.crewScores.set(1, 3);
    sim.royale.crewScores.set(0, 1);
    sim.royale.scores.set(self, 1);
    const play = match.snapshotFor(1) as Extract<ServerMsg, { t: 'snap' }>;
    expect(play.royale?.cw).toEqual({ n: 3, s: 1 });
    expect(play.royale?.rk).toBe(2);
    expect(play.royale?.gap).toBe(2);
  });
});
