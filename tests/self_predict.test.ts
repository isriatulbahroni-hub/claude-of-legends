// The own champion drawn where it is going (src/net/self_predict.ts, ADR
// 0028), over a real sim served the way the server serves it: the orders
// numbered and answered as server/match.ts does, the snapshots built by
// server/snapshot.ts, and a connection that takes a while each way. The
// champion answers a click on the next frame, never jumps on screen, is
// drawn where the server's champion will be once an order sent now
// lands, and ends where the server's champion ends, whatever the server
// did that the client could not know. On the Star Orchard, served as a
// 5v5 is, it goes round a wall a cast raised across the way, and stops
// where the server stops at one raised across its walk.

import { describe, expect, it } from 'vitest';
import { Match, orderNumber, withoutOrderNumber } from '../server/match';
import { buildSnapshot, type SeatAck } from '../server/snapshot';
import { starOrchard } from '../server/star_orchard';
import { ClientWorld } from '../src/net/client_world';
import type { ClientMsg, ServerMsg } from '../src/net/protocol';
import { applySimCommand } from '../src/net/replay';
import { pathOfPairs } from '../src/net/self_predict';
import type { GameMap } from '../src/sim/content/map';
import { offset } from '../src/sim/geo';
import type { NavGrid } from '../src/sim/navgrid';
import { Sim } from '../src/sim/sim';
import type { CombatCtx } from '../src/sim/sim_context';
import { TerrainNavGrid } from '../src/sim/terrain_nav';
import { DT, type Vec2 } from '../src/sim/types';
import type { Unit } from '../src/sim/unit';
import { raiseWall } from '../src/sim/walls';

const FRAME_MS = 16;
const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

interface Frame {
  at: number;
  drawn: Vec2;
  // Whether the prediction drew it (else the mirror's newest position).
  ahead: boolean;
  // The server's own champion at that moment, which the client never sees.
  server: Vec2;
}

// What the mirror is connected to: a seat's champion, its orders taken as
// server/match.ts handleCommand takes them, and a tick that runs the sim
// and answers with the seat's snapshot.
interface Server {
  sim: Sim;
  champ: Unit;
  command(msg: ClientMsg): void;
  tick(): ServerMsg | null;
}

// A server on one side, a mirror world walking `walk` on the other,
// `oneWayMs` between them. One millisecond at a time: orders land, ticks
// run and send their snapshots, snapshots arrive, frames draw.
function connect(server: Server, map: GameMap, walk: NavGrid, oneWayMs: number) {
  const { sim, champ } = server;
  let now = 0;
  const up: { at: number; msg: ClientMsg }[] = [];
  const down: { at: number; msg: ServerMsg }[] = [];
  const world = new ClientWorld(
    (msg) => up.push({ at: now + oneWayMs, msg }),
    map,
    walk,
    () => now,
  );
  world.applyServer({ t: 'match_start', selfUnitId: champ.id, team: 0 });
  const frames: Frame[] = [];
  // The server's champion at each tick, by the tick's time in ms.
  const ticks = new Map<number, Vec2>();
  // A hand on the server before the next tick: what the sim does that the
  // client cannot know.
  let meddle: (() => void) | null = null;
  let nextTick = 0;
  let nextFrame = 0;
  const run = (ms: number): void => {
    const end = now + ms;
    while (now < end) {
      now += 1;
      while (up.length > 0 && up[0]!.at <= now) server.command(up.shift()!.msg);
      if (now >= nextTick) {
        nextTick += DT * 1000;
        meddle?.();
        meddle = null;
        const snap = server.tick();
        ticks.set(Math.round(sim.time * 1000), { x: champ.pos.x, z: champ.pos.z });
        if (snap) down.push({ at: now + oneWayMs, msg: snap });
      }
      while (down.length > 0 && down[0]!.at <= now) world.applyServer(down.shift()!.msg);
      if (now >= nextFrame) {
        nextFrame += FRAME_MS;
        const mirror = world.units.get(champ.id);
        if (!mirror) continue;
        const ahead = world.predictedPos(champ.id, now);
        frames.push({
          at: now,
          drawn: ahead ? { x: ahead.x, z: ahead.z } : { x: mirror.pos.x, z: mirror.pos.z },
          ahead: ahead !== null,
          server: { x: champ.pos.x, z: champ.pos.z },
        });
      }
    }
  };
  // Where the server's champion stood at match time `ms` (its last tick).
  const serverAt = (ms: number): Vec2 | undefined => {
    const tick = Math.floor(ms / (DT * 1000)) * DT * 1000;
    return ticks.get(Math.round(tick));
  };
  return {
    sim,
    champ,
    world,
    run,
    frames,
    serverAt,
    ticks,
    now: () => now,
    meddle: (fn: () => void) => {
      meddle = fn;
    },
  };
}

