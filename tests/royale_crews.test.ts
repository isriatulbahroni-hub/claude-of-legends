// Crews (ADR 0034, src/sim/royale/crews.ts): the seats of each crew size,
// the crews' leaders and their landing together, a return or an Arrival
// beside a crewmate clear of any fight, the crews' standings and ranking;
// and matches on the real planet: one team per crew, the crews landing
// together, One life played to the last crew standing, Respawn's crews
// scoring every takedown their champions land, the same match from the
// same seed.

import { describe, expect, it } from 'vitest';
import { royaleFactory } from '../server/royale_build';
import { RoyaleMatch } from '../server/royale_match';
import type { RoyalePerson } from '../server/royale_seats';
import { buildRoyaleSim, type ReplayPick } from '../src/net/replay';
import { dist, type Vec3 } from '../src/sim/geo';
import { Rng } from '../src/sim/rng';
import {
  besideCrew,
  byCrews,
  CREW_CLEAR_M,
  CREW_LAND_MAX_M,
  CREW_LAND_MIN_M,
  crewCount,
  crewLeaders,
  crewOfSeat,
  crewSeats,
  crewStandings,
  isRoyaleCrew,
} from '../src/sim/royale/crews';
import { startFlight } from '../src/sim/royale/pads';
import { DROP_S, type DuskCap, TRIO_SEATS } from '../src/sim/royale/types';
import type { Sim } from '../src/sim/sim';
import type { Unit } from '../src/sim/unit';
import { fakeGround, fakeLayout, R, sph } from './royale_fixture';
import { loadPlanet } from './royale_planet';

const layout = fakeLayout();
const whole: DuskCap = { center: sph(1, 0, 0), radius: 2 * R };

describe('crew sizes', () => {
  it('seats fifty in Solo and Fives, forty-eight in sixteen Trios', () => {
    expect(crewSeats(1)).toBe(50);
    expect(crewSeats(5)).toBe(50);
    expect(crewSeats(3)).toBe(TRIO_SEATS);
    expect(crewCount(48, 3)).toBe(16);
    expect(crewCount(50, 5)).toBe(10);
    expect(crewCount(50, 1)).toBe(50);
    expect([0, 1, 2, 3, 5, 47].map((i) => crewOfSeat(i, 3))).toEqual([0, 0, 0, 1, 1, 15]);
    expect([0, 4, 5, 49].map((i) => crewOfSeat(i, 5))).toEqual([0, 0, 1, 9]);
    expect([0, 7].map((i) => crewOfSeat(i, 1))).toEqual([0, 7]);
    expect([1, 3, 5].every(isRoyaleCrew)).toBe(true);
    expect([0, 2, 4, '3', null].some(isRoyaleCrew)).toBe(false);
  });
});

describe('the crews at the landing', () => {
  it('lands each crew around its first person who picked, else its first seat that picked', () => {
    const seats = [
      { id: 1, team: 0, person: false },
      { id: 2, team: 0, person: true },
      { id: 3, team: 0, person: true },
      { id: 4, team: 1, person: false },
      { id: 5, team: 1, person: false },
      { id: 6, team: 2, person: false },
    ];
    const picks = new Map<number, Vec3>([
      [1, sph(1, 0, 0)],
      [3, sph(0, 0, 1)],
      [5, sph(-1, 0, 0)],
    ]);
    // Crew 0: the person who picked; crew 1: the seat that picked; crew 2:
    // its first seat, landing at a quiet spot.
    expect([...crewLeaders(seats, picks)]).toEqual([
      [0, 3],
      [1, 5],
      [2, 6],
    ]);
  });
});

