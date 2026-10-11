// A seat's strength and a Respawn drop-in's lift to the field
// (src/sim/royale/strength.ts; ADR 0031, amended 2026-10-11): the build's
// value is its items' costs, the stronger seat is the higher level, then the
// build worth more, then more Grafts; the lift raises the level to the
// field's lower median and walks the seat's own build, piece by piece as a
// cache pays it, until the bag is worth the field's lower median.

import { describe, expect, it } from 'vitest';
import { CHAMPIONS } from '../src/sim/content/champions';
import { ITEMS } from '../src/sim/content/items';
import { lowerMedian } from '../src/sim/royale/levels';
import { grantPiece, grantPieces, seatBuild } from '../src/sim/royale/loot';
import {
  buildValue,
  LIFT_PIECES_MAX,
  liftToField,
  seatStrength,
  strongerFirst,
} from '../src/sim/royale/strength';
import { levelTo } from '../src/sim/stats';
import { createChampion, type Unit } from '../src/sim/unit';

function champ(id: string, level = 3, pieces = 0): Unit {
  const u = createChampion(1, 0, { x: 0, z: 0 }, CHAMPIONS[id]!);
  u.gold = 0;
  levelTo(u, level);
  grantPieces(u, seatBuild(id), pieces);
  return u;
}

describe("a seat's strength", () => {
  it('values a build at its items cost, an unknown id at nothing', () => {
    expect(buildValue([])).toBe(0);
    expect(buildValue(['heart_gem', 'doombrand'])).toBe(
      ITEMS.heart_gem!.cost + ITEMS.doombrand!.cost,
    );
    expect(buildValue(['heart_gem', 'not_an_item'])).toBe(ITEMS.heart_gem!.cost);
  });

  it('reads level, build value and Grafts held off the champion', () => {
    const u = champ('fenn', 7, 3);
    u.grafts = ['a', 'b'];
    expect(seatStrength(u)).toEqual({ level: 7, build: buildValue(u.items), grafts: 2 });
  });

  it('ranks the higher level first, then the richer build, then more Grafts', () => {
    const s = (level: number, build: number, grafts: number) => ({ level, build, grafts });
    const sorted = [s(9, 1000, 0), s(9, 3000, 1), s(11, 0, 0), s(9, 3000, 2), s(8, 9000, 9)].sort(
      strongerFirst,
    );
    expect(sorted).toEqual([
      s(11, 0, 0),
      s(9, 3000, 2),
      s(9, 3000, 1),
      s(9, 1000, 0),
      s(8, 9000, 9),
    ]);
    expect(strongerFirst(s(5, 5, 5), s(5, 5, 5))).toBe(0);
  });
});

describe('the lift to the field', () => {
  // A field of eight seats, levels 4 to 11, each a few pieces into its own
  // build.
  const field = (): Unit[] =>
    ['dain', 'vesk', 'sylra', 'torv', 'rhoka', 'maera', 'korrath', 'elowen'].map((id, i) =>
      champ(id, 4 + i, 2 + i),
    );

  it("raises the level to the field's lower median, the points spent", () => {
    const others = field();
    const u = champ('fenn');
    liftToField(u, others, seatBuild('fenn'));
    expect(u.level).toBe(lowerMedian(others.map((o) => o.level)));
    expect(u.level).toBe(7);
    expect(u.skillPoints).toBe(0);
  });

  it("walks the seat's own build until it is worth the field's lower median", () => {
    const others = field();
    const target = lowerMedian(others.map((o) => buildValue(o.items)));
    const build = seatBuild('fenn');
    const u = champ('fenn');
    liftToField(u, others, build);
    expect(buildValue(u.items)).toBeGreaterThanOrEqual(target);
    // The same pieces a cache pays one at a time, and not one more.
    const walk = champ('fenn', u.level);
    let pieces = 0;
    while (buildValue(walk.items) < target) {
      expect(grantPiece(walk, build)).not.toBeNull();
      pieces++;
    }
    expect(pieces).toBeGreaterThan(0);
    expect(u.items).toEqual(walk.items);
    expect(u.maxHp).toBe(walk.maxHp);
  });

  it('keeps a seat already at the field, level and build', () => {
    const others = field();
    const u = champ('fenn', 12, 12);
    const items = [...u.items];
    const xp = u.xp;
    liftToField(u, others, seatBuild('fenn'));
    expect(u.level).toBe(12);
    expect(u.xp).toBe(xp);
    expect(u.items).toEqual(items);
  });

  it('lifts the build alone for a seat above the level, under the build', () => {
    const others = field();
    const u = champ('fenn', 12);
    liftToField(u, others, seatBuild('fenn'));
    expect(u.level).toBe(12);
    expect(buildValue(u.items)).toBeGreaterThanOrEqual(
      lowerMedian(others.map((o) => buildValue(o.items))),
    );
  });

  it('stops at a finished build, and does nothing with no field', () => {
    // A field of finished builds worth more than the seat's whole build.
    const rich = ['dain', 'torv', 'korrath'].map((id) => champ(id, 9, LIFT_PIECES_MAX));
    for (const o of rich) o.items = [...o.items, 'doombrand', 'doombrand'];
    const u = champ('sylra');
    liftToField(u, rich, seatBuild('sylra'));
    const done = champ('sylra', u.level, LIFT_PIECES_MAX);
    expect(u.items).toEqual(done.items);
    expect(grantPiece(u, seatBuild('sylra'))).toBeNull();

    const alone = champ('fenn');
    liftToField(alone, [], seatBuild('fenn'));
    expect(alone.level).toBe(3);
    expect(alone.items).toEqual([]);
  });
});