// A sim on the launch map, the orders numbered and answered as
// server/match.ts does, the snapshots built by server/snapshot.ts; the
// mirror walks the sim's own grid.
function served(oneWayMs: number, championId = 'sylra') {
  const sim = new Sim(7);
  const champ = sim.addChampion(0, undefined, championId);
  const seat: SeatAck = { ack: 0, ackAt: 0 };
  const known = new Set<number>();
  const command = (msg: ClientMsg): void => {
    const n = orderNumber(msg);
    if (n !== undefined && n > seat.ack) {
      seat.ack = n;
      seat.ackAt = sim.time;
    }
    applySimCommand(sim, 0, champ.id, withoutOrderNumber(msg));
  };
  const tick = (): ServerMsg => buildSnapshot(sim, 0, champ.id, known, sim.tick(), seat);
  return connect({ sim, champ, command, tick }, sim.map, sim.nav, oneWayMs);
}

// A 5v5 on the Star Orchard as server/match.ts serves it, one seat played,
// its champion put at `at` before the first tick. The mirror walks a grid
// of its own over the export, as the browser builds it (src/main.ts), so
// the walls it blocks are its own.
function orchardServed(oneWayMs: number, at: Vec2) {
  const match = new Match(3, [
    { clientId: 1, name: 'human', team: 0, championId: 'sylra', sigils: ['riftstep', 'mend'] },
  ]);
  const champ = match.sim.units.get(match.players.get(1)!.unitId)!;
  champ.pos = { ...at };
  const tick = (): ServerMsg | null => {
    match.tick();
    return match.buildSnapshotFor(1);
  };
  const command = (msg: ClientMsg): void => match.handleCommand(1, msg);
  const orchard = starOrchard();
  const walk = new TerrainNavGrid(orchard.navigation);
  return connect({ sim: match.sim, champ, command, tick }, orchard.map, walk, oneWayMs);
}

type Connected = ReturnType<typeof connect>;

const lastFrame = (frames: Frame[]): Frame => frames[frames.length - 1]!;
const firstAfter = (frames: Frame[], at: number): Frame => frames.find((f) => f.at > at)!;

// The most a frame may move the drawn champion: its walk over the frame,
// and a little for the ease working a correction out.
const frameStep = (speed: number): number => speed * (FRAME_MS / 1000) * 1.5 + 0.03;

