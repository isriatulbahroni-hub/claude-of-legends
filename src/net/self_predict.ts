// The own champion drawn where it is going (ADR 0028). Online, an order
// reaches the server half a round trip after the click and its effect
// comes back half a trip later, so the champion used to answer a click a
// round trip late: a third of a second on a far connection. The client keeps the orders it sent and draws its champion
// as the server will have it once they land: every frame it re-walks the
// newest state the server told for the time an order sent now would land
// at, the orders still on their way applied when each lands, with the
// path search and the walking step the sim itself runs over the ground the
// match stands on (src/sim/ground.ts, src/sim/movement.ts): the Star
// Orchard's grid, or the planet's sphere (ADR 0029), whose snapshots do
// not carry the path, so there the walk the server answered is remembered
// (src/net/walk_memory.ts).
//
// Display only. The server decides everything, the mirror world keeps
// the server's position for every rule that reads one, and what the
// prediction got wrong (a push between bodies, a stun it could not know)
// is eased out on screen rather than jumped, unless the server moved the
// champion farther than any walk could (a recall home, a blink).
//
// The clock is handed in, so a test drives it frame by frame.

import { REPATH_DISTANCE } from '../sim/combat/auto_attack';
import { copy, dist, norm, scale, settle, sub } from '../sim/geo';
import type { Ground } from '../sim/ground';
import { stepMovement } from '../sim/movement';
import { DT, type Vec2 } from '../sim/types';
import { blockWall, clampThroughWalls, unblockWall } from '../sim/walls';
import { WalkMemory } from './walk_memory';

// What the newest snapshot says of the own champion's walk.
export interface SelfState {
  // The snapshot's match time, seconds.
  time: number;
  pos: Vec2;
  // The path it still has to walk; null where the snapshot does not tell
  // it (the planet's), and the walk the server answered is remembered.
  path: readonly Vec2[] | null;
  // Its speed once nothing holds it in place (SelfSnap ms).
  speed: number;
  // The match time until which it cannot walk: a root or a stun, or a
  // cast's windup, which plants the caster.
  stillUntil: number;
  // The unit it is set on attacking: it walks into range and stops there.
  chaseId: number | null;
  range: number;
  radius: number;
  // Nothing to predict: dead, carried by a dash, the match over, or a
  // server that does not tell the walk. The server's position is drawn.
  off: boolean;
  // The number of the last order the server applied, and the match time
  // it applied it (SelfSnap ack, ackAt).
  ack: number;
  ackAt: number;
  // Where the path is not told: when the windup the champion is held in
  // resolves, and when the airborne it is thrown in ends (0 for none). A
  // new one is the sim dropping the walk: a cast planting the caster, a
  // knock-up, a blast.
  windupEnds?: number;
  airborneEnds?: number;
}

// Where an attacked unit stands, as the mirror world has it.
export interface ChaseTarget {
  x: number;
  z: number;
  y?: number;
  radius: number;
}

// The champion as it is drawn this frame, and the way it walks; heading
// is null while it stands. On the planet the point carries y.
export interface DrawnSelf {
  x: number;
  z: number;
  y?: number;
  heading: Vec2 | null;
}

// What the prediction walks on: the ground's path search, line of walk,
// and the cells a wall blocks.
export type WalkGround = Pick<
  Ground,
  'findPath' | 'lineOfWalk' | 'isWalkableAt' | 'blockCircle' | 'unblockCircle'
>;

// A wall a snapshot tells: its id and its two ends (src/sim/walls.ts).
export interface StandingWall {
  id: number;
  a: Vec2;
  b: Vec2;
}

// What an order does to the walk, as the sim would do it. A walk and a
// chase keep where their path was searched from, which the memory starts
// the walk at once the server answers.
export type WalkEffect =
  | { kind: 'walk'; from: Vec2 | null; path: Vec2[]; attackMove?: Vec2 }
  | { kind: 'chase'; from: Vec2 | null; targetId: number; path: Vec2[] }
  | { kind: 'stop' }
  // A cast whose windup plants the caster (src/sim/combat/casting.ts): its
  // path is dropped and it stands until the windup resolves.
  | { kind: 'windup'; seconds: number };

interface Pending {
  seq: number;
  sentAt: number;
  effect: WalkEffect | null;
  // A cast: what it did to the walk the snapshot that answers it tells.
  cast: boolean;
}

interface Walker {
  pos: Vec2;
  path: Vec2[];
  chaseId: number | null;
  stillUntil: number;
  heading: Vec2 | null;
  // Thrown by a launch pad: it stands where the throw takes it up, and
  // the orders that land while it flies are refused.
  thrown: boolean;
}