describe('beside the crew', () => {
  const mate = sph(1, 0.1, 0.05);

  it('comes down a few steps from a crewmate standing clear of any fight', () => {
    const at = besideCrew(new Rng(3), whole, [mate], [sph(-1, 0, 0)], layout, fakeGround);
    expect(at).not.toBeNull();
    const d = dist(at!, mate);
    expect(d).toBeGreaterThanOrEqual(CREW_LAND_MIN_M - 0.05);
    expect(d).toBeLessThanOrEqual(CREW_LAND_MAX_M + 0.05);
  });

  it('never beside a crewmate with an enemy in reach, nor with no crewmate', () => {
    const foe = sph(1, 0.1, 0.12);
    expect(dist(foe, mate)).toBeLessThan(CREW_CLEAR_M);
    expect(besideCrew(new Rng(3), whole, [mate], [foe], layout, fakeGround)).toBeNull();
    expect(besideCrew(new Rng(3), whole, [], [], layout, fakeGround)).toBeNull();
  });

  it('passes over a crewmate outside the light for the next one', () => {
    const lit: DuskCap = { center: sph(0, 0, -1), radius: 30 };
    const inside = sph(0.05, 0, -1);
    const at = besideCrew(new Rng(4), lit, [mate, inside], [], layout, fakeGround);
    expect(at).not.toBeNull();
    expect(dist(at!, inside)).toBeLessThanOrEqual(CREW_LAND_MAX_M + 0.05);
  });
});

describe('the crews ranked', () => {
  it('scores a crew by its takedowns, its champions deaths summed', () => {
    const champions = [
      { team: 0, deaths: 2 },
      { team: 1, deaths: 1 },
      { team: 0, deaths: 3 },
    ];
    expect(crewStandings(champions, new Map([[1, 4]]))).toEqual([
      { id: 0, score: 0, deaths: 5 },
      { id: 1, score: 4, deaths: 1 },
    ]);
  });

  it('ranks every champion with its crew, in the crews order', () => {
    const champions = [
      { id: 1, team: 0 },
      { id: 2, team: 0 },
      { id: 3, team: 1 },
      { id: 4, team: 1 },
      { id: 5, team: 2 },
    ];
    const within = (a: number, b: number): number => b - a;
    expect(byCrews([1, 0], champions, within)).toEqual([4, 3, 2, 1, 5]);
  });
});

const PICKS = 12;

function picks(n: number): ReplayPick[] {
  const roster = ['dain', 'sylra', 'torv', 'vesk', 'maera', 'fenn'];
  return Array.from({ length: n }, (_, i) => ({
    name: `seat${i}`,
    team: i,
    championId: roster[i % roster.length]!,
    sigils: ['riftstep', 'mend'],
    bot: 'royale',
  }));
}

const person: RoyalePerson = {
  clientId: 1,
  owner: 1,
  name: 'p1',
  guest: true,
  pick: { championId: 'dain', sigils: ['riftstep', 'mend'], skin: 0 },
};

function crewMatch(
  variant: 'respawn' | 'one_life',
  seed: number,
): { match: RoyaleMatch; sim: Sim } {
  const match = new RoyaleMatch(1, seed, variant, [person], royaleFactory(loadPlanet), PICKS, 3);
  // The person's seat played by the bot, so the match plays itself out.
  match.leave(1, false);
  return { match, sim: match.sim as unknown as Sim };
}

function teamsOf(sim: Sim): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const u of sim.units.values()) {
    if (u.kind !== 'champion') continue;
    out.set(u.team, [...(out.get(u.team) ?? []), u.id]);
  }
  return out;
}