describe('the own champion, drawn where it is going', () => {
  it('answers a click on the next frame, a round trip before the server tells', () => {
    const h = served(120);
    h.run(1000);
    const start = { ...h.champ.pos };
    h.world.orderMove(h.champ.id, 50, 50);
    const clickAt = h.now();
    h.run(FRAME_MS * 2);
    expect(dist(firstAfter(h.frames, clickAt).drawn, start)).toBeGreaterThan(0.01);
    // The server's word has not come back yet.
    expect(dist(h.world.units.get(h.champ.id)!.pos, start)).toBe(0);
  });

  it('walks without a jump, a trip ahead of the newest snapshot, and ends where the server ends', () => {
    const h = served(120);
    h.run(1000);
    h.world.orderMove(h.champ.id, 50, 50);
    const clickAt = h.now();
    h.run(30_000);
    const speed = h.champ.moveSpeed;
    let worst = 0;
    for (let i = 1; i < h.frames.length; i++) {
      worst = Math.max(worst, dist(h.frames[i]!.drawn, h.frames[i - 1]!.drawn));
    }
    expect(worst).toBeLessThan(frameStep(speed));
    // Drawn where the server's champion stands once an order sent now
    // lands: half a trip on, within a tick's walk.
    for (const f of h.frames) {
      if (f.at < clickAt + 1000 || f.at > clickAt + 6000) continue;
      const there = h.serverAt(f.at + 120);
      if (there) expect(dist(f.drawn, there)).toBeLessThan(speed * DT * 2 + 0.05);
    }
    const end = lastFrame(h.frames);
    expect(dist(h.champ.pos, { x: 50, z: 50 })).toBeLessThan(0.1);
    expect(dist(end.drawn, end.server)).toBeLessThan(0.01);
  });

  it("walks a far connection's first click at its pace, and catches nothing up once answered", () => {
    // Before the first answer, when an order lands is guessed short of a
    // far trip; every snapshot that has not answered it says it lands
    // later, so the walk keeps its pace from the click.
    const h = served(250);
    h.run(1000);
    h.world.orderMove(h.champ.id, 50, 50);
    const clickAt = h.now();
    h.run(4000);
    const speed = h.champ.moveSpeed;
    let worst = 0;
    for (let i = 1; i < h.frames.length; i++) {
      if (h.frames[i]!.at <= clickAt) continue;
      worst = Math.max(worst, dist(h.frames[i]!.drawn, h.frames[i - 1]!.drawn));
    }
    expect(worst).toBeLessThan(frameStep(speed));
    for (const f of h.frames) {
      if (f.at < clickAt + 1500) continue;
      const there = h.serverAt(f.at + 250);
      if (there) expect(dist(f.drawn, there)).toBeLessThan(speed * DT * 2 + 0.05);
    }
  });

  it('stops on the next frame at a stop, where the server stops', () => {
    const h = served(150);
    h.run(1000);
    h.world.orderMove(h.champ.id, 50, 50);
    h.run(2500);
    h.world.orderStop(h.champ.id);
    const stopAt = h.now();
    const drawnAtStop = lastFrame(h.frames).drawn;
    h.run(3000);
    for (const f of h.frames) {
      if (f.at > stopAt + FRAME_MS) {
        expect(dist(f.drawn, drawnAtStop)).toBeLessThan(frameStep(h.champ.moveSpeed));
      }
    }
    expect(dist(drawnAtStop, h.champ.pos)).toBeLessThan(h.champ.moveSpeed * DT * 2 + 0.05);
    const end = lastFrame(h.frames);
    expect(dist(end.drawn, end.server)).toBeLessThan(0.01);
  });

  it('eases out what the client could not know, a root, and ends where the server ends', () => {
    const h = served(120);
    h.run(1000);
    h.world.orderMove(h.champ.id, 50, 50);
    h.run(1500);
    h.champ.statuses.push({ kind: 'root', until: h.sim.time + 1 });
    h.run(30_000);
    let worst = 0;
    for (let i = 1; i < h.frames.length; i++) {
      worst = Math.max(worst, dist(h.frames[i]!.drawn, h.frames[i - 1]!.drawn));
    }
    // The champion walked on for a trip before the root was told: it is
    // drawn walking back, over a few frames, never in one.
    expect(worst).toBeLessThan(0.25);
    const end = lastFrame(h.frames);
    expect(dist(h.champ.pos, { x: 50, z: 50 })).toBeLessThan(0.1);
    expect(dist(end.drawn, end.server)).toBeLessThan(0.01);
  });

  it('walks into range of what it attacks and stops there with the server', () => {
    const h = served(120);
    const foe = h.sim.addChampion(1);
    foe.pos = { x: h.champ.pos.x + 7, z: h.champ.pos.z + 7 };
    h.run(1000);
    expect(h.world.units.has(foe.id)).toBe(true);
    const start = { ...h.champ.pos };
    h.world.orderAttack(h.champ.id, foe.id);
    const clickAt = h.now();
    h.run(FRAME_MS * 2);
    const first = firstAfter(h.frames, clickAt).drawn;
    expect(dist(first, foe.pos)).toBeLessThan(dist(start, foe.pos));
    h.run(3000);
    const end = lastFrame(h.frames);
    expect(dist(end.drawn, end.server)).toBeLessThan(0.05);
    const edge = dist(end.drawn, foe.pos) - h.champ.radius - foe.radius;
    expect(edge).toBeLessThanOrEqual(h.champ.stats.attackRange + 0.2);
  });

  it('plants the champion on the next frame for a cast with a windup, as the server does', () => {
    const h = served(120, 'ashvyn');
    h.sim.setLevel(h.champ.id, 2);
    expect(h.sim.levelAbility(h.champ.id, 'Q')).toBe(true);
    h.run(1000);
    h.world.orderMove(h.champ.id, 50, 50);
    h.run(2000);
    const at = lastFrame(h.frames).drawn;
    h.world.castAbility(h.champ.id, 'Q', { x: at.x + 3, z: at.z + 3 });
    const castAt = h.now();
    h.run(2000);
    const step = frameStep(h.champ.moveSpeed);
    for (const f of h.frames)
      if (f.at > castAt + FRAME_MS) expect(dist(f.drawn, at)).toBeLessThan(step);
    // The server took the cast: it stands where the cast landed.
    expect(h.champ.cooldowns.Q ?? 0).toBeGreaterThan(0);
    const end = lastFrame(h.frames);
    expect(dist(end.drawn, end.server)).toBeLessThan(0.01);
  });

  it('draws what the server says while the champion is dead', () => {
    const h = served(120);
    h.run(500);
    h.champ.hp = 0;
    h.champ.dead = true;
    h.champ.respawnAt = h.sim.time + 30;
    h.run(500);
    expect(h.world.predictedPos(h.champ.id, h.now())).toBeNull();
  });
});