// How the ground's sim walks, beyond the path search.
export interface WalkRules {
  // A step that would cross what cannot be walked stops the walk: the
  // Star Orchard's strict navigation. The planet's sim walks its paths as
  // they are.
  strict?: boolean;
  // Whether a launch pad throws a champion standing at `pos` whose walk
  // ends at `dest` (null when it stands): the planet's pads
  // (src/sim/royale/pads.ts padUnder), checked after each step as the
  // mode does.
  throws?: (pos: Vec2, dest: Vec2 | null) => boolean;
}

// Before the first order is answered, the round trip a land is assumed
// at: about the server's distance from most of Europe, doubled.
export const RTT_GUESS_MS = 120;
// How much of a new measurement of when orders land moves the estimate.
export const LAND_BLEND = 0.25;
// The furthest ahead of the newest state the champion is drawn. A stall
// in the connection keeps the server walking, so the walk goes on, but
// not forever.
export const LEAD_MAX_S = 2;
// How fast a correction is eased out: about two thirds of it in this
// many milliseconds.
export const EASE_MS = 120;
// A move the server made (a recall home, a blink), or taking over from the
// server's position (a respawn, a dash landed), farther than this from the
// walk is shown as the jump it is.
export const SNAP_M = 4;
// The most a correction is eased over: past it (a connection that stalled
// for seconds) the champion is shown where the walk now has it.
export const EASE_MAX_M = 12;
// Orders kept while their answers are awaited; the oldest go first.
export const PENDING_MAX = 64;
// A move between two snapshots longer than the walk could make by this
// much is the server putting the champion down elsewhere (a blink, a
// knockback, a recall home): past SNAP_M shown as the jump it is, and on
// the planet, where the path is not told, the end of the walk the sim
// dropped.
export const JUMP_M = 1;
// Where the path is not told: a walk that covered under this share of
// what it should have between two snapshots ended on the server, for a
// reason the snapshot does not say (a walk stopped short, a crowd).
export const STALL_SHARE = 0.25;
// The least walk a stall is read from, meters.
export const STALL_MIN_M = 0.05;

const NO_EASE: Vec2 = { x: 0, z: 0 };

// Whether the server put its champion down between two snapshots farther
// than its walk could take it (JUMP_M).
function putDown(prev: SelfState | null, next: SelfState): boolean {
  if (!prev || prev.off || next.off) return false;
  const span = next.time - prev.time;
  return dist(prev.pos, next.pos) > Math.max(prev.speed, next.speed) * span + JUMP_M;
}

// a + b, the sphere's third axis kept when either has it.
function plus(a: Vec2, b: Vec2): Vec2 {
  if (a.y === undefined && b.y === undefined) return { x: a.x + b.x, z: a.z + b.z };
  return { x: a.x + b.x, y: (a.y ?? 0) + (b.y ?? 0), z: a.z + b.z };
}

export class SelfPredictor {
  private seq = 0;
  private pending: Pending[] = [];
  private state: SelfState | null = null;
  // When an order lands, in match milliseconds less the client clock at
  // its sending: measured from the answers, guessed before the first.
  private landMs: number | null = null;
  private guessMs = 0;
  private lastAck = 0;
  private ease: Vec2 = NO_EASE;
  private easedAt = 0;
  private drawing = false;
  private readonly memory: WalkMemory;
  // The walls standing on the ground walked, by id, with the points each
  // blocked (standWalls).
  private readonly walls = new Map<number, readonly Vec2[]>();

  constructor(
    private readonly ground: WalkGround,
    private readonly targetOf: (id: number) => ChaseTarget | null,
    private readonly rules: WalkRules = { strict: true },
  ) {
    this.memory = new WalkMemory(ground);
  }

  // When an order sent now lands, as match milliseconds less the client
  // clock: measured once answered. Before the first answer it is guessed,
  // and every snapshot that has not answered the oldest order yet says it
  // lands later than that snapshot, so a far connection walks from the
  // click at its pace rather than catching up once the answer comes.
  private landEstimate(): number {
    if (this.landMs !== null) return this.landMs;
    const oldest = this.pending[0];
    const s = this.state;
    return oldest && s ? Math.max(this.guessMs, s.time * 1000 - oldest.sentAt) : this.guessMs;
  }

  // The match time an order sent at `now` lands at.
  landsAt(now: number): number {
    return (now + this.landEstimate()) / 1000;
  }

