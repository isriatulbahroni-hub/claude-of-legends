// The goal across battle royales (ui/royale_goal.ts) said before the end
// card, so the levels are in sight while they are earned: the one line on
// the wash of a Respawn death, the note under the points' pop in play, the
// note on the end card's Play the next match, and the greeting a browser
// that has played before meets on the landing and on the home's battle
// royale card. Pure, read off the total this browser keeps
// (game/settings.ts royaleGoal); ui/royale_goal_line.ts draws the line
// with its small bar.

import { GOAL_MAX_POINTS, type GoalModel, goalShare, goalStep } from './royale_goal';

// Where a total stands: the level, the next one, the points still wanted
// for it, how full the level's bar is (0 to 1, the first from its head
// start, as on the card), and the words.
export interface GoalLine {
  level: number;
  next: number;
  left: number;
  share: number;
  text: string;
}

const whole = (points: number): number =>
  Number.isFinite(points) ? Math.max(0, Math.min(GOAL_MAX_POINTS, Math.floor(points))) : 0;

// "70 points", "1 point".
export function pointsText(n: number): string {
  return `${n} ${n === 1 ? 'point' : 'points'}`;
}

// "Level 3 · 70 points to Level 4".
export function goalLine(total: number): GoalLine {
  const points = whole(total);
  const step = goalStep(points);
  const left = step.to - points;
  return {
    level: step.level,
    next: step.level + 1,
    left,
    share: goalShare(points, step),
    text: `Level ${step.level} · ${pointsText(left)} to Level ${step.level + 1}`,
  };
}

// Under the pop as points land in a battle royale (ui/points_text.ts
// popText says what they were for): where they leave the bar, or the level
// they reached. Short, since it comes out beside the corner's box.
export function goalPopNote(before: number, after: number): string {
  const was = goalStep(whole(before));
  const now = goalStep(whole(after));
  if (now.level > was.level) return `Level ${now.level} reached`;
  return `${now.to - whole(after)} to Level ${now.level + 1}`;
}

// Under the end card's Play the next match: the points the next level
// still wants. Null when the card shows no goal.
export function nextMatchNote(goal: GoalModel | null): string | null {
  return goal ? `${pointsText(goal.left)} to Level ${goal.next}` : null;
}

// What this browser remembers of the battle royale (game/settings.ts): the
// points, the best Respawn tally, and the quick pick, which is kept on the
// Play that starts a first match (main.ts pickForRoyale).
export interface GoalMemory {
  royaleGoal: number;
  royaleBest: number;
  royalePick: unknown;
}

export const WELCOME_BACK = 'Welcome back';

// The greeting's line, for a browser that has played a battle royale
// before; null for one that never has, which reads the planet's own
// words instead.
export function goalWelcome(memory: GoalMemory): GoalLine | null {
  const played =
    whole(memory.royaleGoal) > 0 || whole(memory.royaleBest) > 0 || memory.royalePick != null;
  return played ? goalLine(memory.royaleGoal) : null;
}