// An open corner of the Star Orchard by the top lane's bend: a straight
// walk of 20 m to the northwest with room either side of it, out of the
// enemy tower's reach, and no enemy wave there while these tests run.
const OPEN: Vec2 = { x: 20, z: 128 };
const NORTHWEST: Vec2 = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };

// A wall raised on the server as a cast raises one (src/sim/walls.ts):
// `ahead` meters along `way` from `from`, across it, `length` long.
function wallAcross(
  sim: Sim,
  from: Vec2,
  way: Vec2,
  ahead: number,
  length: number,
  seconds: number,
): void {
  const ctx = (sim as unknown as { ctx(): CombatCtx }).ctx();
  raiseWall(ctx, 0, 1, offset(from, way, ahead), way, length, seconds);
}

// The farthest one frame moved the drawn champion, from `from` on.
function worstStep(frames: Frame[], from: number): number {
  let worst = 0;
  for (let i = 1; i < frames.length; i++) {
    if (frames[i]!.at <= from) continue;
    worst = Math.max(worst, dist(frames[i]!.drawn, frames[i - 1]!.drawn));
  }
  return worst;
}

// The drawn champion against where the server's champion stands once an
// order sent at that frame lands, `upMs` on: the worst, over the frames
// from `from` on.
function worstLead(h: Connected, from: number, upMs: number): number {
  let worst = 0;
  for (const f of h.frames) {
    if (f.at < from || !f.ahead) continue;
    const there = h.serverAt(f.at + upMs);
    if (there) worst = Math.max(worst, dist(f.drawn, there));
  }
  return worst;
}

// The drawn champion settled where the server's champion stands.
function endsWithServer(h: Connected): void {
  const end = lastFrame(h.frames);
  expect(end.ahead).toBe(true);
  expect(dist(end.drawn, end.server)).toBeLessThan(0.01);
}

