// Crews (CONTEXT.md: Crew; ADR 0034): a battle royale of Trios or Fives
// seats its champions in crews, the sim's teams (ADR 0030): seat i on crew
// floor(i / size), so a match's crews are whole and in seat order. A crew
// shares its sight and never hurts itself (the sim's team rules); the mode
// keeps it together: its champions land around one pick (crewLeaders,
// crewLandings), a crew with a person in it meets a crew of house bots at
// the landing (escortCrewLandings), a champion back from a Respawn fall or
// arriving comes down beside a crewmate standing clear of any fight
// (besideCrew), a Respawn crew scores every takedown its champions land and
// the best crew wins (crewStandings), a One life crew is out once its last
// champion fell and the last crew standing wins (mode.ts). Pure over plain
// records; every draw from the match's stream, and none in Solo.

import { dist2, type Vec3 } from '../geo';
import type { Rng } from '../rng';
import { deepInLight, snapLanding } from './drop';
import { along, type RoyaleGround, type RoyaleLayout, randomHeading } from './layout';
import type { Standing } from './score';
import { type DuskCap, ROYALE_SEATS, type RoyaleCrew, TRIO_SEATS } from './types';

// The crew sizes a match is played in, Solo first.
export const ROYALE_CREWS: readonly RoyaleCrew[] = [1, 3, 5];

export function isRoyaleCrew(v: unknown): v is RoyaleCrew {
  return v === 1 || v === 3 || v === 5;
}

// The seats of a match of this crew size: fifty, Trios forty-eight.
export function crewSeats(crew: RoyaleCrew): number {
  return crew === 3 ? TRIO_SEATS : ROYALE_SEATS;
}

// The crew (the sim's team) a seat sits in.
export function crewOfSeat(seat: number, crew: RoyaleCrew): number {
  return Math.floor(seat / crew);
}

// How many crews this many seats make.
export function crewCount(seats: number, crew: RoyaleCrew): number {
  return Math.max(1, Math.ceil(seats / crew));
}

// A seat as the crews' rules read it at the landing.
export interface CrewSeat {
  id: number;
  team: number;
  // Played by a person (no policy).
  person: boolean;
}

// Each crew's leader, by team: whose pick the crew lands around. The
// crew's first person (lowest unit id) who picked, else its first seat
// that picked, else its first seat.
export function crewLeaders(
  seats: readonly CrewSeat[],
  picks: ReadonlyMap<number, Vec3>,
): Map<number, number> {
  const rank = (s: CrewSeat): number => (picks.has(s.id) ? 0 : 2) + (s.person ? 0 : 1);
  const best = new Map<number, CrewSeat>();
  for (const s of seats) {
    const had = best.get(s.team);
    if (!had || rank(s) < rank(had) || (rank(s) === rank(had) && s.id < had.id)) {
      best.set(s.team, s);
    }
  }
  const out = new Map<number, number>();
  for (const team of [...best.keys()].sort((a, b) => a - b)) out.set(team, best.get(team)!.id);
  return out;
}

// How far around its leader's landing a crew's champion comes down.
export const CREW_LAND_MIN_M = 3;
export const CREW_LAND_MAX_M = 6;

// A point CREW_LAND_MIN_M to CREW_LAND_MAX_M from `at`, at a drawn
// heading, snapped to walkable ground; null when the ground gives none.
function besidePoint(rng: Rng, at: Vec3, layout: RoyaleLayout, ground: RoyaleGround) {
  const reach = CREW_LAND_MIN_M + (CREW_LAND_MAX_M - CREW_LAND_MIN_M) * rng.next();
  return snapLanding(along(at, randomHeading(rng, at), reach, layout.radius), layout, ground);
}

// Moves every champion but the leader beside its leader's landing, in the
// order given (the sim passes unit ids ascending).
export function crewLandings(
  seats: readonly CrewSeat[],
  leaders: ReadonlyMap<number, number>,
  landings: Map<number, Vec3>,
  rng: Rng,
  layout: RoyaleLayout,
  ground: RoyaleGround,
): void {
  for (const s of seats) {
    const leader = leaders.get(s.team);
    if (leader === undefined || leader === s.id) continue;
    const at = landings.get(leader);
    if (!at) continue;
    const p = besidePoint(rng, at, layout, ground);
    if (p) landings.set(s.id, p);
  }
}

