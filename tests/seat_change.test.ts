// A seat changing hands while the match plays (server/seat_change.ts):
// everyone else in the match hears of it, spectators included, by the name
// and the team only; the person it is about does not, and nobody does
// once the match is decided.

import { describe, expect, it } from 'vitest';
import { fillWithBots } from '../server/bot_fill';
import { Match, type MatchPick } from '../server/match';
import { matchSeatSends, seatChangeMsg, seatChangeSends } from '../server/seat_change';
import type { ServerMsg } from '../src/net/protocol';

describe('the seat change on the wire', () => {
  it('names the seat and its team, nothing more', () => {
    expect(seatChangeMsg('joined', { name: 'Wanderer 3433', team: 1 })).toEqual({
      t: 'player_joined',
      name: 'Wanderer 3433',
      team: 1,
    });
    expect(seatChangeMsg('back', { name: 'Thornwick', team: 0 })).toEqual({
      t: 'player_back',
      name: 'Thornwick',
      team: 0,
    });
    expect(seatChangeMsg('left', { name: 'Thornwick', team: 0 })).toEqual({
      t: 'player_left',
      name: 'Thornwick',
      team: 0,
    });
    // A coach's seat: its own bot plays on, said by one additive flag.
    expect(seatChangeMsg('left', { name: 'Thornwick', team: 0, ownBot: true })).toEqual({
      t: 'player_left',
      name: 'Thornwick',
      team: 0,
      own: 1,
    });
  });

  it('keeps whatever else the caller holds of the seat off the wire', () => {
    const held = { name: 'Thornwick', team: 3, unitId: 41, owner: -9001, clientId: 7 };
    const msg = seatChangeMsg('left', held);
    expect(Object.keys(msg).sort()).toEqual(['name', 't', 'team']);
    expect(JSON.stringify(msg)).not.toMatch(/41|9001|"7"|unitId|owner|clientId/);
  });
});

describe('who hears of it', () => {
  it('tells everyone in the match but the person it is about, players and spectators', () => {
    const players = [1, 2, 3];
    const spectators = [8, 9];
    const sends = seatChangeSends(
      'joined',
      { name: 'bob', team: 0 },
      [...players, ...spectators],
      2,
      true,
    );
    expect(sends.map((s) => s.to)).toEqual([1, 3, 8, 9]);
    for (const s of sends) expect(s.msg).toEqual({ t: 'player_joined', name: 'bob', team: 0 });
  });

  it('tells each connection once', () => {
    const sends = seatChangeSends('left', { name: 'bob', team: 0 }, [1, 1, 3], null, true);
    expect(sends.map((s) => s.to)).toEqual([1, 3]);
  });

  it('tells nobody once the match is decided, or when nobody else is in it', () => {
    expect(seatChangeSends('left', { name: 'bob', team: 0 }, [1, 3], 2, false)).toEqual([]);
    expect(seatChangeSends('joined', { name: 'bob', team: 0 }, [2], 2, true)).toEqual([]);
  });
});

describe('a 5v5 seat changing hands (the public queue, a dropped connection)', () => {
  const ALICE: MatchPick = {
    clientId: 1,
    name: 'alice',
    team: 0,
    championId: 'vesk',
    sigils: ['riftstep', 'mend'],
  };
  const SPECTATOR = 50;
  const lineTo = (sends: { to: number; msg: ServerMsg }[], to: number) =>
    sends.filter((s) => s.to === to && s.msg.t !== 'score').map((s) => s.msg);
  const scoreTo = (sends: { to: number; msg: ServerMsg }[], to: number) => {
    const s = sends.find((x) => x.to === to && x.msg.t === 'score');
    return s?.msg.t === 'score' ? s.msg : undefined;
  };

  it('tells the players and the spectators, not the joiner, and the scoreboard follows', () => {
    const match = new Match(7, fillWithBots([ALICE], 7, 5));
    match.addSpectator(SPECTATOR, 1);
    for (let i = 0; i < 20; i++) match.tick();
    const seat = match.takeBotSeat(2, 'Wanderer 0042')!;
    const sends = matchSeatSends(match, 'joined', { name: 'Wanderer 0042', team: seat.team }, 2);
    const joined = { t: 'player_joined', name: 'Wanderer 0042', team: seat.team };
    expect(lineTo(sends, 1)).toEqual([joined]);
    expect(lineTo(sends, SPECTATOR)).toEqual([joined]);
    expect(lineTo(sends, 2)).toEqual([]);
    // Everyone's scoreboard names the seat for its person at once, the
    // joiner's too.
    for (const to of [1, 2, SPECTATOR]) {
      const row = scoreTo(sends, to)?.rows.find((r) => r.unitId === seat.unitId);
      expect(row?.player).toBe('Wanderer 0042');
    }
  });

  it('tells them when the person leaves, the seat marked a bot again', () => {
    const match = new Match(7, fillWithBots([ALICE], 7, 5));
    match.addSpectator(SPECTATOR, 0);
    const seat = match.takeBotSeat(2, 'bob')!;
    const left = match.handleDisconnect(2)!;
    const sends = matchSeatSends(match, 'left', left, 2);
    const msg = { t: 'player_left', name: 'bob', team: seat.team };
    expect(lineTo(sends, 1)).toEqual([msg]);
    expect(lineTo(sends, SPECTATOR)).toEqual([msg]);
    expect(sends.filter((s) => s.to === 2)).toEqual([]);
    const row = scoreTo(sends, 1)?.rows.find((r) => r.unitId === seat.unitId);
    expect(row?.player).toBe('bob (bot)');
    // Back from a dropped connection on a new socket: told to the others.
    match.restorePlayer(3, left);
    const back = matchSeatSends(match, 'back', left, 3);
    expect(lineTo(back, 1)).toEqual([{ t: 'player_back', name: 'bob', team: seat.team }]);
    expect(lineTo(back, 3)).toEqual([]);
    // A coach leaving: their own bot was playing the seat and plays on.
    const coach = matchSeatSends(match, 'left', { name: 'cora', team: 0, coach: true }, 9);
    expect(lineTo(coach, 1)).toEqual([{ t: 'player_left', name: 'cora', team: 0, own: 1 }]);
  });

  it('tells nobody once the match is decided', () => {
    const match = new Match(7, fillWithBots([ALICE], 7, 5));
    match.takeBotSeat(2, 'bob');
    (match.sim as { winner: number | null }).winner = 0;
    const left = match.handleDisconnect(2)!;
    expect(matchSeatSends(match, 'left', left, 2)).toEqual([]);
  });
});
