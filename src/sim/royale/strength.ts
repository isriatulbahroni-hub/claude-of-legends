// A seat's strength in the battle royale (ADR 0031, amended 2026-10-11: a
// drop-in arrives already fed): its level, the value of its build (the
// cost of every item in its bag, content/items.ts, the 5v5 shop's prices,
// which the planet never charges), and the Grafts it holds. A Respawn
// drop-in takes the strongest standing seat of the champion it picked
// (server/royale_join.ts chooseBotSeat), and its Arrival lifts that seat to
// the middle of the field at least (grace.ts arrive, liftToField): its level
// to the lower median of every other seat's (the fallen too), its points
// spent; then, when its build is worth less than the lower median of every
// other seat's, the next pieces of its own build, each as a cache pays it
// (loot.ts grantPiece), until it is worth as much or the build is done.
// Nothing is offered or announced for what was lifted: no Graft for the
// levels (the Arrival's Bough stays its one offer), no loot line for the
// pieces. Pure over the champions it is handed.

import { ITEMS } from '../content/items';
import { levelTo } from '../stats';
import type { Unit } from '../unit';
import { arrivalLevel, lowerMedian, spendSkillPoints } from './levels';
import { grantPiece } from './loot';

// What the items in a bag are worth: the sum of their costs.
export function buildValue(items: readonly string[]): number {
  let value = 0;
  for (const id of items) value += ITEMS[id]?.cost ?? 0;
  return value;
}

export interface SeatStrength {
  level: number;
  // buildValue of its bag.
  build: number;
  // The Grafts it holds.
  grafts: number;
}

export function seatStrength(u: Pick<Unit, 'level' | 'items' | 'grafts'>): SeatStrength {
  return { level: u.level, build: buildValue(u.items), grafts: u.grafts.length };
}

// The stronger first: the higher level, then the build worth more, then
// more Grafts held; zero for two seats alike.
export function strongerFirst(a: SeatStrength, b: SeatStrength): number {
  return b.level - a.level || b.build - a.build || b.grafts - a.grafts;
}

// The most pieces a lift gives, a bound past any build: a whole planet
// build takes 21 to 25 pieces from an empty bag (content/royale_builds.ts).
export const LIFT_PIECES_MAX = 40;

// A Respawn drop-in's seat lifted to the field (every other seat, the
// fallen too): its level to the field's lower median at least, its points
// spent, then the next pieces of `build` until its bag is worth the field's
// lower median build value. A seat already there keeps what it has.
export function liftToField(
  u: Unit,
  field: readonly Pick<Unit, 'level' | 'items'>[],
  build: readonly string[],
): void {
  if (u.kind !== 'champion' || field.length === 0) return;
  levelTo(
    u,
    arrivalLevel(
      u.level,
      field.map((o) => o.level),
    ),
  );
  spendSkillPoints(u);
  const target = lowerMedian(field.map((o) => buildValue(o.items)));
  for (let i = 0; i < LIFT_PIECES_MAX && buildValue(u.items) < target; i++) {
    if (grantPiece(u, build) === null) return;
  }
}
