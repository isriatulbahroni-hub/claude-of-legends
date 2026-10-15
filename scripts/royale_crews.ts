// What a battle royale of house bots looks like in each crew size (ADR
// 0034): plays N seeds of each variant and crew size headless on the
// Wanderseed, every seat a house bot, and prints per match and on average
// how long it ran, the takedowns, how close each champion kept to its
// crew (of every standing champion's seconds, the share with a crewmate
// standing within the regroup leash, bot/brain.ts REGROUP_M, a champion
// left alone counting as apart; and the median distance to the nearest
// crewmate standing, over the seconds one stands, every match's seconds
// pooled in the summary), and the end: One life's crews still in by
// minute and the winning crew's champions standing; Respawn's best two
// crew scores and the spread of the crews' scores.
//
//   node scripts/royale_crews.mjs [--seeds 3] [--from 1]
//     [--variant both|respawn|one_life] [--crews 1,3,5]

import { readFileSync } from 'node:fs';
import { buildRoyaleSim, type ReplayPick, type RoyalePlanet } from '../src/net/replay';
import { assemblePlanet } from '../src/sim/content/planet';
import { dist, type Vec3 } from '../src/sim/geo';
import { SphereGround } from '../src/sim/ground';
import { REGROUP_M } from '../src/sim/royale/bot/brain';
import { crewOfSeat, crewSeats, isRoyaleCrew } from '../src/sim/royale/crews';
import { royaleHouseChampions } from '../src/sim/royale/fill';
import { DROP_S, type RoyaleCrew, type RoyaleVariant } from '../src/sim/royale/types';
import { decodeSphereNav, findSpherePath, SphereNavGrid } from '../src/sim/sphere_nav';
import { TICK_RATE } from '../src/sim/types';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string): string => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1]! : fallback;
};
const seeds = Number(opt('--seeds', '3'));
const firstSeed = Number(opt('--from', '1'));
const variantArg = opt('--variant', 'both');
const variants: RoyaleVariant[] =
  variantArg === 'respawn' || variantArg === 'one_life' ? [variantArg] : ['respawn', 'one_life'];
const crews: RoyaleCrew[] = opt('--crews', '1,3,5').split(',').map(Number).filter(isRoyaleCrew);

function loadPlanet(dir = 'public/map/planet/'): RoyalePlanet {
  const planet = assemblePlanet(JSON.parse(readFileSync(`${dir}layout.json`, 'utf8')));
  const bin = readFileSync(`${dir}navigation.bin`);
  const buffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
  const data = decodeSphereNav(planet.nav, buffer);
  return {
    layout: planet,
    ground: () => new SphereGround(new SphereNavGrid(data), findSpherePath),
  };
}

interface Match {
  variant: RoyaleVariant;
  crew: RoyaleCrew;
  seed: number;
  duration: number;
  takedowns: number;
  // Of every standing champion's sampled seconds, the share with a
  // crewmate standing within REGROUP_M (alone counts as apart); the
  // distances to the nearest one standing, and their median.
  together: number;
  nearest: number[];
  nearestMedian: number;
  // One life: crews (or champions in Solo) still in at each minute, and
  // the winning crew's champions standing at the end.
  inByMin: number[];
  winnersStanding: number;
  // Respawn: the best two crew scores (champion scores in Solo), and the
  // crews' scores from best to worst.
  scores: number[];
}

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