  // The orders, each answering the number it goes up the wire with. The
  // path is searched from where the champion is drawn walking, as the
  // server will search it from where its champion stands when the order
  // lands. An attack-move is walked as a move, its point kept.
  move(to: Vec2, now: number, attackMove = false): number {
    const from = this.raw(now)?.pos ?? this.state?.pos ?? null;
    const path = from ? this.ground.findPath(from, to) : [];
    return this.note(
      attackMove
        ? { kind: 'walk', from, path, attackMove: copy(to) }
        : { kind: 'walk', from, path },
      now,
    );
  }

  // An attack on a unit the mirror cannot see to attack changes nothing of
  // the walk: the server drops it, and the champion walks on.
  chase(targetId: number, now: number): number {
    const from = this.raw(now)?.pos ?? this.state?.pos ?? null;
    const target = this.targetOf(targetId);
    if (!target) return this.note(null, now);
    const path = from ? this.ground.findPath(from, target) : [];
    return this.note({ kind: 'chase', targetId, from, path }, now);
  }

  stop(now: number): number {
    return this.note({ kind: 'stop' }, now);
  }

  // A cast: `windup` when it will plant the caster, null when it changes
  // nothing of the walk (it still carries a number, so the answer tells
  // when orders land).
  cast(windup: number | null, now: number): number {
    return this.note(
      windup !== null && windup > 0 ? { kind: 'windup', seconds: windup } : null,
      now,
      true,
    );
  }

  private note(effect: WalkEffect | null, now: number, cast = false): number {
    this.seq += 1;
    this.pending.push({ seq: this.seq, sentAt: now, effect, cast });
    if (this.pending.length > PENDING_MAX) this.pending.shift();
    return this.seq;
  }

  // Where the walk stands at `now` while the champion is drawn, before a
  // snapshot changes anything: the mirror world takes it before it moves
  // the units, since a chased unit's new position moves the walk too.
  walkedAt(now: number): Vec2 | null {
    return this.drawing ? (this.raw(now)?.pos ?? null) : null;
  }

  // The walls the newest snapshot tells: their ground blocked as the sim
  // blocks it (src/sim/walls.ts), so a way searched here goes round one as
  // the server's search does, and a walk runs into one where the sim's
  // stops; a wall gone frees its ground.
  standWalls(walls: Iterable<StandingWall>): void {
    const seen = new Set<number>();
    for (const w of walls) {
      seen.add(w.id);
      if (!this.walls.has(w.id)) this.walls.set(w.id, blockWall(this.ground, w.a, w.b));
    }
    for (const [id, samples] of this.walls) {
      if (seen.has(id)) continue;
      unblockWall(this.ground, samples);
      this.walls.delete(id);
    }
  }

  // A snapshot arrived. The drawn champion does not jump with it: what
  // the new state moves of the walk, from where it stood `before`, is
  // taken into the ease and worked out over the next frames.
  observe(state: SelfState, now: number, before: Vec2 | null = this.walkedAt(now)): void {
    const prev = this.state;
    if (state.ack > this.lastAck) {
      const answered = this.pending.find((p) => p.seq === state.ack);
      if (answered) {
        const sample = state.ackAt * 1000 - answered.sentAt;
        this.landMs =
          this.landMs === null ? sample : this.landMs + (sample - this.landMs) * LAND_BLEND;
      }
      this.lastAck = state.ack;
    } else if (state.ack < this.lastAck) {
      // The seat's record started over (a seat taken back): what the old
      // record never answered will not be answered now.
      this.pending = [];
      this.lastAck = state.ack;
      this.memory.clear();
    }
    const answered = this.pending.filter((p) => p.seq <= state.ack);
    this.pending = this.pending.filter((p) => p.seq > state.ack);
    this.state =
      state.path !== null ? state : { ...state, path: this.remembered(prev, state, answered) };
    // The snapshot left the server half a trip ago and an order sent now
    // arrives half a trip on.
    this.guessMs = state.time * 1000 - now + RTT_GUESS_MS;
    const after = this.raw(now);
    if (before && after) {
      // A long move the server made (a blink, a recall home) shows as the
      // jump it is, a short one (a knockback) slides; whatever else the
      // walk got wrong (an order the server dropped, a turn it could not
      // know) slides out too, however far a long trip let it run.
      this.ease = plus(this.ease, sub(before, after.pos));
      if (norm(this.ease) > (putDown(prev, state) ? SNAP_M : EASE_MAX_M)) this.ease = NO_EASE;
    }
  }

