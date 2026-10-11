// The home's panels (CONTEXT.md: Home): what a signed-in account reads
// under the play tiles. The top of the ladder by hand, the top bots, the
// latest champions out of the Forge, and the reader's own numbers (the
// places, the career, the line's points and Respawn best), in one
// answer, so the home makes one request rather than six and never carries
// a gallery's worth of definitions to draw six cards. Pure over the same
// seeds, stats, rows and career the ladder page, the gallery and the
// profile read, so every number on the home is pinned by tests.

import { validateForged } from '../src/sim/forge/validate';
import type { ForgedRow } from './forge_store';
import {
  buildLadderPage,
  type LadderPageRow,
  type LadderSeed,
  type Place,
  placeOf,
} from './ladder_page';
import type { ProfileStats } from './profile';
import { wholeBest } from './royale_ranking';
import type { WayStats } from './way_stats';
import type { Way } from './ways';

export const HOME_LADDER_ROWS = 5;
export const HOME_BOT_ROWS = 5;
export const HOME_FORGED_CARDS = 6;

// A ladder row with the reader's own marked, so the client needs no id to
// find itself.
export type HomeLadderRow = LadderPageRow & { mine: boolean };

// A bot row names its champion outright: the ladder row's favorite is the
// same champion by construction (a bot plays one), but a row that has to
// be inferred is a row that will be read wrong one day.
export type HomeBotRow = HomeLadderRow & { championId: string | null };

export interface HomeForgedCard {
  id: string;
  name: string;
  title: string;
  role: string;
  creator: string;
  // The sealed splash, relative to the assets route; null when none.
  splash: string | null;
  likes: number;
  updatedAt: number;
  mine: boolean;
}

export interface HomeCareer {
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  // The champion most played by hand, with its games.
  favorite: { championId: string; games: number } | null;
  // When the last match by hand ended; null before the first.
  lastAt: number | null;
}

// The reader's line of the ladder of every human (ADR 0027): its points,
// which the level reads on the one curve (src/ui/royale_goal.ts goalStep)
// as the landing's own panel reads them (ADR 0033), and its Respawn best.
// What the greeting on Respawn's card says (src/ui/royale_goal_lines.ts).
export interface HomeLine {
  points: number;
  best: number;
}

export interface HomeMe {
  places: Record<Way, Place>;
  career: HomeCareer;
  // The reader's bots, and how many of them stand in the Arena's pool.
  bots: { total: number; ranked: number };
  // The reader's sealed champions.
  forged: number;
  line: HomeLine;
}

export interface HomePage {
  ladder: { way: 'hand'; total: number; rows: HomeLadderRow[] };
  // The Arena's top when it has placed any bot, the live way's otherwise.
  bots: { way: 'arena' | 'bot'; total: number; rows: HomeBotRow[] };
  forged: HomeForgedCard[];
  me: HomeMe;
}

export type ForgedListing = ForgedRow & { likes: number };

export interface HomeInput {
  // The seeds and the stats of one way, exactly as the ladder page reads
  // them; asked for a way only when the home draws it.
  seeds: (way: Way) => readonly LadderSeed[];
  stats: (way: Way) => ReadonlyMap<string | number, WayStats>;
  // Every finalized champion standing, with its likes.
  forged: readonly ForgedListing[];
  // The reader's own career by hand.
  career: ProfileStats;
  // The reader's bots: whether each stands in the Arena's pool.
  myBots: readonly { deposited: boolean }[];
  // The reader's points and Respawn best as the account keeps them.
  line: { points: number; best: number };
}

export interface HomeOpts {
  splash?: (row: ForgedRow) => string | null;
  ladderRows?: number;
  botRows?: number;
  forgedCards?: number;
}

function mark<T extends LadderPageRow>(
  rows: readonly T[],
  readerId: number,
): (T & { mine: boolean })[] {
  return rows.map((r) => ({ ...r, mine: r.accountId === readerId }));
}