function play(planet: RoyalePlanet, variant: RoyaleVariant, crew: RoyaleCrew, seed: number): Match {
  const n = crewSeats(crew);
  const picks: ReplayPick[] = royaleHouseChampions(seed, n).map((championId, i) => ({
    name: `house${i}`,
    team: crewOfSeat(i, crew),
    championId,
    sigils: ['riftstep', 'mend'],
    bot: 'royale',
  }));
  const { sim } = buildRoyaleSim(planet, seed, picks, variant, { crew });
  const mode = sim.royaleMode!;
  const champions = () => [...sim.units.values()].filter((u) => u.kind === 'champion');
  let near = 0;
  let sampled = 0;
  const nearest: number[] = [];
  const inByMin: number[] = [];
  while (mode.state.stage !== 'over') {
    sim.tick();
    if (mode.state.stage !== 'play' || sim.tickCount % TICK_RATE !== 0) continue;
    const standing = champions().filter((u) => !u.dead);
    if (crew > 1) {
      for (const u of standing) {
        let best = Number.POSITIVE_INFINITY;
        for (const o of standing) {
          if (o.id === u.id || o.team !== u.team) continue;
          best = Math.min(best, dist(u.pos as Vec3, o.pos as Vec3));
        }
        sampled++;
        if (!Number.isFinite(best)) continue;
        if (best <= REGROUP_M) near++;
        nearest.push(best);
      }
    }
    const minute = Math.floor((sim.time - DROP_S) / 60);
    if (variant === 'one_life' && inByMin[minute] === undefined) {
      inByMin[minute] = new Set(standing.map((u) => u.team)).size;
    }
  }
  const s = mode.state;
  const scores =
    crew > 1
      ? [...new Set(champions().map((u) => u.team))].map((t) => s.crewScores.get(t) ?? 0)
      : champions().map((u) => s.scores.get(u.id) ?? 0);
  scores.sort((a, b) => b - a);
  return {
    variant,
    crew,
    seed,
    duration: sim.time - DROP_S,
    takedowns: mode.tally.takedowns,
    together: sampled > 0 ? near / sampled : Number.NaN,
    nearest,
    nearestMedian: median(nearest),
    inByMin,
    winnersStanding: champions().filter((u) => !u.dead && u.team === s.winnerTeam).length,
    scores,
  };
}

const clock = (t: number): string =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const pct = (x: number): string => (Number.isNaN(x) ? '-' : `${Math.round(x * 100)}%`);
const name = (crew: RoyaleCrew): string => (crew === 1 ? 'Solo' : crew === 3 ? 'Trios' : 'Fives');

const planet = loadPlanet();
const all: Match[] = [];
for (const variant of variants) {
  for (const crew of crews) {
    for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
      const m = play(planet, variant, crew, seed);
      all.push(m);
      const end =
        variant === 'one_life'
          ? `in by minute ${m.inByMin.join(' ')}, winners standing ${m.winnersStanding}`
          : `best ${m.scores[0]} and ${m.scores[1]}, median ${median(m.scores)}`;
      console.log(
        `${variant} ${name(crew)} seed ${seed}: over at ${clock(m.duration)}, ` +
          `${m.takedowns} takedowns, together ${pct(m.together)} ` +
          `(nearest crewmate ${Number.isNaN(m.nearestMedian) ? '-' : `${m.nearestMedian.toFixed(1)} m`}), ${end}`,
      );
    }
  }
}
console.log('\nsummary');
for (const variant of variants) {
  for (const crew of crews) {
    const ms = all.filter((m) => m.variant === variant && m.crew === crew);
    if (ms.length === 0) continue;
    const avg = (f: (m: Match) => number): number => ms.reduce((a, m) => a + f(m), 0) / ms.length;
    const extra =
      variant === 'one_life'
        ? `winners standing ${avg((m) => m.winnersStanding).toFixed(1)}`
        : `best ${avg((m) => m.scores[0] ?? 0).toFixed(1)}, second ${avg((m) => m.scores[1] ?? 0).toFixed(1)}`;
    console.log(
      `  ${variant} ${name(crew)}: over at ${clock(avg((m) => m.duration))}, ` +
        `${avg((m) => m.takedowns).toFixed(0)} takedowns, together ${pct(avg((m) => m.together))}, ` +
        `nearest crewmate ${median(ms.flatMap((m) => m.nearest)).toFixed(1)} m (median), ${extra}`,
    );
  }
}