  // The path the server's champion still walks where the snapshot does
  // not tell it: the remembered walk brought up to this snapshot. What
  // the server answered takes a walk up or ends it; what the sim does to
  // a walk on its own, the snapshots show and the memory follows: a cast
  // that planted or moved the champion, a throw into the air, a fall or a
  // flight it comes back from, a walk that stopped short, a chase.
  private remembered(
    prev: SelfState | null,
    next: SelfState,
    answered: readonly Pending[],
  ): Vec2[] {
    const m = this.memory;
    if (next.off) {
      m.clear();
      return [];
    }
    const live = prev !== null && !prev.off ? prev : null;
    const span = live ? next.time - live.time : 0;
    const moved = live ? dist(live.pos, next.pos) : 0;
    // Put down farther than a walk could take it (a blink, a push), or
    // planted by a windup: the sim drops the path at the cast that did
    // it, the last one answered here, else at whatever did.
    const jumped = putDown(prev, next);
    const planted = (next.windupEnds ?? 0) > (prev?.windupEnds ?? 0);
    let dropAt = -1;
    if (jumped || planted) {
      for (let i = answered.length - 1; i >= 0 && dropAt < 0; i--) {
        if (answered[i]!.cast) dropAt = i;
      }
    }
    // An attack the snapshot does not show the champion on did not take
    // (the sim sets the target and leaves the path, and drops a target it
    // cannot strike): the walk before it goes on.
    const took = (e: WalkEffect | null): boolean =>
      e?.kind !== 'chase' || e.targetId === next.chaseId;
    answered.forEach((p, i) => {
      if (i === dropAt) m.clear();
      else if (took(p.effect)) remember(m, p.effect);
    });
    if ((jumped || planted) && dropAt < 0) m.clear();
    // Thrown into the air (a knock-up, a blast): the sim drops the path.
    if ((next.airborneEnds ?? 0) > (prev?.airborneEnds ?? 0)) m.clear();
    if (!live) {
      // Back from where orders are refused or a walk does not last (dead,
      // a dash's landing, a pad's flight, the drop): what was answered
      // meanwhile did not take.
      m.clear();
    } else if (
      answered.length === 0 &&
      m.walking &&
      live.chaseId === null &&
      next.chaseId === null &&
      Math.max(live.stillUntil, next.stillUntil) <= live.time
    ) {
      const expected = Math.min(live.speed, next.speed) * span;
      if (expected >= STALL_MIN_M && moved < expected * STALL_SHARE) m.clear();
    }
    this.rememberChase(next);
    return m.pathFrom(next.pos);
  }

  // A chase the server is on: searched again whenever the chased unit
  // stands REPATH_DISTANCE from where the path ends, as the sim does
  // (src/sim/combat/auto_attack.ts), and nothing to walk while in range.
  // A chase that ended walks on what is left of its path, and an
  // attack-move it broke off goes on from there.
  private rememberChase(next: SelfState): void {
    const m = this.memory;
    if (next.chaseId === null) {
      if (m.chaseId !== null) m.endChase(next.pos);
      return;
    }
    const target = this.targetOf(next.chaseId);
    if (!target) return;
    const goal = m.attackMovePoint;
    if (dist(target, next.pos) - next.radius - target.radius <= next.range) {
      if (m.chaseId !== next.chaseId || m.walking) m.set(next.pos, [], next.chaseId, goal);
      return;
    }
    const end = m.end;
    if (m.chaseId !== next.chaseId || !end || dist(end, target) > REPATH_DISTANCE) {
      m.set(next.pos, this.ground.findPath(next.pos, target), next.chaseId, goal);
    }
  }

  // Where to draw the champion at `now`, or null to draw the server's own
  // position.
  drawnAt(now: number): DrawnSelf | null {
    const raw = this.raw(now);
    const state = this.state;
    if (!raw || !state) {
      this.drawing = false;
      this.ease = NO_EASE;
      return null;
    }
    if (!this.drawing) {
      // Taking over from the server's position (the first snapshot, a
      // respawn, a dash landed): start where it stands and ease ahead.
      this.drawing = true;
      this.easedAt = now;
      this.ease = sub(state.pos, raw.pos);
      if (norm(this.ease) > SNAP_M) this.ease = NO_EASE;
    }
    const k = Math.exp(-Math.max(0, now - this.easedAt) / EASE_MS);
    this.easedAt = now;
    this.ease = scale(this.ease, k);
    const at = plus(raw.pos, this.ease);
    if (raw.pos.y === undefined) return { x: at.x, z: at.z, heading: raw.heading };
    // On the sphere the eased point is put back on it.
    const p = settle(at, norm(raw.pos));
    return { x: p.x, y: p.y, z: p.z, heading: raw.heading };
  }