// The latest champions out of the Forge, as the gallery lists them: the
// listed ones, the reader's own whether listed or not, none that no longer
// fits the Forge rules (it reaches no match, so it is nobody's to meet).
export function latestForged(
  rows: readonly ForgedListing[],
  readerId: number,
  splash: (row: ForgedRow) => string | null,
  cap: number,
): HomeForgedCard[] {
  return rows
    .filter((r) => r.status === 'finalized' && !r.takenDown)
    .filter((r) => r.listed || r.accountId === readerId)
    .filter((r) => validateForged(r.def).ok)
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
    .slice(0, cap)
    .map((r) => ({
      id: r.id,
      name: r.def.name,
      title: r.def.title,
      role: r.def.role,
      creator: r.def.creator,
      splash: splash(r),
      likes: r.likes,
      updatedAt: r.updatedAt,
      mine: r.accountId === readerId,
    }));
}

export function careerOf(p: ProfileStats): HomeCareer {
  const top = p.perChampion[0];
  return {
    games: p.games,
    wins: p.wins,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    favorite: top ? { championId: top.championId, games: top.games } : null,
    lastAt: p.recent[0]?.at ?? null,
  };
}

export function buildHomePage(input: HomeInput, readerId: number, opts: HomeOpts = {}): HomePage {
  // A way's seeds are read once however many panels want them.
  const seedsOf = new Map<Way, readonly LadderSeed[]>();
  const seeds = (way: Way): readonly LadderSeed[] => {
    let s = seedsOf.get(way);
    if (!s) {
      s = input.seeds(way);
      seedsOf.set(way, s);
    }
    return s;
  };

  const hand = buildLadderPage('hand', seeds('hand'), input.stats('hand'), readerId, {
    cap: opts.ladderRows ?? HOME_LADDER_ROWS,
  });

  // The Arena is the competition that runs whether or not anyone queues,
  // so its top is the one to show; until it has placed a bot, the bots
  // placed live stand in rather than an empty panel beside a full ladder.
  const botCap = opts.botRows ?? HOME_BOT_ROWS;
  let botWay: 'arena' | 'bot' = 'arena';
  let bots = buildLadderPage('arena', seeds('arena'), input.stats('arena'), readerId, {
    cap: botCap,
  });
  if (bots.total === 0) {
    const live = buildLadderPage('bot', seeds('bot'), input.stats('bot'), readerId, {
      cap: botCap,
    });
    if (live.total > 0) {
      botWay = 'bot';
      bots = live;
    }
  }
  const championOf = new Map<string | number, string>();
  for (const s of seeds(botWay)) if (s.championId) championOf.set(s.id, s.championId);

  const places = {} as Record<Way, Place>;
  for (const way of ['hand', 'bot', 'arena', 'forge'] as const) {
    places[way] = placeOf(seeds(way), readerId);
  }

  return {
    ladder: { way: 'hand', total: hand.total, rows: mark(hand.rows, readerId) },
    bots: {
      way: botWay,
      total: bots.total,
      rows: mark(bots.rows, readerId).map((r) => ({
        ...r,
        championId: championOf.get(r.id) ?? null,
      })),
    },
    forged: latestForged(
      input.forged,
      readerId,
      opts.splash ?? (() => null),
      opts.forgedCards ?? HOME_FORGED_CARDS,
    ),
    me: {
      places,
      career: careerOf(input.career),
      bots: {
        total: input.myBots.length,
        ranked: input.myBots.filter((b) => b.deposited).length,
      },
      forged: input.forged.filter((r) => r.accountId === readerId && r.status === 'finalized')
        .length,
      line: lineOf(input.line),
    },
  };
}

// The line as the home says it: whole points from zero, the best as the
// line keeps it (server/royale_ranking.ts wholeBest).
export function lineOf(line: HomeInput['line']): HomeLine {
  const p = line.points;
  const points = typeof p === 'number' && Number.isFinite(p) ? Math.max(0, Math.floor(p)) : 0;
  return { points, best: wholeBest(line.best) };
}
