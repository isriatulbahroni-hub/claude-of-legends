// The goal across battle royales said before the end card
// (src/ui/royale_goal_lines.ts): the one line of the wash of a Respawn
// death and the note under the points' pop in play.

import { describe, expect, it } from 'vitest';
import { GOAL_HEAD_START, GOAL_MAX_POINTS } from '../src/ui/royale_goal';
import { goalLine, goalPopNote, pointsText } from '../src/ui/royale_goal_lines';

describe('the line', () => {
  it('says the level and the points to the next, the bar as full as the card would draw it', () => {
    expect(goalLine(0)).toEqual({
      level: 1,
      next: 2,
      left: 50,
      share: GOAL_HEAD_START,
      text: 'Level 1 · 50 points to Level 2',
    });
    // Level 3 runs from 125 to 225.
    const l = goalLine(155);
    expect(l).toMatchObject({ level: 3, next: 4, left: 70 });
    expect(l.share).toBeCloseTo(0.3);
    expect(l.text).toBe('Level 3 · 70 points to Level 4');
  });

  it('says one point in the singular', () => {
    expect(goalLine(49).text).toBe('Level 1 · 1 point to Level 2');
    expect(pointsText(1)).toBe('1 point');
    expect(pointsText(0)).toBe('0 points');
  });

  it('reads junk as nothing and caps a stored total', () => {
    expect(goalLine(Number.NaN)).toEqual(goalLine(0));
    expect(goalLine(-30)).toEqual(goalLine(0));
    expect(goalLine(12.9)).toEqual(goalLine(12));
    expect(goalLine(GOAL_MAX_POINTS * 3)).toEqual(goalLine(GOAL_MAX_POINTS));
  });
});

describe('the note under the pop in play', () => {
  it('says where the points leave the bar', () => {
    expect(goalPopNote(20, 30)).toBe('20 to Level 2');
    expect(goalPopNote(124, 125)).toBe('Level 3 reached');
  });

  it('says the level reached, the highest, when one award climbs past two', () => {
    expect(goalPopNote(40, 130)).toBe('Level 3 reached');
  });

  it('agrees with the line the wash shows after it', () => {
    const after = 87;
    const line = goalLine(after);
    expect(goalPopNote(82, after)).toBe(`${line.left} to Level ${line.next}`);
  });
});

describe('the words', () => {
  it('names no ladder entry and no other player anywhere', () => {
    const words = [goalLine(300).text, goalPopNote(290, 300)].join(' ');
    expect(words).not.toMatch(/ladder|rank|place/i);
  });
});