  // The newest state walked forward to when an order sent now lands, the
  // orders still unanswered applied as each lands.
  private raw(now: number): { pos: Vec2; heading: Vec2 | null } | null {
    const s = this.state;
    if (!s || s.off) return null;
    const land = this.landEstimate();
    const horizon = Math.min(Math.max((now + land) / 1000, s.time), s.time + LEAD_MAX_S);
    const w: Walker = {
      pos: copy(s.pos),
      path: (s.path ?? []).map(copy),
      chaseId: s.chaseId,
      stillUntil: s.stillUntil,
      heading: null,
      thrown: false,
    };
    let t = s.time;
    for (const p of this.pending) {
      const at = Math.max(t, (p.sentAt + land) / 1000);
      if (at > horizon) break;
      this.walk(w, s, t, at);
      t = at;
      if (!w.thrown) applyEffect(w, p.effect, at);
    }
    this.walk(w, s, t, horizon);
    return { pos: w.pos, heading: w.heading };
  }

  // The sim's walk from `from` to `to`, tick-sized steps: nothing while
  // held in place, into range of the attacked unit and no further, along
  // the path otherwise, stopped at the face of a wall a path searched
  // before it rose runs into, and where a step would cross what cannot be
  // walked when the ground's navigation is strict, and where a launch pad
  // throws it.
  private walk(w: Walker, s: SelfState, from: number, to: number): void {
    let t = from;
    while (to - t > 1e-9 && !w.thrown) {
      if (t < w.stillUntil) {
        t = Math.min(to, w.stillUntil);
        w.heading = null;
        continue;
      }
      const dt = Math.min(DT, to - t);
      if (w.chaseId !== null) {
        const target = this.targetOf(w.chaseId);
        if (!target) {
          // Out of the mirror's sight: the sim walks on along the path the
          // chase last searched, and so does the prediction.
          w.chaseId = null;
        } else {
          const edge = dist(target, w.pos) - s.radius - target.radius;
          if (edge <= s.range) {
            // In range: it stands and strikes.
            w.path = [];
            w.heading = null;
            return;
          }
          if (this.ground.lineOfWalk(w.pos, target)) w.path = [copy(target)];
        }
      }
      if (w.path.length === 0) {
        w.heading = null;
        return;
      }
      const before = copy(w.pos);
      stepMovement(w, dt, s.speed);
      if (this.walls.size > 0) clampThroughWalls(this.ground, before, w);
      if (this.rules.strict && !this.ground.lineOfWalk(before, w.pos)) {
        w.pos = before;
        w.path = [];
      }
      const h = sub(w.pos, before);
      w.heading = norm(h) > 0 ? h : null;
      t += dt;
      if (this.rules.throws?.(w.pos, w.path[w.path.length - 1] ?? null)) {
        // The server's champion goes up here, and is drawn as the server
        // tells its flight.
        w.thrown = true;
        w.path = [];
        w.chaseId = null;
        w.heading = null;
      }
    }
  }
}

function applyEffect(w: Walker, effect: WalkEffect | null, at: number): void {
  if (!effect) return;
  switch (effect.kind) {
    case 'walk':
      w.path = effect.path.map(copy);
      w.chaseId = null;
      return;
    case 'chase':
      w.path = effect.path.map(copy);
      w.chaseId = effect.targetId;
      return;
    case 'stop':
      w.path = [];
      w.chaseId = null;
      return;
    case 'windup':
      w.path = [];
      w.stillUntil = Math.max(w.stillUntil, at + effect.seconds);
      return;
  }
}

// What an answered order does to the remembered walk. A cast leaves it
// to the snapshot to say (a windup it shows, a jump), which the caller
// reads.
function remember(m: WalkMemory, effect: WalkEffect | null): void {
  if (!effect) return;
  switch (effect.kind) {
    case 'walk':
      if (effect.from) m.set(effect.from, effect.path, null, effect.attackMove ?? null);
      else m.clear();
      return;
    case 'chase':
      if (effect.from) m.set(effect.from, effect.path, effect.targetId);
      else m.clear();
      return;
    case 'stop':
      m.clear();
      return;
    case 'windup':
      return;
  }
}

// The path a snapshot carries as x, z pairs, back into points.
export function pathOfPairs(pairs: readonly number[] | undefined): Vec2[] {
  const out: Vec2[] = [];
  if (!pairs) return out;
  for (let i = 0; i + 1 < pairs.length; i += 2) out.push({ x: pairs[i]!, z: pairs[i + 1]! });
  return out;
}
