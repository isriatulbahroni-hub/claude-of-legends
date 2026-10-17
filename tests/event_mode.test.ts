// Event mode (MOBA_NO_BOTS=1, server/bot_fill.ts): no bot backfill, so the
// opponent is always a person; a match of two people is a duel, which the
// Match already plays (tests/seat_report.test.ts).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fillWithBots, noBotsMode } from '../server/bot_fill';
import { Match, type MatchPick } from '../server/match';

const picks: MatchPick[] = [
  { clientId: 1, name: 'alice', team: 0, championId: 'korrath', sigils: ['riftstep', 'mend'] },
  { clientId: 2, name: 'bob', team: 1, championId: 'fenn', sigils: ['zephyr', 'sear'] },
];

afterEach(() => vi.unstubAllEnvs());

describe('event mode', () => {
  it('is on only when MOBA_NO_BOTS is exactly 1', () => {
    expect(noBotsMode({ MOBA_NO_BOTS: '1' })).toBe(true);
    expect(noBotsMode({ MOBA_NO_BOTS: '0' })).toBe(false);
    expect(noBotsMode({ MOBA_NO_BOTS: 'true' })).toBe(false);
    expect(noBotsMode({})).toBe(false);
  });

  it('off: the fill completes the rosters as before', () => {
    expect(fillWithBots(picks, 7).length).toBeGreaterThan(picks.length);
  });

  it('on: only the seated people play, nobody is backfilled', () => {
    vi.stubEnv('MOBA_NO_BOTS', '1');
    const seated = fillWithBots(picks, 7);
    expect(seated).toHaveLength(2);
    expect(seated.every((p) => p.clientId > 0)).toBe(true);
  });

  it('a match of the seated people alone is built, both seated', () => {
    const match = new Match(9, picks);
    expect(match.players.size).toBe(2);
  });
});
