// The walk the server's champion is on, as the client can tell it where
// the snapshots do not carry the path (the planet's, ADR 0029): the path
// the client searched for the last walk order the server answered, worn
// down as the server's champion passes its waypoints, searched again from
// where it stands when it walks off it. What the prediction walks the
// newest state forward along (src/net/self_predict.ts).
//
// Display only, like the prediction: the server decides, and a walk the
// server ended for a reason this memory cannot see is let go by the
// predictor, which reads the snapshots for it.

import { ARRIVE_RADIUS } from '../sim/attack_move';
import { copy, dist, segmentDist } from '../sim/geo';
import type { Ground } from '../sim/ground';
import type { Vec2 } from '../sim/types';

// How far the server's champion may stand from the remembered path and
// still be on it: a start that differed by a step, a push between bodies.
// Past it the server walks a way of its own, and the path is searched
// again from where it stands.
export const LEG_TOLERANCE_M = 1;

export class WalkMemory {
  // Where the leg being walked began, and the waypoints still ahead.
  private from: Vec2 | null = null;
  private path: Vec2[] = [];
  // The unit a chase is on, null for a walk to a point.
  private chasing: number | null = null;
  // An attack-move's point: the walk goes on toward it after a fight.
  private attackMove: Vec2 | null = null;

  constructor(private readonly ground: Pick<Ground, 'findPath'>) {}

  // A walk the server took up: the path from `from`, a chase's unit, an
  // attack-move's point.
  set(
    from: Vec2,
    path: readonly Vec2[],
    chase: number | null = null,
    attackMove: Vec2 | null = null,
  ): void {
    this.from = copy(from);
    this.path = path.map(copy);
    this.chasing = chase;
    this.attackMove = attackMove ? copy(attackMove) : null;
  }

  // The walk ended: arrived, stopped, or dropped by the server.
  clear(): void {
    this.from = null;
    this.path = [];
    this.chasing = null;
    this.attackMove = null;
  }

  // The chase's unit, null for none.
  get chaseId(): number | null {
    return this.chasing;
  }

  // The attack-move's point, null for none.
  get attackMovePoint(): Vec2 | null {
    return this.attackMove;
  }

  // Where the walk ends, null when there is none.
  get end(): Vec2 | null {
    return this.path[this.path.length - 1] ?? null;
  }

  get walking(): boolean {
    return this.path.length > 0;
  }

  // A chase that ended (the chased unit fell, hid or went out of reach):
  // the sim walks on what is left of the chase's path, to where the unit
  // stood when the path was last searched (src/sim/combat/auto_attack.ts),
  // and from its end an attack-move it broke off goes on toward its point
  // unless it is there already (src/sim/attack_move.ts).
  endChase(pos: Vec2): void {
    this.chasing = null;
    const goal = this.attackMove;
    const end = this.end ?? pos;
    if (goal && dist(end, goal) > ARRIVE_RADIUS) {
      const on = this.ground.findPath(end, goal);
      if (this.path.length === 0) this.set(pos, on, null, goal);
      else this.path.push(...on.map(copy));
      return;
    }
    this.attackMove = null;
    if (this.path.length === 0) this.clear();
  }

  // The path still to walk from `pos`, where the server's champion stands:
  // the waypoints past the leg it stands on, the legs behind it dropped.
  // Off every leg, the way is searched again from there to the same end.
  pathFrom(pos: Vec2): Vec2[] {
    const from = this.from;
    const goal = this.end;
    if (!from || !goal) return [];
    let leg = -1;
    let best = LEG_TOLERANCE_M;
    let a = from;
    for (let i = 0; i < this.path.length; i++) {
      const b = this.path[i]!;
      const d = segmentDist(pos, a, b).d;
      // The nearest leg; on a tie the earlier, so a waypoint the champion
      // stands on is still ahead of it.
      if (d < best || (leg < 0 && d === best)) {
        best = d;
        leg = i;
      }
      a = b;
    }
    if (leg < 0) {
      this.from = copy(pos);
      this.path = dist(pos, goal) > 0 ? this.ground.findPath(pos, goal).map(copy) : [];
      return this.path.map(copy);
    }
    if (leg > 0) {
      this.from = this.path[leg - 1]!;
      this.path = this.path.slice(leg);
    }
    return this.path.map(copy);
  }
}
