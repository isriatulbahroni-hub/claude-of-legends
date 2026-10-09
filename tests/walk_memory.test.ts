// The walk the server's champion is on where the snapshots do not carry
// the path (src/net/walk_memory.ts): the remembered path worn down as the
// champion passes its waypoints, searched again from where it stands once
// it walks off it, and an attack-move going on after the chase that broke
// it off, as the sim's does.

import { describe, expect, it } from 'vitest';
import { LEG_TOLERANCE_M, WalkMemory } from '../src/net/walk_memory';
import { ARRIVE_RADIUS } from '../src/sim/attack_move';
import type { Vec2 } from '../src/sim/types';

// A plane whose path search goes straight to the goal and counts its asks.
function ground() {
  const asks: { from: Vec2; to: Vec2 }[] = [];
  return {
    asks,
    findPath(from: Vec2, to: Vec2): Vec2[] {
      asks.push({ from, to });
      return [{ x: to.x, z: to.z }];
    },
  };
}

const P = (x: number, z: number): Vec2 => ({ x, z });

describe('the remembered walk', () => {
  it('drops the legs the champion has passed and keeps the rest', () => {
    const g = ground();
    const m = new WalkMemory(g);
    m.set(P(0, 0), [P(10, 0), P(10, 10), P(0, 10)]);
    expect(m.pathFrom(P(4, 0.2))).toEqual([P(10, 0), P(10, 10), P(0, 10)]);
    expect(m.pathFrom(P(10.3, 6))).toEqual([P(10, 10), P(0, 10)]);
    // A waypoint the champion stands on is still ahead of it.
    expect(m.pathFrom(P(10, 10))).toEqual([P(10, 10), P(0, 10)]);
    expect(m.pathFrom(P(2, 10))).toEqual([P(0, 10)]);
    // Passed legs stay passed: a point near the first one does not bring
    // it back.
    expect(m.pathFrom(P(5, 10))).toEqual([P(0, 10)]);
    expect(g.asks).toEqual([]);
    expect(m.end).toEqual(P(0, 10));
  });

  it('searches again from where the champion stands once it walks off the path', () => {
    const g = ground();
    const m = new WalkMemory(g);
    m.set(P(0, 0), [P(10, 0), P(10, 10)]);
    const off = P(5, LEG_TOLERANCE_M + 0.5);
    expect(m.pathFrom(off)).toEqual([P(10, 10)]);
    expect(g.asks).toEqual([{ from: off, to: P(10, 10) }]);
    // The new path starts where it stood.
    expect(m.pathFrom(P(7, 3.5))).toEqual([P(10, 10)]);
    expect(g.asks).toHaveLength(1);
  });

  it('remembers nothing once cleared, or before any walk', () => {
    const m = new WalkMemory(ground());
    expect(m.walking).toBe(false);
    expect(m.pathFrom(P(1, 1))).toEqual([]);
    m.set(P(0, 0), [P(5, 0)], 7);
    expect(m.walking).toBe(true);
    expect(m.chaseId).toBe(7);
    m.clear();
    expect(m.walking).toBe(false);
    expect(m.chaseId).toBeNull();
    expect(m.pathFrom(P(1, 0))).toEqual([]);
  });

  it('walks on what is left of a chase that ended, as the sim does', () => {
    const g = ground();
    const m = new WalkMemory(g);
    // Out of range when the chased unit hid: the walk goes on to where it
    // stood when the path was searched.
    m.set(P(0, 0), [P(5, 0)], 9);
    m.endChase(P(2, 0));
    expect(m.chaseId).toBeNull();
    expect(m.pathFrom(P(2, 0))).toEqual([P(5, 0)]);
    // In range when it fell: nothing is left to walk.
    m.set(P(2, 0), [], 9);
    m.endChase(P(2, 0));
    expect(m.walking).toBe(false);
    expect(g.asks).toEqual([]);
  });

  it('goes on toward an attack-move point from the end of the chase that broke it off', () => {
    const g = ground();
    const m = new WalkMemory(g);
    m.set(P(0, 0), [P(3, 0)], 9, P(20, 0));
    m.endChase(P(1, 0));
    expect(m.chaseId).toBeNull();
    expect(m.attackMovePoint).toEqual(P(20, 0));
    expect(m.pathFrom(P(1, 0))).toEqual([P(3, 0), P(20, 0)]);
    expect(g.asks).toEqual([{ from: P(3, 0), to: P(20, 0) }]);
    // Nothing left of the chase: on from where it stands.
    m.set(P(4, 0), [], 9, P(20, 0));
    m.endChase(P(4, 0));
    expect(m.pathFrom(P(4, 0))).toEqual([P(20, 0)]);
    // A chase that leaves it within its arrival radius ends the
    // attack-move there, as the sim's.
    m.set(P(0, 0), [P(20 - ARRIVE_RADIUS + 0.1, 0)], 9, P(20, 0));
    m.endChase(P(1, 0));
    expect(m.attackMovePoint).toBeNull();
    expect(m.pathFrom(P(1, 0))).toEqual([P(20 - ARRIVE_RADIUS + 0.1, 0)]);
    m.set(P(20, 0), [], 9, P(20, 0));
    m.endChase(P(20, 0));
    expect(m.walking).toBe(false);
  });
});