describe('a match in crews', () => {
  it('seats one team per crew and records the size', () => {
    const { sim, unitIds } = buildRoyaleSim(loadPlanet(), 5, picks(PICKS), 'one_life', {
      crew: 3,
    });
    expect(sim.teamCount).toBe(4);
    expect(unitIds.map((id) => sim.units.get(id)!.team)).toEqual([
      0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3,
    ]);
    expect(sim.royaleMode!.crew).toBe(3);
    expect(sim.royale!.crew).toBe(3);
    const build = royaleFactory(loadPlanet)(5, 'respawn', [], 5);
    expect(build.replay.royale.crew).toBe(5);
    expect(royaleFactory(loadPlanet)(5, 'respawn', []).replay.royale.crew).toBeUndefined();
  });

  it('lands every crew together', () => {
    const { match, sim } = crewMatch('one_life', 21);
    while (sim.royale!.stage === 'drop') match.tick();
    for (const ids of teamsOf(sim).values()) {
      const at = ids.map((id) => sim.units.get(id)!.pos as Vec3);
      for (const a of at)
        for (const b of at) expect(dist(a, b)).toBeLessThan(2 * CREW_LAND_MAX_M + 6);
    }
  });

  it('plays One life to the last crew standing', { timeout: 120_000 }, () => {
    const { match, sim } = crewMatch('one_life', 13);
    const outs: { unitId: number; place: number }[] = [];
    while (sim.royale!.stage !== 'over' && sim.time < DROP_S + 700) {
      for (const e of match.tick()) if (e.type === 'royale_out') outs.push(e);
    }
    const r = sim.royale!;
    expect(r.stage).toBe('over');
    expect(r.winnerTeam).not.toBeNull();
    expect(sim.units.get(r.winnerId!)!.team).toBe(r.winnerTeam);
    // Every other crew is out, each told once per champion with its place.
    expect(r.crewsOut).toHaveLength(3);
    expect(new Set([...r.crewsOut, r.winnerTeam])).toEqual(new Set([0, 1, 2, 3]));
    const teams = teamsOf(sim);
    r.crewsOut.forEach((team, i) => {
      const told = outs.filter((o) => teams.get(team)!.includes(o.unitId));
      expect(told.map((o) => o.unitId).sort()).toEqual([...teams.get(team)!].sort());
      expect(new Set(told.map((o) => o.place))).toEqual(new Set([4 - i]));
    });
    // Nobody of a crew out stands; the ranking keeps every crew together.
    for (const u of sim.units.values()) {
      if (u.kind === 'champion' && !u.dead) expect(u.team).toBe(r.winnerTeam);
    }
    const ranking = sim.royaleMode!.ranking(sim);
    const order = ranking.map((id) => sim.units.get(id)!.team);
    expect(order.slice(0, 3)).toEqual([r.winnerTeam, r.winnerTeam, r.winnerTeam]);
    expect(order.filter((t, i) => i === 0 || order[i - 1] !== t)).toHaveLength(4);
  });

  it('scores Respawn crews by every takedown their champions land', { timeout: 120_000 }, () => {
    const { match, sim } = crewMatch('respawn', 17);
    while (sim.royale!.stage !== 'over') match.tick();
    const r = sim.royale!;
    let total = 0;
    for (const [team, ids] of teamsOf(sim)) {
      const own = ids.reduce((n, id) => n + (r.scores.get(id) ?? 0), 0);
      expect(r.crewScores.get(team) ?? 0).toBe(own);
      total += own;
    }
    expect(total).toBeGreaterThan(0);
    const best = Math.max(...[...r.crewScores.values()]);
    expect(r.crewScores.get(r.winnerTeam!)).toBe(best);
    expect(sim.units.get(r.winnerId!)!.team).toBe(r.winnerTeam);
  });

  it('brings a Respawn return beside a crewmate on the ground, never one a pad carries', () => {
    const { match, sim } = crewMatch('respawn', 23);
    while (sim.time < DROP_S + 3) match.tick();
    const mode = sim.royaleMode!;
    const crew = teamsOf(sim)
      .get(1)!
      .map((id) => sim.units.get(id)!);
    const [back, flier, other] = crew as [Unit, Unit, Unit];
    // Its one crewmate standing is in a pad's flight; nobody else is near.
    other.dead = true;
    for (const u of sim.units.values()) {
      if (u.kind === 'champion' && u.team !== 1) u.dead = true;
    }
    const pad = mode.state.pads[0]!;
    mode.flights.set(flier.id, startFlight(flier.id, pad, flier.pos as Vec3, sim.time));
    const at = mode.respawnPoint(back, sim)!;
    expect(dist(at, flier.pos as Vec3)).toBeGreaterThan(CREW_LAND_MAX_M + 0.5);
    // On the ground again, the return comes down beside it.
    mode.flights.delete(flier.id);
    const beside = mode.respawnPoint(back, sim)!;
    expect(dist(beside, flier.pos as Vec3)).toBeLessThanOrEqual(CREW_LAND_MAX_M + 0.1);
  });

  it('is the same match from the same seed', () => {
    const run = (): number => {
      const { match, sim } = crewMatch('respawn', 29);
      while (sim.time < DROP_S + 60) match.tick();
      return sim.checksum();
    };
    expect(run()).toBe(run());
  });
});
