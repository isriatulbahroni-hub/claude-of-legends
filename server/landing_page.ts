// The landing's one request (ADR 0033): the ladder a visitor reads before
// anything else, which is the ladder of every human (ADR 0027): the
// accounts and the Guests with points, ranked by them, names and numbers
// only. Beside it, the own panel (CONTEXT.md: Own panel): who the reader
// is, their place and points, the level those points stand at, their
// Respawn best, and the line just above with how far ahead it is; and the
// week: the rotation, the starters, and when the week turns. The bot
// ladders stay inside the home and the Academy, where their owners read
// them.
//
// The route hands a visitor with no account its Guest before building this
// (server/main.ts handGuest), so the reader is always someone; own is null
// only when no reader is given. Pure over the same lines /api/public/ladder
// ranks (server/points_ladder.ts), so the two never disagree.

import { goalStep } from '../src/ui/royale_goal';
import { rotationAt, STARTER_COLLECTION, WEEK_MS, weekIndex } from './laurels';
import {
  buildPointsLadder,
  type PointsEntry,
  type PointsLadder,
  placedLines,
} from './points_ladder';
import { wholeBest } from './royale_ranking';

// Every line on the ladder, which the landing's list scrolls through: its
// top ten hid everybody else (the maintainer, 2026-10-02). A ceiling far
// above today's count bounds what one landing load carries.
export const LANDING_LADDER_ROWS = 500;

// The reader, as the route found them: an account, or the Guest it handed
// out. The key finds their line and never leaves the server.
export interface LandingOwnInput {
  key: number;
  name: string;
  // A Guest wearing a name it chose; always true for an account.
  named: boolean;
  account: boolean;
  // The Respawn best kept on the line.
  best: number;
  // When the account or the Guest was made.
  since: number;
}

export interface LandingInput {
  entries: readonly PointsEntry[];
  own: LandingOwnInput | null;
  now: number;
}

export interface LandingOpts {
  rows?: number;
}

// The level the line's points stand at (src/ui/royale_goal.ts goalStep,
// the one curve): the level, its first point, and the next level's.
export interface LandingLevel {
  level: number;
  from: number;
  to: number;
}

// The line just above the reader's, and the points that pass it: one
// more than the difference, or the difference itself when the reader's
// line is the older, which wins a tie.
export interface LandingAbove {
  rank: number;
  name: string;
  points: number;
  gap: number;
}

export interface LandingOwn {
  name: string;
  named: boolean;
  account: boolean;
  // Null until the first points.
  rank: number | null;
  points: number;
  level: LandingLevel;
  best: number;
  // Null at the top, and off the ladder.
  above: LandingAbove | null;
  since: number;
}

// The week every player picks from (ADR 0018): the rotation, the starter
// collection, and the moment the rotation turns.
export interface LandingWeek {
  rotation: string[];
  starters: string[];
  turnsAt: number;
}

export interface LandingPage {
  ladder: PointsLadder;
  own: LandingOwn | null;
  week: LandingWeek;
}

function ownOf(entries: readonly PointsEntry[], own: LandingOwnInput): LandingOwn {
  const placed = placedLines(entries);
  const i = placed.findIndex((e) => e.key === own.key);
  const line = i < 0 ? undefined : placed[i];
  const next = i > 0 ? placed[i - 1] : undefined;
  const points = line?.points ?? 0;
  const step = goalStep(points);
  let above: LandingAbove | null = null;
  if (line && next) {
    const tie = line.since < next.since ? 0 : 1;
    above = {
      rank: i,
      name: next.name,
      points: next.points,
      gap: Math.max(1, next.points - points + tie),
    };
  }
  return {
    name: own.name,
    named: own.named,
    account: own.account,
    rank: line ? i + 1 : null,
    points,
    level: { level: step.level, from: step.from, to: step.to },
    best: wholeBest(own.best),
    above,
    since: own.since,
  };
}

export function buildLandingPage(input: LandingInput, opts: LandingOpts = {}): LandingPage {
  const { entries, own, now } = input;
  const reader = own
    ? { key: own.key, name: own.name, guest: !own.account, named: own.named }
    : null;
  return {
    ladder: buildPointsLadder(entries, reader, opts.rows ?? LANDING_LADDER_ROWS),
    own: own ? ownOf(entries, own) : null,
    week: {
      rotation: rotationAt(now),
      starters: [...STARTER_COLLECTION],
      turnsAt: (weekIndex(now) + 1) * WEEK_MS,
    },
  };
}
