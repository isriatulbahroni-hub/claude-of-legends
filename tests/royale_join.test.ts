// Entering a battle royale (server/royale_join.ts, ADR 0031, ADR 0025):
// which running match takes a newcomer, and which bot's seat they take.

import { describe, expect, it } from 'vitest';
import {
  type BotSeatCandidate,
  chooseBotSeat,
  chooseRoyaleMatch,
  type RoyaleCandidate,
  takesPeople,
} from '../server/royale_join';
import { CALM_S, DROP_S, JOIN_UNTIL_END_S, PLAY_S } from '../src/sim/royale/types';

const match = (over: Partial<RoyaleCandidate> = {}): RoyaleCandidate => ({
  matchId: 1,
  variant: 'respawn',
  stage: 'play',
  time: 60,
  dropEndsAt: DROP_S,
  endsAt: DROP_S + PLAY_S,
  people: 1,
  openSeats: 49,
  closing: false,
  ...over,
});

describe('who takes people', () => {
  it('Respawn takes people until two minutes from the end', () => {
    const end = DROP_S + PLAY_S;
    expect(takesPeople(match({ time: end - JOIN_UNTIL_END_S - 1 }))).toBe(true);
    expect(takesPeople(match({ time: end - JOIN_UNTIL_END_S }))).toBe(false);
    expect(takesPeople(match({ stage: 'drop', time: 1 }))).toBe(true);
  });

  it('One life takes people during the drop and the calm only', () => {
    const one = (time: number, stage: 'drop' | 'play' = 'play') =>
      takesPeople(match({ variant: 'one_life', time, stage }));
    expect(one(3, 'drop')).toBe(true);
    expect(one(DROP_S + CALM_S - 1)).toBe(true);
    expect(one(DROP_S + CALM_S)).toBe(false);
  });

  it('never a match that is over, closing, or full of people', () => {
    expect(takesPeople(match({ stage: 'over' }))).toBe(false);
    expect(takesPeople(match({ closing: true }))).toBe(false);
    expect(takesPeople(match({ openSeats: 0 }))).toBe(false);
  });
});

describe('the match to join', () => {
  it('is the liveliest of the variant, then the youngest, then the lowest id', () => {
    const list = [
      match({ matchId: 1, people: 1, time: 30 }),
      match({ matchId: 2, people: 3, time: 200 }),
      match({ matchId: 3, people: 3, time: 100 }),
      match({ matchId: 4, people: 9, variant: 'one_life', stage: 'drop', time: 2 }),
    ];
    expect(chooseRoyaleMatch(list, 'respawn')).toBe(3);
    expect(chooseRoyaleMatch(list, 'one_life')).toBe(4);
    expect(chooseRoyaleMatch([match({ matchId: 5, stage: 'over' })], 'respawn')).toBeNull();
  });
});

describe('the seat to take', () => {
  const seat = (
    unitId: number,
    championId: string,
    level: number,
    over: Partial<BotSeatCandidate> = {},
  ): BotSeatCandidate => ({
    unitId,
    championId,
    dead: false,
    out: false,
    level,
    build: 0,
    grafts: 0,
    ...over,
  });
  const seats = [
    seat(3, 'torv', 3),
    seat(5, 'fenn', 9, { dead: true }),
    seat(7, 'fenn', 4),
    seat(9, 'vesk', 8, { out: true }),
  ];

  it('is a bot playing the champion picked, standing first', () => {
    expect(chooseBotSeat(seats, 'fenn')).toBe(7);
    expect(chooseBotSeat(seats, 'fenn', true)).toBe(7);
  });

  it('else a standing bot, the lowest unit id first', () => {
    expect(chooseBotSeat(seats, 'sylra')).toBe(3);
  });

  it('never a seat out for good', () => {
    expect(chooseBotSeat(seats, 'vesk')).toBe(3);
    expect(chooseBotSeat([seats[3]!], 'vesk')).toBeNull();
    expect(chooseBotSeat([seats[3]!], 'vesk', true)).toBeNull();
  });

  // Respawn's choice (RoyaleMatch.takeBotSeat): the strongest standing seat
  // of the champion picked, so a person arrives already fed.
  const fenns = [
    seat(2, 'fenn', 3),
    seat(4, 'fenn', 9, { build: 2600, grafts: 2 }),
    seat(6, 'fenn', 9, { build: 3400, grafts: 1 }),
    seat(8, 'fenn', 6, { build: 5000, grafts: 4 }),
    seat(10, 'fenn', 9, { build: 3400, grafts: 3 }),
    seat(12, 'fenn', 13, { dead: true, build: 9000 }),
    seat(14, 'torv', 14, { build: 9000, grafts: 5 }),
    seat(16, 'fenn', 15, { out: true, build: 9000 }),
  ];

  it('takes the strongest standing seat of the champion picked in Respawn', () => {
    // Level 9 three times: the build worth more, then more Grafts.
    expect(chooseBotSeat(fenns, 'fenn', true)).toBe(10);
    expect(
      chooseBotSeat(
        fenns.filter((s) => s.unitId !== 10),
        'fenn',
        true,
      ),
    ).toBe(6);
    // Two seats alike: the lowest unit id.
    const twins = [seat(20, 'fenn', 7, { build: 1200 }), seat(18, 'fenn', 7, { build: 1200 })];
    expect(chooseBotSeat(twins, 'fenn', true)).toBe(18);
    // A higher level beats a richer build.
    expect(chooseBotSeat([fenns[3]!, fenns[1]!], 'fenn', true)).toBe(4);
  });

  it('keeps the champion picked and standing before strength, and never one out', () => {
    // The torv at level 14 loses to any standing fenn, the fenn down at 13
    // to the standing ones, the fenn out at 15 to all.
    expect(chooseBotSeat(fenns, 'fenn', true)).not.toBe(14);
    expect(chooseBotSeat(fenns, 'fenn', true)).not.toBe(12);
    expect(chooseBotSeat(fenns.slice(5), 'fenn', true)).toBe(12);
    // Another champion: the strongest standing seat of any.
    expect(chooseBotSeat(fenns, 'vesk', true)).toBe(14);
    expect(chooseBotSeat(fenns.slice(0, 5), 'vesk', true)).toBe(10);
  });

  it('keeps the lowest unit id when strength is not asked (One life)', () => {
    expect(chooseBotSeat(fenns, 'fenn')).toBe(2);
    expect(chooseBotSeat(fenns, 'vesk')).toBe(2);
    expect(chooseBotSeat(seats, 'fenn')).toBe(7);
  });
});