describe('the own champion on the Star Orchard, by the walls a cast raises', () => {
  const ONE_WAY = 250;

  it('walks round a wall standing across the way as the server does, without a jump', () => {
    const h = orchardServed(ONE_WAY, OPEN);
    const goal = offset(OPEN, NORTHWEST, 20);
    expect(h.sim.ground.lineOfWalk(OPEN, goal)).toBe(true);
    h.meddle(() => wallAcross(h.sim, OPEN, NORTHWEST, 4, 8, 20));
    h.run(1000);
    expect(h.world.walls.size).toBe(1);
    h.world.orderMove(h.champ.id, goal.x, goal.z);
    const clickAt = h.now();
    h.run(10_000);
    const speed = h.champ.moveSpeed;
    // The server's champion went round the wall, well off the straight way.
    let off = 0;
    for (const p of h.ticks.values()) {
      const side = NORTHWEST.x * (p.z - OPEN.z) - NORTHWEST.z * (p.x - OPEN.x);
      off = Math.max(off, Math.abs(side));
    }
    expect(off).toBeGreaterThan(3);
    // The way round searched as the server searches it: never a jump, and
    // drawn a trip ahead all along.
    expect(worstStep(h.frames, clickAt)).toBeLessThan(frameStep(speed));
    expect(worstLead(h, clickAt + 2 * ONE_WAY + 200, ONE_WAY)).toBeLessThan(speed * DT * 2 + 0.05);
    expect(dist(h.champ.pos, goal)).toBeLessThan(0.1);
    endsWithServer(h);
  });

  it('stops at a wall raised across its walk where the server stops, never through it', () => {
    const h = orchardServed(ONE_WAY, OPEN);
    h.run(500);
    const goal = offset(OPEN, NORTHWEST, 20);
    h.world.orderMove(h.champ.id, goal.x, goal.z);
    h.run(1500);
    // Where the server's champion stood as the wall rose.
    const rose: { at: Vec2 | null } = { at: null };
    h.meddle(() => {
      rose.at = { ...h.champ.pos };
      wallAcross(h.sim, h.champ.pos, NORTHWEST, 4, 12, 6);
    });
    h.run(DT * 1000);
    const raisedAt = h.now();
    h.run(3000);
    // The sim's walk stopped at the wall's face, its path dropped.
    expect(h.champ.path).toHaveLength(0);
    const from = rose.at!;
    const face = dist(from, h.champ.pos);
    expect(face).toBeGreaterThan(2);
    expect(face).toBeLessThan(4);
    // The drawing, a trip ahead when the wall rose, stopped there too once
    // told of it: never on the wall's ground, never walked on through it,
    // and past the server's stop by less than a tick's walk (between two
    // ticks the drawing takes part of the step the sim's next tick takes
    // whole, and clamps back at the wall's face).
    const tickWalk = h.champ.moveSpeed * DT;
    for (const f of h.frames) {
      if (f.at <= raisedAt) continue;
      expect(h.sim.ground.isWalkableAt(f.drawn)).toBe(true);
      expect(dist(from, f.drawn)).toBeLessThan(face + tickWalk);
    }
    expect(worstStep(h.frames, raisedAt)).toBeLessThan(frameStep(h.champ.moveSpeed));
    endsWithServer(h);
    // The wall falls: the walk the sim dropped is not taken up again.
    h.run(4000);
    expect(h.world.walls.size).toBe(0);
    endsWithServer(h);
    const settled = lastFrame(h.frames).drawn;
    h.run(2000);
    expect(dist(lastFrame(h.frames).drawn, settled)).toBeLessThan(0.01);
  });
});

describe('the server, for the prediction', () => {
  it('tells the walk: the speed once unrooted, the range, the path, the target, the dash', () => {
    const sim = new Sim(7);
    const champ = sim.addChampion(0);
    sim.orderMove(champ.id, 50, 50);
    champ.statuses.push({ kind: 'root', until: sim.time + 1 });
    const snap = buildSnapshot(sim, 0, champ.id, new Set(), [], { ack: 4, ackAt: 1.25 });
    if (snap.t !== 'snap' || !snap.self) throw new Error('no self');
    expect(snap.self.ms).toBeCloseTo(champ.moveSpeed, 2);
    expect(snap.self.rg).toBeCloseTo(champ.stats.attackRange, 2);
    expect(pathOfPairs(snap.self.path)).toEqual(
      champ.path.map((p) => ({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 })),
    );
    expect(snap.self.tgt).toBeUndefined();
    expect(snap.self.dash).toBeUndefined();
    expect(snap.self.ack).toBe(4);
    expect(snap.self.ackAt).toBe(1.25);
  });

  it("answers a seat's order numbers and keeps them out of the replay", () => {
    const match = new Match(3, [
      { clientId: 1, name: 'human', team: 0, championId: 'sylra', sigils: ['riftstep', 'mend'] },
    ]);
    const unitId = match.players.get(1)!.unitId;
    match.tick();
    match.handleCommand(1, { t: 'move', x: 50, z: 50, n: 7 });
    const at = match.sim.time;
    // An older number changes nothing, and an order without one neither.
    match.handleCommand(1, { t: 'move', x: 50, z: 50, n: 3 });
    match.handleCommand(1, { t: 'stop' });
    const snap = match.buildSnapshotFor(1);
    if (snap?.t !== 'snap' || !snap.self) throw new Error('no self');
    expect(snap.self.ack).toBe(7);
    expect(snap.self.ackAt).toBe(at);
    const cmds = match.replayEvents.filter((e) => e.e === 'cmd' && e.u === unitId);
    expect(cmds).toHaveLength(3);
    for (const e of cmds) expect(e.c).not.toHaveProperty('n');
  });
});