// Company at the landing, the crews' way (drop.ts escortLandings is
// Solo's): one crew of house bots comes down ESCORT_CREW_MIN_M to
// ESCORT_CREW_MAX_M from each crew with a person in it, its leader there
// and its champions around it, so the first fight finds them within
// seconds, crew against crew.
export const ESCORT_CREW_MIN_M = 18;
export const ESCORT_CREW_MAX_M = 24;

export function escortCrewLandings(
  groups: readonly { person: number; bots: readonly number[] }[],
  seats: readonly CrewSeat[],
  leaders: ReadonlyMap<number, number>,
  landings: Map<number, Vec3>,
  rng: Rng,
  layout: RoyaleLayout,
  ground: RoyaleGround,
): void {
  for (const { person, bots } of groups) {
    const ownLeader = leaders.get(person);
    const from = ownLeader === undefined ? undefined : landings.get(ownLeader);
    if (!from) continue;
    for (const team of bots) {
      const leader = leaders.get(team);
      if (leader === undefined) continue;
      const reach = ESCORT_CREW_MIN_M + (ESCORT_CREW_MAX_M - ESCORT_CREW_MIN_M) * rng.next();
      const spot = along(from, randomHeading(rng, from), reach, layout.radius);
      const at = snapLanding(spot, layout, ground);
      if (!at) continue;
      landings.set(leader, at);
      for (const s of seats) {
        if (s.team !== team || s.id === leader) continue;
        const p = besidePoint(rng, at, layout, ground);
        if (p) landings.set(s.id, p);
      }
    }
  }
}

// Beside the crew: a crew's champion back from a Respawn fall with no pick
// of its own, or arriving, comes down CREW_LAND_MIN_M to CREW_LAND_MAX_M
// from a crewmate standing deep inside the light (drop.ts deepInLight)
// with no enemy within CREW_CLEAR_M of it, the spot as deep and as clear:
// the crewmates weighed in the order given (the mode passes unit ids
// ascending), CREW_SIDE_TRIES draws each. Null when none will do: a
// crewmate in a fight is not joined at its side.
export const CREW_CLEAR_M = 12;
export const CREW_SIDE_TRIES = 6;

export function besideCrew(
  rng: Rng,
  cap: DuskCap,
  mates: readonly Vec3[],
  enemies: readonly Vec3[],
  layout: RoyaleLayout,
  ground: RoyaleGround,
): Vec3 | null {
  const R = layout.radius;
  const clear2 = CREW_CLEAR_M * CREW_CLEAR_M;
  const clear = (p: Vec3): boolean => !enemies.some((e) => dist2(e, p) <= clear2);
  for (const m of mates) {
    if (!deepInLight(cap, m, R) || !clear(m)) continue;
    for (let i = 0; i < CREW_SIDE_TRIES; i++) {
      const p = besidePoint(rng, m, layout, ground);
      if (p && deepInLight(cap, p, R) && clear(p)) return p;
    }
  }
  return null;
}

// Respawn's crews as standings (score.ts compareStanding ranks them): each
// crew's score, its champions' deaths summed, its team for the id.
export function crewStandings(
  champions: readonly { team: number; deaths: number }[],
  scores: ReadonlyMap<number, number>,
): Standing[] {
  const deaths = new Map<number, number>();
  for (const c of champions) deaths.set(c.team, (deaths.get(c.team) ?? 0) + c.deaths);
  return [...deaths.keys()]
    .sort((a, b) => a - b)
    .map((team) => ({ id: team, score: scores.get(team) ?? 0, deaths: deaths.get(team) ?? 0 }));
}

// Every champion in the order of its crew (`crewOrder`, best first; a crew
// missing from it after the rest, by team), and within a crew by `within`.
export function byCrews(
  crewOrder: readonly number[],
  champions: readonly { id: number; team: number }[],
  within: (a: number, b: number) => number,
): number[] {
  const place = new Map<number, number>();
  crewOrder.forEach((team, i) => {
    if (!place.has(team)) place.set(team, i);
  });
  const of = (team: number): number => place.get(team) ?? crewOrder.length + team;
  return [...champions]
    .sort((a, b) => of(a.team) - of(b.team) || within(a.id, b.id))
    .map((c) => c.id);
}
