// The goal across matches (src/ui/royale_goal.ts): the points on the
// browser's line of the ladder, climbed as levels on Respawn's end card,
// the bar from the last level reached to the next, starting partly filled,
// and the count kept as the points come, anchored to the line's total.

import { describe, expect, it } from 'vitest';
import {
  GOAL_FIRST_SPAN,
  GOAL_HEAD_START,
  GOAL_MAX_POINTS,
  GOAL_SPAN_GROWTH,
  GoalTrack,
  goalModel,
  goalShare,
  goalStep,
} from '../src/ui/royale_goal';

describe('the levels', () => {
  it('start at level 1, a first match away from level 2, each span a little longer', () => {
    expect(goalStep(0)).toEqual({ level: 1, from: 0, to: GOAL_FIRST_SPAN });
    expect(goalStep(GOAL_FIRST_SPAN - 1).level).toBe(1);
    expect(goalStep(GOAL_FIRST_SPAN)).toEqual({
      level: 2,
      from: GOAL_FIRST_SPAN,
      to: 2 * GOAL_FIRST_SPAN + GOAL_SPAN_GROWTH,
    });
    // 50, 125, 225, 350: three takedowns and five assists alone (55) are a
    // level at first; a full match later is about one.
    expect([50, 125, 225, 350].map((p) => goalStep(p).level)).toEqual([2, 3, 4, 5]);
    expect([49, 124, 224, 349].map((p) => goalStep(p).level)).toEqual([1, 2, 3, 4]);
  });

  it('reads junk as nothing and caps a stored total', () => {
    expect(goalStep(-40).level).toBe(1);
    expect(goalStep(Number.NaN).level).toBe(1);
    expect(goalStep(GOAL_MAX_POINTS * 10)).toEqual(goalStep(GOAL_MAX_POINTS));
  });

  it('fills the first bar from a head start, every later one from empty', () => {
    expect(goalShare(0, goalStep(0))).toBe(GOAL_HEAD_START);
    expect(goalShare(25, goalStep(25))).toBeCloseTo(GOAL_HEAD_START + (1 - GOAL_HEAD_START) / 2);
    expect(goalShare(50, goalStep(50))).toBe(0);
    expect(goalShare(87.5, goalStep(87.5))).toBeCloseTo(0.5);
  });
});

describe('the card', () => {
  it("shows a first match's points on a bar that started partly filled", () => {
    const g = goalModel(0, 34);
    expect(g).toMatchObject({ level: 1, next: 2, reached: null, earned: 34, left: 16 });
    expect(g.was).toBe(GOAL_HEAD_START);
    expect(g.now).toBeGreaterThan(g.was);
    expect(g.title).toBe('Level 1');
    expect(g.line).toBe('+34 points this match · 16 more to Level 2');
  });

  it('carries the bar from where the last match left it', () => {
    const g = goalModel(70, 30);
    expect(g).toMatchObject({ level: 2, next: 3, reached: null, left: 25 });
    expect(g.was).toBeCloseTo(20 / 75);
    expect(g.now).toBeCloseTo(50 / 75);
  });

  it('says the level a match reached, the bar starting on its floor', () => {
    const g = goalModel(40, 100);
    expect(g).toMatchObject({ level: 3, next: 4, reached: 3, left: 85 });
    expect(g.was).toBe(0);
    expect(g.now).toBeCloseTo(15 / 100);
    expect(g.title).toBe('Level 3 reached');
    expect(g.line).toBe('+100 points this match · 85 more to Level 4');
  });

  it('says a match without points plainly, one point in the singular', () => {
    expect(goalModel(10, 0).line).toBe('No points this match · 40 more to Level 2');
    expect(goalModel(10, 1).line).toBe('+1 point this match · 39 more to Level 2');
    expect(goalModel(10, -5).earned).toBe(0);
  });
});

describe('the count', () => {
  it('reads the total once, writes it as each award comes, and models the match', () => {
    let stored = 60;
    const reads: number[] = [];
    const track = new GoalTrack(
      () => {
        reads.push(stored);
        return stored;
      },
      (total) => {
        stored = total;
      },
    );
    track.earn(10);
    track.earn(5);
    track.earn(0);
    track.earn(-3);
    expect(stored).toBe(75);
    expect(reads).toEqual([60]);
    expect(track.model()).toMatchObject({ earned: 15, level: 2, left: 50 });
  });

  it('says the total as it stands, before the card and without another read', () => {
    let stored = 40;
    let reads = 0;
    const track = new GoalTrack(
      () => {
        reads += 1;
        return stored;
      },
      (total) => {
        stored = total;
      },
    );
    expect(track.total()).toBe(40);
    track.earn(10);
    expect(track.total()).toBe(50);
    expect(reads).toBe(1);
  });
});

describe('the count on the line', () => {
  // A track whose browser read `stored` before the match, and what it wrote.
  const tracked = (stored: number) => {
    const writes: number[] = [];
    const track = new GoalTrack(
      () => stored,
      (total) => {
        writes.push(total);
      },
    );
    return { track, writes };
  };

  it("anchors the level to the line's total as the points land", () => {
    const { track, writes } = tracked(0);
    track.earn(10, 310);
    const step = goalStep(310);
    expect(step.level).toBe(4);
    expect(track.model()).toMatchObject({ level: step.level, earned: 10, reached: null });
    expect(track.model().was).toBeCloseTo(goalShare(300, step));
    expect(track.model().now).toBeCloseTo(goalShare(310, step));
    expect(writes).toEqual([310]);
  });

  it('stays anchored as the next points come', () => {
    const { track, writes } = tracked(0);
    track.earn(10, 310);
    track.earn(5, 315);
    expect(writes).toEqual([310, 315]);
    expect(track.model()).toMatchObject({ earned: 15, level: 4, left: 35 });
    expect(track.total()).toBe(315);
  });

  it('follows the line when the browser read another total before', () => {
    const { track, writes } = tracked(900);
    track.earn(10, 40);
    expect(writes).toEqual([40]);
    expect(track.model()).toMatchObject({ level: 1, earned: 10, left: 10 });
  });

  it('keeps the count from the read when a message carries no total', () => {
    const { track, writes } = tracked(60);
    track.earn(10);
    track.earn(5, Number.NaN);
    expect(writes).toEqual([70, 75]);
    expect(track.total()).toBe(75);
    const anchored = tracked(0);
    anchored.track.earn(10, 310);
    anchored.track.earn(5);
    expect(anchored.writes).toEqual([310, 315]);
  });

  it('ignores an award of nothing, total or not', () => {
    const { track, writes } = tracked(60);
    track.earn(0, 500);
    track.earn(-3, 500);
    expect(writes).toEqual([]);
    expect(track.total()).toBe(60);
  });

  it('clamps a total below the points earned at 0', () => {
    const { track, writes } = tracked(80);
    track.earn(20, 5);
    expect(track.model()).toMatchObject({ earned: 20, level: 1 });
    expect(track.model().was).toBe(GOAL_HEAD_START);
    expect(writes).toEqual([20]);
    expect(track.total()).toBe(20);
  });

  it('says the total as before plus the points earned, capped', () => {
    const { track } = tracked(30);
    expect(track.total()).toBe(30);
    track.earn(12);
    expect(track.total()).toBe(42);
    track.earn(5, GOAL_MAX_POINTS * 3);
    expect(track.total()).toBe(GOAL_MAX_POINTS);
  });
});
