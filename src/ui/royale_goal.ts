// A goal across matches, on Respawn's end card: the points on this
// browser's line of the ladder (ADR 0033), the 5v5's and the battle
// royale's alike, climbed as levels, the bar running from the last level
// reached to the next. The total is the line's: every points message
// carries it and the count anchors to it, and the browser keeps the last
// one read (game/settings.ts royaleGoal) as the cache a match reads before
// its first points message. The card names nobody: not a ladder entry, not
// another player. Pure; ui/royale_goal_bar.ts draws it, ui/hud.ts counts
// the points as they come, and ui/royale_goal_lines.ts says it before the
// card.
//
// The 5v5's points bank on the same line (server/points.ts). The battle
// royale's are the ones a seat banks (server/royale_points.ts): a
// champion taken down 10, an assist 5, a camp's last hit or a cache opened
// 1, a big creature 15, Respawn's best score 50 at the end, each doubled
// while another person plays the match. A few minutes' play earns a
// few, a match played through 50 to 250 (three takedowns and five assists
// alone are 55), so the first level is a match's worth and each after it
// asks a little more.

// The points from level 1 to level 2, and how much longer each next span is.
export const GOAL_FIRST_SPAN = 50;
export const GOAL_SPAN_GROWTH = 25;
// The first bar starts this much filled, so a first card never shows an
// empty goal; the points it asks for stay the same.
export const GOAL_HEAD_START = 0.2;
// A stored total past this is junk, not points.
export const GOAL_MAX_POINTS = 10_000_000;

// A level's span: the level, its first point, and the next level's.
export interface GoalStep {
  level: number;
  from: number;
  to: number;
}

export function goalStep(points: number): GoalStep {
  const p = Math.max(0, Math.min(GOAL_MAX_POINTS, Math.floor(points)));
  let level = 1;
  let from = 0;
  let span = GOAL_FIRST_SPAN;
  while (p >= from + span) {
    from += span;
    level += 1;
    span += GOAL_SPAN_GROWTH;
  }
  return { level, from, to: from + span };
}

// How full the bar of a step stands at `points`, 0 to 1: the share of the
// span, the first level's from its head start.
export function goalShare(points: number, step: GoalStep): number {
  const raw = Math.min(1, Math.max(0, (points - step.from) / (step.to - step.from)));
  return step.level === 1 ? GOAL_HEAD_START + (1 - GOAL_HEAD_START) * raw : raw;
}

// What the card shows.
export interface GoalModel {
  // The level stood at now, and the one the bar runs to.
  level: number;
  next: number;
  // A level reached this match (the highest), else null.
  reached: number | null;
  // The bar before this match's points and after them, 0 to 1, on the
  // step now shown: a level reached this match starts it from its floor.
  was: number;
  now: number;
  // This match's points, and those still wanted for the next level.
  earned: number;
  left: number;
  // The words: the level line over the bar and the line under it.
  title: string;
  line: string;
}

export function goalModel(before: number, earned: number): GoalModel {
  const from = Math.max(0, Math.min(GOAL_MAX_POINTS, Math.floor(before)));
  const gain = Math.max(0, Math.floor(earned));
  const after = Math.min(GOAL_MAX_POINTS, from + gain);
  const was = goalStep(from);
  const step = goalStep(after);
  const reached = step.level > was.level ? step.level : null;
  const left = step.to - after;
  const got =
    gain === 0 ? 'No points this match' : `+${gain} ${gain === 1 ? 'point' : 'points'} this match`;
  return {
    level: step.level,
    next: step.level + 1,
    reached,
    was: reached !== null ? goalShare(step.from, step) : goalShare(from, step),
    now: goalShare(after, step),
    earned: gain,
    left,
    title: reached !== null ? `Level ${reached} reached` : `Level ${step.level}`,
    line: `${got} · ${left} more to Level ${step.level + 1}`,
  };
}

// A total as the goal reads it: whole, 0 to the cap, junk as 0.
function clampPoints(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(GOAL_MAX_POINTS, Math.floor(v))) : 0;
}

// A match's count: the total before it, and the points its seat banks,
// written as they come so a tab closed mid-match keeps them. The total
// before is the browser's cache, read once when the match begins, until a
// points message carries the line's total: from then on it is that total
// less this match's points, anchored again on every message, so the bar
// is the line's whatever this browser last read.
export class GoalTrack {
  private before: number;
  private earned = 0;

  constructor(
    read: () => number,
    private readonly write: (total: number) => void,
  ) {
    this.before = clampPoints(read());
  }

  // One award: its points, and the line's total after it when the message
  // carries one. An award of nothing changes nothing.
  earn(delta: number, total?: number): void {
    if (!(delta > 0)) return;
    this.earned += Math.round(delta);
    if (typeof total === 'number' && Number.isFinite(total)) {
      this.before = clampPoints(total - this.earned);
    }
    this.write(this.total());
  }

  // The total as it stands, this match's points in it: what the wash of a
  // Respawn death and the points' pop say before the card
  // (ui/royale_goal_lines.ts).
  total(): number {
    return clampPoints(this.before + this.earned);
  }

  model(): GoalModel {
    return goalModel(this.before, this.earned);
  }
}
