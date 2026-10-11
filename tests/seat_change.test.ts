// A seat changing hands while the match plays (server/seat_change.ts):
// everyone else in the match hears of it, spectators included, by the name
// and the team only; the person it is about does not, and nobody does
// once the match is decided.

import { describe, expect, it } from 'vitest';
import { seatChangeMsg, seatChangeSends } from '../server/seat_change';

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
