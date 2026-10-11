// The Upstart (CONTEXT.md; src/sim/royale/upstart.ts): a Respawn champion
// that comes down into the running match (a drop-in's Arrival, a return)
// with no takedown on its tally hits champions UPSTART_DAMAGE harder until
// its first takedown, its fall, or UPSTART_S after it came down, a bot's
// seat as a person's; the match's landing gives none, One life has none.
// Its end sets the champion's damage back to the very number it was, and
// the world checkpoint carries it.

import { describe, expect, it } from 'vitest';
import { dealDamage } from '../src/sim/combat/damage';
import { CALM_S, DROP_S } from '../src/sim/royale/types';
import { hasUpstart, UPSTART_DAMAGE, UPSTART_S } from '../src/sim/royale/upstart';
import type { Sim } from '../src/sim/sim';
import type { CombatCtx } from '../src/sim/sim_context';
import type { Unit } from '../src/sim/unit';
import { landed } from './royale_contract_fixture';

function ctxOf(sim: Sim): CombatCtx {
  return (sim as unknown as { ctx(): CombatCtx }).ctx();
}

function tickUntil(sim: Sim, t: number): void {
  while (sim.time < t - 1e-9) sim.tick();
}

// A seat of a landed match down and back on the next tick (the respawn
// loop), `kills` takedowns on its tally; the others as they landed.
function returned(kills: number) {
  const built = landed('respawn');
  const { sim, unitIds } = built;
  const [foe, u, other] = [0, 1, 2].map((i) => sim.units.get(unitIds[i]!)!) as [Unit, Unit, Unit];
  const base = u.dmgScale;
  u.kills = kills;
  u.dead = true;
  u.hp = 0;
  u.respawnAt = sim.time;
  const backAt = sim.time;
  sim.tick();
  return { sim, u, foe, other, base, backAt };
}

// The health a true hit of `amount` from `source` takes off `target`.
function hitFor(sim: Sim, source: Unit, target: Unit, amount: number): number {
  const before = target.hp;
  dealDamage(ctxOf(sim), source.id, target, amount, 'true');
  const lost = before - target.hp;
  target.hp = before;
  return lost;
}

// The taker's last hit, and the tick that settles the fall.
function takedown(sim: Sim, taker: Unit, victim: Unit): void {
  dealDamage(ctxOf(sim), taker.id, victim, victim.maxHp * 10, 'true');
  sim.tick();
}

describe('the Upstart', () => {
  it('comes with a Respawn return that has no takedown on its tally', () => {
    const { sim, u, foe, base, backAt } = returned(0);
    expect(u.dead).toBe(false);
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(true);
    expect(sim.royaleMode!.upstarts.get(u.id)).toEqual({ until: backAt + UPSTART_S, base });
    expect(u.dmgScale).toBeCloseTo(base * (1 + UPSTART_DAMAGE), 12);
    // Its hits on a champion land that much harder, and only while it lasts.
    const edged = hitFor(sim, u, foe, 100);
    tickUntil(sim, backAt + UPSTART_S + 0.1);
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(false);
    expect(u.dmgScale).toBe(base);
    expect(edged / hitFor(sim, u, foe, 100)).toBeCloseTo(1 + UPSTART_DAMAGE, 9);
  });

  it('lasts until UPSTART_S after the return, no longer', () => {
    const { sim, u, backAt } = returned(0);
    tickUntil(sim, backAt + UPSTART_S - 0.1);
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(true);
    tickUntil(sim, backAt + UPSTART_S + 0.1);
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(false);
  });

  it('never comes with a return that has a takedown on its tally', () => {
    const { sim, u, base } = returned(1);
    expect(u.dead).toBe(false);
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(false);
    expect(u.dmgScale).toBe(base);
    expect(sim.royaleMode!.tally.upstarts).toBe(0);
  });

  it('ends at its first takedown, its damage back to the very number it was', () => {
    const { sim, u, foe, base } = returned(0);
    const tally = sim.royaleMode!.tally;
    expect([tally.upstarts, tally.upstartTakedowns]).toEqual([1, 0]);
    takedown(sim, u, foe);
    expect(foe.dead).toBe(true);
    expect(u.kills).toBe(1);
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(false);
    expect(u.dmgScale).toBe(base);
    expect([tally.upstarts, tally.upstartTakedowns]).toEqual([1, 1]);
  });

  it('ends at its fall, and a takedown by another leaves it on', () => {
    const { sim, u, foe, other, base } = returned(0);
    takedown(sim, other, foe);
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(true);
    // Past the return's Grace, which spares it.
    tickUntil(sim, sim.time + 4);
    takedown(sim, other, u);
    expect(u.dead).toBe(true);
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(false);
    expect(u.dmgScale).toBe(base);
  });

  it('is carried by the world checkpoint', () => {
    const { sim, u, foe, base } = returned(0);
    const snap = sim.snapshot();
    takedown(sim, u, foe);
    expect(u.dmgScale).toBe(base);
    sim.restore(snap);
    const back = sim.units.get(u.id)!;
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(true);
    expect(back.dmgScale).toBeCloseTo(base * (1 + UPSTART_DAMAGE), 12);
    takedown(sim, back, sim.units.get(foe.id)!);
    expect(back.dmgScale).toBe(base);
  });

  it('comes with a Respawn Arrival, whose tally starts from zero', () => {
    const { sim, unitIds } = landed('respawn');
    // The match's landing gives none.
    expect(sim.royaleMode!.upstarts.size).toBe(0);
    const u = sim.units.get(unitIds[1]!)!;
    const base = u.dmgScale;
    u.kills = 5;
    sim.beginArrival(u.id);
    expect(u.kills).toBe(0);
    expect(hasUpstart(sim.royaleMode!, u.id)).toBe(true);
    expect(u.dmgScale).toBeCloseTo(base * (1 + UPSTART_DAMAGE), 12);
  });

  it('never comes in One life', () => {
    const { sim, unitIds } = landed('one_life');
    expect(sim.time).toBeLessThan(DROP_S + CALM_S);
    const u = sim.units.get(unitIds[1]!)!;
    const base = u.dmgScale;
    sim.beginArrival(u.id);
    expect(sim.royale!.arriving.has(u.id)).toBe(true);
    expect(sim.royaleMode!.upstarts.size).toBe(0);
    expect(u.dmgScale).toBe(base);
  });
});
